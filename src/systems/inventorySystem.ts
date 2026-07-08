import { getItemDefinition } from "../data/items";
import type { InventoryStack, ItemCost } from "../types/game";

export const getInventoryQuantity = (
  inventory: InventoryStack[],
  itemId: string,
) => inventory.find((entry) => entry.itemId === itemId)?.quantity ?? 0;

export const hasItemCosts = (inventory: InventoryStack[], costs: ItemCost[]) =>
  costs.every((cost) => getInventoryQuantity(inventory, cost.itemId) >= cost.quantity);

export const addItemStacks = (
  inventory: InventoryStack[],
  items: ItemCost[],
): InventoryStack[] => {
  const nextInventory = [...inventory];

  items.forEach((item) => {
    const existing = nextInventory.find((entry) => entry.itemId === item.itemId);

    if (existing) {
      existing.quantity += item.quantity;
      return;
    }

    nextInventory.push({ ...item });
  });

  return nextInventory;
};

export const consumeItemCosts = (
  inventory: InventoryStack[],
  costs: ItemCost[],
): InventoryStack[] =>
  inventory
    .map((entry) => {
      const cost = costs.find((itemCost) => itemCost.itemId === entry.itemId);

      if (!cost) {
        return entry;
      }

      return {
        ...entry,
        quantity: entry.quantity - cost.quantity,
      };
    })
    .filter((entry) => entry.quantity > 0);

export const formatItemCost = (cost: ItemCost) => {
  const item = getItemDefinition(cost.itemId);
  return `${item?.name ?? cost.itemId} x${cost.quantity}`;
};
