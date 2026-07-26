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
    id: "recipe-healing-pill",
    name: "回春丹",
    output: { itemId: "healing-pill", quantity: 1 },
    ingredients: [
      { itemId: "spirit-grass", quantity: 2 },
      { itemId: "beast-core-low", quantity: 1 },
    ],
    spiritStoneCost: 4,
    baseSuccessRate: 0.65,
    minDivineSense: 4,
    description: "以妖核血气催发药力，战前常备可续命回春。",
  },
  {
    id: "recipe-mana-pill",
    name: "回灵丹",
    output: { itemId: "mana-pill", quantity: 1 },
    ingredients: [{ itemId: "spirit-grass", quantity: 2 }],
    spiritStoneCost: 3,
    baseSuccessRate: 0.75,
    minDivineSense: 3,
    description: "双倍灵息草文火慢凝，回补灵力最是稳妥。",
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
