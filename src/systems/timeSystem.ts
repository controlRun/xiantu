import type { Player } from "../types/game";

export const DAYS_PER_YEAR = 360;

export const advanceTime = (player: Player, days: number): Player => ({
  ...player,
  age: Number((player.age + days / DAYS_PER_YEAR).toFixed(3)),
  updatedAt: new Date().toISOString(),
});

export const formatAge = (age: number) =>
  Number.isInteger(age) ? `${age}` : age.toFixed(1);

/** 闭关时长的可读格式：整年省略月，零头月补「N个月」 */
export const formatMonths = (months: number): string => {
  const years = Math.floor(months / 12);
  const rest = months % 12;

  if (years > 0 && rest > 0) {
    return `${years}年${rest}个月`;
  }

  if (years > 0) {
    return `${years}年`;
  }

  return `${rest}个月`;
};

export const getRemainingYears = (player: Player) =>
  Math.max(0, player.lifespan - player.age);

/** 游戏内日索引（age×360 取整）：用于「今日」判定与 Boss 每日限次 */
export const getGameDay = (player: Player) =>
  Math.floor(player.age * DAYS_PER_YEAR);

/** 天数的可读格式：半日 → 半日，整数 → N 日（决策成本展示用） */
export const formatDays = (days: number) =>
  days === 0.5 ? "半日" : `${days} 日`;

/** 寿尽判定：age ≥ lifespan 即坐化。advanceTime 保留三位小数，等号可成立 */
export const isPlayerDead = (player: Player): boolean =>
  player.age >= player.lifespan;
