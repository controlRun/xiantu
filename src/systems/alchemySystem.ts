import { getItemDefinition } from "../data/items";
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
import { getManualEffects } from "./manualSystem";

const clampSuccessRate = (rate: number) => Math.max(0.08, Math.min(0.96, rate));

export const formatCostList = (costs: ItemCost[]) =>
  costs
    .map((cost) => `${getItemDefinition(cost.itemId)?.name ?? cost.itemId} x${cost.quantity}`)
    .join("，");

export const getAlchemySuccessRate = (
  player: Player,
  recipe: AlchemyRecipe,
) => {
  const divineSenseBonus = player.attributes.divineSense * 0.018;
  const comprehensionBonus = player.attributes.comprehension * 0.01;
  const luckBonus = player.attributes.luck * 0.006;
  const manualEffects = getManualEffects(player);

  return clampSuccessRate(
    recipe.baseSuccessRate +
      divineSenseBonus +
      comprehensionBonus +
      luckBonus +
      manualEffects.alchemyBonus,
  );
};

export const getAlchemyCheck = (
  player: Player,
  recipe: AlchemyRecipe,
): AlchemyCheck => {
  const missingReasons: string[] = [];

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
    successRate: getAlchemySuccessRate(player, recipe),
    missingReasons,
  };
};

export const craftAlchemyRecipe = (
  player: Player,
  recipe: AlchemyRecipe,
): AlchemyResult => {
  const check = getAlchemyCheck(player, recipe);

  if (!check.canCraft) {
    return {
      player,
      recipe,
      success: false,
      message: check.missingReasons[0] ?? "暂无法炼制",
      logs: check.missingReasons,
    };
  }

  const consumedInventory = consumeItemCosts(player.inventory, recipe.ingredients);
  const paidPlayer: Player = {
    ...player,
    spiritStones: player.spiritStones - recipe.spiritStoneCost,
    inventory: consumedInventory,
    updatedAt: new Date().toISOString(),
  };
  const success = Math.random() <= check.successRate;

  if (!success) {
    const refund: ItemCost[] =
      recipe.id === "recipe-foundation-pill"
        ? [{ itemId: "spirit-grass", quantity: 2 }]
        : [];

    return {
      recipe,
      success: false,
      message: `${recipe.name}炼制失败，炉火失衡`,
      logs: [
        `消耗材料：${formatCostList(recipe.ingredients)}`,
        refund.length > 0
          ? `残渣中回收：${formatCostList(refund)}`
          : "药力散尽，未能成丹",
      ],
      player: {
        ...paidPlayer,
        inventory: addItemStacks(paidPlayer.inventory, refund),
      },
    };
  }

  const outputItem = getItemDefinition(recipe.output.itemId);

  return {
    recipe,
    success: true,
    message: `炼成${outputItem?.name ?? recipe.name} x${recipe.output.quantity}`,
    logs: [
      `消耗材料：${formatCostList(recipe.ingredients)}`,
      `丹火稳定，获得：${outputItem?.name ?? recipe.output.itemId} x${recipe.output.quantity}`,
    ],
    player: {
      ...paidPlayer,
      inventory: addItemStacks(paidPlayer.inventory, [recipe.output]),
    },
  };
};
