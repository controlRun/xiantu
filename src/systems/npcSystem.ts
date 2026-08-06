/** NPC 馈赠系统：纯函数发放一次性馈赠，已领记录入存档（npcGiftClaimedIds） */

import { getItemDefinition } from "../data/items";
import type { NpcDefinition } from "../data/npcs";
import type { Player } from "../types/game";
import { addItemStacks } from "./inventorySystem";
import { advanceTime } from "./timeSystem";

export interface NpcGiftResult {
  player: Player;
  /** 本次是否实际发放（无馈赠或已领 → false） */
  granted: boolean;
  message: string;
}

/** 领取 NPC 一次性馈赠：幂等，重复领取原样返回 */
export const claimNpcGift = (
  player: Player,
  npc: NpcDefinition,
): NpcGiftResult => {
  const gift = npc.gift;

  if (!gift || player.npcGiftClaimedIds.includes(npc.id)) {
    return { player, granted: false, message: "" };
  }

  const gains: string[] = [];
  let nextPlayer: Player = player;

  if (gift.spiritStones && gift.spiritStones > 0) {
    nextPlayer = {
      ...nextPlayer,
      spiritStones: nextPlayer.spiritStones + gift.spiritStones,
    };
    gains.push(`灵石 x${gift.spiritStones}`);
  }

  if (gift.itemId) {
    const item = getItemDefinition(gift.itemId);
    const quantity = gift.quantity ?? 1;
    nextPlayer = {
      ...nextPlayer,
      inventory: addItemStacks(nextPlayer.inventory, [
        { itemId: gift.itemId, quantity },
      ]),
    };
    gains.push(`${item?.name ?? gift.itemId} x${quantity}`);
  }

  nextPlayer = {
    ...nextPlayer,
    npcGiftClaimedIds: [...nextPlayer.npcGiftClaimedIds, npc.id],
  };

  const giftLine = gains.length > 0 ? `得${gains.join("、")}` : "";
  const maximLine = gift.maxim ? `「${gift.maxim}」` : "";
  const message = [`${npc.name}赠你一份见面礼`, giftLine, maximLine]
    .filter((part) => part.length > 0)
    .join("，");

  // 对话不耗时日，advanceTime 仅刷新 updatedAt
  return { player: advanceTime(nextPlayer, 0), granted: true, message };
};
