export const SAVE_SCHEMA_VERSION = 2;

export type ElementType = "metal" | "wood" | "water" | "fire" | "earth";

export type ItemType = "material" | "pill" | "manual" | "equipment" | "arrow" | "quest";

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

export interface ManualEffects {
  cultivationBonus?: number;
  breakthroughBonus?: number;
  alchemyBonus?: number;
  battleAttackBonus?: number;
  battleDefenseBonus?: number;
}

export interface ManualDefinition {
  itemId: string;
  name: string;
  description: string;
  sectId: string | null;
  effects: ManualEffects;
}

export type EquipmentSlot = "weapon" | "armor" | "accessory";

export interface EquipmentEffects {
  attack: number;
  defense: number;
}

export interface EquipmentDefinition {
  itemId: string;
  name: string;
  slot: EquipmentSlot;
  description: string;
  effects: EquipmentEffects;
}

export type EquipmentState = Record<EquipmentSlot, string | null>;

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

export type TargetZoneId = "head" | "chest" | "arm" | "leg";

export interface ArrowDefinition {
  itemId: string;
  name: string;
  power: number;
  accuracy: number;
  description: string;
}

export interface TargetZoneDefinition {
  id: TargetZoneId;
  name: string;
  accuracyModifier: number;
  damageMultiplier: number;
  criticalChance: number;
  description: string;
}

export interface ArcheryDuelState {
  monster: MonsterDefinition;
  monsterHealth: number;
  playerHealth: number;
  round: number;
  finished: boolean;
  victory: boolean | null;
  logs: string[];
}

export interface ArcheryShotResult {
  player: Player;
  duel: ArcheryDuelState;
  battleResult: BattleResult | null;
  message: string;
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

export type ExploreEventType = "gather" | "treasure" | "spring" | "ambush" | "insight";

export interface ExploreEventDefinition {
  id: string;
  title: string;
  type: ExploreEventType;
  description: string;
  minRealmOrder: number;
  weight: number;
  healthChange: [number, number];
  manaChange: [number, number];
  spiritStoneReward: [number, number];
  cultivationReward: [number, number];
  lootTable: LootDrop[];
  mindChance: number;
}

export interface SectTask {
  id: string;
  name: string;
  description: string;
  healthCost: number;
  manaCost: number;
  contributionReward: number;
  spiritStoneReward: [number, number];
  cultivationReward: [number, number];
  itemRewards: ItemCost[];
}

export interface SectShopItem {
  id: string;
  name: string;
  item: ItemCost;
  contributionCost: number;
  minRealmOrder: number;
}

export interface SectDefinition {
  id: string;
  name: string;
  alignment: "orthodox" | "alchemy" | "wandering";
  description: string;
  minRealmOrder: number;
  tasks: SectTask[];
  shop: SectShopItem[];
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
  equipment: EquipmentState;
  learnedManualIds: string[];
  sectId: string | null;
  sectContribution: number;
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

export interface ExplorationReward {
  spiritStones: number;
  cultivation: number;
  items: ItemCost[];
  mind: number;
  healthChange: number;
  manaChange: number;
}

export interface ExplorationResult {
  player: Player;
  event: ExploreEventDefinition;
  reward: ExplorationReward;
  logs: string[];
  message: string;
  battle?: BattleResult;
}

export interface SectActionResult {
  player: Player;
  success: boolean;
  message: string;
  logs: string[];
}

export interface SaveData {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  savedAt: string;
  player: Player;
}
