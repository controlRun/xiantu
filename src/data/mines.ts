/** 灵矿矿脉：在矿点采矿耗费气血灵力与时间，产出灵石与材料 */

export interface MineTable {
  mineId: string;
  /** 采矿一次耗费的天数 */
  timeDays: number;
  healthCost: number;
  manaCost: number;
  /** 基础灵石产出区间 */
  spiritStones: [number, number];
  /** 每层境界小境界（realm order）额外 +N 灵石 */
  perOrderBonus: number;
  /** 额外材料掉落 */
  drops: { itemId: string; chance: number }[];
}

export const mineTables: MineTable[] = [
  {
    mineId: "qingshi-mine",
    timeDays: 1,
    healthCost: 10,
    manaCost: 10,
    spiritStones: [3, 7],
    perOrderBonus: 1,
    drops: [
      { itemId: "iron-essence", chance: 0.2 },
      { itemId: "spirit-grass", chance: 0.3 },
    ],
  },
  {
    mineId: "spirit-crystal-mine",
    timeDays: 1,
    healthCost: 16,
    manaCost: 16,
    spiritStones: [20, 40],
    perOrderBonus: 3,
    drops: [
      { itemId: "spirit-crystal", chance: 0.35 },
      { itemId: "thunder-essence", chance: 0.15 },
      { itemId: "immortal-herb", chance: 0.2 },
    ],
  },
];

export const getMineTable = (mineId: string | null | undefined) =>
  mineId
    ? mineTables.find((mine) => mine.mineId === mineId) ?? null
    : null;
