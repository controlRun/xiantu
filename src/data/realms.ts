import type { RealmDefinition } from "../types/game";

const noItems: RealmDefinition["breakthrough"]["requiredItems"] = [];

export const realms: RealmDefinition[] = [
  {
    id: "mortal",
    name: "凡人",
    majorRealm: "凡人",
    order: 0,
    breakthrough: {
      nextRealmId: "qi-refining-1",
      baseChance: 0.9,
      requiredCultivation: 60,
      minMind: 5,
      spiritStoneCost: 0,
      requiredItems: noItems,
    },
    rewards: { lifespan: 20, health: 20, mana: 20 },
  },
  {
    id: "qi-refining-1",
    name: "炼气一层",
    majorRealm: "炼气",
    order: 1,
    breakthrough: {
      nextRealmId: "qi-refining-2",
      baseChance: 0.84,
      requiredCultivation: 120,
      minMind: 5,
      spiritStoneCost: 0,
      requiredItems: noItems,
    },
    rewards: { lifespan: 5, health: 10, mana: 12 },
  },
  {
    id: "qi-refining-2",
    name: "炼气二层",
    majorRealm: "炼气",
    order: 2,
    breakthrough: {
      nextRealmId: "qi-refining-3",
      baseChance: 0.8,
      requiredCultivation: 180,
      minMind: 6,
      spiritStoneCost: 0,
      requiredItems: noItems,
    },
    rewards: { lifespan: 5, health: 10, mana: 12 },
  },
  {
    id: "qi-refining-3",
    name: "炼气三层",
    majorRealm: "炼气",
    order: 3,
    breakthrough: {
      nextRealmId: "qi-refining-4",
      baseChance: 0.74,
      requiredCultivation: 260,
      minMind: 6,
      spiritStoneCost: 5,
      requiredItems: [{ itemId: "qi-gathering-pill", quantity: 1 }],
    },
    rewards: { lifespan: 8, health: 14, mana: 16 },
  },
  {
    id: "qi-refining-4",
    name: "炼气四层",
    majorRealm: "炼气",
    order: 4,
    breakthrough: {
      nextRealmId: "qi-refining-5",
      baseChance: 0.7,
      requiredCultivation: 360,
      minMind: 7,
      spiritStoneCost: 10,
      requiredItems: [{ itemId: "qi-gathering-pill", quantity: 1 }],
    },
    rewards: { lifespan: 8, health: 14, mana: 16 },
  },
  {
    id: "qi-refining-5",
    name: "炼气五层",
    majorRealm: "炼气",
    order: 5,
    breakthrough: {
      nextRealmId: "qi-refining-6",
      baseChance: 0.66,
      requiredCultivation: 500,
      minMind: 7,
      spiritStoneCost: 15,
      requiredItems: [{ itemId: "qi-gathering-pill", quantity: 2 }],
    },
    rewards: { lifespan: 8, health: 16, mana: 18 },
  },
  {
    id: "qi-refining-6",
    name: "炼气六层",
    majorRealm: "炼气",
    order: 6,
    breakthrough: {
      nextRealmId: "qi-refining-7",
      baseChance: 0.62,
      requiredCultivation: 680,
      minMind: 8,
      spiritStoneCost: 20,
      requiredItems: [{ itemId: "qi-gathering-pill", quantity: 2 }],
    },
    rewards: { lifespan: 10, health: 18, mana: 20 },
  },
  {
    id: "qi-refining-7",
    name: "炼气七层",
    majorRealm: "炼气",
    order: 7,
    breakthrough: {
      nextRealmId: "qi-refining-8",
      baseChance: 0.58,
      requiredCultivation: 900,
      minMind: 9,
      spiritStoneCost: 30,
      requiredItems: [{ itemId: "qi-gathering-pill", quantity: 3 }],
    },
    rewards: { lifespan: 10, health: 20, mana: 22 },
  },
  {
    id: "qi-refining-8",
    name: "炼气八层",
    majorRealm: "炼气",
    order: 8,
    breakthrough: {
      nextRealmId: "qi-refining-9",
      baseChance: 0.54,
      requiredCultivation: 1180,
      minMind: 9,
      spiritStoneCost: 40,
      requiredItems: [{ itemId: "qi-gathering-pill", quantity: 3 }],
    },
    rewards: { lifespan: 10, health: 22, mana: 24 },
  },
  {
    id: "qi-refining-9",
    name: "炼气九层",
    majorRealm: "炼气",
    order: 9,
    breakthrough: {
      nextRealmId: "foundation-early",
      baseChance: 0.42,
      requiredCultivation: 1500,
      minMind: 10,
      spiritStoneCost: 100,
      requiredItems: [{ itemId: "foundation-pill", quantity: 1 }],
    },
    rewards: { lifespan: 80, health: 60, mana: 80 },
  },
  {
    id: "foundation-early",
    name: "筑基初期",
    majorRealm: "筑基",
    order: 10,
    breakthrough: {
      nextRealmId: "foundation-middle",
      baseChance: 0.55,
      requiredCultivation: 2200,
      minMind: 12,
      spiritStoneCost: 160,
      requiredItems: [{ itemId: "qi-gathering-pill", quantity: 5 }],
    },
    rewards: { lifespan: 30, health: 50, mana: 60 },
  },
  {
    id: "foundation-middle",
    name: "筑基中期",
    majorRealm: "筑基",
    order: 11,
    breakthrough: {
      nextRealmId: "foundation-late",
      baseChance: 0.48,
      requiredCultivation: 3200,
      minMind: 14,
      spiritStoneCost: 240,
      requiredItems: [{ itemId: "qi-gathering-pill", quantity: 8 }],
    },
    rewards: { lifespan: 30, health: 60, mana: 70 },
  },
  {
    id: "foundation-late",
    name: "筑基后期",
    majorRealm: "筑基",
    order: 12,
    breakthrough: {
      nextRealmId: null,
      baseChance: 0,
      requiredCultivation: 4800,
      minMind: 16,
      spiritStoneCost: 0,
      requiredItems: noItems,
    },
    rewards: { lifespan: 0, health: 0, mana: 0 },
  },
];

export const getRealmById = (realmId: string) =>
  realms.find((realm) => realm.id === realmId) ?? realms[0];

export const getNextRealm = (realmId: string) => {
  const current = getRealmById(realmId);

  if (!current.breakthrough.nextRealmId) {
    return null;
  }

  return getRealmById(current.breakthrough.nextRealmId);
};
