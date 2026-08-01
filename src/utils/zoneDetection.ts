import type { TargetZoneId } from "../types/game";

/**
 * 瞄准部位检测 —— 基于准星与敌方身体的相对位置（SVG 坐标）。
 * 以敌方身体中心为原点：
 *   上方 → 头部；下方 → 腿部；中段两侧 → 手臂；中段正面 → 胸腹。
 */
export const detectTargetZone = (
  aimX: number,
  aimY: number,
  enemyX: number,
  enemyBodyY: number,
  /** 判区容差倍率：>1 时胸腹（中心）更宽容，触屏默认 1，触屏路径传 1.3 */
  tolerance = 1,
): TargetZoneId => {
  const relX = aimX - enemyX;
  const relY = aimY - enemyBodyY;

  if (relY < -20 * tolerance) {
    return "head";
  }

  if (relY > 26 * tolerance) {
    return "leg";
  }

  if (Math.abs(relX) > 18 * tolerance) {
    return "arm";
  }

  return "chest";
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
