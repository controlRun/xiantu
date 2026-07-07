import type { Player, PlayerAttributes } from "../types/game";

const rollAttribute = (base: number, spread: number) =>
  base + Math.floor(Math.random() * spread);

const createAttributes = (): PlayerAttributes => ({
  rootBone: rollAttribute(4, 5),
  comprehension: rollAttribute(4, 5),
  luck: rollAttribute(3, 7),
  mind: rollAttribute(5, 4),
  divineSense: rollAttribute(3, 5),
});

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createInitialPlayer = (): Player => {
  const now = new Date().toISOString();
  const attributes = createAttributes();

  return {
    id: createId(),
    name: "无名凡人",
    realm: {
      id: "mortal",
      name: "凡人",
    },
    cultivation: {
      realmId: "qi-refining-1",
      realmTitle: "炼气一层",
      current: 0,
      required: 100,
      breakthroughChance: 0.65,
    },
    age: 16,
    lifespan: 80,
    health: {
      current: 100,
      max: 100,
    },
    mana: {
      current: 30,
      max: 30,
    },
    spiritStones: 0,
    attributes,
    inventory: [],
    sectId: null,
    createdAt: now,
    updatedAt: now,
  };
};
