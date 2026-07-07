export const SAVE_SCHEMA_VERSION = 1;

export interface BoundedValue {
  current: number;
  max: number;
}

export interface PlayerAttributes {
  rootBone: number;
  comprehension: number;
  luck: number;
  mind: number;
  divineSense: number;
}

export interface CultivationState {
  realmId: string;
  realmTitle: string;
  current: number;
  required: number;
  breakthroughChance: number;
}

export interface Player {
  id: string;
  name: string;
  realm: {
    id: string;
    name: string;
  };
  cultivation: CultivationState;
  age: number;
  lifespan: number;
  health: BoundedValue;
  mana: BoundedValue;
  spiritStones: number;
  attributes: PlayerAttributes;
  inventory: InventoryItem[];
  sectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  itemId: string;
  name: string;
  type: "material" | "pill" | "manual" | "equipment" | "quest";
  quantity: number;
}

export interface SaveData {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  savedAt: string;
  player: Player;
}
