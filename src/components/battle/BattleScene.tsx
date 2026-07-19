import { useCallback, useEffect, useRef, useState } from "react";
import { getShotChance } from "../../systems/battleSystem";
import type {
  AimPosition,
  ArcheryDuelState,
  ArrowDefinition,
  BattleResult,
  Player,
  TargetZoneId,
} from "../../types/game";
import { targetZones } from "../../data/arrows";
import { useBattleAnimation } from "../../hooks/useBattleAnimation";
import { BattleField } from "./BattleField";
import { BattleHUD } from "./BattleHUD";
import { BattleLog } from "./BattleLog";

interface BattleSceneProps {
  duel: ArcheryDuelState;
  player: Player;
  availableArrows: ArrowDefinition[];
  onShoot: (arrowId: string, zoneId: TargetZoneId) => void;
  battleResult: BattleResult | null;
}

const DRAW_DURATION = 1500; // ms
const MAX_DRAW_POWER = 1;

export const BattleScene = ({
  duel,
  player,
  availableArrows,
  onShoot,
  battleResult,
}: BattleSceneProps) => {
  const { state: animation, dispatch } = useBattleAnimation();
  const [selectedArrowId, setSelectedArrowId] = useState(
    availableArrows[availableArrows.length - 1]?.itemId ?? "",
  );
  const drawTimerRef = useRef<number | null>(null);
  const autoReleaseTimerRef = useRef<number | null>(null);

  // Initialize aiming when duel starts
  useEffect(() => {
    if (duel && !duel.finished && animation.phase === "idle") {
      dispatch({ type: "START_AIMING" });
    }
  }, [duel, animation.phase, dispatch]);

  // Calculate hit chance based on current aim
  const selectedArrow = availableArrows.find(
    (a) => a.itemId === selectedArrowId,
  );
  const selectedTarget = targetZones.find(
    (z) => z.id === animation.currentZone,
  );

  const hitChance =
    selectedArrow && selectedTarget
      ? getShotChance(player, selectedArrow.itemId, selectedTarget.id)
      : 0.5;

  const criticalChance = selectedTarget
    ? Math.min(
        0.45,
        Math.max(
          0.03,
          selectedTarget.criticalChance + player.attributes.luck * 0.004,
        ),
      )
    : 0.1;

  // Handle pointer move (aiming)
  const handlePointerMove = useCallback(
    (position: AimPosition, zone: TargetZoneId) => {
      if (animation.phase !== "aiming" && animation.phase !== "drawing") {
        return;
      }
      dispatch({ type: "UPDATE_AIM", position, zone });
    },
    [animation.phase, dispatch],
  );

  // Handle pointer down (start drawing)
  const handlePointerDown = useCallback(() => {
    if (animation.phase !== "aiming" || duel.finished) {
      return;
    }

    dispatch({ type: "START_DRAWING" });

    // Animate draw power
    const startTime = Date.now();
    const animateDraw = () => {
      const elapsed = Date.now() - startTime;
      const power = Math.min(elapsed / DRAW_DURATION, MAX_DRAW_POWER);
      dispatch({ type: "UPDATE_DRAW_POWER", power });

      if (power < MAX_DRAW_POWER) {
        drawTimerRef.current = requestAnimationFrame(animateDraw);
      }
    };

    drawTimerRef.current = requestAnimationFrame(animateDraw);

    // Auto-release after 1.5 seconds
    autoReleaseTimerRef.current = window.setTimeout(() => {
      handlePointerUp();
    }, DRAW_DURATION + 100);
  }, [animation.phase, duel.finished, dispatch]);

  // Handle pointer up (release arrow)
  const handlePointerUp = useCallback(() => {
    if (animation.phase !== "drawing") {
      return;
    }

    // Clear timers
    if (drawTimerRef.current) {
      cancelAnimationFrame(drawTimerRef.current);
      drawTimerRef.current = null;
    }
    if (autoReleaseTimerRef.current) {
      clearTimeout(autoReleaseTimerRef.current);
      autoReleaseTimerRef.current = null;
    }

    // Start flight animation
    dispatch({ type: "START_FLIGHT" });
  }, [animation.phase, dispatch]);

  // Handle flight complete (resolve hit/miss)
  const handleFlightComplete = useCallback(() => {
    if (!selectedArrow || !selectedTarget) {
      return;
    }

    // Determine if hit based on hit chance
    const hit = Math.random() <= hitChance;
    const critical = hit && Math.random() <= criticalChance;

    // For now, we'll let the battle system determine damage
    // We just pass the arrow and zone to the parent
    onShoot(selectedArrow.itemId, selectedTarget.id);

    // Show resolve animation
    dispatch({
      type: "RESOLVE",
      hit,
      damage: 0, // Will be calculated by battle system
      critical,
    });

    // After resolve, show enemy turn or reset
    setTimeout(() => {
      if (!duel.finished) {
        dispatch({ type: "ENEMY_TURN" });
        setTimeout(() => {
          dispatch({ type: "RESET_TO_AIMING" });
        }, 500);
      } else {
        dispatch({ type: "FINISH" });
      }
    }, 800);
  }, [
    selectedArrow,
    selectedTarget,
    hitChance,
    criticalChance,
    onShoot,
    duel.finished,
    dispatch,
  ]);

  const canShoot =
    !duel.finished &&
    animation.phase === "aiming" &&
    availableArrows.length > 0 &&
    Boolean(selectedArrow);

  const monsterHealthPercent = Math.max(
    0,
    Math.round((duel.monsterHealth / duel.monster.health) * 100),
  );
  const playerHealthPercent = Math.max(
    0,
    Math.round((duel.playerHealth / player.health.max) * 100),
  );

  return (
    <div className="battle-scene">
      <BattleField
        duel={duel}
        aimPosition={animation.aimPosition}
        currentZone={animation.currentZone}
        drawPower={animation.drawPower}
        isDrawing={animation.phase === "drawing"}
        isFlying={animation.phase === "flight"}
        showDamage={animation.showDamage}
        lastDamage={animation.lastDamage}
        lastCritical={animation.lastCritical}
        lastHit={animation.lastHit}
        hitChance={hitChance}
        divineSense={player.attributes.divineSense}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onFlightComplete={handleFlightComplete}
      />

      <BattleHUD
        duel={duel}
        player={player}
        availableArrows={availableArrows}
        selectedArrowId={selectedArrowId}
        currentZone={animation.currentZone}
        hitChance={hitChance}
        criticalChance={criticalChance}
        drawPower={animation.drawPower}
        canShoot={canShoot}
        onSelectArrow={setSelectedArrowId}
        monsterHealthPercent={monsterHealthPercent}
        playerHealthPercent={playerHealthPercent}
      />

      <BattleLog logs={duel.logs} />
    </div>
  );
};
