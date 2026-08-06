/** 目标派生系统：从玩家当前状态纯派生进度，不落盘、不存函数 */

import { goals, type GoalDefinition } from "../data/goals";
import { getRealmById } from "../data/realms";
import type { Player } from "../types/game";
import { getBreakthroughCheck } from "./cultivationSystem";
import { getInventoryQuantity } from "./inventorySystem";
import { getGameDay } from "./timeSystem";

export interface GoalProgress {
  goal: GoalDefinition;
  progress: number;
  total: number;
  done: boolean;
}

/** 突破齐备目标的分母：修为 / 心境 / 灵石 / 材料 四项 */
const BREAKTHROUGH_CHECKS = 4;

export const evaluateGoals = (player: Player): GoalProgress[] =>
  goals.map((goal) => {
    switch (goal.cond.kind) {
      case "cultivateToday": {
        const done = player.stats.lastCultivateDay === getGameDay(player);
        return { goal, progress: done ? 1 : 0, total: 1, done };
      }
      case "breakthroughReady": {
        const missing = getBreakthroughCheck(player).missingReasons.length;
        const progress = Math.max(
          0,
          BREAKTHROUGH_CHECKS - Math.min(missing, BREAKTHROUGH_CHECKS),
        );
        return { goal, progress, total: BREAKTHROUGH_CHECKS, done: missing === 0 };
      }
      case "collect": {
        const owned = getInventoryQuantity(player.inventory, goal.cond.itemId);
        return {
          goal,
          progress: Math.min(owned, goal.cond.count),
          total: goal.cond.count,
          done: owned >= goal.cond.count,
        };
      }
      case "joinSect": {
        const done = player.sectId !== null;
        return { goal, progress: done ? 1 : 0, total: 1, done };
      }
      case "buildCave": {
        const done = player.caveDwellingId !== null;
        return { goal, progress: done ? 1 : 0, total: 1, done };
      }
      case "bossKill": {
        const done = player.stats.bossesKilled > 0;
        return { goal, progress: done ? 1 : 0, total: 1, done };
      }
      case "reachOrder": {
        const order = getRealmById(player.realmId).order;
        return {
          goal,
          progress: Math.min(order, goal.cond.order),
          total: goal.cond.order,
          done: order >= goal.cond.order,
        };
      }
      case "npcGift": {
        const claimed = player.npcGiftClaimedIds.length;
        return {
          goal,
          progress: Math.min(claimed, goal.cond.count),
          total: goal.cond.count,
          done: claimed >= goal.cond.count,
        };
      }
      default:
        return { goal, progress: 0, total: 1, done: false };
    }
  });

/** 地图摘要：取完成度最高的未完成短期目标（如「灵息草 ×10 7/10」） */
export const getNextGoalSummary = (player: Player): string | null => {
  const pending = evaluateGoals(player).filter(
    (entry) => entry.goal.tier === "short" && !entry.done,
  );

  if (pending.length === 0) {
    return null;
  }

  pending.sort(
    (a, b) => b.progress / b.total - a.progress / a.total,
  );
  const top = pending[0];

  return `${top.goal.name} ${top.progress}/${top.total}`;
};
