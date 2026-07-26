/** 战斗外服用丹药：疗伤/回灵/化瘀/属性丹统一路由（聚气丹仍走修炼路径） */

import { getPillDefinition } from "../data/pills";
import type { Player } from "../types/game";
import { clampInjury } from "./injurySystem";
import { consumeItemCosts, getInventoryQuantity } from "./inventorySystem";
import { advanceTime } from "./timeSystem";

export const useOutOfBattlePill = (
  player: Player,
  pillItemId: string,
): { player: Player; success: boolean; message: string } => {
  const pill = getPillDefinition(pillItemId);

  if (!pill) {
    return { player, success: false, message: "没有这种丹药。" };
  }

  if (getInventoryQuantity(player.inventory, pillItemId) <= 0) {
    return { player, success: false, message: `没有可服用的${pill.name}` };
  }

  const used = player.pillUseCounts[pillItemId] ?? 0;

  if (pill.maxUses && used >= pill.maxUses) {
    return {
      player,
      success: false,
      message: `${pill.name}终生限服${pill.maxUses}次，多服无益。`,
    };
  }

  const { heal, restoreMana, healInjury, rootBone, mind } = pill.effects;
  const nextInjury = healInjury
    ? clampInjury(player.injury - healInjury)
    : player.injury;
  const injuryDelta = player.injury - nextInjury;

  const nextPlayer = advanceTime(
    {
      ...player,
      inventory: consumeItemCosts(player.inventory, [
        { itemId: pillItemId, quantity: 1 },
      ]),
      health: heal
        ? {
            ...player.health,
            current: Math.min(player.health.max, player.health.current + heal),
          }
        : player.health,
      mana: restoreMana
        ? {
            ...player.mana,
            current: Math.min(player.mana.max, player.mana.current + restoreMana),
          }
        : player.mana,
      injury: nextInjury,
      attributes:
        rootBone || mind
          ? {
              ...player.attributes,
              rootBone: player.attributes.rootBone + (rootBone ?? 0),
              mind: player.attributes.mind + (mind ?? 0),
            }
          : player.attributes,
      pillUseCounts: pill.maxUses
        ? {
            ...player.pillUseCounts,
            [pillItemId]: used + 1,
          }
        : player.pillUseCounts,
    },
    1,
  );

  const effectText = [
    heal ? `气血回复 ${heal}` : "",
    restoreMana ? `灵力回复 ${restoreMana}` : "",
    injuryDelta > 0 ? `化解伤势 ${injuryDelta}` : "",
    rootBone ? `根骨 +${rootBone}` : "",
    mind ? `心境 +${mind}` : "",
  ]
    .filter(Boolean)
    .join("，");

  return {
    player: nextPlayer,
    success: true,
    message: `服下${pill.name}，${effectText}。`,
  };
};
