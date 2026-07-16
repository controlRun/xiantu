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
