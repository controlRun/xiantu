import { createInitialPlayer } from "../data/initialPlayer";
import { getRealmById } from "../data/realms";
import { createSpiritualRoot } from "../data/spiritualRoots";
import {
  SAVE_SCHEMA_VERSION,
  type ElementType,
  type EquipmentState,
  type InventoryStack,
  type Player,
  type SaveData,
  type SpiritualRoot,
} from "../types/game";

const SAVE_KEY = "xiantu.save.v1";

export const SAVE_SLOT_LABEL = "本地一号存档";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const normalizeInventory = (value: unknown): InventoryStack[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isObject(entry) || typeof entry.itemId !== "string") {
        return null;
      }

      return {
        itemId: entry.itemId,
        quantity: Math.max(1, Math.floor(toNumber(entry.quantity, 1))),
      };
    })
    .filter((entry): entry is InventoryStack => entry !== null);
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
};

const normalizeEquipment = (value: unknown): EquipmentState => {
  const emptyEquipment: EquipmentState = {
    weapon: null,
    armor: null,
    accessory: null,
  };

  if (!isObject(value)) {
    return emptyEquipment;
  }

  return {
    weapon: typeof value.weapon === "string" ? value.weapon : null,
    armor: typeof value.armor === "string" ? value.armor : null,
    accessory: typeof value.accessory === "string" ? value.accessory : null,
  };
};

const isElementType = (value: unknown): value is ElementType =>
  value === "metal" ||
  value === "wood" ||
  value === "water" ||
  value === "fire" ||
  value === "earth";

const isSpiritualRoot = (value: unknown): value is SpiritualRoot => {
  if (!isObject(value) || !Array.isArray(value.elements)) {
    return false;
  }

  return (
    value.elements.every(isElementType) &&
    typeof value.name === "string" &&
    typeof value.grade === "string" &&
    typeof value.purity === "number" &&
    typeof value.cultivationMultiplier === "number" &&
    typeof value.breakthroughBonus === "number"
  );
};

const migratePlayer = (value: unknown): Player => {
  const fallback = createInitialPlayer();

  if (!isObject(value)) {
    return fallback;
  }

  const legacyRealm = isObject(value.realm) ? value.realm : null;
  const realmId =
    typeof value.realmId === "string"
      ? value.realmId
      : typeof legacyRealm?.id === "string"
        ? legacyRealm.id
        : fallback.realmId;
  const realm = getRealmById(realmId);
  const legacyCultivation = isObject(value.cultivation)
    ? value.cultivation
    : null;
  const legacyAttributes = isObject(value.attributes) ? value.attributes : null;
  const legacyHealth = isObject(value.health) ? value.health : null;
  const legacyMana = isObject(value.mana) ? value.mana : null;

  return {
    ...fallback,
    id: typeof value.id === "string" ? value.id : fallback.id,
    name: typeof value.name === "string" ? value.name : fallback.name,
    realmId: realm.id,
    spiritualRoot: isSpiritualRoot(value.spiritualRoot)
      ? value.spiritualRoot
      : createSpiritualRoot(),
    cultivation: {
      current: Math.min(
        realm.breakthrough.requiredCultivation,
        toNumber(legacyCultivation?.current, fallback.cultivation.current),
      ),
      required: realm.breakthrough.requiredCultivation,
      lastGain: toNumber(legacyCultivation?.lastGain, 0),
    },
    age: toNumber(value.age, fallback.age),
    lifespan: toNumber(value.lifespan, fallback.lifespan),
    health: {
      current: toNumber(legacyHealth?.current, fallback.health.current),
      max: toNumber(legacyHealth?.max, fallback.health.max),
    },
    mana: {
      current: toNumber(legacyMana?.current, fallback.mana.current),
      max: toNumber(legacyMana?.max, fallback.mana.max),
    },
    spiritStones: toNumber(value.spiritStones, fallback.spiritStones),
    attributes: {
      rootBone: toNumber(legacyAttributes?.rootBone, fallback.attributes.rootBone),
      comprehension: toNumber(
        legacyAttributes?.comprehension,
        fallback.attributes.comprehension,
      ),
      luck: toNumber(legacyAttributes?.luck, fallback.attributes.luck),
      mind: toNumber(legacyAttributes?.mind, fallback.attributes.mind),
      divineSense: toNumber(
        legacyAttributes?.divineSense,
        fallback.attributes.divineSense,
      ),
    },
    inventory: normalizeInventory(value.inventory),
    equipment: normalizeEquipment(value.equipment),
    learnedManualIds: normalizeStringArray(value.learnedManualIds),
    sectId: typeof value.sectId === "string" ? value.sectId : null,
    sectContribution: toNumber(value.sectContribution, fallback.sectContribution),
    createdAt:
      typeof value.createdAt === "string" ? value.createdAt : fallback.createdAt,
    updatedAt: new Date().toISOString(),
  };
};

const normalizeSaveData = (value: unknown): SaveData | null => {
  if (!isObject(value) || !isObject(value.player)) {
    return null;
  }

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: typeof value.savedAt === "string" ? value.savedAt : new Date().toISOString(),
    player: migratePlayer(value.player),
  };
};

export const createSaveData = (player: Player): SaveData => ({
  schemaVersion: SAVE_SCHEMA_VERSION,
  savedAt: new Date().toISOString(),
  player: {
    ...player,
    updatedAt: new Date().toISOString(),
  },
});

export const saveGame = (player: Player) => {
  const save = createSaveData(player);
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  return save;
};

export const loadGame = (): SaveData | null => {
  const rawSave = localStorage.getItem(SAVE_KEY);

  if (!rawSave) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSave) as unknown;
    const save = normalizeSaveData(parsed);

    if (save) {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    }

    return save;
  } catch {
    return null;
  }
};

export const clearSave = () => {
  localStorage.removeItem(SAVE_KEY);
};
