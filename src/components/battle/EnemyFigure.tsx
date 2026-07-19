import type { MonsterDefinition, TargetZoneId } from "../../types/game";

interface EnemyFigureProps {
  monster: MonsterDefinition;
  currentZone: TargetZoneId;
  isHit: boolean;
  isShaking: boolean;
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
}: EnemyFigureProps) => {
  // Generic humanoid silhouette for now
  // Can be extended with different shapes for different monsters
  const getSilhouette = () => {
    // Simple humanoid silhouette path
    return (
      <g className="enemy-silhouette">
        {/* Head */}
        <circle cx="300" cy="120" r="25" fill="currentColor" />
        {/* Body */}
        <rect x="280" y="145" width="40" height="80" rx="8" fill="currentColor" />
        {/* Arms */}
        <rect x="255" y="150" width="20" height="60" rx="10" fill="currentColor" />
        <rect x="325" y="150" width="20" height="60" rx="10" fill="currentColor" />
        {/* Legs */}
        <rect x="285" y="225" width="18" height="70" rx="9" fill="currentColor" />
        <rect x="317" y="225" width="18" height="70" rx="9" fill="currentColor" />
      </g>
    );
  };

  return (
    <g
      className={`enemy-figure ${isShaking ? "enemy-shake" : ""}`}
      style={{ color: "rgba(239, 232, 210, 0.85)" }}
    >
      {/* Enemy silhouette */}
      {getSilhouette()}

      {/* Target zones (invisible hit areas) */}
      <g className="target-zones">
        {/* Head zone */}
        <circle
          cx="300"
          cy="120"
          r="30"
          fill={currentZone === "head" ? zoneColors.head : "transparent"}
          fillOpacity={currentZone === "head" ? 0.3 : 0}
          stroke={currentZone === "head" ? zoneColors.head : "transparent"}
          strokeWidth="2"
          className={`zone-indicator ${currentZone === "head" ? "zone-active" : ""}`}
        />

        {/* Chest zone */}
        <rect
          x="275"
          y="145"
          width="50"
          height="80"
          rx="8"
          fill={currentZone === "chest" ? zoneColors.chest : "transparent"}
          fillOpacity={currentZone === "chest" ? 0.3 : 0}
          stroke={currentZone === "chest" ? zoneColors.chest : "transparent"}
          strokeWidth="2"
          className={`zone-indicator ${currentZone === "chest" ? "zone-active" : ""}`}
        />

        {/* Left arm zone */}
        <rect
          x="250"
          y="150"
          width="30"
          height="60"
          rx="15"
          fill={currentZone === "arm" ? zoneColors.arm : "transparent"}
          fillOpacity={currentZone === "arm" ? 0.3 : 0}
          stroke={currentZone === "arm" ? zoneColors.arm : "transparent"}
          strokeWidth="2"
          className={`zone-indicator ${currentZone === "arm" ? "zone-active" : ""}`}
        />

        {/* Right arm zone */}
        <rect
          x="320"
          y="150"
          width="30"
          height="60"
          rx="15"
          fill={currentZone === "arm" ? zoneColors.arm : "transparent"}
          fillOpacity={currentZone === "arm" ? 0.3 : 0}
          stroke={currentZone === "arm" ? zoneColors.arm : "transparent"}
          strokeWidth="2"
          className={`zone-indicator ${currentZone === "arm" ? "zone-active" : ""}`}
        />

        {/* Leg zone */}
        <rect
          x="280"
          y="225"
          width="60"
          height="70"
          rx="8"
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
          cx="300"
          cy="180"
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
