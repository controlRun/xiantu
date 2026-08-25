/** 丹药效果表：战斗内外的疗伤、回灵；属性丹限次服用 */

export interface PillEffects {
  /** 恢复气血 */
  heal?: number;
  /** 恢复灵力 */
  restoreMana?: number;
  /** 化解伤势 */
  healInjury?: number;
  /** 永久提升根骨（限次丹） */
  rootBone?: number;
  /** 永久提升心境（限次丹） */
  mind?: number;
  /** 服下累积的丹毒（0-100，滞修行） */
  toxicity?: number;
  /** 服下化去的丹毒 */
  clearToxicity?: number;
}

export interface PillDefinition {
  itemId: string;
  name: string;
  effects: PillEffects;
  description: string;
  /** 终生限服次数；缺省不限 */
  maxUses?: number;
}

export const pillDefinitions: PillDefinition[] = [
  {
    itemId: "healing-pill",
    name: "回春丹",
    effects: { heal: 45, toxicity: 5 },
    description: "药力温和绵长，战中服下可速续气血；唯丹毒微积，服多滞修行。",
  },
  {
    itemId: "mana-pill",
    name: "回灵丹",
    effects: { restoreMana: 25, toxicity: 5 },
    description: "聚灵草精华凝成，服之灵力回涌；丹毒微积，服多滞修行。",
  },
  {
    itemId: "stasis-pill",
    name: "化瘀丹",
    effects: { healInjury: 40, toxicity: 8 },
    description: "以狼牙倒钩之性攻散瘀血，服之化解伤势；药性峻猛，丹毒稍积。",
  },
  {
    itemId: "body-forging-pill",
    name: "锻体丹",
    effects: { rootBone: 1, toxicity: 12 },
    description: "妖核血气淬炼筋骨，终生限服三次；妖气冲体，丹毒淤积。",
    maxUses: 3,
  },
  {
    itemId: "mind-cleansing-pill",
    name: "洗心丹",
    effects: { mind: 1, clearToxicity: 40 },
    description: "灵息草木清气涤荡心尘，化去丹毒四十缕，终生限服两次。",
    maxUses: 2,
  },
  {
    itemId: "divine-elixir",
    name: "天元丹",
    effects: { heal: 160, restoreMana: 120, toxicity: 10 },
    description: "天芝与妖核熬炼的仙丹，战中服下气血灵力齐涌；丹毒亦随之淤积。",
  },
  {
    itemId: "spirit-refining-pill",
    name: "炼神丹",
    effects: { mind: 1, toxicity: 15 },
    description: "淬炼元神的奇丹，服之灵台清明、心境更上一层；药力暴烈，丹毒深积，终生限服两次。",
    maxUses: 2,
  },
];

export const getPillDefinition = (itemId: string): PillDefinition | undefined =>
  pillDefinitions.find((pill) => pill.itemId === itemId);

/** 是否可用于战斗内（回血/回灵类） */
export const isBattlePill = (pill: PillDefinition): boolean =>
  Boolean(pill.effects.heal || pill.effects.restoreMana);
