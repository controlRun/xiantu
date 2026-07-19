import { useCallback, useRef } from "react";
import type {
  AimPosition,
  ArcheryDuelState,
  MonsterDefinition,
  TargetZoneId,
} from "../../types/game";
import { clamp, detectTargetZone } from "../../utils/zoneDetection";
import { AimingCrosshair } from "./AimingCrosshair";
import { ArrowProjectile } from "./ArrowProjectile";
import { BowDisplay } from "./BowDisplay";
import { DamageNumber } from "./DamageNumber";
import { EnemyFigure } from "./EnemyFigure";

interface BattleFieldProps {
  duel: ArcheryDuelState;
  aimPosition: AimPosition;
  currentZone: TargetZoneId;
  drawPower: number;
  isDrawing: boolean;
  isFlying: boolean;
  showDamage: boolean;
  lastDamage: number;
  lastCritical: boolean;
  lastHit: boolean;
  hitChance: number;
  divineSense: number;
  onPointerMove: (position: AimPosition, zone: TargetZoneId) => void;
  onPointerDown: () => void;
  onPointerUp: () => void;
  onFlightComplete: () => void;
}

export const BattleField = ({
  duel,
  aimPosition,
  currentZone,
  drawPower,
  isDrawing,
  isFlying,
  showDamage,
  lastDamage,
  lastCritical,
  lastHit,
  hitChance,
  divineSense,
  onPointerMove,
  onPointerDown,
  onPointerUp,
  onFlightComplete,
}: BattleFieldProps) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      const x = clamp(
        ((e.clientX - rect.left) / rect.width) * 100,
        15,
        85,
      );
      const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 8, 88);
      const zone = detectTargetZone(x, y);

      onPointerMove({ x, y }, zone);
    },
    [onPointerMove],
  );

  // Convert percentage to SVG coordinates
  const targetX = (aimPosition.x / 100) * 600;
  const targetY = (aimPosition.y / 100) * 400;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 600 400"
      className="battle-field-svg"
      onPointerMove={handlePointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* Background gradient */}
      <defs>
        <linearGradient id="battle-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(20, 23, 25, 0.95)" />
          <stop offset="100%" stopColor="rgba(15, 18, 20, 0.98)" />
        </linearGradient>
      </defs>
      <rect width="600" height="400" fill="url(#battle-bg)" />

      {/* Enemy */}
      <EnemyFigure
        monster={duel.monster}
        currentZone={currentZone}
        isHit={showDamage && lastHit}
        isShaking={showDamage && lastHit}
      />

      {/* Bow */}
      <BowDisplay drawPower={drawPower} isDrawing={isDrawing} />

      {/* Arrow projectile */}
      <ArrowProjectile
        fromX={60}
        fromY={340}
        toX={targetX}
        toY={targetY}
        isFlying={isFlying}
        onComplete={onFlightComplete}
      />

      {/* Aiming crosshair */}
      <AimingCrosshair
        position={aimPosition}
        currentZone={currentZone}
        hitChance={hitChance}
        divineSense={divineSense}
      />

      {/* Damage number */}
      <DamageNumber
        value={lastDamage}
        x={targetX}
        y={targetY - 30}
        isCritical={lastCritical}
        isVisible={showDamage}
      />

      {/* Miss text */}
      {showDamage && !lastHit && (
        <text
          x={targetX}
          y={targetY}
          textAnchor="middle"
          fill="rgba(243, 239, 228, 0.6)"
          fontSize="16"
          fontWeight="700"
          className="miss-text"
        >
          闪避
        </text>
      )}
    </svg>
  );
};
