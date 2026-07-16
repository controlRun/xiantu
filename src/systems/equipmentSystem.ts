import { equipmentDefinitions, getEquipmentDefinition } from "../data/equipment";
import { getItemDefinition } from "../data/items";
import type {
  EquipmentEffects,
  EquipmentSlot,
  Player,
  SectActionResult,
} from "../types/game";
import {
  addItemStacks,
  consumeItemCosts,
  getInventoryQuantity,
} from "./inventorySystem";
import { advanceTime } from "./timeSystem";

const emptyEffects: EquipmentEffects = {
  attack: 0,
  defense: 0,
};

export const getEquippedItems = (player: Player) =>
  (Object.entries(player.equipment) as [EquipmentSlot, string | null][])
    .map(([slot, itemId]) => ({
      slot,
      item: itemId ? getEquipmentDefinition(itemId) : undefined,
    }))
    .filter((entry) => entry.item !== undefined);

export const getEquipmentEffects = (player: Player): EquipmentEffects =>
  getEquippedItems(player).reduce(
    (effects, entry) => ({
      attack: effects.attack + (entry.item?.effects.attack ?? 0),
      defense: effects.defense + (entry.item?.effects.defense ?? 0),
    }),
    emptyEffects,
  );

export const equipItem = (
  player: Player,
  itemId: string,
): SectActionResult => {
  const item = getItemDefinition(itemId);
  const equipment = getEquipmentDefinition(itemId);

  if (!equipment || item?.type !== "equipment") {
    return {
      player,
      success: false,
      message: "这不是可穿戴的装备",
      logs: ["此物无法收入装备栏"],
    };
  }

  if (getInventoryQuantity(player.inventory, itemId) <= 0) {
    return {
      player,
      success: false,
      message: "背包中没有该装备",
      logs: ["装备不在手边，无法穿戴"],
    };
  }

  const previousItemId = player.equipment[equipment.slot];
  const inventoryWithoutNew = consumeItemCosts(player.inventory, [
    { itemId, quantity: 1 },
  ]);
  const nextInventory = previousItemId
    ? addItemStacks(inventoryWithoutNew, [{ itemId: previousItemId, quantity: 1 }])
    : inventoryWithoutNew;

  return {
    player: advanceTime({
      ...player,
      inventory: nextInventory,
      equipment: {
        ...player.equipment,
        [equipment.slot]: itemId,
      },
    }, 1),
    success: true,
    message: `穿戴${equipment.name}`,
    logs: [
      equipment.description,
      `装备加成：攻击 +${equipment.effects.attack}，防御 +${equipment.effects.defense}`,
    ],
  };
};

export const getEquipmentBySlot = (slot: EquipmentSlot) =>
  equipmentDefinitions.filter((equipment) => equipment.slot === slot);
