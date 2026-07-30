import { getItemDefinition } from "../data/items";
import { getExploreEventsForRealmOrder } from "../data/exploreEvents";
import { getRealmById } from "../data/realms";
import type {
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

export const exploreSecretRealm = (
  player: Player,
  area?: string,
): ExplorationResult => {
  const realm = getRealmById(player.realmId);
  const event = chooseWeightedEvent(
    getExploreEventsForRealmOrder(realm.order, area),
  );

  if (event.type === "ambush") {
    const battle = startBattle(player, area);
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
  }

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
