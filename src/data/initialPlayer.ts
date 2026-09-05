import { getRealmById } from "./realms";
import { createSpiritualRoot } from "./spiritualRoots";
import type {
  InventoryStack,
  Player,
  PlayerAttributes,
  PlayerGender,
} from "../types/game";

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
  { itemId: "wooden-arrow", quantity: 20 },
  { itemId: "iron-arrow", quantity: 6 },
];

export const createInitialPlayer = (
  name = "无名凡人",
  gender: PlayerGender = "male",
): Player => {
  const now = new Date().toISOString();
  const attributes = createAttributes();
  const realm = getRealmById("mortal");

  return {
    id: createId(),
    name,
    gender,
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
    equipment: {
      weapon: "ironwood-sword",
      armor: null,
      accessory: null,
    },
    learnedManualIds: [],
    sectId: null,
    sectContribution: 0,
    sectRank: 0,
    locationId: "qingshi-town",
    caveDwellingId: null,
    hasEnteredSpiritWorld: false,
    injury: 0,
    pillToxicity: 0,
    pillUseCounts: {},
    npcGiftClaimedIds: [],
    npcRelations: {},
    stats: {
      monstersKilled: 0,
      bossesKilled: 0,
      lastCultivateDay: -1,
      lastBossDay: -1,
    },
    eventLog: [],
    createdAt: now,
    updatedAt: now,
  };
};
