import type { MonsterDefinition } from "../types/game";

export const monsters: MonsterDefinition[] = [
  {
    id: "wild-wolf",
    name: "山野恶狼",
    area: "青石山脚",
    minRealmOrder: 0,
    maxRealmOrder: 2,
    health: 58,
    attack: 10,
    defense: 2,
    spiritStoneReward: [2, 5],
    cultivationReward: [12, 22],
    lootTable: [
      { itemId: "spirit-grass", quantity: 1, chance: 0.32 },
      { itemId: "beast-core-low", quantity: 1, chance: 0.12 },
    ],
  },
  {
    id: "mist-fox",
    name: "雾隐狐妖",
    area: "青石山腰",
    minRealmOrder: 1,
    maxRealmOrder: 5,
    health: 86,
    attack: 15,
    defense: 4,
    spiritStoneReward: [5, 10],
    cultivationReward: [24, 42],
    lootTable: [
      { itemId: "spirit-grass", quantity: 2, chance: 0.38 },
      { itemId: "beast-core-low", quantity: 1, chance: 0.24 },
      { itemId: "qi-gathering-pill", quantity: 1, chance: 0.1 },
    ],
  },
  {
    id: "rock-scaled-serpent",
    name: "岩鳞蛇",
    area: "乱石涧",
    minRealmOrder: 3,
    maxRealmOrder: 8,
    health: 128,
    attack: 22,
    defense: 8,
    spiritStoneReward: [10, 18],
    cultivationReward: [44, 72],
    lootTable: [
      { itemId: "beast-core-low", quantity: 1, chance: 0.46 },
      { itemId: "qi-gathering-pill", quantity: 1, chance: 0.18 },
      { itemId: "spirit-grass", quantity: 3, chance: 0.28 },
    ],
  },
  {
    id: "rogue-cultivator",
    name: "落魄邪修",
    area: "废弃古道",
    minRealmOrder: 6,
    maxRealmOrder: 12,
    health: 180,
    attack: 30,
    defense: 12,
    spiritStoneReward: [18, 36],
    cultivationReward: [70, 110],
    lootTable: [
      { itemId: "qi-gathering-pill", quantity: 1, chance: 0.28 },
      { itemId: "beast-core-low", quantity: 2, chance: 0.2 },
      { itemId: "foundation-pill", quantity: 1, chance: 0.04 },
    ],
  },
];

export const getMonstersForRealmOrder = (realmOrder: number) => {
  const matched = monsters.filter(
    (monster) =>
      realmOrder >= monster.minRealmOrder && realmOrder <= monster.maxRealmOrder,
  );

  return matched.length > 0 ? matched : [monsters[0]];
};
