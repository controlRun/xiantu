import {
  arrowDefinitions,
  getArrowDefinition,
  getTargetZone,
  targetZones,
} from "../data/arrows";
import { getItemDefinition } from "../data/items";
import { getMonsterBehavior } from "../data/monsterBehaviors";
import { getMonstersForRealmOrder, getSecretRealmBoss } from "../data/monsters";
import { getDefeatPenaltyTier } from "../data/penalties";
import { getPillDefinition } from "../data/pills";
import { getRealmById } from "../data/realms";
import {
  getSpiritArrowPower,
  getSpiritArrowTier,
  getUnlockedSpiritArrowTiers,
  getUsableSpiritArrowTiers,
  isSpiritArrowId,
  type SpiritArrowTier,
} from "../data/spiritArrows";
import type {
  ArcheryDuelState,
  ArcheryShotResult,
  ArrowDefinition,
  BattleBackgroundId,
  BattleLoadout,
  BattlePenalty,
  BattleResult,
  BattleStatusKind,
  BattleStatusSpec,
  BattleStatusState,
  EnemyDebuffState,
  ItemCost,
  MonsterDefinition,
  Player,
  TargetZoneId,
} from "../types/game";

export type { ArcheryShotResult };
import { clampInjury, getInjuryPenalty } from "./injurySystem";
import { clampPillToxicity } from "./pillToxicitySystem";
import { addItemStacks, consumeItemCosts, getInventoryQuantity } from "./inventorySystem";
import { getEquipmentEffects, getEquippedWeapon, getWeaponCompatibleArrows } from "./equipmentSystem";
import { getManualEffects } from "./manualSystem";
import { getSectPassiveBonuses } from "./sectSystem";
import { advanceTime, getGameDay } from "./timeSystem";

const MAX_ARCHERY_ROUNDS = 8;

/** 秘境 Boss 血厚防高，回合上限放宽 */
const BOSS_MAX_ROUNDS = 14;

/** 部位 debuff 叠加上限 */
const MAX_DEBUFF_STACKS = 3;

/** 腿部 debuff 每层命中惩罚 / 手臂 debuff 每层伤害削减（取自部位配置） */
const LEG_DEBUFF_HIT =
  targetZones.find((zone) => zone.onHitDebuff?.kind === "leg")?.onHitDebuff
    ?.enemyHit ?? -0.08;
const ARM_DEBUFF_DAMAGE =
  targetZones.find((zone) => zone.onHitDebuff?.kind === "arm")?.onHitDebuff
    ?.enemyDamage ?? 0.12;

/** 战斗状态叠加上限 */
const MAX_STATUS_STACKS = 3;

/** 中毒每层每回合跳伤（取碧毒箭 spec，怪物毒同样沿用此数值） */
const POISON_DAMAGE_PER_STACK =
  arrowDefinitions.find((arrow) => arrow.onHitStatus?.kind === "poison")
    ?.onHitStatus?.damagePerRound ?? 4;

/** 破甲每层被击伤害提升倍率 */
const ARMORBREAK_DAMAGE_BONUS =
  arrowDefinitions.find((arrow) => arrow.onHitStatus?.kind === "armorbreak")
    ?.onHitStatus?.damageTakenBonus ?? 0.15;

/** 回合推进时清理过期的敌方 debuff */
const decayEnemyDebuffs = (
  debuffs: EnemyDebuffState | undefined,
  round: number,
): EnemyDebuffState | undefined => {
  if (!debuffs) return undefined;
  const leg = round > debuffs.expireRound.leg ? 0 : debuffs.leg;
  const arm = round > debuffs.expireRound.arm ? 0 : debuffs.arm;

  if (leg === 0 && arm === 0) return undefined;

  return { leg, arm, expireRound: debuffs.expireRound };
};

/** 回合推进时清理过期的战斗状态（毒/眩晕/破甲），全空返回 undefined */
const decayStatuses = (
  statuses: BattleStatusState | undefined,
  round: number,
): BattleStatusState | undefined => {
  if (!statuses) return undefined;

  const next: BattleStatusState = {};
  let hasAny = false;

  for (const kind of Object.keys(statuses) as BattleStatusKind[]) {
    const effect = statuses[kind];
    if (effect && round <= effect.expireRound) {
      next[kind] = effect;
      hasAny = true;
    }
  }

  return hasAny ? next : undefined;
};

/**
 * 附加/刷新战斗状态：眩晕不叠层只刷时长，其余封顶 MAX_STATUS_STACKS；
 * 失效回合 = 当前回合 + duration − 1（对齐部位 debuff）。
 */
const applyStatusEffect = (
  current: BattleStatusState | undefined,
  spec: BattleStatusSpec,
  round: number,
): BattleStatusState => {
  const existing = current?.[spec.kind];
  const stacks =
    spec.kind === "stun"
      ? 1
      : Math.min(MAX_STATUS_STACKS, (existing?.stacks ?? 0) + 1);
  const expireRound =
    (existing?.stacks ?? 0) > 0
      ? Math.max(existing?.expireRound ?? 0, round + spec.duration - 1)
      : round + spec.duration - 1;

  return {
    ...current,
    [spec.kind]: { stacks, expireRound },
  };
};

/** 状态附加的日志文案（供箭矢命中与怪物反击复用） */
const statusApplyText = (name: string, spec: BattleStatusSpec): string => {
  if (spec.kind === "poison") return `${name}身中剧毒，毒劲渗入经脉。`;
  if (spec.kind === "armorbreak") return `${name}护体罡气被撕开，破甲缠身。`;
  return `${name}被震得晕眩，无力还射。`;
};

/** 玩家中毒：回合初跳伤（血线下限 1），返回扣伤后的血量 */
const tickPlayerPoison = (
  duel: ArcheryDuelState,
  playerHealth: number,
  logs: string[],
): number => {
  const poison = duel.playerStatuses?.poison;
  if (!poison || poison.stacks <= 0) return playerHealth;

  const dot = poison.stacks * POISON_DAMAGE_PER_STACK;
  logs.push(`第 ${duel.round} 回合：体内毒劲发作，气血 −${dot}。`);
  return Math.max(1, playerHealth - dot);
};

const randomInt = (min: number, max: number) =>
  min + Math.floor(Math.random() * (max - min + 1));

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** 对战背景库：沙漠、竹林、悬崖、水上、屋顶、宫墙 */
const battleBackgrounds: BattleBackgroundId[] = [
  "desert",
  "bamboo",
  "cliff",
  "water",
  "rooftop",
  "palace",
];

const randomBattleBackground = (): BattleBackgroundId =>
  battleBackgrounds[randomInt(0, battleBackgrounds.length - 1)];

const sparringOpponentNames = [
  "游方散修",
  "落魄道士",
  "江湖剑客",
  "云游僧人",
  "隐世散人",
  "落魄书生",
  "流浪武者",
  "无名修士",
];

const generateSparringOpponent = (player: Player): MonsterDefinition => {
  const realm = getRealmById(player.realmId);
  const realmOrder = realm.order;
  const name = sparringOpponentNames[randomInt(0, sparringOpponentNames.length - 1)];

  // Stats scale with player's realm order with some randomization
  const baseHealth = 40 + realmOrder * 18;
  const baseAttack = 8 + realmOrder * 3;
  const baseDefense = 1 + realmOrder * 2;

  const health = randomInt(Math.floor(baseHealth * 0.8), Math.floor(baseHealth * 1.2));
  const attack = randomInt(Math.floor(baseAttack * 0.8), Math.floor(baseAttack * 1.2));
  const defense = randomInt(Math.floor(baseDefense * 0.7), Math.floor(baseDefense * 1.3));

  // Sparring rewards: cultivation-focused, fewer spirit stones, no loot
  const spiritStoneMin = Math.max(1, Math.floor(realmOrder * 0.5));
  const spiritStoneMax = Math.max(2, realmOrder);
  const cultivationMin = Math.max(8, Math.floor(realmOrder * 4));
  const cultivationMax = Math.max(16, Math.floor(realmOrder * 8));

  return {
    id: `sparring-${name}`,
    name,
    area: "演武场",
    minRealmOrder: Math.max(0, realmOrder - 1),
    maxRealmOrder: realmOrder + 1,
    health,
    attack,
    defense,
    spiritStoneReward: [spiritStoneMin, spiritStoneMax],
    cultivationReward: [cultivationMin, cultivationMax],
    // 演武对手随机使用三种行为档，便于练习应对不同性格的敌人
    behavior: (["beast", "evil", "guard"] as const)[randomInt(0, 2)],
    lootTable: [],
  };
};

/** 按野外地点的区域挑选灵兽；该区域无合适灵兽时回退到全部区域 */
const chooseMonster = (player: Player, area?: string): MonsterDefinition => {
  const realm = getRealmById(player.realmId);
  const pool = getMonstersForRealmOrder(realm.order);
  const areaPool = area
    ? pool.filter((monster) => monster.area === area)
    : pool;
  const finalPool = areaPool.length > 0 ? areaPool : pool;

  return finalPool[randomInt(0, finalPool.length - 1)];
};

const formatLoot = (items: ItemCost[]) => {
  if (items.length === 0) {
    return "无额外掉落";
  }

  return items
    .map((item) => `${getItemDefinition(item.itemId)?.name ?? item.itemId} x${item.quantity}`)
    .join("，");
};

const rollLoot = (monster: MonsterDefinition): ItemCost[] =>
  monster.lootTable
    .filter((drop) => Math.random() <= drop.chance)
    .map((drop) => ({
      itemId: drop.itemId,
      quantity: drop.quantity,
    }));

export const canBattle = (player: Player): boolean => {
  const weapon = getEquippedWeapon(player);

  if (!weapon) {
    return false;
  }

  return (
    getAvailableArrowsForBattle(player).length > 0 || canUseSpiritArrows(player)
  );
};

export const getAvailableArrowsForBattle = (player: Player): ArrowDefinition[] => {
  const compatibleIds = getWeaponCompatibleArrows(player);

  return compatibleIds
    .map((id) => getArrowDefinition(id))
    .filter(
      (arrow): arrow is ArrowDefinition =>
        arrow !== undefined && getInventoryQuantity(player.inventory, arrow.itemId) > 0,
    );
};

/** 是否有可用灵力箭（境界已解锁且灵力足够） */
export const canUseSpiritArrows = (player: Player): boolean =>
  getUsableSpiritArrowTiers(player).length > 0;

/**
 * 本场对战可用的实物箭：按整备携带（loadout.arrowIds）过滤；
 * 演武切磋（endless）无消耗，列出全部武器兼容箭种（不看库存），
 * 便于空箭囊也能练习瞄准与测试伤害。
 */
export const getBattlePhysicalArrows = (
  player: Player,
  duel: ArcheryDuelState,
): ArrowDefinition[] => {
  const carriedIds = duel.loadout?.arrowIds;
  const base = duel.endless
    ? getWeaponCompatibleArrows(player)
        .map((id) => getArrowDefinition(id))
        .filter((arrow): arrow is ArrowDefinition => arrow !== undefined)
    : getAvailableArrowsForBattle(player);

  return carriedIds ? base.filter((arrow) => carriedIds.includes(arrow.itemId)) : base;
};

/** 本场对战可用的灵力化箭：按整备携带过滤 */
export const getBattleSpiritArrows = (
  player: Player,
  duel: ArcheryDuelState,
): SpiritArrowTier[] => {
  const carriedIds = duel.loadout?.arrowIds;
  const base = getUnlockedSpiritArrowTiers(player);

  return carriedIds ? base.filter((tier) => carriedIds.includes(tier.id)) : base;
};

/** 武器兼容的全部箭种定义（整备页候选用，不看库存） */
export const getCompatibleArrowDefinitions = (player: Player): ArrowDefinition[] =>
  getWeaponCompatibleArrows(player)
    .map((id) => getArrowDefinition(id))
    .filter((arrow): arrow is ArrowDefinition => arrow !== undefined);

export interface CombatArrow {
  itemId: string;
  name: string;
  power: number;
  accuracy: number;
  /** 灵力化箭：射出消耗灵力而非箭囊数量 */
  spirit: boolean;
  /** 实物箭矢命中附带的状态（毒/眩晕/破甲）；灵力化箭无此效果 */
  onHitStatus?: BattleStatusSpec;
}

/**
 * 统一解析参战箭矢：
 * - 实物箭（炼器/掉落所得）→ 取箭矢定义
 * - 灵力化箭（spirit- 前缀）→ 取档位，威力随境界成长
 */
export const getCombatArrow = (
  player: Player,
  arrowId: string,
): CombatArrow | undefined => {
  if (isSpiritArrowId(arrowId)) {
    const tier = getSpiritArrowTier(arrowId);

    if (!tier) {
      return undefined;
    }

    return {
      itemId: tier.id,
      name: tier.name,
      power: getSpiritArrowPower(player, tier),
      accuracy: tier.accuracy,
      spirit: true,
    };
  }

  const arrow = getArrowDefinition(arrowId);

  if (!arrow) {
    return undefined;
  }

  return {
    itemId: arrow.itemId,
    name: arrow.name,
    power: arrow.power,
    accuracy: arrow.accuracy,
    spirit: false,
    onHitStatus: arrow.onHitStatus,
  };
};

const getPlayerDefense = (player: Player) => {
  const realm = getRealmById(player.realmId);
  const manualEffects = getManualEffects(player);
  const equipmentEffects = getEquipmentEffects(player);
  // 宗门所长：如厚土堡锻体如山（随职位增长）
  const { defenseBonus } = getSectPassiveBonuses(player);

  return Math.floor(
    (4 +
      realm.order * 2 +
      Math.floor(player.attributes.mind / 2) +
      equipmentEffects.defense) *
      (1 + manualEffects.battleDefenseBonus) *
      (1 + defenseBonus),
  );
};

export const getShotChance = (player: Player, arrowItemId: string, targetId: TargetZoneId) => {
  const arrow = getCombatArrow(player, arrowItemId) ?? arrowDefinitions[0];
  const target = getTargetZone(targetId);
  const manualEffects = getManualEffects(player);
  const equipmentEffects = getEquipmentEffects(player);
  // 伤势拖累准头：伤势 50 → 命中 −10%
  const { hitPenalty } = getInjuryPenalty(player.injury);
  // 宗门所长：如金剑宗剑准（随职位增长）
  const { accuracyBonus } = getSectPassiveBonuses(player);

  return clamp(
    arrow.accuracy +
      target.accuracyModifier +
      player.attributes.divineSense * 0.006 +
      player.attributes.luck * 0.003 +
      manualEffects.battleAttackBonus * 0.15 +
      (equipmentEffects.accuracyBonus ?? 0) +
      accuracyBonus +
      hitPenalty,
    0.1,
    0.95,
  );
};

/**
 * 暴击率唯一权威算法：部位基础 + 气运 + 装备会心 + 灵根战斗暴击，夹取 [0.03, 0.45]。
 * 展示（BattleHUD）与结算（getPlayerShotDamage）共用，杜绝两边各写一份再漂移。
 */
export const getShotCriticalChance = (player: Player, targetId: TargetZoneId): number => {
  const target = getTargetZone(targetId);
  const equipmentEffects = getEquipmentEffects(player);
  return clamp(
    target.criticalChance +
      player.attributes.luck * 0.004 +
      (equipmentEffects.critBonus ?? 0) +
      (player.spiritualRoot.battleCritBonus ?? 0),
    0.03,
    0.45,
  );
};

export const getPlayerShotDamage = (
  player: Player,
  monster: MonsterDefinition,
  arrowItemId: string,
  targetId: TargetZoneId,
  chargeMultiplier = 1,
  armorBreakStacks = 0,
) => {
  const arrow = getCombatArrow(player, arrowItemId) ?? arrowDefinitions[0];
  const target = getTargetZone(targetId);
  const realm = getRealmById(player.realmId);
  const manualEffects = getManualEffects(player);
  const equipmentEffects = getEquipmentEffects(player);
  const behavior = getMonsterBehavior(monster);
  // 伤势削弱力道：伤势 50 → 伤害 −15%
  const { damageMul } = getInjuryPenalty(player.injury);
  // 暴击率：部位基础 + 气运 + 装备会心 + 灵根战斗暴击加成
  const criticalChance = getShotCriticalChance(player, targetId);
  const critical = Math.random() <= criticalChance;
  const baseDamage =
    arrow.power +
    realm.order * 4 +
    Math.floor(player.attributes.rootBone * 1.5) +
    equipmentEffects.attack;
  const rolledDamage = randomInt(
    Math.floor(baseDamage * 0.85),
    Math.ceil(baseDamage * 1.15),
  );
  // 蓄力影响伤害：轻拉只有五成力道，满蓄方可发挥全部威力
  const chargedDamage = Math.max(1, Math.round(rolledDamage * chargeMultiplier));
  // 守卫型敌人护体灵气厚重，defenseScale 放大其防御减伤
  const effectiveDefense = Math.floor(monster.defense * behavior.defenseScale);
  // 宗门所长：如金剑宗庚金剑气（随职位增长）
  const { damageBonus } = getSectPassiveBonuses(player);
  // 敌方破甲状态：每层提升我方命中伤害
  const damage = Math.max(
    1,
    Math.floor(
      chargedDamage *
        target.damageMultiplier *
        (critical ? 1.5 : 1) *
        (1 + armorBreakStacks * ARMORBREAK_DAMAGE_BONUS) *
        (1 + manualEffects.battleAttackBonus) *
        (1 + damageBonus) *
        damageMul -
        effectiveDefense,
    ),
  );

  return { damage, critical };
};

interface EnemyShot {
  targetName: string;
  hit: boolean;
  damage: number;
  critical: boolean;
}

/**
 * 敌方反击结算：
 * - 命中率受行为档（野兽偏低/邪修守卫偏高）与腿部 debuff 层数影响，下限 0.1
 * - 伤害受手臂 debuff 层数与行为档 damageScale 影响
 * - 按行为档 critChance 掷暴（邪修高暴）
 */
const getMonsterShot = (
  player: Player,
  monster: MonsterDefinition,
  duel: ArcheryDuelState,
  damageScale = 1,
): EnemyShot => {
  const target = targetZones[randomInt(0, targetZones.length - 1)];
  const behavior = getMonsterBehavior(monster);
  const legStacks = duel.enemyDebuffs?.leg ?? 0;
  const armStacks = duel.enemyDebuffs?.arm ?? 0;
  // 玩家被破甲：每层提升敌方命中我方时的伤害
  const playerArmorbreak = duel.playerStatuses?.armorbreak?.stacks ?? 0;
  const hitChance = clamp(
    0.68 +
      monster.attack * 0.004 -
      player.attributes.divineSense * 0.004 +
      behavior.hitModifier +
      legStacks * LEG_DEBUFF_HIT,
    0.1,
    0.9,
  );
  const critical = Math.random() <= behavior.critChance;

  if (Math.random() > hitChance) {
    return {
      targetName: target.name,
      hit: false,
      damage: 0,
      critical: false,
    };
  }

  const playerDefense = getPlayerDefense(player);
  const baseDamage = randomInt(
    Math.floor(monster.attack * 0.72),
    Math.ceil(monster.attack * 1.18),
  );
  const damage = Math.max(
    1,
    Math.floor(
      baseDamage *
        target.damageMultiplier *
        (critical ? behavior.critMultiplier : 1) *
        (1 + playerArmorbreak * ARMORBREAK_DAMAGE_BONUS) *
        (1 - armStacks * ARM_DEBUFF_DAMAGE) *
        behavior.damageScale *
        damageScale -
        playerDefense,
    ),
  );

  return {
    targetName: target.name,
    hit: true,
    damage,
    critical,
  };
};

/**
 * 反击段共用结算：掷一次反击（野兽档可能触发二连急射），写日志，
 * 扣血并汇总为单条 lastEnemyShot（视觉上仍只表现一支来箭）。
 */
const resolveEnemyCounter = (
  player: Player,
  duel: ArcheryDuelState,
  playerHealth: number,
  logs: string[],
): {
  playerHealth: number;
  lastEnemyShot: EnemyShot;
  playerStatuses: BattleStatusState | undefined;
} => {
  const behavior = getMonsterBehavior(duel.monster);
  const shots: EnemyShot[] = [getMonsterShot(player, duel.monster, duel)];

  // 野兽特性：概率触发二连急射，每箭按 doubleShotDamageScale 折损
  if (behavior.doubleShotChance > 0 && Math.random() <= behavior.doubleShotChance) {
    logs.push(`${duel.monster.name}攻势一急，接连射出两箭！`);
    shots.push(
      getMonsterShot(player, duel.monster, duel, behavior.doubleShotDamageScale),
    );
  }

  let health = playerHealth;
  let anyHit = false;
  let totalDamage = 0;
  let anyCrit = false;
  let lastTargetName = shots[shots.length - 1].targetName;

  for (const shot of shots) {
    if (!shot.hit) {
      logs.push(`${duel.monster.name}还射${shot.targetName}，被你侧身避开。`);
      continue;
    }

    anyHit = true;
    totalDamage += shot.damage;
    lastTargetName = shot.targetName;
    if (shot.critical) {
      anyCrit = true;
    }
    logs.push(
      `${duel.monster.name}反射${shot.targetName}，造成 ${shot.damage} 伤害${shot.critical ? "，正中要害" : ""}。`,
    );
  }

  health = Math.max(1, health - totalDamage);

  // 怪物反击命中时按 chance 附加状态（毒/破甲等特性）
  const monsterAttack = duel.monster.onHitStatus;
  const playerStatuses =
    anyHit && monsterAttack && Math.random() <= monsterAttack.chance
      ? applyStatusEffect(duel.playerStatuses, monsterAttack.spec, duel.round)
      : duel.playerStatuses;

  if (playerStatuses !== duel.playerStatuses) {
    logs.push(statusApplyText(duel.monster.name, monsterAttack!.spec));
  }

  return {
    playerHealth: health,
    lastEnemyShot: {
      hit: anyHit,
      damage: totalDamage,
      targetName: lastTargetName,
      critical: anyCrit,
    },
    playerStatuses,
  };
};

/**
 * 敌方回合统一结算：敌方中毒跳伤（演武不流血，可致死）→ 眩晕抑制反击。
 * 返回敌方血、是否眩晕、扣伤后的玩家血与（被抑制时缺省的）反击信息与玩家状态。
 */
const resolveEnemyTurn = (
  player: Player,
  duel: ArcheryDuelState,
  playerHealth: number,
  logs: string[],
): {
  monsterHealth: number;
  stunned: boolean;
  playerHealth: number;
  lastEnemyShot?: EnemyShot;
  playerStatuses?: BattleStatusState;
} => {
  let monsterHealth = duel.monsterHealth;
  let playerStatuses = duel.playerStatuses;
  let lastEnemyShot: EnemyShot | undefined;

  // 敌方中毒跳伤（演武对手无限血不结算）
  const poison = duel.enemyStatuses?.poison;
  if (poison && poison.stacks > 0 && !duel.endless) {
    const dot = poison.stacks * POISON_DAMAGE_PER_STACK;
    monsterHealth = Math.max(0, monsterHealth - dot);
    logs.push(`第 ${duel.round} 回合：${duel.monster.name}毒发，气血 −${dot}。`);
  }

  const stunned = (duel.enemyStatuses?.stun?.stacks ?? 0) > 0;
  const dead = !duel.endless && monsterHealth <= 0;

  if (stunned) {
    logs.push(`第 ${duel.round} 回合：${duel.monster.name}被震得晕眩，无力还射。`);
  } else if (!dead) {
    const counter = resolveEnemyCounter(player, duel, playerHealth, logs);
    playerHealth = counter.playerHealth;
    lastEnemyShot = counter.lastEnemyShot;
    playerStatuses = counter.playerStatuses;
  }

  return { monsterHealth, stunned, playerHealth, lastEnemyShot, playerStatuses };
};

/** 玩家防御化解敌矢（仅返还，不改公式、不重掷）：
 *  敌矢伤害已在 resolveEnemyCounter 预扣进 duel.playerHealth，
 *  此处按 refund 补回并改写 lastEnemyShot 供视觉演出（dodge 视为未命中）。
 *  refund 由 UI 侧按闪避率/格挡公式掷出，系统只做封顶（不超敌方伤害、不超血量上限）。 */
export interface EnemyDefense {
  kind: "dodge" | "block";
  refund: number;
}

export const applyEnemyDefense = (
  player: Player,
  duel: ArcheryDuelState,
  defense: EnemyDefense,
): ArcheryShotResult => {
  const enemyShot = duel.lastEnemyShot;

  if (!enemyShot || enemyShot.damage <= 0 || duel.finished) {
    return { player, duel, battleResult: null, message: "无从防御" };
  }

  const refunded = Math.min(
    defense.refund,
    enemyShot.damage,
    player.health.max - duel.playerHealth,
  );
  const playerHealth = Math.max(1, duel.playerHealth + refunded);
  const remaining = Math.max(0, enemyShot.damage - refunded);

  return {
    player: {
      ...player,
      health: {
        ...player.health,
        current: playerHealth,
      },
    },
    duel: {
      ...duel,
      playerHealth,
      logs: [
        ...duel.logs,
        defense.kind === "dodge"
          ? "千钧一发，你侧身闪开了来箭，分毫未伤。"
          : "你举弓格挡，卸去半数力道。",
      ],
      lastEnemyShot: {
        ...enemyShot,
        defended: defense.kind,
        hit: defense.kind === "dodge" ? false : enemyShot.hit,
        damage: remaining,
      },
    },
    battleResult: null,
    message: defense.kind === "dodge" ? "闪避成功" : "格挡成功",
  };
};

/**
 * 战败惩罚结算（分级）：
 * - 演武切磋全免
 * - order<3：无惩罚（仅文案）
 * - order 3–9：伤势 [10,20] + 随机损失材料/箭 1 组
 * - order≥10：再扣灵石 5–10% + 伤势 [20,30] + 寿元 +2 日
 * - 主动撤退（retreated）各项减半；装备 injuryResist 减伤势增量
 * 材料损失先快照可用类型（仅 material/arrow，排除装备/功法/丹药）再扣。
 */
const rollDefeatPenalty = (
  player: Player,
  retreated: boolean,
  isSparring: boolean,
): { player: Player; penalty: BattlePenalty; logs: string[] } => {
  const empty: BattlePenalty = {
    injury: 0,
    lostStones: 0,
    lostItems: [],
    lostDays: 0,
  };

  if (isSparring) {
    return { player, penalty: empty, logs: [] };
  }

  const realm = getRealmById(player.realmId);
  const tier = getDefeatPenaltyTier(realm.order);
  const halve = retreated ? 0.5 : 1;
  const logs: string[] = [];
  let nextPlayer = player;
  let injuryGain = 0;

  if (tier.injury[1] > 0) {
    // 伤势抵抗：装备 + 宗门（碧水宫/厚土堡）叠加，封顶七成以免全然无伤
    const injuryResist = Math.min(
      0.75,
      (getEquipmentEffects(player).injuryResist ?? 0) +
        getSectPassiveBonuses(player).injuryResist,
    );
    injuryGain = Math.round(
      randomInt(tier.injury[0], tier.injury[1]) * halve * (1 - injuryResist),
    );

    if (injuryGain > 0) {
      nextPlayer = {
        ...nextPlayer,
        injury: clampInjury(nextPlayer.injury + injuryGain),
      };
      logs.push(`此战失利，旧伤新创交加，伤势 +${injuryGain}。`);
    }
  }

  let lostItems: ItemCost[] = [];

  if (tier.loseMaterialStack) {
    // 先快照可损失品类（仅材料/箭矢），再抽取扣除
    const candidates = nextPlayer.inventory.filter((stack) => {
      const def = getItemDefinition(stack.itemId);
      return (
        stack.quantity > 0 &&
        def !== undefined &&
        (def.type === "material" || def.type === "arrow")
      );
    });

    if (candidates.length > 0) {
      const picked = candidates[randomInt(0, candidates.length - 1)];
      const quantity = clamp(
        Math.ceil(randomInt(1, 3) * halve),
        1,
        picked.quantity,
      );
      lostItems = [{ itemId: picked.itemId, quantity }];
      nextPlayer = {
        ...nextPlayer,
        inventory: consumeItemCosts(nextPlayer.inventory, lostItems),
      };
      logs.push(
        `仓皇脱身之际，遗失${getItemDefinition(picked.itemId)?.name ?? picked.itemId} x${quantity}。`,
      );
    }
  }

  let lostStones = 0;

  if (tier.lostStonesRatio[1] > 0 && nextPlayer.spiritStones > 0) {
    const [min, max] = tier.lostStonesRatio;
    const ratio = min + Math.random() * (max - min);
    lostStones = Math.min(
      nextPlayer.spiritStones,
      Math.ceil(nextPlayer.spiritStones * ratio * halve),
    );

    if (lostStones > 0) {
      nextPlayer = {
        ...nextPlayer,
        spiritStones: nextPlayer.spiritStones - lostStones,
      };
      logs.push(`储物袋亦被波及，失落灵石 x${lostStones}。`);
    }
  }

  const lostDays = Math.round(tier.lostDays * halve);

  return {
    player: nextPlayer,
    penalty: { injury: injuryGain, lostStones, lostItems, lostDays },
    logs,
  };
};

const finishDuel = (
  player: Player,
  duel: ArcheryDuelState,
  victory: boolean,
  retreated = false,
): ArcheryShotResult => {
  const realm = getRealmById(player.realmId);
  const isSparring = duel.monster.id.startsWith("sparring-");

  if (!victory) {
    // 先同步战中血量，再结算分级惩罚，最后统一推进时间（疗伤 3 日 + 惩罚寿元损耗）
    const woundedPlayer: Player = {
      ...player,
      health: {
        ...player.health,
        current: Math.max(1, duel.playerHealth),
      },
    };
    const penaltyResult = rollDefeatPenalty(woundedPlayer, retreated, isSparring);
    const finalPlayer = advanceTime(
      penaltyResult.player,
      3 + penaltyResult.penalty.lostDays,
    );
    const defeatLog = isSparring
      ? "切磋落败，对方点到为止。"
      : retreated
        ? `你主动撤退，脱离与${duel.monster.name}的战局。`
        : "你负伤撤退，保住了性命。";
    const battleResult: BattleResult = {
      player: finalPlayer,
      monster: duel.monster,
      victory: false,
      reward: {
        spiritStones: 0,
        cultivation: 0,
        items: [],
      },
      logs: [...duel.logs, defeatLog, ...penaltyResult.logs],
      message: isSparring
        ? `切磋失败，不敌${duel.monster.name}`
        : retreated
          ? `主动撤离，脱离与${duel.monster.name}的战局`
          : `历练失败，被${duel.monster.name}逼退`,
      isSparring,
      retreated,
      penalty: isSparring ? undefined : penaltyResult.penalty,
      arrowsUsed: duel.arrowsUsed ?? [],
      totalDamage: duel.totalDamage ?? 0,
      // 疗伤 3 日 + 惩罚寿元损耗（演武惩罚为空，lostDays = 0）
      daysSpent: 3 + penaltyResult.penalty.lostDays,
    };

    return {
      player: finalPlayer,
      duel: {
        ...duel,
        finished: true,
        victory: false,
        logs: battleResult.logs,
      },
      battleResult,
      message: battleResult.message,
    };
  }

  const spiritStones = randomInt(
    duel.monster.spiritStoneReward[0],
    duel.monster.spiritStoneReward[1],
  );
  const cultivation = randomInt(
    duel.monster.cultivationReward[0],
    duel.monster.cultivationReward[1],
  );
  const items = isSparring ? [] : rollLoot(duel.monster);
  const requiredCultivation = realm.breakthrough.requiredCultivation;
  const nextCultivation = Math.min(
    requiredCultivation,
    player.cultivation.current + cultivation,
  );
  const finalLogs = isSparring
    ? [...duel.logs, `切磋获胜，对方拱手认输，修为精进 +${cultivation}。`]
    : [...duel.logs, `胜利，获得灵石 x${spiritStones}，修为 +${cultivation}，${formatLoot(items)}。`];
  const finalPlayer = advanceTime(
    {
      ...player,
      spiritStones: player.spiritStones + spiritStones,
      health: {
        ...player.health,
        current: Math.max(1, duel.playerHealth),
      },
      inventory: addItemStacks(player.inventory, items),
      cultivation: {
        current: nextCultivation,
        required: requiredCultivation,
        lastGain: cultivation,
      },
      // 切磋不计战绩；Boss 击杀单独累计，供「志」长期目标派生
      // ?? 兜底：个别极早期存档可能缺 stats 字段（迁移前写入），
      // 胜利结算绝不能因战绩累计而抛异常——那会直接卡死命中结算链
      stats: isSparring
        ? player.stats
        : {
            monstersKilled: (player.stats?.monstersKilled ?? 0) + 1,
            bossesKilled:
              (player.stats?.bossesKilled ?? 0) + (duel.monster.isBoss ? 1 : 0),
            lastCultivateDay: player.stats?.lastCultivateDay ?? 0,
            lastBossDay: player.stats?.lastBossDay ?? 0,
          },
    },
    3,
  );
  const battleResult: BattleResult = {
    player: finalPlayer,
    monster: duel.monster,
    victory: true,
    reward: {
      spiritStones,
      cultivation,
      items,
    },
    logs: finalLogs,
    message: isSparring
      ? `切磋获胜，修为精进 +${cultivation}`
      : `击败${duel.monster.name}，获得灵石 x${spiritStones}`,
    isSparring,
    arrowsUsed: duel.arrowsUsed ?? [],
    totalDamage: duel.totalDamage ?? 0,
    // 战后调息固定 3 日
    daysSpent: 3,
  };

  return {
    player: finalPlayer,
    duel: {
      ...duel,
      finished: true,
      victory: true,
      logs: finalLogs,
    },
    battleResult,
    message: battleResult.message,
  };
};

/** 静养：回满气血灵力，兼化瘀血（伤势 −15）、化丹毒（丹毒 −10） */
export const restPlayer = (player: Player): Player =>
  advanceTime(
    {
      ...player,
      health: {
        ...player.health,
        current: player.health.max,
      },
      mana: {
        ...player.mana,
        current: player.mana.max,
      },
      injury: clampInjury(player.injury - 15),
      pillToxicity: clampPillToxicity(player.pillToxicity - 10),
    },
    1,
  );

export const startArcheryBattle = (
  player: Player,
  area?: string,
  loadout?: BattleLoadout,
  fixedMonster?: MonsterDefinition,
): ArcheryDuelState => {
  // 固定怪（如秘境远征按层指定）优先于地区随机抽取
  const monster = fixedMonster ?? chooseMonster(player, area);
  const weapon = getEquippedWeapon(player);
  const weaponName = weapon?.name ?? "弓";

  return {
    monster,
    monsterHealth: monster.health,
    playerHealth: player.health.current,
    round: 1,
    finished: false,
    victory: null,
    logs: [`你持${weaponName}在${monster.area}遭遇了${monster.name}，双方拉开距离，以弓箭对射。`],
    background: randomBattleBackground(),
    loadout,
  };
};

export const startSparringBattle = (
  player: Player,
  loadout?: BattleLoadout,
): ArcheryDuelState => {
  const opponent = generateSparringOpponent(player);
  const weapon = getEquippedWeapon(player);
  const weaponName = weapon?.name ?? "弓";

  return {
    monster: opponent,
    monsterHealth: opponent.health,
    playerHealth: player.health.current,
    round: 1,
    finished: false,
    victory: null,
    logs: [`演武场上，你持${weaponName}与${opponent.name}对峙，对方气定神闲，似有无穷气力。`],
    endless: true,
    background: randomBattleBackground(),
    loadout,
  };
};

export interface BossChallengeCheck {
  boss: MonsterDefinition;
  canChallenge: boolean;
  reason?: string;
}

/** 守关者每日仅容挑战一次：按游戏内日索引判定（advanceTime 推进后自动刷新） */
export const getBossChallengeCheck = (
  player: Player,
  boss: MonsterDefinition = getSecretRealmBoss(),
): BossChallengeCheck => {
  const challengedToday = player.stats.lastBossDay === getGameDay(player);

  return {
    boss,
    canChallenge: !challengedToday,
    reason: challengedToday
      ? `今日已挑战过${boss.name}，且待明日再来。`
      : undefined,
  };
};

/** 开战即占用当日挑战次数（无论胜败），防止反复刷 Boss */
export const markBossAttempt = (player: Player): Player => ({
  ...player,
  stats: {
    ...player.stats,
    lastBossDay: getGameDay(player),
  },
});

/** Boss 战：固定指定守关者，不走随机怪物池（缺省回落秘境石傀） */
export const startBossBattle = (
  player: Player,
  boss: MonsterDefinition = getSecretRealmBoss(),
  loadout?: BattleLoadout,
): ArcheryDuelState => {
  const weapon = getEquippedWeapon(player);
  const weaponName = weapon?.name ?? "弓";

  return {
    monster: boss,
    monsterHealth: boss.health,
    playerHealth: player.health.current,
    round: 1,
    finished: false,
    victory: null,
    logs: [
      `秘境深处，你持${weaponName}踏碎石阵，${boss.name}自尘雾中缓缓立起，周身灵压沉重如山。`,
    ],
    background: randomBattleBackground(),
    loadout,
    maxRounds: BOSS_MAX_ROUNDS,
  };
};

/** 按箭种累计本场箭耗（供结算「消耗」展示） */
const accumulateArrowUse = (
  used: ItemCost[],
  arrowItemId: string,
): ItemCost[] => {
  const existing = used.find((stack) => stack.itemId === arrowItemId);

  if (existing) {
    return used.map((stack) =>
      stack.itemId === arrowItemId
        ? { ...stack, quantity: stack.quantity + 1 }
        : stack,
    );
  }

  return [...used, { itemId: arrowItemId, quantity: 1 }];
};

export const shootArrow = (
  player: Player,
  duel: ArcheryDuelState,
  arrowItemId: string,
  targetId: TargetZoneId,
  drawPower = 1,
): ArcheryShotResult => {
  if (duel.finished) {
    return {
      player,
      duel,
      battleResult: null,
      message: "战斗已经结束。",
    };
  }

  const arrow = getCombatArrow(player, arrowItemId);
  const target = getTargetZone(targetId);

  if (!arrow) {
    return {
      player,
      duel,
      battleResult: null,
      message: "没有找到这种箭矢。",
    };
  }

  const spiritTier = arrow.spirit ? getSpiritArrowTier(arrowItemId) : undefined;

  // 演武切磋（endless）：无消耗训练，跳过箭囊/灵力校验与扣除
  if (!duel.endless) {
    // 灵力化箭：校验并消耗灵力；实物箭：校验并消耗箭囊数量
    if (spiritTier) {
      if (player.mana.current < spiritTier.manaCost) {
        return {
          player,
          duel,
          battleResult: null,
          message: `灵力不足，凝不出${spiritTier.name}。`,
        };
      }
    } else if (getInventoryQuantity(player.inventory, arrowItemId) <= 0) {
      return {
        player,
        duel,
        battleResult: null,
        message: `${arrow.name}不足，无法射击。`,
      };
    }
  }

  const logs = [...duel.logs];
  let monsterHealth = duel.monsterHealth;
  let playerHealth = duel.playerHealth;
  let nextPlayer: Player = duel.endless
    ? { ...player, updatedAt: new Date().toISOString() }
    : spiritTier
      ? {
          ...player,
          mana: {
            ...player.mana,
            current: player.mana.current - spiritTier.manaCost,
          },
          updatedAt: new Date().toISOString(),
        }
      : {
          ...player,
          inventory: consumeItemCosts(player.inventory, [
            { itemId: arrowItemId, quantity: 1 },
          ]),
          updatedAt: new Date().toISOString(),
        };

  // Always calculate potential damage - visual hit detection will determine if damage is applied
  // 蓄力 0~1 对应伤害倍率 0.5~1.0
  const chargeMultiplier = 0.5 + 0.5 * clamp(drawPower, 0, 1);
  const { damage, critical } = getPlayerShotDamage(
    player,
    duel.monster,
    arrowItemId,
    targetId,
    chargeMultiplier,
    duel.enemyStatuses?.armorbreak?.stacks ?? 0,
  );
  // Store pending damage - will be applied later ONLY if arrow visually hits
  const pendingDamage: ArcheryShotResult["pendingDamage"] = {
    damage,
    critical,
    targetName: target.name,
    targetId,
  };
  logs.push(
    spiritTier
      ? `第 ${duel.round} 回合：你凝灵力为${arrow.name}（耗灵 ${spiritTier.manaCost}），瞄准${target.name}，灵光离弦而出。`
      : `第 ${duel.round} 回合：你以${arrow.name}瞄准${target.name}，箭矢飞向目标。`,
  );

  let nextDuel: ArcheryDuelState = {
    ...duel,
    monsterHealth,
    playerHealth,
    logs,
    lastEnemyShot: undefined,
    // 演武切磋不耗箭，不计入消耗；实战每射一箭按箭种累计
    arrowsUsed: duel.endless
      ? duel.arrowsUsed
      : accumulateArrowUse(duel.arrowsUsed ?? [], arrowItemId),
  };

  return {
    player: nextPlayer,
    duel: nextDuel,
    battleResult: null,
    message: "箭矢飞向目标",
    pendingDamage,
  };
};

// Apply player's shot damage after visual hit confirmation
export const applyPlayerShot = (
  player: Player,
  duel: ArcheryDuelState,
  arrowItemId: string,
  pendingDamage: NonNullable<ArcheryShotResult["pendingDamage"]>,
): ArcheryShotResult => {
  const logs = [...duel.logs];
  // 演武切磋（endless）：对手血量无限，伤害只作演武反馈，不打死对方
  let monsterHealth = duel.endless
    ? duel.monsterHealth
    : Math.max(0, duel.monsterHealth - pendingDamage.damage);
  // 回合初：玩家中毒跳伤（血线下限 1；日志追加在命中文案之后）
  let playerHealth = tickPlayerPoison(duel, duel.playerHealth, logs);

  // Update log with actual hit result
  const arrow = getCombatArrow(player, arrowItemId);
  const arrowName = arrow?.name ?? "箭矢";
  logs[logs.length - 1] = duel.endless
    ? `第 ${duel.round} 回合：你以${arrowName}瞄准${pendingDamage.targetName}，命中造成 ${pendingDamage.damage} 伤害${pendingDamage.critical ? "，正中要害" : ""}，对方微微一笑，浑然无碍。`
    : `第 ${duel.round} 回合：你以${arrowName}瞄准${pendingDamage.targetName}，命中造成 ${pendingDamage.damage} 伤害${pendingDamage.critical ? "，正中要害" : ""}。`;

  // 部位命中 debuff：命中即生效（本次反击已被削弱——奖励性设计），
  // 层数封顶 MAX_DEBUFF_STACKS，失效回合 = 当前回合 + duration − 1
  const zone = getTargetZone(pendingDamage.targetId);
  const debuffSpec = zone.onHitDebuff;
  let enemyDebuffs = duel.enemyDebuffs;

  if (debuffSpec) {
    const current = enemyDebuffs ?? {
      leg: 0,
      arm: 0,
      expireRound: { leg: 0, arm: 0 },
    };
    const kind = debuffSpec.kind;
    const currentStacks = current[kind];
    const expireRound =
      currentStacks > 0
        ? Math.max(current.expireRound[kind], duel.round + debuffSpec.duration - 1)
        : duel.round + debuffSpec.duration - 1;
    const stacks = Math.min(MAX_DEBUFF_STACKS, currentStacks + 1);

    enemyDebuffs = {
      leg: kind === "leg" ? stacks : current.leg,
      arm: kind === "arm" ? stacks : current.arm,
      expireRound: {
        leg: kind === "leg" ? expireRound : current.expireRound.leg,
        arm: kind === "arm" ? expireRound : current.expireRound.arm,
      },
    };

    if (kind === "leg") {
      logs.push(
        stacks > currentStacks
          ? `${duel.monster.name}腿部中箭（${stacks} 层），准头受挫。`
          : `${duel.monster.name}腿部再中一箭，伤势延续。`,
      );
    } else {
      logs.push(
        stacks > currentStacks
          ? `${duel.monster.name}手臂中箭（${stacks} 层），反击力道渐衰。`
          : `${duel.monster.name}手臂再中一箭，伤势延续。`,
      );
    }
  }

  // 状态箭矢命中：附加中毒/眩晕/破甲（与部位 debuff 并存）
  let enemyStatuses = duel.enemyStatuses;
  if (arrow?.onHitStatus) {
    enemyStatuses = applyStatusEffect(enemyStatuses, arrow.onHitStatus, duel.round);
    logs.push(statusApplyText(duel.monster.name, arrow.onHitStatus));
  }

  let nextDuel: ArcheryDuelState = {
    ...duel,
    monsterHealth,
    playerHealth,
    logs,
    enemyDebuffs,
    enemyStatuses,
    // 累计本场命中伤害（演武亦计，供「战绩」展示）
    totalDamage: (duel.totalDamage ?? 0) + pendingDamage.damage,
  };

  if (!duel.endless && monsterHealth <= 0) {
    return finishDuel(player, nextDuel, true);
  }

  // 敌方回合：毒发跳伤（可致死）→ 眩晕抑制反击（部位 debuff 已生效，本次反击即被削弱）
  const turn = resolveEnemyTurn(player, nextDuel, playerHealth, logs);
  if (turn.monsterHealth !== nextDuel.monsterHealth) {
    monsterHealth = turn.monsterHealth;
    nextDuel = { ...nextDuel, monsterHealth, logs };
  }
  if (!duel.endless && monsterHealth <= 0) {
    return finishDuel(player, nextDuel, true);
  }
  playerHealth = turn.playerHealth;

  const nextPlayer: Player = {
    ...player,
    health: {
      ...player.health,
      current: playerHealth,
    },
  };
  nextDuel = {
    ...nextDuel,
    playerHealth,
    round: duel.round + 1,
    logs,
    lastEnemyShot: turn.lastEnemyShot,
    enemyDebuffs: decayEnemyDebuffs(enemyDebuffs, duel.round + 1),
    enemyStatuses: decayStatuses(enemyStatuses, duel.round + 1),
    playerStatuses: decayStatuses(turn.playerStatuses, duel.round + 1),
  };

  if (playerHealth <= 1) {
    return finishDuel(nextPlayer, nextDuel, false);
  }

  // 演武切磋没有回合上限，由玩家主动退出
  if (!duel.endless && nextDuel.round > (duel.maxRounds ?? MAX_ARCHERY_ROUNDS)) {
    const wonByPressure = monsterHealth < duel.monster.health * 0.35;
    logs.push(
      wonByPressure
        ? `${duel.monster.name}伤势过重，转身遁逃。`
        : "鏖战太久，你判断形势不利，收弓撤退。",
    );
    return finishDuel(
      nextPlayer,
      {
        ...nextDuel,
        logs,
      },
      wonByPressure,
    );
  }

  return {
    player: nextPlayer,
    duel: nextDuel,
    battleResult: null,
    message: duel.endless ? "箭矢命中，对方神色如常。" : "箭矢命中，敌人仍未倒下。",
  };
};

// Skip damage (arrow visually missed) but still handle monster counter-attack
export const skipPlayerShot = (
  player: Player,
  duel: ArcheryDuelState,
  missReason = "这一箭没有命中目标。",
): ArcheryShotResult => {
  const logs = [...duel.logs];
  // 回合初：玩家中毒跳伤
  let playerHealth = tickPlayerPoison(duel, duel.playerHealth, logs);

  logs.push(missReason);

  // 敌方回合：毒发跳伤（可致死）→ 眩晕抑制反击
  const turn = resolveEnemyTurn(player, duel, playerHealth, logs);
  let monsterHealth = turn.monsterHealth;
  if (!duel.endless && monsterHealth <= 0) {
    logs.push(`${duel.monster.name}毒发身亡。`);
    return finishDuel(
      player,
      { ...duel, monsterHealth, logs },
      true,
    );
  }
  playerHealth = turn.playerHealth;

  const nextPlayer: Player = {
    ...player,
    health: {
      ...player.health,
      current: playerHealth,
    },
  };
  const nextDuel: ArcheryDuelState = {
    ...duel,
    monsterHealth,
    playerHealth,
    round: duel.round + 1,
    logs,
    lastEnemyShot: turn.lastEnemyShot,
    playerStatuses: decayStatuses(turn.playerStatuses, duel.round + 1),
    enemyDebuffs: decayEnemyDebuffs(duel.enemyDebuffs, duel.round + 1),
    enemyStatuses: decayStatuses(duel.enemyStatuses, duel.round + 1),
  };

  if (playerHealth <= 1) {
    return finishDuel(nextPlayer, nextDuel, false);
  }

  if (!duel.endless && nextDuel.round > (duel.maxRounds ?? MAX_ARCHERY_ROUNDS)) {
    const wonByPressure = monsterHealth < duel.monster.health * 0.35;
    logs.push(
      wonByPressure
        ? `${duel.monster.name}伤势过重，转身遁逃。`
        : "鏖战太久，你判断形势不利，收弓撤退。",
    );
    return finishDuel(
      nextPlayer,
      {
        ...nextDuel,
        logs,
      },
      wonByPressure,
    );
  }

  return {
    player: nextPlayer,
    duel: nextDuel,
    battleResult: null,
    message: "这一箭落空，敌人趁势还击。",
  };
};

/** 主动撤退：置 retreated 标志（二期惩罚分级据此减半） */
export const retreatFromBattle = (
  player: Player,
  duel: ArcheryDuelState,
): ArcheryShotResult => finishDuel(player, duel, false, true);

/**
 * 战中使用丹药：消耗一枚丹药，按效果回血/回灵，随后敌人趁机反击一回合。
 * 注意：战中血量挂在 duel.playerHealth 上，finishDuel 才同步回 player.health，
 * 这里回的是 duel.playerHealth（仅在返回的 player 上同步一份用于 HUD）。
 */
export const useBattlePill = (
  player: Player,
  duel: ArcheryDuelState,
  pillItemId: string,
): ArcheryShotResult => {
  if (duel.finished) {
    return {
      player,
      duel,
      battleResult: null,
      message: "战斗已经结束。",
    };
  }

  const pill = getPillDefinition(pillItemId);

  if (!pill) {
    return {
      player,
      duel,
      battleResult: null,
      message: "没有这种丹药。",
    };
  }

  if (getInventoryQuantity(player.inventory, pillItemId) <= 0) {
    return {
      player,
      duel,
      battleResult: null,
      message: `${pill.name}不足，无法服用。`,
    };
  }

  const { heal, restoreMana } = pill.effects;

  if (!heal && !restoreMana) {
    return {
      player,
      duel,
      battleResult: null,
      message: `${pill.name}无法在战中使用。`,
    };
  }

  const logs = [...duel.logs];
  // 回合初：玩家中毒跳伤
  let playerHealth = tickPlayerPoison(duel, duel.playerHealth, logs);

  if (heal) {
    playerHealth = Math.min(player.health.max, playerHealth + heal);
  }

  const toxicity = pill.effects.toxicity ?? 0;
  const consumedPlayer: Player = {
    ...player,
    inventory: consumeItemCosts(player.inventory, [
      { itemId: pillItemId, quantity: 1 },
    ]),
    mana: restoreMana
      ? {
          ...player.mana,
          current: Math.min(player.mana.max, player.mana.current + restoreMana),
        }
      : player.mana,
    pillToxicity: toxicity > 0 ? clampPillToxicity(player.pillToxicity + toxicity) : player.pillToxicity,
    updatedAt: new Date().toISOString(),
  };

  const effectText = [
    heal ? `气血回复 ${heal}` : "",
    restoreMana ? `灵力回复 ${restoreMana}` : "",
    toxicity > 0 ? `丹毒 +${toxicity}` : "",
  ]
    .filter(Boolean)
    .join("、");
  logs.push(`第 ${duel.round} 回合：你趁隙服下${pill.name}，${effectText}。`);

  // 敌方回合：毒发跳伤（可致死）→ 眩晕抑制反击（服药占用一回合）
  const turn = resolveEnemyTurn(consumedPlayer, duel, playerHealth, logs);
  let monsterHealth = turn.monsterHealth;
  if (!duel.endless && monsterHealth <= 0) {
    logs.push(`${duel.monster.name}毒发身亡。`);
    return finishDuel(
      consumedPlayer,
      { ...duel, monsterHealth, logs },
      true,
    );
  }
  playerHealth = turn.playerHealth;

  const nextPlayer: Player = {
    ...consumedPlayer,
    health: {
      ...consumedPlayer.health,
      current: playerHealth,
    },
  };
  let nextDuel: ArcheryDuelState = {
    ...duel,
    monsterHealth,
    playerHealth,
    round: duel.round + 1,
    logs,
    lastEnemyShot: turn.lastEnemyShot,
    playerStatuses: decayStatuses(turn.playerStatuses, duel.round + 1),
    enemyDebuffs: decayEnemyDebuffs(duel.enemyDebuffs, duel.round + 1),
    enemyStatuses: decayStatuses(duel.enemyStatuses, duel.round + 1),
  };

  if (playerHealth <= 1) {
    return finishDuel(nextPlayer, nextDuel, false);
  }

  if (!duel.endless && nextDuel.round > (duel.maxRounds ?? MAX_ARCHERY_ROUNDS)) {
    const wonByPressure = monsterHealth < duel.monster.health * 0.35;
    logs.push(
      wonByPressure
        ? `${duel.monster.name}伤势过重，转身遁逃。`
        : "鏖战太久，你判断形势不利，收弓撤退。",
    );
    return finishDuel(
      nextPlayer,
      {
        ...nextDuel,
        logs,
      },
      wonByPressure,
    );
  }

  return {
    player: nextPlayer,
    duel: nextDuel,
    battleResult: null,
    message: `服下${pill.name}，${effectText}。`,
  };
};

/**
 * 撤退策略自动判定：回到瞄准阶段时调用，返回触发原因（用于日志）；
 * 未触发或策略为 never 时返回 null。演武切磋与已结束对战不触发。
 */
export const shouldAutoRetreat = (
  player: Player,
  duel: ArcheryDuelState,
): string | null => {
  if (duel.finished || duel.endless) {
    return null;
  }

  const rule = duel.loadout?.retreatRule ?? "never";
  const healthRatio = player.health.max > 0 ? duel.playerHealth / player.health.max : 0;

  switch (rule) {
    case "hp50":
      if (healthRatio <= 0.5) {
        return "伤势渐重，依战前之策，先行撤退。";
      }
      return null;
    case "hp30":
      if (healthRatio <= 0.3) {
        return "伤势已危，依战前之策，先行撤退。";
      }
      return null;
    case "round6":
      if (duel.round >= 6) {
        return "鏖战已久，依战前之策，先行撤退。";
      }
      return null;
    default:
      return null;
  }
};

/** 无头对战路径选箭：优先最强实物箭，箭囊空空则回退最省灵力的灵力箭 */

/** 无头自动战的瞄准部位：加权随机（胸 50 / 臂 20 / 腿 20 / 头 10），与 UI 战同管线吃到部位 debuff */
const randomAutoTarget = (): TargetZoneId => {
  const roll = Math.random();

  if (roll < 0.5) return "chest";
  if (roll < 0.7) return "arm";
  if (roll < 0.9) return "leg";
  return "head";
};

const getBestAvailableArrowId = (player: Player): string | undefined => {
  const physical = getAvailableArrowsForBattle(player).pop();

  if (physical) {
    return physical.itemId;
  }

  return getUsableSpiritArrowTiers(player)[0]?.id;
};

export const startBattle = (player: Player, area?: string): BattleResult => {
  const weapon = getEquippedWeapon(player);

  if (!weapon) {
    const finalPlayer = advanceTime(player, 1);

    return {
      player: finalPlayer,
      monster: chooseMonster(player, area),
      victory: false,
      reward: {
        spiritStones: 0,
        cultivation: 0,
        items: [],
      },
      logs: ["你未持任何武器，无法与敌对射，只能暂避锋芒。"],
      message: "未装备武器，无法战斗",
    };
  }

  let duel = startArcheryBattle(player, area);
  let currentPlayer = player;

  for (let index = 0; index < MAX_ARCHERY_ROUNDS; index += 1) {
    const arrowId = getBestAvailableArrowId(currentPlayer);

    if (!arrowId) {
      const finalPlayer = advanceTime(currentPlayer, 1);

      return {
        player: finalPlayer,
        monster: duel.monster,
        victory: false,
        reward: {
          spiritStones: 0,
          cultivation: 0,
          items: [],
        },
        logs: [...duel.logs, "箭囊已空、灵力亦竭，只能暂避锋芒。"],
        message: "没有箭矢，历练被迫中止",
      };
    }

    const autoTarget = randomAutoTarget();
    const shotResult = shootArrow(currentPlayer, duel, arrowId, autoTarget);
    currentPlayer = shotResult.player;
    duel = shotResult.duel;

    if (shotResult.battleResult) {
      return shotResult.battleResult;
    }

    const hit =
      Boolean(shotResult.pendingDamage) &&
      Math.random() <= getShotChance(currentPlayer, arrowId, autoTarget);
    const result =
      hit && shotResult.pendingDamage
        ? applyPlayerShot(currentPlayer, duel, arrowId, shotResult.pendingDamage)
        : skipPlayerShot(currentPlayer, duel, "这一箭被对方身法避开。");

    currentPlayer = result.player;
    duel = result.duel;

    if (result.battleResult) {
      return result.battleResult;
    }
  }

  return finishDuel(currentPlayer, duel, false).battleResult as BattleResult;
};
