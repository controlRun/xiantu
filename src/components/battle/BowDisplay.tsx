interface BowDisplayProps {
  drawPower: number; // 0 to 1
  isDrawing: boolean;
  aimAngle?: number; // Angle in degrees
}

export const BowDisplay = ({ drawPower, isDrawing, aimAngle = 0 }: BowDisplayProps) => {
  const bowHeight = 60;

  // Bowstring bend based on draw power
  const stringBend = isDrawing ? drawPower * 20 : 0;

  return (
    <g
      className="bow-display"
      style={{
        transform: `rotate(${aimAngle}deg)`,
        transformOrigin: "0 0",
      }}
    >
      {/* Bow limb */}
      <path
        d={`M 0 ${-bowHeight / 2}
            Q 12 0 0 ${bowHeight / 2}`}
        fill="none"
        stroke="#8b6f47"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* Bowstring */}
      <path
        d={`M 0 ${-bowHeight / 2}
            L ${-stringBend} 0
            L 0 ${bowHeight / 2}`}
        fill="none"
        stroke="rgba(239, 232, 210, 0.6)"
        strokeWidth="1.5"
      />

      {/* Arrow nocked on string (when drawing) */}
      {isDrawing && drawPower > 0.1 && (
        <g className="nocked-arrow">
          <line
            x1={-stringBend}
            y1="0"
            x2={-stringBend + 25}
            y2="0"
            stroke="rgba(239, 232, 210, 0.8)"
            strokeWidth="2"
          />
          {/* Arrow tip */}
          <polygon
            points={`${-stringBend + 25},-3 ${-stringBend + 32},0 ${-stringBend + 25},3`}
            fill="rgba(239, 232, 210, 0.8)"
          />
        </g>
      )}
      {/* 蓄力指示已移至角色左侧的 ChargeBar */}
    </g>
  );
};
