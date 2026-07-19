import type { TargetZoneId } from "../types/game";

export const detectTargetZone = (x: number, y: number): TargetZoneId => {
  // Based on relative position in SVG canvas (0-100%)
  // y < 25% → head
  // 25% ≤ y < 55% → chest (but if x < 30% or x > 70% → arm)
  // y ≥ 55% → leg

  if (y < 25) {
    return "head";
  }

  if (y < 55) {
    // Middle section - check if it's arm or chest
    if (x < 30 || x > 70) {
      return "arm";
    }
    return "chest";
  }

  return "leg";
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
