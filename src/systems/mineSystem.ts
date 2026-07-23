/** 灵矿采矿系统：耗费气血灵力与时间，产出灵石与材料 */

import { getItemDefinition } from "../data/items";
import type { MapLocation } from "../data/locations";
import { getMineTable } from "../data/mines";
import { getRealmById } from "../data/realms";
import type { ItemCost, Player } from "../types/game";
import { addItemStacks } from "./inventorySystem";
import { advanceTime } from "./timeSystem";

const randomInt = (min: number, max: number) =>
  min + Math.floor(Math.random() * (max - min + 1));

export interface MineCheck {
  canMine: boolean;
  missingReasons: string[];
}

export const getMineCheck = (player: Player, loc: MapLocation): MineCheck => {
  const table = getMineTable(loc.mineId);
  const missingReasons: string[] = [];

  if (!table) {
    missingReasons.push("此地并无矿脉");
    return { canMine: false, missingReasons };
  }

  if (player.health.current <= table.healthCost) {
    missingReasons.push(`气血不足：采矿需要 ${table.healthCost} 气血`);
  }

  if (player.mana.current <= table.manaCost) {
    missingReasons.push(`灵力不足：采矿需要 ${table.manaCost} 灵力`);
  }

  return {
    canMine: missingReasons.length === 0,
    missingReasons,
  };
};

export interface MineResult {
  ok: boolean;
  player: Player;
  spiritStones: number;
  drops: ItemCost[];
  message: string;
}

export const mineOnce = (player: Player, loc: MapLocation): MineResult => {
  const table = getMineTable(loc.mineId);

  if (!table) {
    return {
      ok: false,
      player,
      spiritStones: 0,
      drops: [],
      message: "此地并无矿脉",
    };
  }

  const check = getMineCheck(player, loc);

  if (!check.canMine) {
    return {
      ok: false,
      player,
      spiritStones: 0,
      drops: [],
      message: `无法采矿：${check.missingReasons.join("；")}`,
    };
  }

  const realm = getRealmById(player.realmId);
  const spiritStones =
    randomInt(table.spiritStones[0], table.spiritStones[1]) +
    realm.order * table.perOrderBonus;
  const drops = table.drops
    .filter((drop) => Math.random() <= drop.chance)
    .map((drop) => ({ itemId: drop.itemId, quantity: 1 }));
  const dropNames = drops.map(
    (drop) => `${getItemDefinition(drop.itemId)?.name ?? drop.itemId} ×${drop.quantity}`,
  );

  return {
    ok: true,
    player: advanceTime(
      {
        ...player,
        spiritStones: player.spiritStones + spiritStones,
        health: {
          ...player.health,
          current: Math.max(1, player.health.current - table.healthCost),
        },
        mana: {
          ...player.mana,
          current: Math.max(0, player.mana.current - table.manaCost),
        },
        inventory: addItemStacks(player.inventory, drops),
      },
      table.timeDays,
    ),
    spiritStones,
    drops,
    message:
      dropNames.length > 0
        ? `采矿一日，得灵石 ×${spiritStones}，又挖出${dropNames.join("、")}`
        : `采矿一日，得灵石 ×${spiritStones}`,
  };
};
