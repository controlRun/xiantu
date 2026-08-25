/**
 * 秘境节点远征数据表（二期）
 *
 * 妖芯秘境逐层深入：1–4 层每层掷 3 个异型分支节点（战斗/采集/宝箱/禁制/奇遇），
 * 玩家择一结算后「继续深入」或「携宝而归」；第 5 层固定挑战守关者（石傀，每日一次）。
 * 深入越远，遍历成本（气血/灵力/寿元）越高、节点类型越偏向宝箱/奇遇、怪物越硬。
 *
 * 怪物按层固定选取（不走 area 过滤——order 9+ 时 area 池为空会兜底失效），
 * 战斗节点经 startArcheryBattle 的 fixedMonster 参注入。掉落由战斗引擎直接入库存，
 * run.loot 仅承载非战斗节点收益。
 */

import type { ExpeditionNodeType } from "../types/game";

/** 远征最深至第 5 层（Boss 层） */
export const EXPEDITION_MAX_DEPTH = 5;

/** 远征所在地点（与 locations.ts 的 yaoxin-secret-realm 对应） */
export const EXPEDITION_LOCATION_ID = "yaoxin-secret-realm";

/** 常规层（1–4），Boss 层 5 不掷节点 */
export type LayerDepth = 1 | 2 | 3 | 4;

/** 每层战斗节点候选怪物 id（血量升序阶梯，复用现有怪物） */
export const DEPTH_MONSTER_IDS: Record<LayerDepth, string[]> = {
  1: ["mist-fox", "iron-back-wolf"],
  2: ["rock-scaled-serpent", "iron-back-wolf"],
  3: ["rogue-cultivator", "rock-scaled-serpent"],
  4: ["heart-devourer", "rogue-cultivator"],
};

/** 灵界秘境（上古妖境）战斗候选 */
export const SPIRIT_DEPTH_MONSTER_IDS: Record<LayerDepth, string[]> = {
  1: ["spirit-ice-soul", "spirit-lightning-eagle"],
  2: ["spirit-yaochi-serpent", "spirit-thunder-ghoul"],
  3: ["spirit-thunder-ghoul", "spirit-yaochi-serpent"],
  4: ["spirit-jiuxiao-peng", "spirit-lightning-eagle"],
};

/** 灵界秘境所在地点（与 locations.ts 的 sp-shanggu-yaojing 对应） */
export const SPIRIT_EXPEDITION_LOCATION_ID = "sp-shanggu-yaojing";

/** 按秘境所在地点取本层战斗候选（凡间/灵界两套表） */
export const getDepthMonsterIds = (locationId: string, depth: LayerDepth) =>
  locationId === SPIRIT_EXPEDITION_LOCATION_ID
    ? SPIRIT_DEPTH_MONSTER_IDS[depth]
    : DEPTH_MONSTER_IDS[depth];

/** 每层节点类型权重（战斗↓、宝箱/奇遇↑） */
export const DEPTH_NODE_WEIGHTS: Record<
  LayerDepth,
  Record<ExpeditionNodeType, number>
> = {
  1: { combat: 55, gather: 15, chest: 12, ward: 8, encounter: 10 },
  2: { combat: 50, gather: 15, chest: 13, ward: 10, encounter: 12 },
  3: { combat: 45, gather: 14, chest: 15, ward: 10, encounter: 16 },
  4: { combat: 40, gather: 14, chest: 16, ward: 10, encounter: 20 },
};

/**
 * 每层遍历成本：进入该层（下潜）时结算。
 * healthPct/manaPct 按最大值百分比扣除（气血保底 1），days 经 advanceTime 折寿。
 */
export const DEPTH_TRAVERSAL_COST: Record<
  LayerDepth,
  { healthPct: number; manaPct: number; days: number }
> = {
  1: { healthPct: 0.05, manaPct: 0.05, days: 0.5 },
  2: { healthPct: 0.08, manaPct: 0.08, days: 1 },
  3: { healthPct: 0.12, manaPct: 0.12, days: 1 },
  4: { healthPct: 0.15, manaPct: 0.15, days: 2 },
};

/** 通用掉落条目（带概率） */
export interface ExpeditionDrop {
  itemId: string;
  quantity: number;
  chance: number;
}

/** 采集节点：修为 + 材料池 */
export interface GatherPool {
  cultivation: [number, number];
  rewards: ExpeditionDrop[];
}

export const DEPTH_GATHER_POOLS: Record<LayerDepth, GatherPool> = {
  1: {
    cultivation: [8, 16],
    rewards: [
      { itemId: "spirit-grass", quantity: 3, chance: 0.9 },
      { itemId: "wolf-fang", quantity: 2, chance: 0.4 },
      { itemId: "wooden-arrow", quantity: 4, chance: 0.35 },
    ],
  },
  2: {
    cultivation: [14, 26],
    rewards: [
      { itemId: "spirit-grass", quantity: 4, chance: 0.85 },
      { itemId: "mist-fox-tail", quantity: 1, chance: 0.5 },
      { itemId: "iron-arrow", quantity: 3, chance: 0.4 },
    ],
  },
  3: {
    cultivation: [22, 38],
    rewards: [
      { itemId: "serpent-scale", quantity: 2, chance: 0.6 },
      { itemId: "iron-essence", quantity: 1, chance: 0.5 },
      { itemId: "iron-arrow", quantity: 4, chance: 0.4 },
    ],
  },
  4: {
    cultivation: [32, 54],
    rewards: [
      { itemId: "iron-essence", quantity: 2, chance: 0.6 },
      { itemId: "beast-core-low", quantity: 1, chance: 0.5 },
      { itemId: "spirit-piercing-arrow", quantity: 2, chance: 0.3 },
    ],
  },
};

/** 宝箱节点：灵石 + 物品池 */
export interface ChestPool {
  spiritStones: [number, number];
  rewards: ExpeditionDrop[];
}

export const DEPTH_CHEST_POOLS: Record<LayerDepth, ChestPool> = {
  1: {
    spiritStones: [8, 16],
    rewards: [
      { itemId: "qi-gathering-pill", quantity: 1, chance: 0.35 },
      { itemId: "healing-pill", quantity: 1, chance: 0.3 },
    ],
  },
  2: {
    spiritStones: [14, 26],
    rewards: [
      { itemId: "qi-gathering-pill", quantity: 1, chance: 0.4 },
      { itemId: "mana-pill", quantity: 1, chance: 0.3 },
      { itemId: "wolf-fang-arrow", quantity: 3, chance: 0.3 },
    ],
  },
  3: {
    spiritStones: [22, 40],
    rewards: [
      { itemId: "mana-pill", quantity: 1, chance: 0.4 },
      { itemId: "stasis-pill", quantity: 1, chance: 0.3 },
      { itemId: "serpent-scale-arrow", quantity: 3, chance: 0.3 },
    ],
  },
  4: {
    spiritStones: [34, 60],
    rewards: [
      { itemId: "foundation-pill", quantity: 1, chance: 0.3 },
      { itemId: "golden-core-pill", quantity: 1, chance: 0.15 },
      { itemId: "stasis-pill", quantity: 1, chance: 0.35 },
      { itemId: "spirit-jade-pendant", quantity: 1, chance: 0.1 },
    ],
  },
};

/** 禁制节点：耗灵力解禁得全奖励；强闯则伤势 + 奖励减半 */
export interface WardPool {
  /** 正常解禁灵力消耗 */
  manaCost: number;
  /** 强闯新增伤势区间 */
  forceInjury: [number, number];
  rewards: ExpeditionDrop[];
}

export const DEPTH_WARD_POOLS: Record<LayerDepth, WardPool> = {
  1: {
    manaCost: 6,
    forceInjury: [3, 6],
    rewards: [
      { itemId: "spirit-grass", quantity: 4, chance: 0.9 },
      { itemId: "qi-gathering-pill", quantity: 1, chance: 0.4 },
    ],
  },
  2: {
    manaCost: 10,
    forceInjury: [5, 9],
    rewards: [
      { itemId: "mist-fox-tail", quantity: 2, chance: 0.6 },
      { itemId: "mana-pill", quantity: 1, chance: 0.4 },
    ],
  },
  3: {
    manaCost: 14,
    forceInjury: [7, 12],
    rewards: [
      { itemId: "iron-essence", quantity: 2, chance: 0.6 },
      { itemId: "stasis-pill", quantity: 1, chance: 0.4 },
    ],
  },
  4: {
    manaCost: 18,
    forceInjury: [9, 15],
    rewards: [
      { itemId: "beast-core-low", quantity: 2, chance: 0.6 },
      { itemId: "foundation-pill", quantity: 1, chance: 0.35 },
      { itemId: "golden-core-pill", quantity: 1, chance: 0.15 },
    ],
  },
};

/** 奇遇节点：修为/心境 + 稀有物品 */
export interface EncounterPool {
  cultivation: [number, number];
  mindChance: number;
  rewards: ExpeditionDrop[];
}

export const DEPTH_ENCOUNTER_POOLS: Record<LayerDepth, EncounterPool> = {
  1: {
    cultivation: [16, 30],
    mindChance: 0.25,
    rewards: [{ itemId: "spirit-jade-pendant", quantity: 1, chance: 0.08 }],
  },
  2: {
    cultivation: [26, 46],
    mindChance: 0.3,
    rewards: [{ itemId: "spirit-jade-pendant", quantity: 1, chance: 0.12 }],
  },
  3: {
    cultivation: [40, 68],
    mindChance: 0.35,
    rewards: [
      { itemId: "spirit-jade-pendant", quantity: 1, chance: 0.16 },
      { itemId: "beast-core-low", quantity: 1, chance: 0.4 },
    ],
  },
  4: {
    cultivation: [56, 92],
    mindChance: 0.4,
    rewards: [
      { itemId: "spirit-jade-pendant", quantity: 1, chance: 0.2 },
      { itemId: "foundation-pill", quantity: 1, chance: 0.3 },
      { itemId: "golden-core-pill", quantity: 1, chance: 0.12 },
    ],
  },
};

/** 节点类型展示文案（面板与日志用） */
export const NODE_TYPE_LABEL: Record<ExpeditionNodeType, string> = {
  combat: "战斗",
  gather: "采集",
  chest: "宝箱",
  ward: "禁制",
  encounter: "奇遇",
};

export const NODE_TYPE_FLAVOR: Record<ExpeditionNodeType, string> = {
  combat: "妖气浮动，恐有一战",
  gather: "灵机蕴草，或可采集",
  chest: "尘封宝箱，不知藏有何物",
  ward: "古禁横亘，需灵力或蛮力破之",
  encounter: "机缘隐现，祸福难料",
};
