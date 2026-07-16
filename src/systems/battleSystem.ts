import { getItemDefinition } from "../data/items";
import { getMonstersForRealmOrder } from "../data/monsters";
import { getRealmById } from "../data/realms";
import type { BattleResult, ItemCost, MonsterDefinition, Player } from "../types/game";
import { addItemStacks } from "./inventorySystem";
import { getEquipmentEffects } from "./equipmentSystem";
import { getManualEffects } from "./manualSystem";
import { advanceTime } from "./timeSystem";

const randomInt = (min: number, max: number) =>
  min + Math.floor(Math.random() * (max - min + 1));

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

export const restPlayer = (player: Player): Player => advanceTime({
  ...player,
  health: {
    ...player.health,
    current: player.health.max,
  },
  mana: {
    ...player.mana,
    current: player.mana.max,
  },
}, 1);

export const startBattle = (player: Player): BattleResult => {
  const monster = chooseMonster(player);
  const realm = getRealmById(player.realmId);
  const logs: string[] = [`你在${monster.area}遭遇了${monster.name}`];
  let playerHealth = player.health.current;
  let monsterHealth = monster.health;
  const manualEffects = getManualEffects(player);
  const equipmentEffects = getEquipmentEffects(player);
  const playerAttack = Math.floor(
    (14 +
      realm.order * 5 +
      player.attributes.rootBone * 2 +
      player.attributes.divineSense +
      equipmentEffects.attack) *
      (1 + manualEffects.battleAttackBonus),
  );
  const playerDefense = Math.floor(
    (4 +
      realm.order * 2 +
      Math.floor(player.attributes.mind / 2) +
      equipmentEffects.defense) *
      (1 + manualEffects.battleDefenseBonus),
  );

  for (let round = 1; round <= 6; round += 1) {
    const playerDamage = Math.max(
      1,
      randomInt(Math.floor(playerAttack * 0.75), Math.ceil(playerAttack * 1.18)) -
        monster.defense,
    );
    monsterHealth -= playerDamage;
    logs.push(`第 ${round} 回合：你造成 ${playerDamage} 伤害`);

    if (monsterHealth <= 0) {
      break;
    }

    const monsterDamage = Math.max(
      1,
      randomInt(Math.floor(monster.attack * 0.75), Math.ceil(monster.attack * 1.22)) -
        playerDefense,
    );
    playerHealth -= monsterDamage;
    logs.push(`${monster.name}反击，造成 ${monsterDamage} 伤害`);

    if (playerHealth <= 0) {
      break;
    }
  }

  const victory = monsterHealth <= 0;

  if (!victory) {
    return {
      monster,
      victory: false,
      reward: {
        spiritStones: 0,
        cultivation: 0,
        items: [],
      },
      logs: [...logs, "你负伤撤退，保住了性命"],
      message: `历练失败，被${monster.name}逼退`,
      player: advanceTime({
        ...player,
        health: {
          ...player.health,
          current: Math.max(1, playerHealth),
        },
      }, 3),
    };
  }

  const spiritStones = randomInt(
    monster.spiritStoneReward[0],
    monster.spiritStoneReward[1],
  );
  const cultivation = randomInt(
    monster.cultivationReward[0],
    monster.cultivationReward[1],
  );
  const items = rollLoot(monster);
  const requiredCultivation = realm.breakthrough.requiredCultivation;
  const nextCultivation = Math.min(
    requiredCultivation,
    player.cultivation.current + cultivation,
  );

  return {
    monster,
    victory: true,
    reward: {
      spiritStones,
      cultivation,
      items,
    },
    logs: [
      ...logs,
      `胜利，获得灵石 x${spiritStones}，修为 +${cultivation}，${formatLoot(items)}`,
    ],
    message: `击败${monster.name}，获得灵石 x${spiritStones}`,
    player: advanceTime({
      ...player,
      spiritStones: player.spiritStones + spiritStones,
      health: {
        ...player.health,
        current: Math.max(1, playerHealth),
      },
      inventory: addItemStacks(player.inventory, items),
      cultivation: {
        current: nextCultivation,
        required: requiredCultivation,
        lastGain: cultivation,
      },
    }, 3),
  };
};
