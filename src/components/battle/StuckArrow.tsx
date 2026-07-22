export interface StuckArrowState {
  id: number;
  x: number;
  y: number;
  angleDeg: number;
  isEnemy: boolean;
}

interface StuckArrowProps {
  x: number;
  y: number;
  angleDeg: number;
  isEnemy: boolean;
}

/**
 * 命中后插在对手身上的箭矢：
 * 带着轻微震颤钉入目标，停留约 1 秒后淡出消失（由父组件定时移除）。
 */
export const StuckArrow = ({ x, y, angleDeg, isEnemy }: StuckArrowProps) => {
  const arrowColor = isEnemy ? "rgba(232, 151, 93, 0.95)" : "rgba(239, 232, 210, 0.95)";
  const fletchingColor = isEnemy ? "rgba(232, 151, 93, 0.65)" : "rgba(239, 232, 210, 0.65)";

  return (
    <g
      style={{
        transform: `translate(${x}px, ${y}px) rotate(${angleDeg}deg)`,
        transformOrigin: "0 0",
      }}
    >
      {/* 内层承载动画（震颤钉入 → 停留 → 淡出），避免覆盖外层定位 */}
      <g className="stuck-arrow">
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

        {/* 箭头（没入目标） */}
        <polygon
          points="50,-4 65,0 50,4"
          fill={isEnemy ? "rgba(200, 120, 60, 0.95)" : "rgba(220, 220, 230, 0.95)"}
          stroke={isEnemy ? "rgba(180, 100, 40, 0.8)" : "rgba(180, 180, 200, 0.8)"}
          strokeWidth="0.5"
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
        </g>

        {/* 箭筈 */}
        <circle
          cx="-2"
          cy="0"
          r="1.5"
          fill={isEnemy ? "rgba(180, 100, 40, 0.8)" : "rgba(160, 160, 180, 0.8)"}
        />
      </g>
    </g>
  );
};
