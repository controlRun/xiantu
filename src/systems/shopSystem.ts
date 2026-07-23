/** 城镇商店系统：按倍率买入、按基准价六成卖出（统一公式，杜绝两地倒卖） */

import { getItemDefinition } from "../data/items";
import { getShop } from "../data/shops";
import type { ItemDefinition, Player } from "../types/game";
import {
  addItemStacks,
  consumeItemCosts,
  getInventoryQuantity,
} from "./inventorySystem";

export const getBuyPrice = (item: ItemDefinition, markup: number) =>
  Math.max(1, Math.ceil(item.value * markup));

export const getSellPrice = (item: ItemDefinition) =>
  Math.max(1, Math.floor(item.value * 0.6));

export interface ShopActionResult {
  ok: boolean;
  reason?: string;
  player: Player;
  message: string;
}

export const buyItem = (
  player: Player,
  locationId: string,
  itemId: string,
): ShopActionResult => {
  const shop = getShop(locationId);
  const item = getItemDefinition(itemId);

  if (!shop || !item || !shop.itemIds.includes(itemId)) {
    return {
      ok: false,
      reason: "此店不售此物",
      player,
      message: "此店不售此物",
    };
  }

  const price = getBuyPrice(item, shop.markup);

  if (player.spiritStones < price) {
    return {
      ok: false,
      reason: `灵石不足：需要 ${price}`,
      player,
      message: `灵石不足：购买${item.name}需要 ${price} 灵石`,
    };
  }

  return {
    ok: true,
    player: {
      ...player,
      spiritStones: player.spiritStones - price,
      inventory: addItemStacks(player.inventory, [
        { itemId: item.id, quantity: 1 },
      ]),
      updatedAt: new Date().toISOString(),
    },
    message: `购得${item.name}，花费灵石 ×${price}`,
  };
};

export const sellItem = (
  player: Player,
  itemId: string,
): ShopActionResult => {
  const item = getItemDefinition(itemId);

  if (!item) {
    return {
      ok: false,
      reason: "物品不存在",
      player,
      message: "物品不存在",
    };
  }

  if (getInventoryQuantity(player.inventory, itemId) <= 0) {
    return {
      ok: false,
      reason: "没有可出售的物品",
      player,
      message: `没有可出售的${item.name}`,
    };
  }

  const price = getSellPrice(item);

  return {
    ok: true,
    player: {
      ...player,
      spiritStones: player.spiritStones + price,
      inventory: consumeItemCosts(player.inventory, [
        { itemId: item.id, quantity: 1 },
      ]),
      updatedAt: new Date().toISOString(),
    },
    message: `售出${item.name}，得灵石 ×${price}`,
  };
};
