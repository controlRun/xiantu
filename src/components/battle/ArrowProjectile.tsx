import { useEffect, useRef, useState } from "react";
import {
  arrowAngleAt,
  flightEndReason,
  launchDirection,
  launchSpeed,
  MAX_FLIGHT_TIME,
  simulateArrowPoint,
  type FlightEndReason,
} from "../../utils/arrowPhysics";
import { HIT_SECOND_POINT_OFFSET } from "./battleLayout";

interface ArrowProjectileProps {
  fromX: number;
  fromY: number;
  /** 瞄准方向上的任意一点（与 from 共同决定发射方向） */
  toX: number;
  toY: number;
  isFlying: boolean;
  /** 蓄力 0~1，决定初速与射程 */
  drawPower: number;
  /** 目标（对手）碰撞中心 */
  targetX: number;
  targetY: number;
  targetRadius: number;
  /** 飞行结束但未命中：报告离场原因与最后位置 */
  onComplete: (reason: FlightEndReason, x: number, y: number) => void;
  /** 命中对手：报告箭尾位置与飞行角度（用于插箭停留） */
  onHit?: (x: number, y: number, angleDeg: number) => void;
  isEnemy?: boolean;
}

export const ArrowProjectile = ({
  fromX,
  fromY,
  toX,
  toY,
  isFlying,
  drawPower,
  targetX,
  targetY,
  targetRadius,
  onComplete,
  onHit,
  isEnemy = false,
}: ArrowProjectileProps) => {
  const [current, setCurrent] = useState({ x: fromX, y: fromY, angle: 0 });
  const onCompleteRef = useRef(onComplete);
  const onHitRef = useRef(onHit);

  // 每次渲染同步最新发射参数；起飞瞬间从中取值并冻结。
  // 飞行途中父组件的任何 prop 变动都不会重启动画、篡改初速
  const launchRef = useRef({
    fromX,
    fromY,
    toX,
    toY,
    drawPower,
    targetX,
    targetY,
    targetRadius,
  });
  launchRef.current = {
    fromX,
    fromY,
    toX,
    toY,
    drawPower,
    targetX,
    targetY,
    targetRadius,
  };

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onHitRef.current = onHit;
  }, [onHit]);

  useEffect(() => {
    if (!isFlying) {
      const { fromX, fromY } = launchRef.current;
      setCurrent({ x: fromX, y: fromY, angle: 0 });
      return;
    }

    // 起飞瞬间冻结发射参数 —— 方向与蓄力一律以松手那一刻为准
    const {
      fromX,
      fromY,
      toX,
      toY,
      drawPower,
      targetX,
      targetY,
      targetRadius,
    } = launchRef.current;

    // 发射方向（单位向量，带向前/俯角约束，杜绝出手即坠地）
    const { dirX, dirY } = launchDirection(fromX, fromY, toX, toY);

    // 蓄力决定初速 —— 力度不足会坠落，力度过大将出界
    const speed = launchSpeed(drawPower);
    const startTime = performance.now();
    let animationId = 0;
    let isCompleted = false;

    // 双点碰撞：身体中心 + 头颈偏移点，任一进入半径即命中
    const checkHit = (x: number, y: number, fdirX: number, fdirY: number) => {
      for (const ahead of [65, 32, 0]) {
        const px = x + fdirX * ahead;
        const py = y + fdirY * ahead;
        for (const cy of [targetY, targetY - HIT_SECOND_POINT_OFFSET]) {
          const dx = px - targetX;
          const dy = py - cy;
          if (dx * dx + dy * dy <= targetRadius * targetRadius) {
            return true;
          }
        }
      }
      return false;
    };

    const animate = () => {
      const t = (performance.now() - startTime) / 1000;
      const { x, y } = simulateArrowPoint(fromX, fromY, dirX, dirY, speed, t);
      const angle = arrowAngleAt(dirX, dirY, speed, t);

      setCurrent({ x, y, angle });

      // 飞行姿态的单位向量（用于沿箭身取碰撞采样点）
      const rad = (angle * Math.PI) / 180;
      const fdirX = Math.cos(rad);
      const fdirY = Math.sin(rad);

      if (checkHit(x, y, fdirX, fdirY)) {
        isCompleted = true;
        onHitRef.current?.(x, y, angle);
        return;
      }

      const reason = flightEndReason(x, y);
      if (reason !== null) {
        isCompleted = true;
        onCompleteRef.current(reason, x, y);
        return;
      }

      if (t >= MAX_FLIGHT_TIME) {
        isCompleted = true;
        onCompleteRef.current("sky", x, y);
        return;
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    // 兜底：任何异常情况下也保证飞行结束
    const timeoutId = window.setTimeout(() => {
      if (!isCompleted) {
        isCompleted = true;
        onCompleteRef.current("sky", fromX, fromY);
      }
    }, (MAX_FLIGHT_TIME + 0.6) * 1000);

    return () => {
      cancelAnimationFrame(animationId);
      clearTimeout(timeoutId);
    };
    // 只监听 isFlying：起飞/落地各触发一次；
    // 其余参数已在起飞瞬间经 launchRef 冻结，中途变更不应重启动画
  }, [isFlying]);

  if (!isFlying) {
    return null;
  }

  const arrowColor = isEnemy ? "rgba(232, 151, 93, 0.9)" : "rgba(239, 232, 210, 0.9)";
  const fletchingColor = isEnemy ? "rgba(232, 151, 93, 0.6)" : "rgba(239, 232, 210, 0.6)";

  return (
    <g
      className="arrow-projectile"
      style={{
        transform: `translate(${current.x}px, ${current.y}px) rotate(${current.angle}deg)`,
        transformOrigin: "0 0",
      }}
    >
      {/* 箭羽拖尾光痕 */}
      <line
        x1="-14"
        y1="0"
        x2="0"
        y2="0"
        stroke={isEnemy ? "rgba(232, 151, 93, 0.35)" : "rgba(239, 232, 210, 0.3)"}
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* 箭杆 */}
      <line
        x1="0"
        y1="0"
        x2="50"
        y2="0"
        stroke={arrowColor}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="5"
        y1="0"
        x2="45"
        y2="0"
        stroke={fletchingColor}
        strokeWidth="1.5"
        opacity="0.5"
      />

      {/* 箭头 */}
      <polygon
        points="50,-4 65,0 50,4"
        fill={isEnemy ? "rgba(200, 120, 60, 0.95)" : "rgba(220, 220, 230, 0.95)"}
        stroke={isEnemy ? "rgba(180, 100, 40, 0.8)" : "rgba(180, 180, 200, 0.8)"}
        strokeWidth="0.5"
      />
      <polygon
        points="52,-2 60,0 52,2"
        fill={isEnemy ? "rgba(255, 180, 100, 0.4)" : "rgba(255, 255, 255, 0.4)"}
      />

      {/* 箭羽 */}
      <g opacity="0.9">
        <path
          d="M 0,0 Q -3,-6 0,-10 Q 3,-6 6,0"
          fill={fletchingColor}
          stroke={arrowColor}
          strokeWidth="0.5"
        />
        <path
          d="M 0,0 Q -3,6 0,10 Q 3,6 6,0"
          fill={fletchingColor}
          stroke={arrowColor}
          strokeWidth="0.5"
        />
        <path
          d="M 2,0 Q 0,-4 4,-6 Q 6,-3 8,0"
          fill={fletchingColor}
          opacity="0.7"
        />
      </g>

      {/* 箭筈 */}
      <circle
        cx="-2"
        cy="0"
        r="1.5"
        fill={isEnemy ? "rgba(180, 100, 40, 0.8)" : "rgba(160, 160, 180, 0.8)"}
      />
    </g>
  );
};
