import { getItemDefinition } from "../data/items";
import { getRealmById } from "../data/realms";
import { getSectById, sectDefinitions } from "../data/sects";
import type { ItemCost, Player, SectActionResult, SectTask } from "../types/game";
import { addItemStacks } from "./inventorySystem";

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
    player: {
      ...player,
      sectId: sect.id,
      sectContribution: 0,
      updatedAt: new Date().toISOString(),
    },
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
    player: {
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
      updatedAt: new Date().toISOString(),
    },
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
    player: {
      ...player,
      sectContribution: player.sectContribution - reward.contributionCost,
      inventory: addItemStacks(player.inventory, [reward.item]),
      updatedAt: new Date().toISOString(),
    },
  };
};
