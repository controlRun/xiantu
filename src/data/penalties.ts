/** 战败惩罚分级表：按境界 order 从高到低匹配，缺省走最低档（无惩罚） */

export interface DefeatPenaltyTier {
  minRealmOrder: number;
  /** 伤势增量区间 [min, max]，0 表示无伤势 */
  injury: [number, number];
  /** 是否随机损失一组材料/箭矢 */
  loseMaterialStack: boolean;
  /** 灵石损失比例区间 [min, max]，[0,0] 表示不扣 */
  lostStonesRatio: [number, number];
  /** 额外流逝天数（寿元） */
  lostDays: number;
  description: string;
}

export const defeatPenaltyTiers: DefeatPenaltyTier[] = [
  {
    minRealmOrder: 16,
    injury: [30, 40],
    loseMaterialStack: true,
    lostStonesRatio: [0.08, 0.15],
    lostDays: 3,
    description: "元婴境以上战败，根基受损：伤势、灵石与寿元折损更重。",
  },
  {
    minRealmOrder: 10,
    injury: [20, 30],
    loseMaterialStack: true,
    lostStonesRatio: [0.05, 0.1],
    lostDays: 2,
    description: "高阶修士战败，代价沉重：伤势、灵石与寿元俱损。",
  },
  {
    minRealmOrder: 3,
    injury: [10, 20],
    loseMaterialStack: true,
    lostStonesRatio: [0, 0],
    lostDays: 0,
    description: "修行渐深后战败，会受伤并遗失一组材料。",
  },
  {
    minRealmOrder: 0,
    injury: [0, 0],
    loseMaterialStack: false,
    lostStonesRatio: [0, 0],
    lostDays: 0,
    description: "初入修途，败亦无碍，只当是一场历练。",
  },
];

export const getDefeatPenaltyTier = (realmOrder: number): DefeatPenaltyTier =>
  defeatPenaltyTiers.find((tier) => realmOrder >= tier.minRealmOrder) ??
  defeatPenaltyTiers[defeatPenaltyTiers.length - 1];
