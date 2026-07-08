import { getItemDefinition } from "../data/items";
import { getNextRealm, getRealmById } from "../data/realms";
import type {
  BreakthroughCheck,
  BreakthroughResult,
  Player,
} from "../types/game";
import {
  consumeItemCosts,
  formatItemCost,
  getInventoryQuantity,
  hasItemCosts,
} from "./inventorySystem";

const clampChance = (chance: number) => Math.max(0.05, Math.min(0.95, chance));

export const getCultivationGain = (player: Player) => {
  const rootGain = player.attributes.rootBone * 2;
  const mindGain = Math.floor(player.attributes.mind / 2);
  const baseGain = 10 + rootGain + mindGain;

  return Math.max(
    1,
    Math.floor(baseGain * player.spiritualRoot.cultivationMultiplier),
  );
};

export const getBreakthroughChance = (player: Player) => {
  const realm = getRealmById(player.realmId);
  const attributeBonus =
    player.attributes.rootBone * 0.006 +
    player.attributes.comprehension * 0.004 +
    player.attributes.luck * 0.003 +
    player.spiritualRoot.breakthroughBonus;

  return clampChance(realm.breakthrough.baseChance + attributeBonus);
};

export const getBreakthroughCheck = (player: Player): BreakthroughCheck => {
  const realm = getRealmById(player.realmId);
  const missingReasons: string[] = [];

  if (!realm.breakthrough.nextRealmId) {
    missingReasons.push("当前版本暂未开放更高境界");
  }

  if (player.cultivation.current < realm.breakthrough.requiredCultivation) {
    missingReasons.push(
      `修为不足：需要 ${realm.breakthrough.requiredCultivation}`,
    );
  }

  if (player.attributes.mind < realm.breakthrough.minMind) {
    missingReasons.push(`心境不足：需要 ${realm.breakthrough.minMind}`);
  }

  if (player.spiritStones < realm.breakthrough.spiritStoneCost) {
    missingReasons.push(`灵石不足：需要 ${realm.breakthrough.spiritStoneCost}`);
  }

  if (!hasItemCosts(player.inventory, realm.breakthrough.requiredItems)) {
    realm.breakthrough.requiredItems.forEach((cost) => {
      const owned = getInventoryQuantity(player.inventory, cost.itemId);

      if (owned < cost.quantity) {
        const item = getItemDefinition(cost.itemId);
        missingReasons.push(
          `${item?.name ?? cost.itemId}不足：需要 ${cost.quantity}`,
        );
      }
    });
  }

  return {
    canBreakthrough: missingReasons.length === 0,
    chance: getBreakthroughChance(player),
    missingReasons,
  };
};

export const cultivate = (player: Player): Player => {
  const realm = getRealmById(player.realmId);
  const gain = getCultivationGain(player);
  const nextCultivation = Math.min(
    realm.breakthrough.requiredCultivation,
    player.cultivation.current + gain,
  );

  return {
    ...player,
    cultivation: {
      current: nextCultivation,
      required: realm.breakthrough.requiredCultivation,
      lastGain: gain,
    },
    updatedAt: new Date().toISOString(),
  };
};

export const useQiGatheringPill = (player: Player) => {
  const owned = getInventoryQuantity(player.inventory, "qi-gathering-pill");

  if (owned <= 0) {
    return {
      player,
      success: false,
      message: "没有可服用的聚气丹",
    };
  }

  const realm = getRealmById(player.realmId);
  const gain = Math.floor(80 * player.spiritualRoot.cultivationMultiplier);
  const current = Math.min(
    realm.breakthrough.requiredCultivation,
    player.cultivation.current + gain,
  );

  return {
    player: {
      ...player,
      inventory: consumeItemCosts(player.inventory, [
        { itemId: "qi-gathering-pill", quantity: 1 },
      ]),
      cultivation: {
        current,
        required: realm.breakthrough.requiredCultivation,
        lastGain: gain,
      },
      updatedAt: new Date().toISOString(),
    },
    success: true,
    message: `服下聚气丹，修为 +${gain}`,
  };
};

export const attemptBreakthrough = (player: Player): BreakthroughResult => {
  const realm = getRealmById(player.realmId);
  const nextRealm = getNextRealm(player.realmId);
  const check = getBreakthroughCheck(player);

  if (!check.canBreakthrough || !nextRealm) {
    return {
      player,
      success: false,
      message: check.missingReasons[0] ?? "暂无法突破",
    };
  }

  const passed = Math.random() <= check.chance;
  const inventory = consumeItemCosts(player.inventory, realm.breakthrough.requiredItems);
  const spiritStones = player.spiritStones - realm.breakthrough.spiritStoneCost;

  if (!passed) {
    const lostCultivation = Math.ceil(realm.breakthrough.requiredCultivation * 0.18);

    return {
      success: false,
      message: `突破失败，气息紊乱，损失 ${lostCultivation} 修为`,
      player: {
        ...player,
        spiritStones,
        inventory,
        cultivation: {
          ...player.cultivation,
          current: Math.max(0, player.cultivation.current - lostCultivation),
        },
        updatedAt: new Date().toISOString(),
      },
    };
  }

  return {
    success: true,
    message: `突破成功，已晋入${nextRealm.name}`,
    player: {
      ...player,
      realmId: nextRealm.id,
      spiritStones,
      inventory,
      lifespan: player.lifespan + realm.rewards.lifespan,
      health: {
        current: player.health.max + realm.rewards.health,
        max: player.health.max + realm.rewards.health,
      },
      mana: {
        current: player.mana.max + realm.rewards.mana,
        max: player.mana.max + realm.rewards.mana,
      },
      cultivation: {
        current: 0,
        required: nextRealm.breakthrough.requiredCultivation,
        lastGain: 0,
      },
      updatedAt: new Date().toISOString(),
    },
  };
};

export const describeBreakthroughCosts = (player: Player) => {
  const realm = getRealmById(player.realmId);
  const costs = realm.breakthrough.requiredItems.map(formatItemCost);

  if (realm.breakthrough.spiritStoneCost > 0) {
    costs.push(`灵石 x${realm.breakthrough.spiritStoneCost}`);
  }

  return costs.length > 0 ? costs.join("，") : "无额外材料";
};
