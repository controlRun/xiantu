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
    effects: { heal: 45 },
    description: "药力温和绵长，战中服下可速续气血。",
  },
  {
    itemId: "mana-pill",
    name: "回灵丹",
    effects: { restoreMana: 25 },
    description: "聚灵草精华凝成，服之灵力回涌。",
  },
  {
    itemId: "stasis-pill",
    name: "化瘀丹",
    effects: { healInjury: 40 },
    description: "以狼牙倒钩之性攻散瘀血，服之化解伤势。",
  },
  {
    itemId: "body-forging-pill",
    name: "锻体丹",
    effects: { rootBone: 1 },
    description: "妖核血气淬炼筋骨，终生限服三次，多服无益。",
    maxUses: 3,
  },
  {
    itemId: "mind-cleansing-pill",
    name: "洗心丹",
    effects: { mind: 1 },
    description: "灵息草木清气涤荡心尘，终生限服两次，多服无益。",
    maxUses: 2,
  },
];

export const getPillDefinition = (itemId: string): PillDefinition | undefined =>
  pillDefinitions.find((pill) => pill.itemId === itemId);

/** 是否可用于战斗内（回血/回灵类） */
export const isBattlePill = (pill: PillDefinition): boolean =>
  Boolean(pill.effects.heal || pill.effects.restoreMana);
