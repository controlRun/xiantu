import type { ManualDefinition } from "../types/game";

export const manualDefinitions: ManualDefinition[] = [
  {
    itemId: "basic-breathing-manual",
    name: "引气诀",
    description: "基础引气入体法门，略微提升日常修炼效率。",
    sectId: null,
    effects: {
      cultivationBonus: 0.08,
    },
  },
  {
    itemId: "qingyun-heart-method",
    name: "青云心法",
    description: "青云门内修心法，提升修炼效率与突破稳定性。",
    sectId: "qingyun-sect",
    effects: {
      cultivationBonus: 0.1,
      breakthroughBonus: 0.05,
    },
  },
  {
    itemId: "danxia-fire-control",
    name: "丹霞控火诀",
    description: "丹霞谷控火诀，显著提升炼丹成功率。",
    sectId: "danxia-valley",
    effects: {
      alchemyBonus: 0.12,
      cultivationBonus: 0.04,
    },
  },
  {
    itemId: "wandering-step",
    name: "游身步",
    description: "散修盟身法，提升历练战斗中的攻守表现。",
    sectId: "loose-cultivator-league",
    effects: {
      battleAttackBonus: 0.1,
      battleDefenseBonus: 0.12,
    },
  },
];

export const getManualDefinition = (itemId: string) =>
  manualDefinitions.find((manual) => manual.itemId === itemId);
