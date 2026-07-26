/** 丹药效果表：战斗内外的疗伤、回灵；healInjury（化瘀）二期消费 */

export interface PillEffects {
  /** 恢复气血 */
  heal?: number;
  /** 恢复灵力 */
  restoreMana?: number;
  /** 化解伤势（二期伤势系统） */
  healInjury?: number;
}

export interface PillDefinition {
  itemId: string;
  name: string;
  effects: PillEffects;
  description: string;
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
];

export const getPillDefinition = (itemId: string): PillDefinition | undefined =>
  pillDefinitions.find((pill) => pill.itemId === itemId);
