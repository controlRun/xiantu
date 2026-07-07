import {
  SAVE_SCHEMA_VERSION,
  type Player,
  type SaveData,
} from "../types/game";

const SAVE_KEY = "xiantu.save.v1";

export const SAVE_SLOT_LABEL = "本地一号存档";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isSaveData = (value: unknown): value is SaveData => {
  if (!isObject(value)) {
    return false;
  }

  return (
    value.schemaVersion === SAVE_SCHEMA_VERSION &&
    typeof value.savedAt === "string" &&
    isObject(value.player)
  );
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
    return isSaveData(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const clearSave = () => {
  localStorage.removeItem(SAVE_KEY);
};
