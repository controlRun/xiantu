import type { MonsterDefinition, TargetZoneId } from "../../types/game";

interface EnemyFigureProps {
  monster: MonsterDefinition;
  currentZone: TargetZoneId;
  isHit: boolean;
  isShaking: boolean;
  hasBow?: boolean;
  drawPower?: number;
  aimAngle?: number;
}

const zoneColors: Record<TargetZoneId, string> = {
  head: "#e85d5d",
  chest: "#72c08c",
  arm: "#5d9fe8",
  leg: "#e8c45d",
};

export const EnemyFigure = ({
  monster,
  currentZone,
  isHit,
  isShaking,
  hasBow = false,
  drawPower = 0,
  aimAngle = 180,
}: EnemyFigureProps) => {
  // Generic humanoid silhouette
  return (
    <g
      className={`enemy-figure ${isShaking ? "enemy-shake" : ""}`}
      style={{ color: "rgba(239, 232, 210, 0.85)" }}
    >
      {/* Enemy silhouette */}
      <g className="enemy-silhouette">
        {/* Head */}
        <circle cx="0" cy="-40" r="20" fill="currentColor" />
        {/* Body */}
        <rect x="-15" y="-20" width="30" height="60" rx="6" fill="currentColor" />
        {/* Arms */}
        <rect x="-25" y="-15" width="8" height="45" rx="4" fill="currentColor" />
        {/* Right arm (bow arm) - extended if has bow */}
        {hasBow ? (
          <line
            x1="15"
            y1="-5"
            x2="-15"
            y2="-5"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
          />
        ) : (
          <rect x="17" y="-15" width="8" height="45" rx="4" fill="currentColor" />
        )}
        {/* Legs */}
        <rect x="-12" y="40" width="10" height="50" rx="5" fill="currentColor" />
        <rect x="2" y="40" width="10" height="50" rx="5" fill="currentColor" />
      </g>

      {/* Enemy bow (if has bow) */}
      {hasBow && (
        <g
          className="enemy-bow"
          style={{
            transform: `rotate(${aimAngle}deg)`,
            transformOrigin: "0 0",
          }}
        >
          {/* Bow limb */}
          <path
            d={`M 0 -25
                Q -10 0 0 25`}
            fill="none"
            stroke="#8b6f47"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Bowstring */}
          <line
            x1="0"
            y1="-25"
            x2={drawPower > 0 ? 8 : 0}
            y2="0"
            stroke="rgba(239, 232, 210, 0.6)"
            strokeWidth="1"
          />
          <line
            x1={drawPower > 0 ? 8 : 0}
            y1="0"
            x2="0"
            y2="25"
            stroke="rgba(239, 232, 210, 0.6)"
            strokeWidth="1"
          />
          {/* Arrow nocked (when drawing) */}
          {drawPower > 0.1 && (
            <g>
              <line
                x1={8}
                y1="0"
                x2="30"
                y2="0"
                stroke="rgba(232, 151, 93, 0.8)"
                strokeWidth="2"
              />
              <polygon
                points="30,-2 36,0 30,2"
                fill="rgba(232, 151, 93, 0.8)"
              />
            </g>
          )}
        </g>
      )}

      {/* Target zones (invisible hit areas) */}
      <g className="target-zones">
        {/* Head zone */}
        <circle
          cx="0"
          cy="-40"
          r="25"
          fill={currentZone === "head" ? zoneColors.head : "transparent"}
          fillOpacity={currentZone === "head" ? 0.3 : 0}
          stroke={currentZone === "head" ? zoneColors.head : "transparent"}
          strokeWidth="2"
          className={`zone-indicator ${currentZone === "head" ? "zone-active" : ""}`}
        />

        {/* Chest zone */}
        <rect
          x="-20"
          y="-20"
          width="40"
          height="60"
          rx="6"
          fill={currentZone === "chest" ? zoneColors.chest : "transparent"}
          fillOpacity={currentZone === "chest" ? 0.3 : 0}
          stroke={currentZone === "chest" ? zoneColors.chest : "transparent"}
          strokeWidth="2"
          className={`zone-indicator ${currentZone === "chest" ? "zone-active" : ""}`}
        />

        {/* Left arm zone */}
        <rect
          x="-30"
          y="-15"
          width="18"
          height="45"
          rx="9"
          fill={currentZone === "arm" ? zoneColors.arm : "transparent"}
          fillOpacity={currentZone === "arm" ? 0.3 : 0}
          stroke={currentZone === "arm" ? zoneColors.arm : "transparent"}
          strokeWidth="2"
          className={`zone-indicator ${currentZone === "arm" ? "zone-active" : ""}`}
        />

        {/* Right arm zone */}
        <rect
          x="12"
          y="-15"
          width="18"
          height="45"
          rx="9"
          fill={currentZone === "arm" ? zoneColors.arm : "transparent"}
          fillOpacity={currentZone === "arm" ? 0.3 : 0}
          stroke={currentZone === "arm" ? zoneColors.arm : "transparent"}
          strokeWidth="2"
          className={`zone-indicator ${currentZone === "arm" ? "zone-active" : ""}`}
        />

        {/* Leg zone */}
        <rect
          x="-15"
          y="40"
          width="30"
          height="50"
          rx="6"
          fill={currentZone === "leg" ? zoneColors.leg : "transparent"}
          fillOpacity={currentZone === "leg" ? 0.3 : 0}
          stroke={currentZone === "leg" ? zoneColors.leg : "transparent"}
          strokeWidth="2"
          className={`zone-indicator ${currentZone === "leg" ? "zone-active" : ""}`}
        />
      </g>

      {/* Hit effect */}
      {isHit && (
        <circle
          cx="0"
          cy="0"
          r="0"
          fill="none"
          stroke="rgba(239, 232, 210, 0.8)"
          strokeWidth="3"
          className="ink-impact"
        />
      )}
    </g>
  );
};
