import {
  arrowDefinitions,
  getArrowDefinition,
  getTargetZone,
  targetZones,
} from "../data/arrows";
import { getItemDefinition } from "../data/items";
import { getMonstersForRealmOrder } from "../data/monsters";
import { getRealmById } from "../data/realms";
import type {
  ArcheryDuelState,
  ArcheryShotResult,
  BattleResult,
  ItemCost,
  MonsterDefinition,
  Player,
  TargetZoneId,
} from "../types/game";
import { addItemStacks, consumeItemCosts, getInventoryQuantity } from "./inventorySystem";
import { getEquipmentEffects } from "./equipmentSystem";
import { getManualEffects } from "./manualSystem";
import { advanceTime } from "./timeSystem";

const MAX_ARCHERY_ROUNDS = 8;

const randomInt = (min: number, max: number) =>
  min + Math.floor(Math.random() * (max - min + 1));

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const chooseMonster = (player: Player): MonsterDefinition => {
  const realm = getRealmById(player.realmId);
  const pool = getMonstersForRealmOrder(realm.order);

  return pool[randomInt(0, pool.length - 1)];
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

const getShotChance = (player: Player, arrowItemId: string, targetId: TargetZoneId) => {
  const arrow = getArrowDefinition(arrowItemId) ?? arrowDefinitions[0];
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

const getPlayerShotDamage = (
  player: Player,
  monster: MonsterDefinition,
  arrowItemId: string,
  targetId: TargetZoneId,
) => {
  const arrow = getArrowDefinition(arrowItemId) ?? arrowDefinitions[0];
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
  const damage = Math.max(
    1,
    Math.floor(
      rolledDamage *
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
      logs: [...duel.logs, "你负伤撤退，保住了性命。"],
      message: `历练失败，被${duel.monster.name}逼退`,
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
  const items = rollLoot(duel.monster);
  const requiredCultivation = realm.breakthrough.requiredCultivation;
  const nextCultivation = Math.min(
    requiredCultivation,
    player.cultivation.current + cultivation,
  );
  const finalLogs = [
    ...duel.logs,
    `胜利，获得灵石 x${spiritStones}，修为 +${cultivation}，${formatLoot(items)}。`,
  ];
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
    message: `击败${duel.monster.name}，获得灵石 x${spiritStones}`,
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

export const startArcheryBattle = (player: Player): ArcheryDuelState => {
  const monster = chooseMonster(player);

  return {
    monster,
    monsterHealth: monster.health,
    playerHealth: player.health.current,
    round: 1,
    finished: false,
    victory: null,
    logs: [`你在${monster.area}遭遇了${monster.name}，双方拉开距离，以弓箭对射。`],
  };
};

export const shootArrow = (
  player: Player,
  duel: ArcheryDuelState,
  arrowItemId: string,
  targetId: TargetZoneId,
): ArcheryShotResult => {
  if (duel.finished) {
    return {
      player,
      duel,
      battleResult: null,
      message: "战斗已经结束。",
    };
  }

  const arrow = getArrowDefinition(arrowItemId);
  const target = getTargetZone(targetId);

  if (!arrow) {
    return {
      player,
      duel,
      battleResult: null,
      message: "没有找到这种箭矢。",
    };
  }

  if (getInventoryQuantity(player.inventory, arrowItemId) <= 0) {
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
  const hitChance = getShotChance(player, arrowItemId, targetId);
  const shotLanded = Math.random() <= hitChance;
  let nextPlayer: Player = {
    ...player,
    inventory: consumeItemCosts(player.inventory, [{ itemId: arrowItemId, quantity: 1 }]),
    updatedAt: new Date().toISOString(),
  };

  if (shotLanded) {
    const { damage, critical } = getPlayerShotDamage(
      player,
      duel.monster,
      arrowItemId,
      targetId,
    );
    monsterHealth = Math.max(0, monsterHealth - damage);
    logs.push(
      `第 ${duel.round} 回合：你以${arrow.name}瞄准${target.name}，命中造成 ${damage} 伤害${critical ? "，正中要害" : ""}。`,
    );
  } else {
    logs.push(
      `第 ${duel.round} 回合：你以${arrow.name}瞄准${target.name}，箭矢擦身而过。`,
    );
  }

  let nextDuel: ArcheryDuelState = {
    ...duel,
    monsterHealth,
    playerHealth,
    logs,
  };

  if (monsterHealth <= 0) {
    return finishDuel(nextPlayer, nextDuel, true);
  }

  const monsterShot = getMonsterShot(nextPlayer, duel.monster);

  if (monsterShot.hit) {
    playerHealth = Math.max(1, playerHealth - monsterShot.damage);
    logs.push(
      `${duel.monster.name}反射${monsterShot.targetName}，造成 ${monsterShot.damage} 伤害。`,
    );
  } else {
    logs.push(`${duel.monster.name}还射${monsterShot.targetName}，被你侧身避开。`);
  }

  nextPlayer = {
    ...nextPlayer,
    health: {
      ...nextPlayer.health,
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

  if (nextDuel.round > MAX_ARCHERY_ROUNDS) {
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
    message: shotLanded ? "箭矢命中，敌人仍未倒下。" : "这一箭落空，敌人趁势还击。",
  };
};

const getBestAvailableArrow = (player: Player) =>
  [...arrowDefinitions]
    .reverse()
    .find((arrow) => getInventoryQuantity(player.inventory, arrow.itemId) > 0);

export const startBattle = (player: Player): BattleResult => {
  let duel = startArcheryBattle(player);
  let currentPlayer = player;

  for (let index = 0; index < MAX_ARCHERY_ROUNDS; index += 1) {
    const arrow = getBestAvailableArrow(currentPlayer);

    if (!arrow) {
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
        logs: [...duel.logs, "箭囊已空，只能暂避锋芒。"],
        message: "没有箭矢，历练被迫中止",
      };
    }

    const result = shootArrow(currentPlayer, duel, arrow.itemId, "chest");
    currentPlayer = result.player;
    duel = result.duel;

    if (result.battleResult) {
      return result.battleResult;
    }
  }

  return finishDuel(currentPlayer, duel, false).battleResult as BattleResult;
};
