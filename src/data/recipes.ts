import type { AlchemyRecipe } from "../types/game";

export const alchemyRecipes: AlchemyRecipe[] = [
  {
    id: "recipe-qi-gathering-pill",
    name: "聚气丹",
    output: { itemId: "qi-gathering-pill", quantity: 1 },
    ingredients: [
      { itemId: "spirit-grass", quantity: 3 },
      { itemId: "beast-core-low", quantity: 1 },
    ],
    spiritStoneCost: 3,
    baseSuccessRate: 0.72,
    minDivineSense: 3,
    description: "炼气期最常见的辅助丹药，适合快速积累修为。",
  },
  {
    id: "recipe-foundation-pill",
    name: "筑基丹",
    output: { itemId: "foundation-pill", quantity: 1 },
    ingredients: [
      { itemId: "spirit-grass", quantity: 10 },
      { itemId: "beast-core-low", quantity: 4 },
      { itemId: "qi-gathering-pill", quantity: 2 },
    ],
    spiritStoneCost: 40,
    baseSuccessRate: 0.38,
    minDivineSense: 8,
    description: "冲击筑基境的重要丹药，炼制难度远高于普通丹药。",
  },
];

export const getAlchemyRecipe = (recipeId: string) =>
  alchemyRecipes.find((recipe) => recipe.id === recipeId);
