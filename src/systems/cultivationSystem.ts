import { getItemDefinition } from "../data/items";
import { getNextRealm, getRealmById } from "../data/realms";
import type {
  BreakthroughCheck,
  BreakthroughResult,
  Player,
} from "../types/game";
import { getEquipmentEffects } from "./equipmentSystem";
import { clampInjury, getInjuryPenalty } from "./injurySystem";
import {
  consumeItemCosts,
  formatItemCost,
  getInventoryQuantity,
  hasItemCosts,
} from "./inventorySystem";
import { getCaveLocation } from "./mapSystem";
import { getManualEffects } from "./manualSystem";
import { getSectPassiveBonuses } from "./sectSystem";
import { advanceTime, getGameDay } from "./timeSystem";

const clampChance = (chance: number) => Math.max(0.05, Math.min(0.95, chance));

export const getCultivationGain = (player: Player) => {
  const rootGain = player.attributes.rootBone * 2;
  const mindGain = Math.floor(player.attributes.mind / 2);
  const baseGain = 10 + rootGain + mindGain;
  const manualEffects = getManualEffects(player);
  // 洞府所在灵地的灵气加成（如紫雾灵山 ×1.25）
  const caveBonus = getCaveLocation(player)?.caveBonus ?? 1;
  // 伤势拖累吐纳：伤势 50 → 修炼效率 −20%
  const { cultivationMul } = getInjuryPenalty(player.injury);
  // 宗门所长：如青云门吐纳生生不息（随职位增长）
  const { cultivationBonus } = getSectPassiveBonuses(player);

  return Math.max(
    1,
    Math.floor(
      baseGain *
        player.spiritualRoot.cultivationMultiplier *
        (1 + manualEffects.cultivationBonus) *
        (1 + cultivationBonus) *
        caveBonus *
        cultivationMul,
    ),
  );
};

export const getBreakthroughChance = (player: Player) => {
  const realm = getRealmById(player.realmId);
  const manualEffects = getManualEffects(player);
  const attributeBonus =
    player.attributes.rootBone * 0.006 +
    player.attributes.comprehension * 0.004 +
    player.attributes.luck * 0.003 +
    player.spiritualRoot.breakthroughBonus +
    manualEffects.breakthroughBonus;

  return clampChance(realm.breakthrough.baseChance + attributeBonus);
};

export const getBreakthroughCheck = (player: Player): BreakthroughCheck => {
  const realm = getRealmById(player.realmId);
  const missingReasons: string[] = [];

  if (!realm.breakthrough.nextRealmId) {
    missingReasons.push("当前版本暂未开放更高境界");
  }

  if (player.cultivation.current < realm.breakthrough.requiredCultivation) {
    missingReasons.push(
      `修为不足：需要 ${realm.breakthrough.requiredCultivation}`,
    );
  }

  if (player.attributes.mind < realm.breakthrough.minMind) {
    missingReasons.push(`心境不足：需要 ${realm.breakthrough.minMind}`);
  }

  if (player.spiritStones < realm.breakthrough.spiritStoneCost) {
    missingReasons.push(`灵石不足：需要 ${realm.breakthrough.spiritStoneCost}`);
  }

  if (!hasItemCosts(player.inventory, realm.breakthrough.requiredItems)) {
    realm.breakthrough.requiredItems.forEach((cost) => {
      const owned = getInventoryQuantity(player.inventory, cost.itemId);

      if (owned < cost.quantity) {
        const item = getItemDefinition(cost.itemId);
        missingReasons.push(
          `${item?.name ?? cost.itemId}不足：需要 ${cost.quantity}`,
        );
      }
    });
  }

  return {
    canBreakthrough: missingReasons.length === 0,
    chance: getBreakthroughChance(player),
    missingReasons,
  };
};

export const cultivate = (player: Player): Player => {
  const realm = getRealmById(player.realmId);
  const gain = getCultivationGain(player);
  const nextCultivation = Math.min(
    realm.breakthrough.requiredCultivation,
    player.cultivation.current + gain,
  );

  // 打坐耗时 7 日：lastCultivateDay 取推进后的游戏日，使「今日打坐」目标即时可见
  const after = advanceTime({
    ...player,
    cultivation: {
      current: nextCultivation,
      required: realm.breakthrough.requiredCultivation,
      lastGain: gain,
    },
  }, 7);

  return {
    ...after,
    stats: {
      ...after.stats,
      lastCultivateDay: getGameDay(after),
    },
  };
};

export const getMindTrainingCost = (player: Player) => {
  const currentMind = player.attributes.mind;

  return {
    spiritStones: Math.max(3, currentMind * 2),
    cultivation: Math.max(20, currentMind * 8),
  };
};

export const trainMind = (player: Player) => {
  const cost = getMindTrainingCost(player);

  if (player.spiritStones < cost.spiritStones) {
    return {
      player,
      success: false,
      message: `灵石不足：静心参悟需要 ${cost.spiritStones}`,
    };
  }

  if (player.cultivation.current < cost.cultivation) {
    return {
      player,
      success: false,
      message: `修为不足：静心参悟需要 ${cost.cultivation}`,
    };
  }

  return {
    player: advanceTime({
      ...player,
      spiritStones: player.spiritStones - cost.spiritStones,
      attributes: {
        ...player.attributes,
        mind: player.attributes.mind + 1,
      },
      cultivation: {
        ...player.cultivation,
        current: player.cultivation.current - cost.cultivation,
        lastGain: 0,
      },
    }, 15),
    success: true,
    message: `静心参悟，心境提升至 ${player.attributes.mind + 1}`,
  };
};

export const useQiGatheringPill = (player: Player) => {
  const owned = getInventoryQuantity(player.inventory, "qi-gathering-pill");

  if (owned <= 0) {
    return {
      player,
      success: false,
      message: "没有可服用的聚气丹",
    };
  }

  const realm = getRealmById(player.realmId);
  const gain = Math.floor(80 * player.spiritualRoot.cultivationMultiplier);
  const current = Math.min(
    realm.breakthrough.requiredCultivation,
    player.cultivation.current + gain,
  );

  return {
    player: advanceTime({
      ...player,
      inventory: consumeItemCosts(player.inventory, [
        { itemId: "qi-gathering-pill", quantity: 1 },
      ]),
      cultivation: {
        current,
        required: realm.breakthrough.requiredCultivation,
        lastGain: gain,
      },
    }, 1),
    success: true,
    message: `服下聚气丹，修为 +${gain}`,
  };
};

export const attemptBreakthrough = (player: Player): BreakthroughResult => {
  const realm = getRealmById(player.realmId);
  const nextRealm = getNextRealm(player.realmId);
  const check = getBreakthroughCheck(player);

  if (!check.canBreakthrough || !nextRealm) {
    return {
      player,
      success: false,
      message:
        check.missingReasons.length > 0
          ? `暂无法突破：${check.missingReasons.join("；")}`
          : "暂无法突破",
    };
  }

  const passed = Math.random() <= check.chance;
  const inventory = consumeItemCosts(player.inventory, realm.breakthrough.requiredItems);
  const spiritStones = player.spiritStones - realm.breakthrough.spiritStoneCost;

  if (!passed) {
    const lostCultivation = Math.ceil(realm.breakthrough.requiredCultivation * 0.18);
    // 冲击失败经脉受创：伤势 +15（装备 injuryResist 可减免）
    const injuryResist = getEquipmentEffects(player).injuryResist ?? 0;
    const injuryGain = Math.round(15 * (1 - injuryResist));
    // 高阶境界（筑基及以上）冲关失败代价更重：调养耗时倍增
    const severe = realm.order >= 10;

    return {
      success: false,
      message: severe
        ? `突破失败，经脉受创，损失 ${lostCultivation} 修为，伤势 +${injuryGain}`
        : `突破失败，气息紊乱，损失 ${lostCultivation} 修为，伤势 +${injuryGain}`,
      player: advanceTime({
        ...player,
        spiritStones,
        inventory,
        injury: clampInjury(player.injury + injuryGain),
        cultivation: {
          ...player.cultivation,
          current: Math.max(0, player.cultivation.current - lostCultivation),
        },
      }, severe ? 60 : 30),
    };
  }

  return {
    success: true,
    message: `突破成功，已晋入${nextRealm.name}`,
    player: advanceTime({
      ...player,
      realmId: nextRealm.id,
      spiritStones,
      inventory,
      lifespan: player.lifespan + realm.rewards.lifespan,
      health: {
        current: player.health.max + realm.rewards.health,
        max: player.health.max + realm.rewards.health,
      },
      mana: {
        current: player.mana.max + realm.rewards.mana,
        max: player.mana.max + realm.rewards.mana,
      },
      cultivation: {
        current: 0,
        required: nextRealm.breakthrough.requiredCultivation,
        lastGain: 0,
      },
    }, 30),
  };
};

export const describeBreakthroughCosts = (player: Player) => {
  const realm = getRealmById(player.realmId);
  const costs = realm.breakthrough.requiredItems.map(formatItemCost);

  if (realm.breakthrough.spiritStoneCost > 0) {
    costs.push(`灵石 x${realm.breakthrough.spiritStoneCost}`);
  }

  return costs.length > 0 ? costs.join("，") : "无额外材料";
};
