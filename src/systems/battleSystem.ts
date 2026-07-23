import {
  arrowDefinitions,
  getArrowDefinition,
  getTargetZone,
  targetZones,
} from "../data/arrows";
import { getItemDefinition } from "../data/items";
import { getMonstersForRealmOrder } from "../data/monsters";
import { getRealmById } from "../data/realms";
import {
  getSpiritArrowPower,
  getSpiritArrowTier,
  getUsableSpiritArrowTiers,
  isSpiritArrowId,
} from "../data/spiritArrows";
import type {
  ArcheryDuelState,
  ArcheryShotResult,
  ArrowDefinition,
  BattleBackgroundId,
  BattleResult,
  ItemCost,
  MonsterDefinition,
  Player,
  TargetZoneId,
} from "../types/game";

export type { ArcheryShotResult };
import { addItemStacks, consumeItemCosts, getInventoryQuantity } from "./inventorySystem";
import { getEquipmentEffects, getEquippedWeapon, getWeaponCompatibleArrows } from "./equipmentSystem";
import { getManualEffects } from "./manualSystem";
import { advanceTime } from "./timeSystem";

const MAX_ARCHERY_ROUNDS = 8;

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

export interface CombatArrow {
  itemId: string;
  name: string;
  power: number;
  accuracy: number;
  /** 灵力化箭：射出消耗灵力而非箭囊数量 */
  spirit: boolean;
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
  };
};

const getPlayerDefense = (player: Player) => {
  const realm = getRealmById(player.realmId);
  const manualEffects = getManualEffects(player);
  const equipmentEffects = getEquipmentEffects(player);

  return Math.floor(
    (4 +
      realm.order * 2 +
      Math.floor(player.attributes.mind / 2) +
      equipmentEffects.defense) *
      (1 + manualEffects.battleDefenseBonus),
  );
};

export const getShotChance = (player: Player, arrowItemId: string, targetId: TargetZoneId) => {
  const arrow = getCombatArrow(player, arrowItemId) ?? arrowDefinitions[0];
  const target = getTargetZone(targetId);
  const manualEffects = getManualEffects(player);

  return clamp(
    arrow.accuracy +
      target.accuracyModifier +
      player.attributes.divineSense * 0.006 +
      player.attributes.luck * 0.003 +
      manualEffects.battleAttackBonus * 0.15,
    0.1,
    0.95,
  );
};

export const getPlayerShotDamage = (
  player: Player,
  monster: MonsterDefinition,
  arrowItemId: string,
  targetId: TargetZoneId,
  chargeMultiplier = 1,
) => {
  const arrow = getCombatArrow(player, arrowItemId) ?? arrowDefinitions[0];
  const target = getTargetZone(targetId);
  const realm = getRealmById(player.realmId);
  const manualEffects = getManualEffects(player);
  const equipmentEffects = getEquipmentEffects(player);
  const criticalChance = clamp(
    target.criticalChance + player.attributes.luck * 0.004,
    0.03,
    0.45,
  );
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
  const damage = Math.max(
    1,
    Math.floor(
      chargedDamage *
        target.damageMultiplier *
        (critical ? 1.5 : 1) *
        (1 + manualEffects.battleAttackBonus) -
        monster.defense,
    ),
  );

  return { damage, critical };
};

const getMonsterShot = (player: Player, monster: MonsterDefinition) => {
  const target = targetZones[randomInt(0, targetZones.length - 1)];
  const hitChance = clamp(
    0.68 + monster.attack * 0.004 - player.attributes.divineSense * 0.004,
    0.25,
    0.9,
  );

  if (Math.random() > hitChance) {
    return {
      targetName: target.name,
      hit: false,
      damage: 0,
    };
  }

  const playerDefense = getPlayerDefense(player);
  const baseDamage = randomInt(
    Math.floor(monster.attack * 0.72),
    Math.ceil(monster.attack * 1.18),
  );
  const damage = Math.max(
    1,
    Math.floor(baseDamage * target.damageMultiplier - playerDefense),
  );

  return {
    targetName: target.name,
    hit: true,
    damage,
  };
};

const finishDuel = (
  player: Player,
  duel: ArcheryDuelState,
  victory: boolean,
): ArcheryShotResult => {
  const realm = getRealmById(player.realmId);
  const isSparring = duel.monster.id.startsWith("sparring-");

  if (!victory) {
    const finalPlayer = advanceTime(
      {
        ...player,
        health: {
          ...player.health,
          current: Math.max(1, duel.playerHealth),
        },
      },
      3,
    );
    const battleResult: BattleResult = {
      player: finalPlayer,
      monster: duel.monster,
      victory: false,
      reward: {
        spiritStones: 0,
        cultivation: 0,
        items: [],
      },
      logs: [...duel.logs, isSparring ? "切磋落败，对方点到为止。" : "你负伤撤退，保住了性命。"],
      message: isSparring ? `切磋失败，不敌${duel.monster.name}` : `历练失败，被${duel.monster.name}逼退`,
      isSparring,
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
    },
    1,
  );

export const startArcheryBattle = (
  player: Player,
  area?: string,
): ArcheryDuelState => {
  const monster = chooseMonster(player, area);
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
  };
};

export const startSparringBattle = (player: Player): ArcheryDuelState => {
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
  };
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

  const logs = [...duel.logs];
  let monsterHealth = duel.monsterHealth;
  let playerHealth = duel.playerHealth;
  let nextPlayer: Player = spiritTier
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
  );
  // Store pending damage - will be applied later ONLY if arrow visually hits
  const pendingDamage: ArcheryShotResult["pendingDamage"] = { damage, critical, targetName: target.name };
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
  let playerHealth = duel.playerHealth;

  // Update log with actual hit result
  const arrowName = getCombatArrow(player, arrowItemId)?.name ?? "箭矢";
  logs[logs.length - 1] = duel.endless
    ? `第 ${duel.round} 回合：你以${arrowName}瞄准${pendingDamage.targetName}，命中造成 ${pendingDamage.damage} 伤害${pendingDamage.critical ? "，正中要害" : ""}，对方微微一笑，浑然无碍。`
    : `第 ${duel.round} 回合：你以${arrowName}瞄准${pendingDamage.targetName}，命中造成 ${pendingDamage.damage} 伤害${pendingDamage.critical ? "，正中要害" : ""}。`;

  let nextDuel: ArcheryDuelState = {
    ...duel,
    monsterHealth,
    playerHealth,
    logs,
  };

  if (!duel.endless && monsterHealth <= 0) {
    return finishDuel(player, nextDuel, true);
  }

  // Monster counter-attack
  const monsterShot = getMonsterShot(player, duel.monster);

  if (monsterShot.hit) {
    playerHealth = Math.max(1, playerHealth - monsterShot.damage);
    logs.push(
      `${duel.monster.name}反射${monsterShot.targetName}，造成 ${monsterShot.damage} 伤害。`,
    );
  } else {
    logs.push(`${duel.monster.name}还射${monsterShot.targetName}，被你侧身避开。`);
  }

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
  };

  if (playerHealth <= 1) {
    return finishDuel(nextPlayer, nextDuel, false);
  }

  // 演武切磋没有回合上限，由玩家主动退出
  if (!duel.endless && nextDuel.round > MAX_ARCHERY_ROUNDS) {
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
): ArcheryShotResult => {
  const logs = [...duel.logs];
  let playerHealth = duel.playerHealth;

  // Monster counter-attack
  const monsterShot = getMonsterShot(player, duel.monster);

  if (monsterShot.hit) {
    playerHealth = Math.max(1, playerHealth - monsterShot.damage);
    logs.push(
      `${duel.monster.name}反射${monsterShot.targetName}，造成 ${monsterShot.damage} 伤害。`,
    );
  } else {
    logs.push(`${duel.monster.name}还射${monsterShot.targetName}，被你侧身避开。`);
  }

  const nextPlayer: Player = {
    ...player,
    health: {
      ...player.health,
      current: playerHealth,
    },
  };
  const nextDuel: ArcheryDuelState = {
    ...duel,
    playerHealth,
    round: duel.round + 1,
    logs,
  };

  if (playerHealth <= 1) {
    return finishDuel(nextPlayer, nextDuel, false);
  }

  if (!duel.endless && nextDuel.round > MAX_ARCHERY_ROUNDS) {
    const wonByPressure = duel.monsterHealth < duel.monster.health * 0.35;
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

/** 无头对战路径选箭：优先最强实物箭，箭囊空空则回退最省灵力的灵力箭 */
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

    const result = shootArrow(currentPlayer, duel, arrowId, "chest");
    currentPlayer = result.player;
    duel = result.duel;

    if (result.battleResult) {
      return result.battleResult;
    }
  }

  return finishDuel(currentPlayer, duel, false).battleResult as BattleResult;
};
