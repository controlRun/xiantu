import type { Player } from "../types/game";

export const DAYS_PER_YEAR = 360;

export const advanceTime = (player: Player, days: number): Player => ({
  ...player,
  age: Number((player.age + days / DAYS_PER_YEAR).toFixed(3)),
  updatedAt: new Date().toISOString(),
});

export const formatAge = (age: number) =>
  Number.isInteger(age) ? `${age}` : age.toFixed(1);

export const getRemainingYears = (player: Player) =>
  Math.max(0, player.lifespan - player.age);

/** 游戏内日索引（age×360 取整）：用于「今日」判定与 Boss 每日限次 */
export const getGameDay = (player: Player) =>
  Math.floor(player.age * DAYS_PER_YEAR);

/** 寿尽判定：age ≥ lifespan 即坐化。advanceTime 保留三位小数，等号可成立 */
export const isPlayerDead = (player: Player): boolean =>
  player.age >= player.lifespan;
