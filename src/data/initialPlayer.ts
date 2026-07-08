import { getRealmById } from "./realms";
import { createSpiritualRoot } from "./spiritualRoots";
import type { InventoryStack, Player, PlayerAttributes } from "../types/game";

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

const createInitialInventory = (): InventoryStack[] => [
  { itemId: "basic-breathing-manual", quantity: 1 },
  { itemId: "spirit-grass", quantity: 6 },
  { itemId: "qi-gathering-pill", quantity: 2 },
];

export const createInitialPlayer = (): Player => {
  const now = new Date().toISOString();
  const attributes = createAttributes();
  const realm = getRealmById("mortal");

  return {
    id: createId(),
    name: "无名凡人",
    realmId: realm.id,
    spiritualRoot: createSpiritualRoot(),
    cultivation: {
      current: 0,
      required: realm.breakthrough.requiredCultivation,
      lastGain: 0,
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
    spiritStones: 12,
    attributes,
    inventory: createInitialInventory(),
    sectId: null,
    sectContribution: 0,
    createdAt: now,
    updatedAt: now,
  };
};
