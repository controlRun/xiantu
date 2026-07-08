export const SAVE_SCHEMA_VERSION = 2;

export type ElementType = "metal" | "wood" | "water" | "fire" | "earth";

export type ItemType = "material" | "pill" | "manual" | "equipment" | "quest";

export type ItemRarity = "common" | "uncommon" | "rare" | "epic";

export interface ItemCost {
  itemId: string;
  quantity: number;
}

export interface LootDrop extends ItemCost {
  chance: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  description: string;
  stackable: boolean;
}

export interface InventoryStack {
  itemId: string;
  quantity: number;
}

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

export interface SpiritualRoot {
  elements: ElementType[];
  grade: "mixed" | "ordinary" | "true" | "earth" | "heaven";
  purity: number;
  cultivationMultiplier: number;
  breakthroughBonus: number;
  name: string;
}

export interface BreakthroughRule {
  nextRealmId: string | null;
  baseChance: number;
  requiredCultivation: number;
  minMind: number;
  spiritStoneCost: number;
  requiredItems: ItemCost[];
}

export interface RealmDefinition {
  id: string;
  name: string;
  majorRealm: string;
  order: number;
  breakthrough: BreakthroughRule;
  rewards: {
    lifespan: number;
    health: number;
    mana: number;
  };
}

export interface MonsterDefinition {
  id: string;
  name: string;
  area: string;
  minRealmOrder: number;
  maxRealmOrder: number;
  health: number;
  attack: number;
  defense: number;
  spiritStoneReward: [number, number];
  cultivationReward: [number, number];
  lootTable: LootDrop[];
}

export interface AlchemyRecipe {
  id: string;
  name: string;
  output: ItemCost;
  ingredients: ItemCost[];
  spiritStoneCost: number;
  baseSuccessRate: number;
  minDivineSense: number;
  description: string;
}

export interface CultivationState {
  current: number;
  required: number;
  lastGain: number;
}

export interface Player {
  id: string;
  name: string;
  realmId: string;
  spiritualRoot: SpiritualRoot;
  cultivation: CultivationState;
  age: number;
  lifespan: number;
  health: BoundedValue;
  mana: BoundedValue;
  spiritStones: number;
  attributes: PlayerAttributes;
  inventory: InventoryStack[];
  sectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BreakthroughCheck {
  canBreakthrough: boolean;
  chance: number;
  missingReasons: string[];
}

export interface BreakthroughResult {
  player: Player;
  success: boolean;
  message: string;
}

export interface BattleReward {
  spiritStones: number;
  cultivation: number;
  items: ItemCost[];
}

export interface BattleResult {
  player: Player;
  monster: MonsterDefinition;
  victory: boolean;
  reward: BattleReward;
  logs: string[];
  message: string;
}

export interface AlchemyCheck {
  canCraft: boolean;
  successRate: number;
  missingReasons: string[];
}

export interface AlchemyResult {
  player: Player;
  recipe: AlchemyRecipe;
  success: boolean;
  message: string;
  logs: string[];
}

export interface SaveData {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  savedAt: string;
  player: Player;
}
