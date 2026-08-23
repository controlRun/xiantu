import { getItemDefinition } from "../data/items";
import { getNextRealm, getRealmById } from "../data/realms";
import type {
  BreakthroughCheck,
  BreakthroughResult,
  Player,
} from "../types/game";
import { getEquipmentEffects } from "./equipmentSystem";
import { clampInjury, getInjuryPenalty } from "./injurySystem";
import { clampPillToxicity, getPillToxicityPenalty } from "./pillToxicitySystem";
import {
  consumeItemCosts,
  formatItemCost,
  getInventoryQuantity,
  hasItemCosts,
} from "./inventorySystem";
import { getCaveLocation } from "./mapSystem";
import { getManualEffects } from "./manualSystem";
import { getSectPassiveBonuses } from "./sectSystem";
import {
  DAYS_PER_YEAR,
  advanceTime,
  getGameDay,
  getRemainingYears,
} from "./timeSystem";

const clampChance = (chance: number) => Math.max(0.05, Math.min(0.95, chance));

/** 闭关时制度：1 月 = 30 日；滑块区间 1 个月 ~ 20 年（240 月） */
export const DAYS_PER_MONTH = DAYS_PER_YEAR / 12;
export const MAX_CULTIVATION_MONTHS = 240;

export const getCultivationGain = (player: Player) => {
  const rootGain = player.attributes.rootBone * 2;
  const mindGain = Math.floor(player.attributes.mind / 2);
  const baseGain = 10 + rootGain + mindGain;
  const manualEffects = getManualEffects(player);
  // 洞府所在灵地的灵气加成（如紫雾灵山 ×1.25）
  const caveBonus = getCaveLocation(player)?.caveBonus ?? 1;
  // 伤势拖累吐纳：伤势 50 → 修炼效率 −20%
  const { cultivationMul } = getInjuryPenalty(player.injury);
  // 丹毒淤积滞修行：丹毒 50 → 修炼效率 −20%（与伤势平行）
  const { cultivationMul: toxMul } = getPillToxicityPenalty(player.pillToxicity);
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
        cultivationMul *
        toxMul,
    ),
  );
};

/**
 * 闭关时长上限（月）。受两条约束：
 * 1. 版本硬上限 MAX_CULTIVATION_MONTHS（20 年 = 240 月）；
 * 2. 剩余寿元——减去 1 个月作余量，保证「出关时寿元未尽」，杜绝闭关坐化。
 * 寿元恒为整数年、age 由 advanceTime 量化到 0.001 年，ceil−1 的余量充分。
 * 返回 0 表示寿元已不足一次最短闭关（约 1 月），前端应禁用修炼入口。
 */
export const getCultivateMonthsCap = (player: Player): number => {
  const remainingMonths = Math.ceil(getRemainingYears(player) * 12 - 1e-9) - 1;
  return Math.max(0, Math.min(MAX_CULTIVATION_MONTHS, remainingMonths));
};

export interface CultivateGainPreview {
  days: number;
  /** 未封顶的毛收益 */
  raw: number;
  /** 计入境界瓶颈后的实得 */
  gain: number;
  /** 是否触到当前境界修为上限 */
  capped: boolean;
}

/**
 * 闭关收益的单一权威来源：滑块预览与 cultivate 实修共用，
 * 保证「预计修为」与结果卡数值永不错位。折算为线性：7 日局收益 ÷ 7 × 天数。
 */
export const getCultivateGainForMonths = (
  player: Player,
  months: number,
): CultivateGainPreview => {
  const realm = getRealmById(player.realmId);
  const days = Math.round(months * DAYS_PER_MONTH);
  const raw = Math.max(
    1,
    Math.floor((getCultivationGain(player) / 7) * days),
  );
  const headroom = Math.max(
    0,
    realm.breakthrough.requiredCultivation - player.cultivation.current,
  );

  return {
    days,
    raw,
    gain: Math.min(raw, headroom),
    capped: raw > headroom,
  };
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
  // 丹毒淤积干扰破境：丹毒 50 → 突破 −7.5%
  const { breakthroughPenalty } = getPillToxicityPenalty(player.pillToxicity);

  return clampChance(realm.breakthrough.baseChance + attributeBonus - breakthroughPenalty);
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

/**
 * 闭关修炼。months 为滑块所选时长（月），经双重夹值：
 * 1. 非有限数（如 .mjs 冒烟误传 undefined → NaN）回落 1，杜绝 NaN 增龄；
 * 2. clamp 到 [1, getCultivateMonthsCap]，防越过寿元/版本上限。
 * 收益与天数取自 getCultivateGainForMonths（与预览同源）。
 */
export const cultivate = (player: Player, months: number): Player => {
  const realm = getRealmById(player.realmId);
  const cap = getCultivateMonthsCap(player);
  const safeMonths = Number.isFinite(months) ? Math.floor(months) : 1;
  const clampedMonths = Math.max(1, Math.min(Math.max(1, cap), safeMonths));
  const { days, gain } = getCultivateGainForMonths(player, clampedMonths);

  const nextCultivation = Math.min(
    realm.breakthrough.requiredCultivation,
    player.cultivation.current + gain,
  );

  // lastCultivateDay 取推进后的游戏日，使「今日打坐」目标即时可见
  const after = advanceTime({
    ...player,
    cultivation: {
      current: nextCultivation,
      required: realm.breakthrough.requiredCultivation,
      lastGain: gain,
    },
  }, days);

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
      // 聚气丹丹毒 +8（走修炼路径，未入 pillDefinitions 故此处直接累计）
      pillToxicity: clampPillToxicity(player.pillToxicity + 8),
    }, 1),
    success: true,
    message: `服下聚气丹，修为 +${gain}，丹毒 +8`,
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
