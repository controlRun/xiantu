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
import {
  ENEMY_BOW_ORIGIN,
  PLAYER_BODY_Y,
  PLAYER_X,
} from "./battleLayout";
import { useBattleAnimation } from "../../hooks/useBattleAnimation";
import {
  launchSpeed,
  MISS_TEXTS,
  solveLaunchDirection,
  type FlightEndReason,
} from "../../utils/arrowPhysics";
import { BattleField, type MissMarker } from "./BattleField";
import { BattleHUD } from "./BattleHUD";
import { BattleLog } from "./BattleLog";
import { BattleResult as BattleResultOverlay } from "./BattleResult";
import { getEnemyDialogue } from "./EnemyDialogue";
import type { StuckArrowState } from "./StuckArrow";

interface BattleScreenProps {
  duel: ArcheryDuelState;
  player: Player;
  availableArrows: ArrowDefinition[];
  onShoot: (
    arrowId: string,
    zoneId: TargetZoneId,
    drawPower: number,
  ) => import("../../systems/battleSystem").ArcheryShotResult;
  onApplyShot: (arrowId: string, pendingDamage: NonNullable<import("../../systems/battleSystem").ArcheryShotResult["pendingDamage"]>) => import("../../systems/battleSystem").ArcheryShotResult;
  onSkipShot: () => import("../../systems/battleSystem").ArcheryShotResult;
  onBattleEnd: (result: BattleResult | null) => void;
  battleResult: BattleResult | null;
}

const DRAW_DURATION = 1500; // ms
const MAX_DRAW_POWER = 1;
/** 触屏：拖拽蓄力低于该值视为"收手不射"，不消耗箭矢 */
const TOUCH_MIN_FIRE = 0.08;

export const BattleScreen = ({
  duel,
  player,
  availableArrows,
  onShoot,
  onApplyShot,
  onSkipShot,
  onBattleEnd,
  battleResult,
}: BattleScreenProps) => {
  const { state: animation, dispatch } = useBattleAnimation();
  const [selectedArrowId, setSelectedArrowId] = useState(
    availableArrows[availableArrows.length - 1]?.itemId ?? "",
  );
  const drawTimerRef = useRef<number | null>(null);
  const autoReleaseTimerRef = useRef<number | null>(null);
  const hasReleasedRef = useRef<boolean>(false);
  /** 本次拉弓是否来自触屏（决定蓄力方式与轻点取消逻辑） */
  const touchShotRef = useRef<boolean>(false);
  const stuckIdRef = useRef<number>(0);
  const pendingResultRef = useRef<{
    result: import("../../systems/battleSystem").ArcheryShotResult;
    arrowId: string;
    hit: boolean;
    critical: boolean;
    damage: number;
    drawPower: number;
  } | null>(null);

  // Enemy shooting state（默认瞄准玩家，拉弓阶段弓身朝向合理）
  const [enemyShooting, setEnemyShooting] = useState({
    isDrawing: false,
    drawPower: 0,
    isFlying: false,
    targetX: PLAYER_X,
    targetY: PLAYER_BODY_Y,
    showDamage: false,
    lastDamage: 0,
    lastCritical: false,
    lastHit: false,
  });

  // 插在目标身上的箭矢（1 秒后自动消失）
  const [stuckArrows, setStuckArrows] = useState<StuckArrowState[]>([]);

  // 玩家箭矢落空提示（坠渊 / 出界 / 掠过）
  const [missMarker, setMissMarker] = useState<MissMarker | null>(null);

  // Enemy dialogue state
  const [enemyDialogue, setEnemyDialogue] = useState<string | null>(null);

  const addStuckArrow = useCallback(
    (x: number, y: number, angleDeg: number, isEnemy: boolean) => {
      stuckIdRef.current += 1;
      const id = stuckIdRef.current;
      setStuckArrows((prev) => [...prev, { id, x, y, angleDeg, isEnemy }]);
      // 停留 1 秒后淡出移除
      window.setTimeout(() => {
        setStuckArrows((prev) => prev.filter((arrow) => arrow.id !== id));
      }, 1000);
    },
    [],
  );

  // Initialize aiming when duel starts
  useEffect(() => {
    if (duel && !duel.finished && animation.phase === "idle") {
      dispatch({ type: "START_AIMING" });
    }
  }, [duel, animation.phase, dispatch]);

  // Reset release flag when returning to aiming phase
  useEffect(() => {
    if (animation.phase === "aiming") {
      hasReleasedRef.current = false;
    }
  }, [animation.phase]);

  // Handle battle end
  useEffect(() => {
    if (duel.finished && battleResult) {
      const timer = setTimeout(() => {
        onBattleEnd(battleResult);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [duel.finished, battleResult, onBattleEnd]);

  /**
   * 敌方回合：拉弓 → 按战报结果反解弹道 → 放箭。
   * 战报命中 → 解出必中的低仰角弹道；战报未中 → 随机偏强（越过头顶出界）
   * 或偏弱（力竭坠入深渊）的弹道，视觉与逻辑严格一致。
   */
  useEffect(() => {
    if (animation.phase !== "enemyTurn" || duel.finished) {
      return;
    }

    setEnemyShooting({
      isDrawing: true,
      drawPower: 0,
      isFlying: false,
      targetX: PLAYER_X,
      targetY: PLAYER_BODY_Y,
      showDamage: false,
      lastDamage: 0,
      lastCritical: false,
      lastHit: false,
    });

    const drawStartTime = Date.now();
    const drawDuration = 900;
    let rafId = 0;

    const releaseEnemyArrow = () => {
      const lastLog = duel.logs[duel.logs.length - 1] ?? "";
      const willHit = lastLog.includes("造成") && lastLog.includes("伤害");

      let power = 0.72;
      let dirX = -1;
      let dirY = -0.2;

      if (willHit) {
        // 解出恰好命中玩家身躯的低仰角弹道
        const solution = solveLaunchDirection(
          ENEMY_BOW_ORIGIN.x,
          ENEMY_BOW_ORIGIN.y,
          PLAYER_X,
          PLAYER_BODY_Y - 12,
          launchSpeed(power),
        );
        if (solution) {
          dirX = solution.dirX;
          dirY = solution.dirY;
        }
      } else if (Math.random() < 0.5) {
        // 力道过猛：中仰角越过玩家头顶，贴左上角飞出窗口
        // （仰角过高会让箭矢长时间飘出画面，28~36° 恰好全程可见）
        power = 0.95;
        const theta = ((28 + Math.random() * 8) * Math.PI) / 180;
        dirX = -Math.cos(theta);
        dirY = -Math.sin(theta);
      } else {
        // 力道不济：箭矢半途坠入深渊
        power = 0.28 + Math.random() * 0.1;
        const theta = ((18 + Math.random() * 10) * Math.PI) / 180;
        dirX = -Math.cos(theta);
        dirY = -Math.sin(theta);
      }

      setEnemyShooting((prev) => ({
        ...prev,
        isDrawing: false,
        isFlying: true,
        drawPower: power,
        targetX: ENEMY_BOW_ORIGIN.x + dirX * 320,
        targetY: ENEMY_BOW_ORIGIN.y + dirY * 320,
      }));
    };

    const animateDraw = () => {
      const elapsed = Date.now() - drawStartTime;
      const power = Math.min(elapsed / drawDuration, 1);
      setEnemyShooting((prev) => ({ ...prev, drawPower: power }));

      if (power < 1) {
        rafId = requestAnimationFrame(animateDraw);
      } else {
        releaseEnemyArrow();
      }
    };

    rafId = requestAnimationFrame(animateDraw);

    return () => cancelAnimationFrame(rafId);
  }, [animation.phase, duel.finished, duel.logs]);

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
  // 触屏携带 dragPower（拖拽距离换算的蓄力），鼠标则靠时间蓄力
  const handlePointerMove = useCallback(
    (position: AimPosition, zone: TargetZoneId, dragPower?: number) => {
      if (animation.phase !== "aiming" && animation.phase !== "drawing") {
        return;
      }
      dispatch({ type: "UPDATE_AIM", position, zone });
      if (dragPower !== undefined) {
        dispatch({ type: "UPDATE_DRAW_POWER", power: dragPower });
      }
    },
    [animation.phase, dispatch],
  );

  // Handle pointer down (start drawing)
  const handlePointerDown = useCallback(
    (pointerType: "touch" | "mouse") => {
      // 无箭可选时不允许开弓（否则松手会射出无蓄力的一箭）
      if (animation.phase !== "aiming" || duel.finished || !selectedArrow) {
        return;
      }

      // Reset release flag
      hasReleasedRef.current = false;
      touchShotRef.current = pointerType === "touch";

      dispatch({ type: "START_DRAWING" });

      // 触屏：蓄力完全由拖拽距离驱动（BattleField 随 pointermove 上报），
      // 不做时间蓄力、不设满蓄自动释放——玩家可以慢慢瞄准，松手才定力度
      if (pointerType === "touch") {
        return;
      }

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

      // 满蓄自动释放：通过 ref 调用最新版 handlePointerUp，
      // 避免定时器捕获按下时的过期闭包（当时 phase 还是 aiming）
      autoReleaseTimerRef.current = window.setTimeout(() => {
        if (!hasReleasedRef.current) {
          releaseRef.current();
        }
      }, DRAW_DURATION + 100);
    },
    [animation.phase, duel.finished, selectedArrow, dispatch],
  );

  // 始终指向最新的释放函数，供自动释放定时器调用
  const releaseRef = useRef<() => void>(() => {});

  // Handle pointer up (release arrow)
  const handlePointerUp = useCallback(() => {
    if (animation.phase !== "drawing") {
      return;
    }

    // Prevent double release
    if (hasReleasedRef.current) {
      return;
    }
    hasReleasedRef.current = true;

    // Clear timers
    if (drawTimerRef.current) {
      cancelAnimationFrame(drawTimerRef.current);
      drawTimerRef.current = null;
    }
    if (autoReleaseTimerRef.current) {
      clearTimeout(autoReleaseTimerRef.current);
      autoReleaseTimerRef.current = null;
    }

    // 触屏轻点/拖距不足：收弦不射（防误触），不消耗箭矢
    if (touchShotRef.current && animation.drawPower < TOUCH_MIN_FIRE) {
      touchShotRef.current = false;
      dispatch({ type: "START_AIMING" });
      return;
    }
    touchShotRef.current = false;

    // Clear any previous pending result to ensure we can shoot
    pendingResultRef.current = null;

    // Call battle system FIRST to get actual result BEFORE starting animation
    if (selectedArrow && selectedTarget) {
      // Save current draw power before it gets reset
      const currentDrawPower = animation.drawPower;

      // 蓄力同时影响伤害（在战斗系统中结算）
      const result = onShoot(selectedArrow.itemId, selectedTarget.id, currentDrawPower);

      // Check if there's pending damage (battle system always calculates it now)
      const pendingDamage = result.pendingDamage;
      const critical = pendingDamage?.critical ?? false;
      const damage = pendingDamage?.damage ?? 0;

      // Store the result for use on visual hit (including damage)
      pendingResultRef.current = {
        result,
        arrowId: selectedArrow.itemId,
        hit: !!pendingDamage,
        critical,
        damage,
        drawPower: currentDrawPower,
      };

      // Start flight animation - damage applies only if the arrow visually hits
      dispatch({ type: "START_FLIGHT", hit: !!pendingDamage, damage, critical, drawPower: currentDrawPower });
    } else {
      // Start flight animation without hit result (shouldn't happen normally)
      dispatch({ type: "START_FLIGHT" });
    }
  }, [animation.phase, animation.drawPower, selectedArrow, selectedTarget, onShoot, dispatch]);

  // 每次渲染同步最新引用
  releaseRef.current = handlePointerUp;

  // 玩家箭矢飞行结束（未命中）：按离场原因提示，敌方趁势还击
  const handleFlightComplete = useCallback(
    (reason: FlightEndReason, x: number, y: number) => {
      const pending = pendingResultRef.current;

      // Always clear pending result
      pendingResultRef.current = null;

      if (!pending) {
        // No pending result, just reset to aiming
        dispatch({ type: "RESET_TO_AIMING" });
        return;
      }

      // 落空原因提示（坠入深渊 / 飞出窗口 / 擦身而过）
      setMissMarker({ key: Date.now(), text: MISS_TEXTS[reason], x, y });
      window.setTimeout(() => setMissMarker(null), 1500);

      // Arrow didn't visually hit - don't apply damage, but handle monster counter-attack
      const result = onSkipShot();

      dispatch({
        type: "RESOLVE",
        hit: false,
        damage: 0,
        critical: false,
      });

      // Show enemy dialogue for miss
      setTimeout(() => {
        setEnemyDialogue(getEnemyDialogue("playerMiss"));
      }, 300);

      // Proceed to enemy turn
      setTimeout(() => {
        if (!result.duel.finished) {
          dispatch({ type: "ENEMY_TURN" });
        } else {
          dispatch({ type: "FINISH" });
        }
      }, 600);
    },
    [dispatch, onSkipShot],
  );

  // 敌方箭矢落地（命中或未中）：解析战报展示伤害与台词
  const resolveEnemyShot = useCallback(() => {
    setEnemyShooting((prev) => ({
      ...prev,
      isFlying: false,
      showDamage: true,
    }));

    // Parse actual enemy damage from duel logs
    const lastLog = duel.logs[duel.logs.length - 1] ?? "";
    const enemyHit = lastLog.includes("造成") && lastLog.includes("伤害");
    const damageMatch = lastLog.match(/造成 (\d+) 伤害/);
    const enemyDamage = damageMatch ? parseInt(damageMatch[1], 10) : 0;

    setEnemyShooting((prev) => ({
      ...prev,
      lastDamage: enemyDamage,
      lastHit: enemyHit,
      lastCritical: false,
    }));

    setTimeout(() => {
      if (enemyHit) {
        setEnemyDialogue(getEnemyDialogue("enemyAttack"));
      } else {
        setEnemyDialogue(getEnemyDialogue("enemyMiss"));
      }
    }, 200);

    // Reset enemy state after showing damage
    setTimeout(() => {
      setEnemyShooting({
        isDrawing: false,
        drawPower: 0,
        isFlying: false,
        targetX: PLAYER_X,
        targetY: PLAYER_BODY_Y,
        showDamage: false,
        lastDamage: 0,
        lastCritical: false,
        lastHit: false,
      });
      dispatch({ type: "RESET_TO_AIMING" });
    }, 1000);
  }, [dispatch, duel.logs]);

  // 玩家箭矢视觉上命中对手：插箭停留 + 结算伤害
  const handlePlayerArrowHit = useCallback(
    (x: number, y: number, angleDeg: number) => {
      const pending = pendingResultRef.current;
      if (!pending) {
        return;
      }

      // Clear pending result immediately to prevent double-triggering
      pendingResultRef.current = null;

      // 箭矢停留在对手身上，1 秒后淡出
      addStuckArrow(x, y, angleDeg, false);

      // Arrow visually hit - apply pending damage
      if (pending.result.pendingDamage) {
        const result = onApplyShot(pending.arrowId, pending.result.pendingDamage);

        dispatch({
          type: "RESOLVE",
          hit: true,
          damage: pending.damage,
          critical: pending.critical,
        });

        // Show enemy dialogue based on visual hit
        setTimeout(() => {
          if (pending.damage < 10) {
            setEnemyDialogue(getEnemyDialogue("lowDamage"));
          } else {
            setEnemyDialogue(getEnemyDialogue("playerAttack"));
          }
        }, 300);

        // After showing damage, proceed to enemy turn
        setTimeout(() => {
          if (!result.duel.finished) {
            dispatch({ type: "ENEMY_TURN" });
          } else {
            dispatch({ type: "FINISH" });
          }
        }, 1000);
      }
    },
    [dispatch, onApplyShot, addStuckArrow],
  );

  // 敌方箭矢视觉上命中玩家：插箭停留 + 展示战报伤害
  const handleEnemyArrowHit = useCallback(
    (x: number, y: number, angleDeg: number) => {
      addStuckArrow(x, y, angleDeg, true);
      resolveEnemyShot();
    },
    [addStuckArrow, resolveEnemyShot],
  );

  const canShoot =
    !duel.finished &&
    animation.phase === "aiming" &&
    availableArrows.length > 0 &&
    Boolean(selectedArrow);

  // 演武切磋：对手血量无限，血条常驻全满、数值显示 ∞
  const monsterHealthPercent = duel.endless
    ? 100
    : Math.max(0, Math.round((duel.monsterHealth / duel.monster.health) * 100));
  const playerHealthPercent = Math.max(
    0,
    Math.round((duel.playerHealth / player.health.max) * 100),
  );

  const aimActive =
    animation.phase === "aiming" || animation.phase === "drawing";

  return (
    <div className="battle-screen">
      <div className="battle-screen-header">
        <div className="battle-screen-title">
          <p className="eyebrow">{duel.monster.area}</p>
          <h1>{duel.monster.name}</h1>
        </div>
        <div className="battle-screen-status">
          {duel.finished ? (
            <span className={duel.victory ? "victory" : "defeat"}>
              {duel.victory ? "胜利" : "失败"}
            </span>
          ) : (
            <>
              <span>第 {duel.round} 回合</span>
              {/* 演武切磋（对手血量无限）：随时可退出对战 */}
              {duel.endless && (
                <button
                  type="button"
                  className="battle-exit-button"
                  onClick={() => onBattleEnd(null)}
                >
                  退出对战
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="battle-screen-content">
        <BattleField
          duel={duel}
          playerHealth={duel.playerHealth}
          playerMaxHealth={player.health.max}
          aimPosition={animation.aimPosition}
          currentZone={animation.currentZone}
          drawPower={animation.drawPower}
          isDrawing={animation.phase === "drawing"}
          isFlying={animation.phase === "flight"}
          aimActive={aimActive}
          showDamage={animation.showDamage}
          lastDamage={animation.lastDamage}
          lastCritical={animation.lastCritical}
          lastHit={animation.lastHit}
          stuckArrows={stuckArrows}
          missMarker={missMarker}
          dialogue={enemyDialogue}
          onDialogueDone={() => setEnemyDialogue(null)}
          isEnemyShooting={enemyShooting.isDrawing}
          enemyDrawPower={enemyShooting.drawPower}
          enemyArrowFlying={enemyShooting.isFlying}
          enemyTargetX={enemyShooting.targetX}
          enemyTargetY={enemyShooting.targetY}
          enemyShowDamage={enemyShooting.showDamage}
          enemyLastDamage={enemyShooting.lastDamage}
          enemyLastCritical={enemyShooting.lastCritical}
          enemyLastHit={enemyShooting.lastHit}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onFlightComplete={handleFlightComplete}
          onEnemyFlightComplete={resolveEnemyShot}
          onPlayerArrowHit={handlePlayerArrowHit}
          onEnemyArrowHit={handleEnemyArrowHit}
        />

        <div className="battle-screen-sidebar">
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

          {battleResult && (
            <div className="battle-result-summary">
              <h3>战斗结果</h3>
              <div className="result-stats">
                <div className="result-stat">
                  <span className="stat-label">灵石</span>
                  <span className="stat-value">+{battleResult.reward.spiritStones}</span>
                </div>
                <div className="result-stat">
                  <span className="stat-label">修为</span>
                  <span className="stat-value">+{battleResult.reward.cultivation}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="battle-screen-footer">
        <BattleLog logs={duel.logs} />
      </div>

      {/* Battle result overlay */}
      {battleResult && duel.finished && (
        <BattleResultOverlay
          result={battleResult}
          onContinue={() => onBattleEnd(battleResult)}
        />
      )}
    </div>
  );
};
