/**
 * 数值平衡参考表：各境界推荐战力区间。
 * 区间以 powerSystem.getPlayerPower 的典型玩家模拟值为锚（下界 ≈ 可推进，
 * 上界 ≈ 同档舒适历练），仅供展示层提示，不参与战斗结算。
 */

export interface RealmPowerBand {
  order: number;
  /** 代表性境界名 */
  realmName: string;
  /** 推荐战力区间 [下界, 上界] */
  band: [number, number];
}

export const REALM_POWER_BANDS: RealmPowerBand[] = [
  { order: 0, realmName: "凡人", band: [100, 140] },
  { order: 1, realmName: "炼气一层", band: [110, 155] },
  { order: 2, realmName: "炼气二层", band: [125, 175] },
  { order: 3, realmName: "炼气三层", band: [140, 195] },
  { order: 4, realmName: "炼气四层", band: [160, 230] },
  { order: 5, realmName: "炼气五层", band: [180, 250] },
  { order: 6, realmName: "炼气六层", band: [200, 285] },
  { order: 7, realmName: "炼气七层", band: [220, 310] },
  { order: 8, realmName: "炼气八层", band: [245, 345] },
  { order: 9, realmName: "炼气九层", band: [290, 405] },
  { order: 10, realmName: "筑基初期", band: [345, 490] },
  { order: 11, realmName: "筑基中期", band: [390, 550] },
  { order: 12, realmName: "筑基后期", band: [400, 560] },
  { order: 13, realmName: "金丹初期", band: [530, 770] },
  { order: 14, realmName: "金丹中期", band: [590, 860] },
  { order: 15, realmName: "金丹后期", band: [660, 950] },
  { order: 16, realmName: "元婴初期", band: [840, 1210] },
  { order: 17, realmName: "元婴中期", band: [930, 1350] },
  { order: 18, realmName: "元婴后期", band: [1030, 1490] },
  { order: 19, realmName: "化神初期", band: [1310, 1890] },
  { order: 20, realmName: "化神中期", band: [1460, 2110] },
  { order: 21, realmName: "化神后期", band: [1630, 2350] },
  { order: 22, realmName: "炼虚初期", band: [1850, 2700] },
  { order: 23, realmName: "炼虚中期", band: [2050, 3000] },
  { order: 24, realmName: "炼虚后期", band: [2250, 3300] },
  { order: 25, realmName: "合体初期", band: [2500, 3650] },
  { order: 26, realmName: "合体中期", band: [2750, 4000] },
  { order: 27, realmName: "合体后期", band: [3000, 4400] },
  { order: 28, realmName: "大乘初期", band: [3300, 4850] },
  { order: 29, realmName: "大乘中期", band: [3650, 5350] },
  { order: 30, realmName: "大乘后期", band: [4000, 5900] },
];

/** 取指定境界的战力区间；越界向两端收敛 */
export const getRealmPowerBand = (order: number): RealmPowerBand => {
  if (order <= 0) {
    return REALM_POWER_BANDS[0];
  }

  return (
    REALM_POWER_BANDS.find((entry) => entry.order === order) ??
    REALM_POWER_BANDS[REALM_POWER_BANDS.length - 1]
  );
};

/** 怪物代表境界：取其适用区间的中点，用于换算区域推荐战力 */
export const getMonsterTypicalOrder = (monster: {
  minRealmOrder: number;
  maxRealmOrder: number;
}): number => {
  // maxRealmOrder 99 之类的开放上界（Boss）按 30（大乘后期）封顶折算
  const cap = Math.min(monster.maxRealmOrder, 30);
  return Math.round((monster.minRealmOrder + cap) / 2);
};
