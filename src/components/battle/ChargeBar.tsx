import { powerTierColor } from "../../utils/arrowPhysics";

interface ChargeBarProps {
  /** 蓄力 0~1 */
  drawPower: number;
  /** 是否处于可蓄力阶段（瞄准/蓄力时点亮，其余时候淡出） */
  active: boolean;
  x: number;
  y: number;
}

const BAR_WIDTH = 18;
const BAR_HEIGHT = 132;
const INNER_PAD = 4;
const INNER_HEIGHT = BAR_HEIGHT - INNER_PAD * 2;

/** 档位分界线（0.3 / 0.7） */
const TIERS: Array<{ at: number; label: string }> = [
  { at: 0.3, label: "轻" },
  { at: 0.7, label: "满" },
];

/**
 * 角色左侧的竖直蓄力条：
 * 自下而上充能，颜色随档位变化（金→翠→朱），满蓄时脉冲发光。
 */
export const ChargeBar = ({ drawPower, active, x, y }: ChargeBarProps) => {
  const fillHeight = INNER_HEIGHT * drawPower;
  const color = powerTierColor(drawPower);
  const isFull = drawPower >= 0.98;

  return (
    <g
      className={`charge-bar ${active ? "charge-bar-active" : ""}`}
      transform={`translate(${x}, ${y})`}
      pointerEvents="none"
    >
      {/* 标题 */}
      <text
        x={BAR_WIDTH / 2}
        y={-10}
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill={active ? "rgba(242, 223, 170, 0.95)" : "rgba(242, 223, 170, 0.4)"}
      >
        蓄力
      </text>

      {/* 外框 */}
      <rect
        x="0"
        y="0"
        width={BAR_WIDTH}
        height={BAR_HEIGHT}
        rx="9"
        fill="rgba(6, 10, 14, 0.72)"
        stroke={active ? color : "rgba(239, 232, 210, 0.25)"}
        strokeWidth="1.5"
        style={{ transition: "stroke 0.2s ease" }}
      />

      {/* 档位底色（金 / 翠 / 朱 三段，始终隐约可见） */}
      <rect
        x={INNER_PAD}
        y={INNER_PAD + INNER_HEIGHT * 0.7}
        width={BAR_WIDTH - INNER_PAD * 2}
        height={INNER_HEIGHT * 0.3}
        fill="rgba(232, 196, 93, 0.16)"
      />
      <rect
        x={INNER_PAD}
        y={INNER_PAD + INNER_HEIGHT * 0.3}
        width={BAR_WIDTH - INNER_PAD * 2}
        height={INNER_HEIGHT * 0.4}
        fill="rgba(114, 192, 140, 0.16)"
      />
      <rect
        x={INNER_PAD}
        y={INNER_PAD}
        width={BAR_WIDTH - INNER_PAD * 2}
        height={INNER_HEIGHT * 0.3}
        fill="rgba(232, 93, 93, 0.16)"
      />

      {/* 充能填充（自下而上） */}
      {drawPower > 0.01 && (
        <rect
          x={INNER_PAD}
          y={INNER_PAD + INNER_HEIGHT - fillHeight}
          width={BAR_WIDTH - INNER_PAD * 2}
          height={fillHeight}
          rx="4"
          fill={color}
          className={isFull ? "charge-fill-full" : ""}
          style={{
            filter: active
              ? `drop-shadow(0 0 ${4 + drawPower * 6}px ${color})`
              : "none",
            transition: "fill 0.15s ease",
          }}
        />
      )}

      {/* 档位刻度线 */}
      {TIERS.map((tier) => (
        <line
          key={tier.at}
          x1="2"
          y1={INNER_PAD + INNER_HEIGHT * (1 - tier.at)}
          x2={BAR_WIDTH - 2}
          y2={INNER_PAD + INNER_HEIGHT * (1 - tier.at)}
          stroke="rgba(239, 232, 210, 0.35)"
          strokeWidth="1"
          strokeDasharray="2,2"
        />
      ))}

      {/* 百分比读数 */}
      <text
        x={BAR_WIDTH / 2}
        y={BAR_HEIGHT + 16}
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill={active ? color : "rgba(239, 232, 210, 0.35)"}
        style={{ transition: "fill 0.15s ease" }}
      >
        {Math.round(drawPower * 100)}%
      </text>
    </g>
  );
};
