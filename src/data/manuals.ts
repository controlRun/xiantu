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
    sectId: "qingyun-men",
    effects: {
      cultivationBonus: 0.1,
      breakthroughBonus: 0.05,
    },
  },
  {
    itemId: "danxia-fire-control",
    name: "丹霞控火诀",
    description: "丹霞谷控火诀，显著提升炼丹成功率。",
    sectId: "danxia-gu",
    effects: {
      alchemyBonus: 0.12,
      cultivationBonus: 0.04,
    },
  },
  {
    itemId: "wandering-step",
    name: "游身步",
    description: "江湖散修间流传的身法，提升历练战斗中的攻守表现。",
    sectId: null,
    effects: {
      battleAttackBonus: 0.1,
      battleDefenseBonus: 0.12,
    },
  },
  {
    itemId: "metal-sword-intent",
    name: "金剑诀",
    description: "金剑宗入门剑诀，养一身庚金剑气，历练战斗攻击更显锋锐。",
    sectId: "jinjian-sect",
    effects: {
      battleAttackBonus: 0.12,
    },
  },
  {
    itemId: "wood-vitality-script",
    name: "长春功",
    description: "青云门木属吐纳正法，生生不息，日常修炼进境更稳。",
    sectId: "qingyun-men",
    effects: {
      cultivationBonus: 0.12,
    },
  },
  {
    itemId: "water-soft-stream",
    name: "弱水诀",
    description: "碧水宫柔水心法，以柔克刚，历练战斗中防御更坚。",
    sectId: "bishui-palace",
    effects: {
      battleDefenseBonus: 0.12,
    },
  },
  {
    itemId: "fire-blazing-heart",
    name: "焚心经",
    description: "丹霞谷焚火真经，心火相济，炼丹火候愈发精纯。",
    sectId: "danxia-gu",
    effects: {
      alchemyBonus: 0.12,
    },
  },
  {
    itemId: "earth-mountain-body",
    name: "厚土身",
    description: "厚土堡锻体法门，气沉如山，破境之时根基更固。",
    sectId: "houtou-bao",
    effects: {
      breakthroughBonus: 0.1,
      battleDefenseBonus: 0.06,
    },
  },
];

export const getManualDefinition = (itemId: string) =>
  manualDefinitions.find((manual) => manual.itemId === itemId);
