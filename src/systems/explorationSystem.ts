import { getItemDefinition } from "../data/items";
import { getExploreEventsForRealmOrder } from "../data/exploreEvents";
import { getRealmById } from "../data/realms";
import type {
  BattleResult,
  ExploreEventDefinition,
  ExplorationResult,
  ItemCost,
  Player,
} from "../types/game";
import { startBattle } from "./battleSystem";
import { clampInjury } from "./injurySystem";
import { addItemStacks } from "./inventorySystem";
import { advanceTime } from "./timeSystem";

const randomInt = (min: number, max: number) =>
  min + Math.floor(Math.random() * (max - min + 1));

const chooseWeightedEvent = (events: ExploreEventDefinition[]) => {
  const totalWeight = events.reduce((sum, event) => sum + event.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const event of events) {
    roll -= event.weight;

    if (roll <= 0) {
      return event;
    }
  }

  return events[0];
};

const rollLoot = (event: ExploreEventDefinition): ItemCost[] =>
  event.lootTable
    .filter((drop) => Math.random() <= drop.chance)
    .map((drop) => ({
      itemId: drop.itemId,
      quantity: drop.quantity,
    }));

const formatLoot = (items: ItemCost[]) => {
  if (items.length === 0) {
    return "未获得额外物品";
  }

  return items
    .map((item) => `${getItemDefinition(item.itemId)?.name ?? item.itemId} x${item.quantity}`)
    .join("，");
};

/**
 * 探索三原语 + 组合壳：
 * rollExploreEvent 掷事件 → resolveExploreEvent（非遇袭原逻辑）/
 * resolveExploreAmbush（真战斗结算后归并）。
 * exploreSecretRealm 保留旧签名，字节级兼容冒烟：遇袭内部跑完一场战斗再归并。
 * App 侧遇袭改为先开真战斗（备战→开战→结算），胜败再走 resolveExploreAmbush。
 */

/** 掷一次探索事件（不结算）：App 侧遇袭据此转真战斗 */
export const rollExploreEvent = (
  player: Player,
  area?: string,
): ExploreEventDefinition =>
  chooseWeightedEvent(
    getExploreEventsForRealmOrder(getRealmById(player.realmId).order, area),
  );

/** 遇袭归并：战斗已由外部结算（player 为战前快照，battle.player 为战后），补心境与 2 日 */
export const resolveExploreAmbush = (
  player: Player,
  event: ExploreEventDefinition,
  battle: BattleResult,
  area?: string,
): ExplorationResult => {
  const mindGain = Math.random() <= event.mindChance ? 1 : 0;
  const nextPlayer = advanceTime(
    mindGain > 0
      ? {
          ...battle.player,
          attributes: {
            ...battle.player.attributes,
            mind: battle.player.attributes.mind + mindGain,
          },
        }
      : battle.player,
    2,
  );

  return {
    event,
    battle,
    player: nextPlayer,
    reward: {
      spiritStones: battle.reward.spiritStones,
      cultivation: battle.reward.cultivation,
      items: battle.reward.items,
      mind: mindGain,
      healthChange: nextPlayer.health.current - player.health.current,
      manaChange: 0,
    },
    logs: [
      event.description,
      ...battle.logs,
      mindGain > 0 ? "生死一瞬，你的心境有所提升" : "你稳住心神，继续前行",
    ],
    message: battle.victory
      ? `${area ?? "秘境"}伏击已化解，击败${battle.monster.name}`
      : `${area ?? "秘境"}遇险，被${battle.monster.name}逼退`,
  };
};

/** 非遇袭事件原逻辑：抽奖式收获，耗时 5 日 */
export const resolveExploreEvent = (
  player: Player,
  event: ExploreEventDefinition,
): ExplorationResult => {
  const realm = getRealmById(player.realmId);
  const healthChange = randomInt(event.healthChange[0], event.healthChange[1]);
  const manaChange = randomInt(event.manaChange[0], event.manaChange[1]);
  const spiritStones = randomInt(
    event.spiritStoneReward[0],
    event.spiritStoneReward[1],
  );
  const cultivation = randomInt(
    event.cultivationReward[0],
    event.cultivationReward[1],
  );
  const items = rollLoot(event);
  const mindGain = Math.random() <= event.mindChance ? 1 : 0;
  const injuryGain = event.injury ? randomInt(event.injury[0], event.injury[1]) : 0;
  const requiredCultivation = realm.breakthrough.requiredCultivation;
  const nextCultivation = Math.min(
    requiredCultivation,
    player.cultivation.current + cultivation,
  );
  const nextHealth = Math.max(
    1,
    Math.min(player.health.max, player.health.current + healthChange),
  );
  const nextMana = Math.max(
    0,
    Math.min(player.mana.max, player.mana.current + manaChange),
  );

  return {
    event,
    player: advanceTime({
      ...player,
      spiritStones: player.spiritStones + spiritStones,
      health: {
        ...player.health,
        current: nextHealth,
      },
      mana: {
        ...player.mana,
        current: nextMana,
      },
      attributes: {
        ...player.attributes,
        mind: player.attributes.mind + mindGain,
      },
      inventory: addItemStacks(player.inventory, items),
      injury: clampInjury(player.injury + injuryGain),
      cultivation: {
        current: nextCultivation,
        required: requiredCultivation,
        lastGain: cultivation,
      },
    }, 5),
    reward: {
      spiritStones,
      cultivation,
      items,
      mind: mindGain,
      healthChange,
      manaChange,
    },
    logs: [
      event.description,
      `修为 +${cultivation}，灵石 +${spiritStones}`,
      formatLoot(items),
      healthChange === 0 ? "气血无损" : `气血 ${healthChange > 0 ? "+" : ""}${healthChange}`,
      manaChange === 0 ? "灵力无损" : `灵力 ${manaChange > 0 ? "+" : ""}${manaChange}`,
      mindGain > 0 ? "心境 +1" : "心境未变",
      injuryGain === 0 ? "伤势未变" : `伤势 +${injuryGain}`,
    ],
    message: `${event.title}：探索有所收获`,
  };
};

/**
 * 旧组合壳：字节级兼容冒烟脚本（遇袭 = 内部跑完整场战斗再归并）。
 * App 侧已改用「roll → 遇袭转真战斗 → resolveExploreAmbush」，
 * 此壳仅保留给既有调用（smokeExplore 等）。
 */
export const exploreSecretRealm = (
  player: Player,
  area?: string,
): ExplorationResult => {
  const event = rollExploreEvent(player, area);

  if (event.type === "ambush") {
    return resolveExploreAmbush(player, event, startBattle(player, area), area);
  }

  return resolveExploreEvent(player, event);
};
