import type { AlchemyRecipe } from "../types/game";

/**
 * 炼器配方：以凡铁、灵兽材料炼制箭矢。
 * 字段结构与丹方一致（复用 AlchemyRecipe），由 craftSystem 独立结算。
 */
export const craftRecipes: AlchemyRecipe[] = [
  {
    id: "craft-wooden-arrow",
    name: "木羽箭",
    output: { itemId: "wooden-arrow", quantity: 10 },
    ingredients: [{ itemId: "spirit-grass", quantity: 1 }],
    spiritStoneCost: 1,
    baseSuccessRate: 0.95,
    minDivineSense: 2,
    description: "硬木削杆、灵草汁定型，最基础的制箭手艺，几乎不会失手。",
  },
  {
    id: "craft-wolf-fang-arrow",
    name: "狼牙箭",
    output: { itemId: "wolf-fang-arrow", quantity: 6 },
    ingredients: [
      { itemId: "wolf-fang", quantity: 2 },
      { itemId: "spirit-grass", quantity: 1 },
    ],
    spiritStoneCost: 3,
    baseSuccessRate: 0.82,
    minDivineSense: 4,
    description: "狼牙磨尖倒钩，中箭者伤口撕裂，难以愈合。",
  },
  {
    id: "craft-mist-feather-arrow",
    name: "雾羽箭",
    output: { itemId: "mist-feather-arrow", quantity: 5 },
    ingredients: [
      { itemId: "mist-fox-tail", quantity: 1 },
      { itemId: "spirit-grass", quantity: 2 },
    ],
    spiritStoneCost: 4,
    baseSuccessRate: 0.8,
    minDivineSense: 5,
    description: "雾狐灵毫为翎，箭身破风无声，指哪打哪。",
  },
  {
    id: "craft-iron-arrow",
    name: "精铁箭",
    output: { itemId: "iron-arrow", quantity: 6 },
    ingredients: [
      { itemId: "iron-essence", quantity: 1 },
      { itemId: "spirit-grass", quantity: 2 },
    ],
    spiritStoneCost: 4,
    baseSuccessRate: 0.85,
    minDivineSense: 4,
    description: "精铁髓锻打箭头，分量沉实，破甲有力。",
  },
  {
    id: "craft-serpent-scale-arrow",
    name: "玄鳞箭",
    output: { itemId: "serpent-scale-arrow", quantity: 4 },
    ingredients: [
      { itemId: "serpent-scale", quantity: 2 },
      { itemId: "beast-core-low", quantity: 1 },
    ],
    spiritStoneCost: 6,
    baseSuccessRate: 0.72,
    minDivineSense: 6,
    description: "妖核之火熔炼玄鳞，箭头坚逾精铁，专破厚皮妖兽。",
  },
  {
    id: "craft-spirit-piercing-arrow",
    name: "破灵箭",
    output: { itemId: "spirit-piercing-arrow", quantity: 2 },
    ingredients: [
      { itemId: "beast-core-low", quantity: 3 },
      { itemId: "iron-essence", quantity: 2 },
      { itemId: "serpent-scale", quantity: 1 },
    ],
    spiritStoneCost: 15,
    baseSuccessRate: 0.5,
    minDivineSense: 8,
    description: "妖核灵力沁入箭身刻成破灵纹，十炉九败，成则利器。",
  },
];

export const getCraftRecipe = (recipeId: string) =>
  craftRecipes.find((recipe) => recipe.id === recipeId);
