import { getItemDefinition } from "../data/items";
import { getManualDefinition, manualDefinitions } from "../data/manuals";
import type { ManualEffects, Player, SectActionResult } from "../types/game";
import { consumeItemCosts, getInventoryQuantity } from "./inventorySystem";
import { advanceTime } from "./timeSystem";

export const getLearnedManuals = (player: Player) =>
  player.learnedManualIds
    .map((manualId) => getManualDefinition(manualId))
    .filter((manual) => manual !== undefined);

export const getManualEffects = (player: Player): Required<ManualEffects> =>
  getLearnedManuals(player).reduce(
    (effects, manual) => ({
      cultivationBonus:
        effects.cultivationBonus + (manual.effects.cultivationBonus ?? 0),
      breakthroughBonus:
        effects.breakthroughBonus + (manual.effects.breakthroughBonus ?? 0),
      alchemyBonus: effects.alchemyBonus + (manual.effects.alchemyBonus ?? 0),
      battleAttackBonus:
        effects.battleAttackBonus + (manual.effects.battleAttackBonus ?? 0),
      battleDefenseBonus:
        effects.battleDefenseBonus + (manual.effects.battleDefenseBonus ?? 0),
    }),
    {
      cultivationBonus: 0,
      breakthroughBonus: 0,
      alchemyBonus: 0,
      battleAttackBonus: 0,
      battleDefenseBonus: 0,
    },
  );

export const learnManual = (
  player: Player,
  manualItemId: string,
): SectActionResult => {
  const manual = getManualDefinition(manualItemId);
  const item = getItemDefinition(manualItemId);

  if (!manual || item?.type !== "manual") {
    return {
      player,
      success: false,
      message: "这不是可学习的功法",
      logs: ["你翻看片刻，并未找到可修之法"],
    };
  }

  if (player.learnedManualIds.includes(manualItemId)) {
    return {
      player,
      success: false,
      message: "该功法已经学会",
      logs: [`${manual.name}已在你的识海中留下痕迹`],
    };
  }

  if (getInventoryQuantity(player.inventory, manualItemId) <= 0) {
    return {
      player,
      success: false,
      message: "背包中没有该功法",
      logs: ["无书可读，自然无从参悟"],
    };
  }

  return {
    player: advanceTime({
      ...player,
      learnedManualIds: [...player.learnedManualIds, manualItemId],
      inventory: consumeItemCosts(player.inventory, [
        { itemId: manualItemId, quantity: 1 },
      ]),
    }, 10),
    success: true,
    message: `学会${manual.name}`,
    logs: [manual.description, `功法加成：${formatManualEffects(manual.effects)}`],
  };
};

export const formatManualEffects = (effects: ManualEffects) => {
  const labels = [
    effects.cultivationBonus
      ? `修炼 +${Math.round(effects.cultivationBonus * 100)}%`
      : null,
    effects.breakthroughBonus
      ? `突破 +${Math.round(effects.breakthroughBonus * 100)}%`
      : null,
    effects.alchemyBonus
      ? `炼丹 +${Math.round(effects.alchemyBonus * 100)}%`
      : null,
    effects.battleAttackBonus
      ? `战斗攻击 +${Math.round(effects.battleAttackBonus * 100)}%`
      : null,
    effects.battleDefenseBonus
      ? `战斗防御 +${Math.round(effects.battleDefenseBonus * 100)}%`
      : null,
  ].filter((label): label is string => label !== null);

  return labels.length > 0 ? labels.join("，") : "无显著加成";
};

export const getManualsForSect = (sectId: string | null) =>
  manualDefinitions.filter((manual) => manual.sectId === null || manual.sectId === sectId);
