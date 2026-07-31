export const SAVE_SCHEMA_VERSION = 6;

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
  /** 灵石基准价：商店按倍率加价出售，出售给商店为 floor(value * 0.6) */
  value: number;
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
  /** 战斗命中加成（小数，如 0.02 = +2%）；旧装备缺省 0 */
  accuracyBonus?: number;
  /** 战斗暴击加成（小数）；旧装备缺省 0 */
  critBonus?: number;
  /** 伤势获取减免（小数，如 0.2 = 少受 20% 伤势）；旧装备缺省 0 */
  injuryResist?: number;
}

export interface EquipmentDefinition {
  itemId: string;
  name: string;
  slot: EquipmentSlot;
  description: string;
  effects: EquipmentEffects;
  compatibleArrows?: string[];
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
  /** 战斗暴击加成：天灵根 0.05 → 杂灵根 0（旧存档缺省 0） */
  battleCritBonus?: number;
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

/**
 * 敌方行为档位：决定反击的命中/暴击/连击/防御倾向。
 * beast 野兽（低命中、高频率二连）、evil 邪修（高暴击）、guard 守卫（高防低速）。
 */
export type MonsterBehaviorId = "beast" | "evil" | "guard";

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
  /** 行为档位；缺省按 beast 处理 */
  behavior?: MonsterBehaviorId;
  /** 秘境守关者：固定挑战入口，不计入随机遭遇池 */
  isBoss?: boolean;
}

export type TargetZoneId = "head" | "chest" | "arm" | "leg";

export interface ArrowDefinition {
  itemId: string;
  name: string;
  power: number;
  accuracy: number;
  description: string;
}

/** 部位命中后挂在敌人身上的削弱效果（叠层、按回合衰减） */
export interface ZoneDebuffSpec {
  /** 削弱维度：腿部降命中、手臂降反击伤害 */
  kind: "leg" | "arm";
  /** 每层对敌方命中率的加成（负值），默认 -0.08 */
  enemyHit?: number;
  /** 每层对敌方反击伤害的乘算削减，默认 0.12（即 ×(1-0.12)） */
  enemyDamage?: number;
  /** 持续回合数 */
  duration: number;
}

export interface TargetZoneDefinition {
  id: TargetZoneId;
  name: string;
  accuracyModifier: number;
  damageMultiplier: number;
  criticalChance: number;
  description: string;
  /** 命中后附加的敌方削弱效果；头部不加（其高暴低命中本身即特性） */
  onHitDebuff?: ZoneDebuffSpec;
}

/** 战前整备：携带箭矢/丹药与撤退策略 */
export type RetreatRule = "never" | "hp30" | "hp50" | "round6";

export interface BattleLoadout {
  /** 携带参战的箭矢 id（实物箭 itemId 或灵力箭 tier id），最多 3 种 */
  arrowIds: string[];
  /** 携带的战斗丹药 itemId，最多 2 种 */
  pillIds: string[];
  /** 自动撤退策略 */
  retreatRule: RetreatRule;
}

/** 对战场景：开战时随机选取一幅水墨背景 */
export type BattleBackgroundId =
  | "desert"
  | "bamboo"
  | "cliff"
  | "water"
  | "rooftop"
  | "palace";

/** 部位命中累积的敌方削弱状态：层数（封顶 3）与各自的失效回合 */
export interface EnemyDebuffState {
  leg: number;
  arm: number;
  /** 各维度 debuff 失效时的回合号（含当回合）；层数归零时重置 */
  expireRound: { leg: number; arm: number };
}

export interface ArcheryDuelState {
  monster: MonsterDefinition;
  monsterHealth: number;
  playerHealth: number;
  round: number;
  finished: boolean;
  victory: boolean | null;
  logs: string[];
  lastEnemyShot?: {
    hit: boolean;
    damage: number;
    targetName: string;
    /** 敌方本次反击是否暴击（按行为档暴击率掷出） */
    critical?: boolean;
  };
  /** 模拟对战（演武）：对手血量无限，不会被打败，只能由玩家主动退出或力竭落败 */
  endless?: boolean;
  /** 本场对战的背景场景 */
  background: BattleBackgroundId;
  /** 部位命中挂上的敌方削弱（腿降命中、臂降伤害） */
  enemyDebuffs?: EnemyDebuffState;
  /** 战前整备带入的携带配置 */
  loadout?: BattleLoadout;
  /** 回合上限覆盖（Boss 战放宽；缺省走 MAX_ARCHERY_ROUNDS） */
  maxRounds?: number;
}

export interface ArcheryShotResult {
  player: Player;
  duel: ArcheryDuelState;
  battleResult: BattleResult | null;
  message: string;
  pendingDamage?: {
    damage: number;
    critical: boolean;
    targetName: string;
    /** 瞄准部位：视觉命中后据此结算部位 debuff */
    targetId: TargetZoneId;
  };
}

export type BattlePhase =
  | "idle"
  | "aiming"
  | "drawing"
  | "flight"
  | "resolving"
  | "enemyTurn"
  | "finished";

export interface AimPosition {
  x: number;
  y: number;
}

export interface BattleAnimation {
  phase: BattlePhase;
  aimPosition: AimPosition;
  currentZone: TargetZoneId;
  drawPower: number;
  showDamage: boolean;
  lastDamage: number;
  lastCritical: boolean;
  lastHit: boolean;
}

export type BattleAnimationAction =
  | { type: "START_AIMING" }
  | { type: "UPDATE_AIM"; position: AimPosition; zone: TargetZoneId }
  | { type: "START_DRAWING" }
  | { type: "UPDATE_DRAW_POWER"; power: number }
  | { type: "START_FLIGHT"; hit?: boolean; damage?: number; critical?: boolean; drawPower?: number }
  | { type: "RESOLVE"; hit: boolean; damage: number; critical: boolean }
  | { type: "ENEMY_TURN" }
  | { type: "RESET_TO_AIMING" }
  | { type: "FINISH" };

export interface AlchemyRecipe {
  id: string;
  name: string;
  output: ItemCost;
  ingredients: ItemCost[];
  spiritStoneCost: number;
  baseSuccessRate: number;
  minDivineSense: number;
  description: string;
  /** 炼器配方的境界门槛（炼器专用，丹方缺省不限） */
  minRealmOrder?: number;
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
  /** 地区限定：对应 monsters 的 area（如「青石山脚」）；缺省 = 所有地区可抽 */
  areas?: string[];
  /** 博弈风险：非战斗分支掷伤势（战斗分支由 battleSystem 计伤，不重复） */
  injury?: [number, number];
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
  /** 主修五行属性 */
  element: ElementType;
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

export type PlayerGender = "male" | "female";

/** 修行统计：击杀数与按游戏内日（age×360 取整）索引的行为印记 */
export interface PlayerStats {
  monstersKilled: number;
  bossesKilled: number;
  /** 最近一次打坐修炼的游戏日 */
  lastCultivateDay: number;
  /** 最近一次挑战秘境 Boss 的游戏日（每日限一次） */
  lastBossDay: number;
}

/** 秘境远征节点类型 */
export type ExpeditionNodeType =
  | "combat"
  | "gather"
  | "chest"
  | "ward"
  | "encounter";

/** 远征节点：每层掷 3 个异型分支供玩家择一 */
export interface ExpeditionNode {
  id: string;
  type: ExpeditionNodeType;
  resolved: boolean;
  /** 战斗节点：掷节点时固定的怪物 id（持久化，展示与应战一致） */
  monsterId?: string;
}

/** 秘境远征局状态：持久化至 Player，刷新可续 */
export interface SecretRealmRun {
  locationId: string;
  /** 当前层数 1–5（5 = Boss 层） */
  depth: number;
  /** 当前层的分支节点（Boss 层为空） */
  nodes: ExpeditionNode[];
  /** 本局未入库的非战斗收益（战败丢弃，撤离/通关入库） */
  loot: ItemCost[];
}

export interface Player {
  id: string;
  name: string;
  gender: PlayerGender;
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
  /** 当前所在地图地点 ID */
  locationId: string;
  /** 洞府所在灵地 ID（一次性搭建，永久归属） */
  caveDwellingId: string | null;
  /** 伤势值（0–100）：战败/突破失败累积，降战力，服丹或静养化解 */
  injury: number;
  /** 限次丹药已服次数（itemId → 次数） */
  pillUseCounts: Record<string, number>;
  /** 修行统计（三期：目标派生与 Boss 每日限次的数据源） */
  stats: PlayerStats;
  /** 秘境远征局状态（二期：节点远征，缺省 = 无在途局） */
  secretRealmRun?: SecretRealmRun;
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

/** 战败惩罚明细（按境界分级；演武全免，主动撤退减半） */
export interface BattlePenalty {
  /** 新增伤势 */
  injury: number;
  /** 损失灵石 */
  lostStones: number;
  /** 损失材料/箭矢 */
  lostItems: ItemCost[];
  /** 额外流逝寿元（天） */
  lostDays: number;
}

export interface BattleResult {
  player: Player;
  monster: MonsterDefinition;
  victory: boolean;
  reward: BattleReward;
  logs: string[];
  message: string;
  isSparring?: boolean;
  /** 主动撤退（非战败）：失败惩罚据此减半 */
  retreated?: boolean;
  /** 战败惩罚明细；无惩罚（前期/演武）时缺省 */
  penalty?: BattlePenalty;
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
