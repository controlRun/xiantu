import { useMemo } from "react";
import { launchDirection, powerTierColor } from "../../utils/arrowPhysics";

interface TrajectoryPreviewProps {
  fromX: number;
  fromY: number;
  /** 瞄准方向上的任意一点 */
  toX: number;
  toY: number;
  /** 当前蓄力 0~1；未蓄力时按默认力度显示参考方向 */
  drawPower: number;
  /** 是否正在蓄力（蓄力中高亮并随力度伸长） */
  isDrawing: boolean;
}

/** 未蓄力时的参考力度 */
const PREVIEW_DEFAULT_POWER = 0.62;

/**
 * 瞄准方向指示虚线 —— 只从弓前延伸一小段标示方向，
 * 不预测落点，命中与否全凭准星与力道。
 * 虚线长度随蓄力微微伸展，颜色随档位变化。
 */
export const TrajectoryPreview = ({
  fromX,
  fromY,
  toX,
  toY,
  drawPower,
  isDrawing,
}: TrajectoryPreviewProps) => {
  const power = isDrawing ? drawPower : PREVIEW_DEFAULT_POWER;

  const path = useMemo(() => {
    // 与实际飞行同源的发射方向约束
    const { dirX, dirY } = launchDirection(fromX, fromY, toX, toY);
    // 短线只作方向提示（70~140px），远不及对手距离，绝不暴露预计落点
    const length = 70 + power * 70;
    return `M ${fromX} ${fromY} L ${(fromX + dirX * length).toFixed(1)} ${(fromY + dirY * length).toFixed(1)}`;
  }, [fromX, fromY, toX, toY, power]);

  if (!path) {
    return null;
  }

  const color = powerTierColor(power);

  return (
    <g className="trajectory-preview" pointerEvents="none">
      {/* 外层柔光 */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray="2,10"
        strokeLinecap="round"
        opacity={isDrawing ? 0.25 : 0.12}
      />
      {/* 主虚线（流动动画见 styles.css） */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeDasharray="7,8"
        strokeLinecap="round"
        opacity={isDrawing ? 0.9 : 0.4}
        className="trajectory-dash"
      />
    </g>
  );
};
