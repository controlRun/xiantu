import { getItemDefinition } from "../data/items";
import { getRealmById } from "../data/realms";
import { getSectById, SECT_RANKS, sectDefinitions } from "../data/sects";
import type {
  ItemCost,
  Player,
  SectActionResult,
  SectPassiveBonuses,
  SectRankDefinition,
  SectTask,
} from "../types/game";
import { addItemStacks } from "./inventorySystem";
import { advanceTime } from "./timeSystem";

const randomInt = (min: number, max: number) =>
  min + Math.floor(Math.random() * (max - min + 1));

const formatItems = (items: ItemCost[]) => {
  if (items.length === 0) {
    return "无额外物品";
  }

  return items
    .map((item) => `${getItemDefinition(item.itemId)?.name ?? item.itemId} x${item.quantity}`)
    .join("，");
};

const chooseTask = (tasks: SectTask[]) => tasks[randomInt(0, tasks.length - 1)];

export const getAvailableSects = (player: Player) => {
  const realm = getRealmById(player.realmId);
  return sectDefinitions.filter((sect) => realm.order >= sect.minRealmOrder);
};

export const joinSect = (player: Player, sectId: string): SectActionResult => {
  const sect = getSectById(sectId);
  const realm = getRealmById(player.realmId);

  if (!sect) {
    return {
      player,
      success: false,
      message: "没有找到该宗门",
      logs: ["山门隐没，未能寻得其踪"],
    };
  }

  if (player.sectId) {
    return {
      player,
      success: false,
      message: "你已经加入宗门",
      logs: ["当前版本暂不支持改投山门"],
    };
  }

  if (realm.order < sect.minRealmOrder) {
    return {
      player,
      success: false,
      message: "境界不足，暂不可拜入",
      logs: [`${sect.name}暂不收录当前境界的修士`],
    };
  }

  return {
    player: advanceTime({
      ...player,
      sectId: sect.id,
      sectContribution: 0,
      sectRank: 0,
    }, 15),
    success: true,
    message: `拜入${sect.name}`,
    logs: [`你通过考核，成为${sect.name}弟子`],
  };
};

export const completeSectTask = (player: Player): SectActionResult => {
  const sect = getSectById(player.sectId);

  if (!sect) {
    return {
      player,
      success: false,
      message: "尚未加入宗门",
      logs: ["无宗门可接任务"],
    };
  }

  const task = chooseTask(sect.tasks);

  if (player.health.current <= task.healthCost) {
    return {
      player,
      success: false,
      message: "气血不足，先调息恢复",
      logs: [`${task.name}需要消耗 ${task.healthCost} 气血`],
    };
  }

  if (player.mana.current < task.manaCost) {
    return {
      player,
      success: false,
      message: "灵力不足，先调息恢复",
      logs: [`${task.name}需要消耗 ${task.manaCost} 灵力`],
    };
  }

  const realm = getRealmById(player.realmId);
  const spiritStones = randomInt(
    task.spiritStoneReward[0],
    task.spiritStoneReward[1],
  );
  const cultivation = randomInt(
    task.cultivationReward[0],
    task.cultivationReward[1],
  );
  const nextCultivation = Math.min(
    realm.breakthrough.requiredCultivation,
    player.cultivation.current + cultivation,
  );

  return {
    success: true,
    message: `完成${task.name}，贡献 +${task.contributionReward}`,
    logs: [
      task.description,
      `贡献 +${task.contributionReward}，灵石 +${spiritStones}，修为 +${cultivation}`,
      `获得：${formatItems(task.itemRewards)}`,
    ],
    player: advanceTime({
      ...player,
      sectContribution: player.sectContribution + task.contributionReward,
      spiritStones: player.spiritStones + spiritStones,
      health: {
        ...player.health,
        current: player.health.current - task.healthCost,
      },
      mana: {
        ...player.mana,
        current: player.mana.current - task.manaCost,
      },
      inventory: addItemStacks(player.inventory, task.itemRewards),
      cultivation: {
        current: nextCultivation,
        required: realm.breakthrough.requiredCultivation,
        lastGain: cultivation,
      },
    }, 7),
  };
};

export const exchangeSectReward = (
  player: Player,
  rewardId: string,
): SectActionResult => {
  const sect = getSectById(player.sectId);
  const realm = getRealmById(player.realmId);
  const reward = sect?.shop.find((item) => item.id === rewardId);

  if (!sect || !reward) {
    return {
      player,
      success: false,
      message: "没有找到该兑换",
      logs: ["宗门库房并无此物"],
    };
  }

  if (realm.order < reward.minRealmOrder) {
    return {
      player,
      success: false,
      message: "境界不足，暂不可兑换",
      logs: [`${reward.name}需要更高境界`],
    };
  }

  if (player.sectContribution < reward.contributionCost) {
    return {
      player,
      success: false,
      message: `贡献不足：需要 ${reward.contributionCost}`,
      logs: [`当前贡献 ${player.sectContribution}`],
    };
  }

  return {
    success: true,
    message: `${reward.name}成功`,
    logs: [
      `消耗贡献 ${reward.contributionCost}`,
      `获得：${formatItems([reward.item])}`,
    ],
    player: advanceTime({
      ...player,
      sectContribution: player.sectContribution - reward.contributionCost,
      inventory: addItemStacks(player.inventory, [reward.item]),
    }, 1),
  };
};

const EMPTY_BONUSES: SectPassiveBonuses = {
  cultivationBonus: 0,
  alchemyBonus: 0,
  damageBonus: 0,
  accuracyBonus: 0,
  defenseBonus: 0,
  injuryResist: 0,
  traversalCostReduction: 0,
};

/** clamp 职位序号至合法区间（存档越界兜底） */
export const clampSectRank = (rank: number): number =>
  Math.min(SECT_RANKS.length - 1, Math.max(0, Math.floor(rank)));

export const getSectRankDefinition = (rank: number): SectRankDefinition =>
  SECT_RANKS[clampSectRank(rank)];

/**
 * 宗门差异化被动加成：按职位线性缩放（杂役 = 0，长老 = 上限）。
 * 无宗门则全零。各系统（修炼/炼丹/战斗/远征）在此聚合取值，避免散落判定。
 */
export const getSectPassiveBonuses = (player: Player): SectPassiveBonuses => {
  const sect = getSectById(player.sectId);

  if (!sect) {
    return EMPTY_BONUSES;
  }

  const factor = clampSectRank(player.sectRank) / (SECT_RANKS.length - 1);
  const { max } = sect.bonus;

  return {
    cultivationBonus: (max.cultivationBonus ?? 0) * factor,
    alchemyBonus: (max.alchemyBonus ?? 0) * factor,
    damageBonus: (max.damageBonus ?? 0) * factor,
    accuracyBonus: (max.accuracyBonus ?? 0) * factor,
    defenseBonus: (max.defenseBonus ?? 0) * factor,
    injuryResist: (max.injuryResist ?? 0) * factor,
    traversalCostReduction: (max.traversalCostReduction ?? 0) * factor,
  };
};

export interface PromotionCheck {
  canPromote: boolean;
  /** 下一级职位；null = 已至长老 */
  nextRank: SectRankDefinition | null;
  missingReasons: string[];
}

/** 晋升判定：境界 order 与累计贡献双门槛（贡献不消耗） */
export const getPromotionCheck = (player: Player): PromotionCheck => {
  if (!getSectById(player.sectId)) {
    return { canPromote: false, nextRank: null, missingReasons: ["尚未加入宗门"] };
  }

  const nextRank = SECT_RANKS[clampSectRank(player.sectRank) + 1] ?? null;

  if (!nextRank) {
    return { canPromote: false, nextRank: null, missingReasons: ["已位极长老"] };
  }

  const realm = getRealmById(player.realmId);
  const missingReasons: string[] = [];

  if (realm.order < nextRank.minRealmOrder) {
    missingReasons.push(`境界不足：晋升${nextRank.name}需更高境界`);
  }

  if (player.sectContribution < nextRank.minContribution) {
    missingReasons.push(
      `贡献不足：晋升${nextRank.name}需累计贡献 ${nextRank.minContribution}`,
    );
  }

  return { canPromote: missingReasons.length === 0, nextRank, missingReasons };
};

/** 晋升一级（耗时 10 日；贡献为门槛，不消耗） */
export const promoteSect = (player: Player): SectActionResult => {
  const sect = getSectById(player.sectId);
  const check = getPromotionCheck(player);

  if (!sect) {
    return {
      player,
      success: false,
      message: "尚未加入宗门",
      logs: ["无宗门可晋升"],
    };
  }

  if (!check.canPromote || !check.nextRank) {
    return {
      player,
      success: false,
      message: check.missingReasons[0] ?? "暂无法晋升",
      logs: check.missingReasons,
    };
  }

  const nextRank = check.nextRank;

  return {
    success: true,
    message: `晋升为${sect.name}${nextRank.name}`,
    logs: [
      `经宗门考校，你由${getSectRankDefinition(player.sectRank).name}晋升为${nextRank.name}`,
      "本宗被动加成随之精进",
    ],
    player: advanceTime({ ...player, sectRank: nextRank.rank }, 10),
  };
};
