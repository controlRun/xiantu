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
    behavior: "beast",
    lootTable: [
      { itemId: "wooden-arrow", quantity: 4, chance: 0.42 },
      { itemId: "spirit-grass", quantity: 1, chance: 0.32 },
      { itemId: "wolf-fang", quantity: 1, chance: 0.25 },
      { itemId: "beast-core-low", quantity: 1, chance: 0.12 },
      { itemId: "ironwood-sword", quantity: 1, chance: 0.05 },
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
    behavior: "beast",
    lootTable: [
      { itemId: "wooden-arrow", quantity: 5, chance: 0.36 },
      { itemId: "iron-arrow", quantity: 2, chance: 0.24 },
      { itemId: "spirit-grass", quantity: 2, chance: 0.38 },
      { itemId: "mist-fox-tail", quantity: 1, chance: 0.2 },
      { itemId: "beast-core-low", quantity: 1, chance: 0.24 },
      { itemId: "qi-gathering-pill", quantity: 1, chance: 0.1 },
      { itemId: "cloud-thread-robe", quantity: 1, chance: 0.05 },
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
    behavior: "guard",
    lootTable: [
      { itemId: "iron-arrow", quantity: 3, chance: 0.28 },
      { itemId: "beast-core-low", quantity: 1, chance: 0.46 },
      { itemId: "serpent-scale", quantity: 1, chance: 0.3 },
      { itemId: "iron-essence", quantity: 1, chance: 0.12 },
      { itemId: "qi-gathering-pill", quantity: 1, chance: 0.18 },
      { itemId: "spirit-grass", quantity: 3, chance: 0.28 },
      { itemId: "spirit-jade-pendant", quantity: 1, chance: 0.04 },
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
    behavior: "evil",
    lootTable: [
      { itemId: "iron-arrow", quantity: 4, chance: 0.32 },
      { itemId: "spirit-piercing-arrow", quantity: 1, chance: 0.1 },
      { itemId: "iron-essence", quantity: 1, chance: 0.22 },
      { itemId: "qi-gathering-pill", quantity: 1, chance: 0.28 },
      { itemId: "beast-core-low", quantity: 2, chance: 0.2 },
      { itemId: "foundation-pill", quantity: 1, chance: 0.04 },
      { itemId: "spirit-jade-pendant", quantity: 1, chance: 0.08 },
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
