import { VIEW_H, VIEW_W } from "../components/battle/battleLayout";

/**
 * 箭矢抛物线物理 —— 玩家与敌方箭矢共用同一套弹道模型。
 * 瞄准方向决定初速方向，蓄力决定初速大小：
 *   力度不足 → 抛物线过短，箭矢坠入深渊；
 *   力度过大 → 箭矢越过对手，飞出窗口。
 */

/**
 * 重力加速度（px/s²，SVG 坐标系 y 向下为正）。
 * 取值按"满蓄力 + 略微上仰可命中对手"调校：
 * 重力太大时，满蓄平射也会在飞抵对手前坠入深渊，
 * 玩家会觉得"蓄力足够箭却照样掉下来"。
 */
export const GRAVITY = 550;

/** 蓄力 → 初速（px/s）：0% → 300，100% → 1250 */
export const LAUNCH_BASE_SPEED = 300;
export const LAUNCH_POWER_SCALE = 950;

/** 单次飞行最长时间（秒），超时视为力竭 */
export const MAX_FLIGHT_TIME = 3.5;

/** 出界边距 */
const OUT_MARGIN = 30;

export const launchSpeed = (drawPower: number) =>
  LAUNCH_BASE_SPEED + drawPower * LAUNCH_POWER_SCALE;

/**
 * 发射方向（单位向量）—— 对瞄准方向做合理约束：
 * 弓箭不会朝身后发射，也不会直直往地面砸（那会出手即坠渊）。
 * 准星压得再低，最多也只是近乎平射，箭矢的坠落由重力自然完成。
 */
export const launchDirection = (
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): { dirX: number; dirY: number } => {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 1) {
    return { dirX: 1, dirY: -0.12 };
  }

  let dirX = dx / distance;
  let dirY = dy / distance;

  // 沿初始朝向锁定"向前"（玩家向右、敌方向左），俯角封顶接近平射，仰角不限
  const forward = dirX >= 0 ? 0.18 : -0.18;
  dirX = dirX >= 0 ? Math.max(dirX, forward) : Math.min(dirX, forward);
  dirY = Math.min(dirY, 0.06);

  const norm = Math.sqrt(dirX * dirX + dirY * dirY);
  return { dirX: dirX / norm, dirY: dirY / norm };
};

export interface ArrowPoint {
  x: number;
  y: number;
}

/** t 时刻箭矢位置（from 为箭尾出发点，dir 为单位方向向量，向上为负） */
export const simulateArrowPoint = (
  fromX: number,
  fromY: number,
  dirX: number,
  dirY: number,
  speed: number,
  t: number,
): ArrowPoint => ({
  x: fromX + dirX * speed * t,
  y: fromY + dirY * speed * t + 0.5 * GRAVITY * t * t,
});

/** t 时刻箭矢飞行角度（deg），随速度方向自然俯仰 */
export const arrowAngleAt = (
  dirX: number,
  dirY: number,
  speed: number,
  t: number,
): number => {
  const vx = dirX * speed;
  const vy = dirY * speed + GRAVITY * t;
  return Math.atan2(vy, vx) * (180 / Math.PI);
};

export type FlightEndReason = "abyss" | "passed" | "sky";

/** 判断箭矢是否已离开战场，返回离场原因；仍在场内返回 null */
export const flightEndReason = (x: number, y: number): FlightEndReason | null => {
  if (y > VIEW_H + OUT_MARGIN) {
    return "abyss"; // 坠入深渊
  }
  if (x < -OUT_MARGIN || x > VIEW_W + OUT_MARGIN) {
    return "passed"; // 横向飞出窗口
  }
  return null;
};

/** 蓄力档位配色（蓄力条 / 轨迹预览共用） */
export const powerTierColor = (drawPower: number): string => {
  if (drawPower < 0.3) return "#e8c45d"; // 金：轻拉，力道不足
  if (drawPower < 0.7) return "#72c08c"; // 翠：适中
  return "#e85d5d"; // 朱：刚猛，易脱力出界
};

export const MISS_TEXTS: Record<FlightEndReason, string> = {
  abyss: "劲力已竭 · 箭坠深渊",
  passed: "擦身而过",
  sky: "力道过猛 · 箭入苍茫",
};

/**
 * 反解弹道：给定出发点、目标点与初速，求低仰角发射方向。
 * 用于敌方回合 —— 按战报结果决定这一箭是否射得中。
 * 无法抵达时返回 null。
 */
export const solveLaunchDirection = (
  fromX: number,
  fromY: number,
  targetX: number,
  targetY: number,
  speed: number,
): { dirX: number; dirY: number } | null => {
  const dx = targetX - fromX;
  const dyUp = -(targetY - fromY); // 转为 y 向上为正
  const absDx = Math.abs(dx);

  if (absDx < 1) {
    return { dirX: 0, dirY: -1 };
  }

  const v2 = speed * speed;
  const discriminant = v2 * v2 - GRAVITY * (GRAVITY * absDx * absDx + 2 * dyUp * v2);

  if (discriminant < 0) {
    return null; // 初速不足，物理上无法抵达
  }

  // 低仰角解（直射弹道）
  const tanTheta = (v2 - Math.sqrt(discriminant)) / (GRAVITY * absDx);
  const theta = Math.atan(tanTheta);

  return {
    dirX: (dx > 0 ? 1 : -1) * Math.cos(theta),
    dirY: -Math.sin(theta),
  };
};
