import type { AimPosition, TargetZoneId } from "../../types/game";

interface AimingCrosshairProps {
  position: AimPosition;
  currentZone: TargetZoneId;
  hitChance: number;
  divineSense: number;
}

const zoneColors: Record<TargetZoneId, string> = {
  head: "#e85d5d",
  chest: "#72c08c",
  arm: "#5d9fe8",
  leg: "#e8c45d",
};

export const AimingCrosshair = ({
  position,
  currentZone,
  hitChance,
  divineSense,
}: AimingCrosshairProps) => {
  // Convert percentage to SVG coordinates (viewBox 600x400)
  const x = (position.x / 100) * 600;
  const y = (position.y / 100) * 400;

  // Breathing wobble based on divine sense (higher sense = less wobble)
  const wobbleRadius = Math.max(2, 8 - divineSense * 0.3);

  return (
    <g
      className="aiming-crosshair"
      style={{
        transform: `translate(${x}px, ${y}px)`,
      }}
    >
      {/* Breathing animation wrapper */}
      <g className="crosshair-breathe">
        {/* Outer ring */}
        <circle
          cx="0"
          cy="0"
          r="20"
          fill="none"
          stroke={zoneColors[currentZone]}
          strokeWidth="2"
          strokeOpacity="0.8"
        />

        {/* Inner crosshair */}
        <line
          x1="-12"
          y1="0"
          x2="-4"
          y2="0"
          stroke={zoneColors[currentZone]}
          strokeWidth="2"
        />
        <line
          x1="4"
          y1="0"
          x2="12"
          y2="0"
          stroke={zoneColors[currentZone]}
          strokeWidth="2"
        />
        <line
          x1="0"
          y1="-12"
          x2="0"
          y2="-4"
          stroke={zoneColors[currentZone]}
          strokeWidth="2"
        />
        <line
          x1="0"
          y1="4"
          x2="0"
          y2="12"
          stroke={zoneColors[currentZone]}
          strokeWidth="2"
        />

        {/* Center dot */}
        <circle
          cx="0"
          cy="0"
          r="2"
          fill={zoneColors[currentZone]}
        />
      </g>

      {/* Hit chance display */}
      <text
        x="0"
        y="35"
        textAnchor="middle"
        fill="rgba(243, 239, 228, 0.9)"
        fontSize="12"
        fontWeight="700"
      >
        {Math.round(hitChance * 100)}%
      </text>
    </g>
  );
};
