/** 战力与难度分级：纯派生估算，仅供展示层参考（整备页 / 地点卡），不参与战斗结算管线 */

import { arrowDefinitions } from "../data/arrows";
import { getRealmById } from "../data/realms";
import {
  getSpiritArrowPower,
  getUnlockedSpiritArrowTiers,
} from "../data/spiritArrows";
import type { MonsterDefinition, Player } from "../types/game";
import { getEquipmentEffects } from "./equipmentSystem";
import { getInventoryQuantity } from "./inventorySystem";
import { getManualEffects } from "./manualSystem";

/** 当前可用最强箭威力：箭囊实物箭与已解锁灵力箭档位取大（无箭则为 0） */
export const getBestArrowPower = (player: Player): number => {
  let best = 0;

  for (const arrow of arrowDefinitions) {
    if (getInventoryQuantity(player.inventory, arrow.itemId) > 0) {
      best = Math.max(best, arrow.power);
    }
  }

  for (const tier of getUnlockedSpiritArrowTiers(player)) {
    best = Math.max(best, getSpiritArrowPower(player, tier));
  }

  return best;
};

/**
 * 玩家战力估算：攻击基座与战斗公式同源（箭威 + 境界×4 + 根骨×1.5 + 装备攻击），
 * ×2 折算攻防节奏，再加防御、气血与灵力池权重。
 */
export const getPlayerPower = (player: Player): number => {
  const realm = getRealmById(player.realmId);
  const equipment = getEquipmentEffects(player);
  const manual = getManualEffects(player);

  const offenseBase =
    getBestArrowPower(player) +
    realm.order * 4 +
    player.attributes.rootBone * 1.5 +
    equipment.attack;

  return Math.round(
    offenseBase * (1 + manual.battleAttackBonus) * 2 +
      equipment.defense +
      player.health.max * 0.4 +
      player.mana.max * 0.2,
  );
};

export type DifficultyLabel = "easy" | "even" | "tough" | "deadly";

export const DIFFICULTY_TEXT: Record<DifficultyLabel, string> = {
  easy: "轻松",
  even: "势均力敌",
  tough: "吃力",
  deadly: "凶险",
};

export interface MonsterDifficulty {
  ratio: number;
  label: DifficultyLabel;
  text: string;
}

/**
 * 难度比：monster.health/(power×0.9) + monster.attack×2/power。
 * <0.7 轻松 / 0.7–1.0 势均力敌 / 1.0–1.4 吃力 / >1.4 凶险。
 */
export const getMonsterDifficulty = (
  monster: MonsterDefinition,
  power: number,
): MonsterDifficulty => {
  const safePower = Math.max(1, power);
  const ratio =
    monster.health / (safePower * 0.9) + (monster.attack * 2) / safePower;

  const label: DifficultyLabel =
    ratio < 0.7
      ? "easy"
      : ratio <= 1.0
        ? "even"
        : ratio <= 1.4
          ? "tough"
          : "deadly";

  return {
    ratio: Math.round(ratio * 100) / 100,
    label,
    text: DIFFICULTY_TEXT[label],
  };
};

/** 怪物池的代表难度：按难度比取中位怪物再分级（区域整体印象） */
export const getPoolDifficulty = (
  pool: MonsterDefinition[],
  power: number,
): MonsterDifficulty | null => {
  if (pool.length === 0) {
    return null;
  }

  const sorted = [...pool].sort(
    (a, b) => getMonsterDifficulty(a, power).ratio - getMonsterDifficulty(b, power).ratio,
  );
  const median = sorted[Math.floor(sorted.length / 2)];

  return getMonsterDifficulty(median, power);
};
