interface BowDisplayProps {
  drawPower: number; // 0 to 1
  isDrawing: boolean;
}

export const BowDisplay = ({ drawPower, isDrawing }: BowDisplayProps) => {
  // Bow position: bottom-left corner
  const bowX = 60;
  const bowY = 340;
  const bowHeight = 80;

  // Bowstring bend based on draw power
  const stringBend = isDrawing ? drawPower * 25 : 0;

  return (
    <g className="bow-display">
      {/* Bow limb */}
      <path
        d={`M ${bowX} ${bowY - bowHeight / 2}
            Q ${bowX + 15} ${bowY} ${bowX} ${bowY + bowHeight / 2}`}
        fill="none"
        stroke="#8b6f47"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Bowstring */}
      <path
        d={`M ${bowX} ${bowY - bowHeight / 2}
            L ${bowX + stringBend} ${bowY}
            L ${bowX} ${bowY + bowHeight / 2}`}
        fill="none"
        stroke="rgba(239, 232, 210, 0.6)"
        strokeWidth="1.5"
      />

      {/* Arrow nocked on string (when drawing) */}
      {isDrawing && drawPower > 0.1 && (
        <g className="nocked-arrow">
          <line
            x1={bowX + stringBend}
            y1={bowY}
            x2={bowX + stringBend + 30}
            y2={bowY}
            stroke="rgba(239, 232, 210, 0.8)"
            strokeWidth="2"
          />
          {/* Arrow tip */}
          <polygon
            points={`${bowX + stringBend + 30},${bowY - 3} ${bowX + stringBend + 38},${bowY} ${bowX + stringBend + 30},${bowY + 3}`}
            fill="rgba(239, 232, 210, 0.8)"
          />
        </g>
      )}

      {/* Draw power indicator */}
      {isDrawing && (
        <g className="draw-power-bar">
          <rect
            x={bowX - 20}
            y={bowY + bowHeight / 2 + 10}
            width="40"
            height="6"
            rx="3"
            fill="rgba(255, 255, 255, 0.1)"
          />
          <rect
            x={bowX - 20}
            y={bowY + bowHeight / 2 + 10}
            width={40 * drawPower}
            height="6"
            rx="3"
            fill={
              drawPower < 0.3
                ? "#e8c45d"
                : drawPower < 0.7
                  ? "#72c08c"
                  : "#e85d5d"
            }
          />
        </g>
      )}
    </g>
  );
};
