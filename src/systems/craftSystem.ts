import { getItemDefinition } from "../data/items";
import { getRealmById, getRealmByOrder } from "../data/realms";
import type {
  AlchemyCheck,
  AlchemyRecipe,
  AlchemyResult,
  ItemCost,
  Player,
} from "../types/game";
import {
  addItemStacks,
  consumeItemCosts,
  getInventoryQuantity,
  hasItemCosts,
} from "./inventorySystem";
import { getSectPassiveBonuses } from "./sectSystem";
import { advanceTime } from "./timeSystem";

const clampSuccessRate = (rate: number) => Math.max(0.08, Math.min(0.96, rate));

export const formatCraftCostList = (costs: ItemCost[]) =>
  costs
    .map((cost) => `${getItemDefinition(cost.itemId)?.name ?? cost.itemId} x${cost.quantity}`)
    .join("，");

/** 炼器成功率：根骨与悟性主导（区别于炼丹的神识主导） */
export const getCraftSuccessRate = (player: Player, recipe: AlchemyRecipe) => {
  const rootBoneBonus = player.attributes.rootBone * 0.012;
  const comprehensionBonus = player.attributes.comprehension * 0.012;
  const luckBonus = player.attributes.luck * 0.006;
  // 宗门所长：如丹霞谷丹道精深（随职位增长）
  const { alchemyBonus } = getSectPassiveBonuses(player);

  return clampSuccessRate(
    recipe.baseSuccessRate +
      rootBoneBonus +
      comprehensionBonus +
      luckBonus +
      alchemyBonus,
  );
};

export const getCraftCheck = (
  player: Player,
  recipe: AlchemyRecipe,
): AlchemyCheck => {
  const missingReasons: string[] = [];

  // 高阶箭矢随境界解锁（玄鳞箭炼气四层 / 破灵箭炼气七层）
  if (recipe.minRealmOrder !== undefined) {
    const order = getRealmById(player.realmId).order;

    if (order < recipe.minRealmOrder) {
      const required = getRealmByOrder(recipe.minRealmOrder);
      missingReasons.push(
        `境界不足：${required?.name ?? `更高境界`}方可炼制`,
      );
    }
  }

  if (player.attributes.divineSense < recipe.minDivineSense) {
    missingReasons.push(`神识不足：需要 ${recipe.minDivineSense}`);
  }

  if (player.spiritStones < recipe.spiritStoneCost) {
    missingReasons.push(`灵石不足：需要 ${recipe.spiritStoneCost}`);
  }

  if (!hasItemCosts(player.inventory, recipe.ingredients)) {
    recipe.ingredients.forEach((ingredient) => {
      const owned = getInventoryQuantity(player.inventory, ingredient.itemId);

      if (owned < ingredient.quantity) {
        const item = getItemDefinition(ingredient.itemId);
        missingReasons.push(
          `${item?.name ?? ingredient.itemId}不足：需要 ${ingredient.quantity}`,
        );
      }
    });
  }

  return {
    canCraft: missingReasons.length === 0,
    successRate: getCraftSuccessRate(player, recipe),
    missingReasons,
  };
};

/** 炼器结算：耗时 2 日，失败则材料尽毁 */
export const craftRecipe = (
  player: Player,
  recipe: AlchemyRecipe,
): AlchemyResult => {
  const check = getCraftCheck(player, recipe);

  if (!check.canCraft) {
    return {
      player,
      recipe,
      success: false,
      message: check.missingReasons[0] ?? "暂无法炼器",
      logs: check.missingReasons,
    };
  }

  const consumedInventory = consumeItemCosts(player.inventory, recipe.ingredients);
  const paidPlayer: Player = advanceTime(
    {
      ...player,
      spiritStones: player.spiritStones - recipe.spiritStoneCost,
      inventory: consumedInventory,
    },
    2,
  );
  const success = Math.random() <= check.successRate;

  if (!success) {
    return {
      recipe,
      success: false,
      message: `${recipe.name}炼器失败，器胚崩碎`,
      logs: [
        `消耗材料：${formatCraftCostList(recipe.ingredients)}`,
        "炉中器胚应声崩碎，材料尽毁。",
      ],
      player: paidPlayer,
    };
  }

  const outputItem = getItemDefinition(recipe.output.itemId);

  return {
    recipe,
    success: true,
    message: `炼成${outputItem?.name ?? recipe.name} x${recipe.output.quantity}`,
    logs: [
      `消耗材料：${formatCraftCostList(recipe.ingredients)}`,
      `器成出炉，获得：${outputItem?.name ?? recipe.output.itemId} x${recipe.output.quantity}`,
    ],
    player: {
      ...paidPlayer,
      inventory: addItemStacks(paidPlayer.inventory, [recipe.output]),
    },
  };
};
