interface HealthBarProps {
  current: number;
  max: number;
  x: number;
  y: number;
  isPlayer?: boolean;
}

export const HealthBar = ({
  current,
  max,
  x,
  y,
  isPlayer = false,
}: HealthBarProps) => {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  const barWidth = 80;
  const barHeight = 8;

  return (
    <g className="health-bar" transform={`translate(${x}, ${y})`}>
      {/* Background */}
      <rect
        x={-barWidth / 2}
        y="0"
        width={barWidth}
        height={barHeight}
        rx="4"
        fill="rgba(0, 0, 0, 0.5)"
        stroke="rgba(239, 232, 210, 0.3)"
        strokeWidth="1"
      />
      {/* Health fill */}
      <rect
        x={-barWidth / 2}
        y="0"
        width={(barWidth * percentage) / 100}
        height={barHeight}
        rx="4"
        fill={isPlayer ? "#72c08c" : "#e8975d"}
      />
      {/* Health text */}
      <text
        x="0"
        y={barHeight + 12}
        textAnchor="middle"
        fill="rgba(243, 239, 228, 0.9)"
        fontSize="11"
        fontWeight="700"
      >
        {current}/{max}
      </text>
    </g>
  );
};
