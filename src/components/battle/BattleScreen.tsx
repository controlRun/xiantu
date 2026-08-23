import { useCallback, useEffect, useRef, useState } from "react";
import {
  getShotChance,
  getShotCriticalChance,
  shouldAutoRetreat,
  type EnemyDefense,
} from "../../systems/battleSystem";
import { playCue } from "../../utils/audioSystem";
import { getInventoryQuantity } from "../../systems/inventorySystem";
import { getPillDefinition } from "../../data/pills";
import type {
  AimPosition,
  ArcheryDuelState,
  ArrowDefinition,
  BattlePhase,
  BattleResult,
  Player,
  TargetZoneId,
} from "../../types/game";
import { targetZones } from "../../data/arrows";
import { isSpiritArrowId, type SpiritArrowTier } from "../../data/spiritArrows";
import {
  ENEMY_BOW_ORIGIN,
  PLAYER_BODY_Y,
  PLAYER_X,
} from "./battleLayout";
import { useBattleAnimation } from "../../hooks/useBattleAnimation";
import { useBattleTimers } from "../../hooks/useBattleTimers";
import {
  launchSpeed,
  MISS_TEXTS,
  solveLaunchDirection,
  type FlightEndReason,
} from "../../utils/arrowPhysics";
import { BattleField, type MissMarker } from "./BattleField";
import { BattleHUD } from "./BattleHUD";
import { BattleResult as BattleResultOverlay } from "./BattleResult";
import { getEnemyDialogue } from "./EnemyDialogue";
import type { StuckArrowState } from "./StuckArrow";

interface BattleScreenProps {
  duel: ArcheryDuelState;
  player: Player;
  availableArrows: ArrowDefinition[];
  /** 当前境界已解锁的灵力化箭档位 */
  spiritArrows: SpiritArrowTier[];
  onShoot: (
    arrowId: string,
    zoneId: TargetZoneId,
    drawPower: number,
  ) => import("../../systems/battleSystem").ArcheryShotResult;
  onApplyShot: (
    basePlayer: Player,
    baseDuel: ArcheryDuelState,
    arrowId: string,
    pendingDamage: NonNullable<import("../../systems/battleSystem").ArcheryShotResult["pendingDamage"]>,
  ) => import("../../systems/battleSystem").ArcheryShotResult;
  onSkipShot: (
    basePlayer: Player,
    baseDuel: ArcheryDuelState,
    missReason?: string,
  ) => import("../../systems/battleSystem").ArcheryShotResult;
  /** 战中服丹：消耗丹药并触发敌方反击一回合 */
  onUsePill: (pillItemId: string) => import("../../systems/battleSystem").ArcheryShotResult;
  /** 敌方拉弓期间点按防御：返还血量并改写 lastEnemyShot（dodge 全额 / block 减半） */
  onApplyDefense: (
    basePlayer: Player,
    baseDuel: ArcheryDuelState,
    defense: EnemyDefense,
  ) => import("../../systems/battleSystem").ArcheryShotResult;
  /** 撤退策略自动触发（reason 用于战报日志） */
  onAutoRetreat: (reason: string) => void;
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
  spiritArrows,
  onShoot,
  onApplyShot,
  onSkipShot,
  onUsePill,
  onApplyDefense,
  onAutoRetreat,
  onBattleEnd,
  battleResult,
}: BattleScreenProps) => {
  const { state: animation, dispatch } = useBattleAnimation();
  /** 定时器登记簿：所有 setTimeout 经此登记，卸载即清（见 useBattleTimers） */
  const { schedule, cancel } = useBattleTimers();
  /** 演武切磋（endless）：无消耗训练，箭矢/灵力不受库存限制 */
  const endless = Boolean(duel.endless);
  // 默认选箭：最强实物箭；箭囊空空则取灵力足够的灵力箭（否则取已解锁首档）
  const [selectedArrowId, setSelectedArrowId] = useState(
    availableArrows[availableArrows.length - 1]?.itemId ??
      spiritArrows.find((tier) => player.mana.current >= tier.manaCost)?.id ??
      spiritArrows[0]?.id ??
      "",
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

  /** 敌方回合防御：每回合一次，拉弓窗口内点按 → 闪避（全额）或格挡（减半） */
  const [defenseUsed, setDefenseUsed] = useState(false);
  const [defenseBadge, setDefenseBadge] = useState<"dodge" | "block" | null>(null);

  // 每次进入敌方回合重置防御窗口（无论来箭是否命中）
  useEffect(() => {
    if (animation.phase !== "enemyTurn") {
      return;
    }
    setDefenseUsed(false);
    setDefenseBadge(null);
  }, [animation.phase]);

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
      schedule(() => {
        setStuckArrows((prev) => prev.filter((arrow) => arrow.id !== id));
      }, 1000);
    },
    [schedule],
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

  // 始终指向最新回调，避免 App 重渲染刷新函数签名导致定时器反复重置、
  // 结算自动返回被无限推迟
  const onBattleEndRef = useRef(onBattleEnd);
  onBattleEndRef.current = onBattleEnd;
  /** 镜像最新 duel，供异步回调（看门狗 / 敌方结算）读取 finished 状态 */
  const duelRef = useRef(duel);
  duelRef.current = duel;

  // Handle battle end
  useEffect(() => {
    if (duel.finished && battleResult) {
      playCue(battleResult.victory ? "battleWin" : "battleLose");
      // 战报停留 5 秒供阅读后自动返回（也可点击「收起战报」立即退出）
      const timer = setTimeout(() => {
        onBattleEndRef.current(battleResult);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [duel.finished, battleResult]);

  // 撤退策略自动判定：每次回到瞄准阶段检查（血量阈值 / 回合数）
  const autoRetreatedRef = useRef(false);
  useEffect(() => {
    if (
      animation.phase !== "aiming" ||
      duel.finished ||
      autoRetreatedRef.current
    ) {
      return;
    }
    const reason = shouldAutoRetreat(player, duel);
    if (reason) {
      autoRetreatedRef.current = true;
      onAutoRetreat(reason);
    }
  }, [animation.phase, duel, player, onAutoRetreat]);

  /**
   * 阶段看门狗：飞行 / 结算 / 敌方回合三个阶段各由一条动画与定时器链推进，
   * 任一环节的回调丢失（事件被吞、脚本异常、极端卡顿）都会让界面永久卡死。
   * 超过各阶段合理上限仍未离开时强制兜底——宁可跳过一段演出，也不锁死界面。
   * （drawing 阶段不设限：触屏允许长时间拖拽瞄准，由指针捕获保证抬手送达。）
   */
  useEffect(() => {
    const phaseLimits: Partial<Record<BattlePhase, number>> = {
      flight: 6000, // 箭矢飞行自带 4.1s 兜底，此处再留余裕
      resolving: 3000, // 命中/落空演出后 ≤1s 应转入敌方回合或结算
      enemyTurn: 8000, // 拉弓 0.9s + 飞行 ≤4.1s + 结算展示 1s
    };
    const limit = phaseLimits[animation.phase];

    if (limit === undefined) {
      return;
    }

    const timer = window.setTimeout(() => {
      // 看门狗触发即说明某条回调链中断——留档现场便于追查根因
      console.warn(
        `[battle] 阶段看门狗触发：${animation.phase} 超过 ${limit}ms 未推进，强制兜底`,
      );
      if (duelRef.current.finished) {
        dispatch({ type: "FINISH" });
      } else {
        dispatch({ type: "RESET_TO_AIMING" });
      }
    }, limit);
    return () => window.clearTimeout(timer);
  }, [animation.phase, dispatch]);

  /**
   * 敌方回合：拉弓 → 按战报结果反解弹道 → 放箭。
   * 战报命中 → 解出必中的低仰角弹道；战报未中 → 随机偏强（越过头顶出界）
   * 或偏弱（力竭坠入深渊）的弹道，视觉与逻辑严格一致。
   */
  useEffect(() => {
    if (animation.phase !== "enemyTurn") {
      return;
    }

    // 对战已终结（防御性分支）：不再演出敌方回合，直接进入结算态
    if (duel.finished) {
      dispatch({ type: "FINISH" });
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
      const willHit = duel.lastEnemyShot?.hit ?? false;

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
  }, [animation.phase, duel.finished, duel.lastEnemyShot]);

  // Calculate hit chance based on current aim
  // 选中箭矢可能是实物箭（箭囊）或灵力化箭（spirit- 档位）
  const selectedSpiritArrow = spiritArrows.find(
    (tier) =>
      tier.id === selectedArrowId &&
      (endless || player.mana.current >= tier.manaCost),
  );
  const selectedArrow =
    availableArrows.find((a) => a.itemId === selectedArrowId) ??
    (selectedSpiritArrow
      ? {
          itemId: selectedSpiritArrow.id,
          name: selectedSpiritArrow.name,
          accuracy: selectedSpiritArrow.accuracy,
        }
      : undefined);
  const selectedTarget = targetZones.find(
    (z) => z.id === animation.currentZone,
  );
  const fallbackArrowId =
    availableArrows[availableArrows.length - 1]?.itemId ??
    spiritArrows.find(
      (tier) => endless || player.mana.current >= tier.manaCost,
    )?.id ??
    "";

  useEffect(() => {
    const selectedPhysical = availableArrows.some(
      (arrow) => arrow.itemId === selectedArrowId,
    );
    const selectedSpirit = spiritArrows.some(
      (tier) =>
        tier.id === selectedArrowId &&
        (endless || player.mana.current >= tier.manaCost),
    );

    if (!selectedPhysical && !selectedSpirit && fallbackArrowId) {
      setSelectedArrowId(fallbackArrowId);
    }
  }, [
    availableArrows,
    endless,
    fallbackArrowId,
    player.mana.current,
    selectedArrowId,
    spiritArrows,
  ]);

  const hitChance =
    selectedArrow && selectedTarget
      ? getShotChance(player, selectedArrow.itemId, selectedTarget.id)
      : 0.5;

  const criticalChance = selectedTarget
    ? getShotCriticalChance(player, selectedTarget.id)
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
      autoReleaseTimerRef.current = schedule(() => {
        if (!hasReleasedRef.current) {
          releaseRef.current();
        }
      }, DRAW_DURATION + 100);
    },
    [animation.phase, duel.finished, selectedArrow, dispatch, schedule],
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
    cancel(autoReleaseTimerRef.current);
    autoReleaseTimerRef.current = null;

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
  }, [animation.phase, animation.drawPower, selectedArrow, selectedTarget, onShoot, dispatch, cancel]);

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
      playCue("playerMiss");
      schedule(() => setMissMarker(null), 1500);

      // Arrow didn't visually hit - don't apply damage, but handle monster counter-attack
      // 与命中结算同构的容错：结算异常不得阻塞 RESOLVE → 敌方回合的状态机推进
      let result: import("../../systems/battleSystem").ArcheryShotResult | null =
        null;
      try {
        result = onSkipShot(pending.result.player, pending.result.duel);
      } catch (error) {
        console.error("[battle] 落空结算异常，按当前战局强行推进：", error);
      }

      dispatch({
        type: "RESOLVE",
        hit: false,
        damage: 0,
        critical: false,
      });

      // Show enemy dialogue for miss
      schedule(() => {
        setEnemyDialogue(getEnemyDialogue("playerMiss"));
      }, 300);

      // Proceed to enemy turn
      schedule(() => {
        const finished = result
          ? result.duel.finished
          : duelRef.current.finished;
        if (finished) {
          dispatch({ type: "FINISH" });
        } else {
          dispatch({ type: "ENEMY_TURN" });
        }
      }, 600);
    },
    [dispatch, onSkipShot, schedule],
  );

  // 敌方箭矢落地（命中或未中）：解析战报展示伤害与台词
  const resolveEnemyShot = useCallback(() => {
    setEnemyShooting((prev) => ({
      ...prev,
      isFlying: false,
      showDamage: true,
    }));

    const enemyHit = duel.lastEnemyShot?.hit ?? false;
    const enemyDamage = duel.lastEnemyShot?.damage ?? 0;
    if (enemyHit) {
      playCue("enemyHit");
    }

    setEnemyShooting((prev) => ({
      ...prev,
      lastDamage: enemyDamage,
      lastHit: enemyHit,
      lastCritical: duel.lastEnemyShot?.critical ?? false,
    }));

    schedule(() => {
      if (enemyHit) {
        setEnemyDialogue(getEnemyDialogue("enemyAttack"));
      } else {
        setEnemyDialogue(getEnemyDialogue("enemyMiss"));
      }
    }, 200);

    // Reset enemy state after showing damage
    schedule(() => {
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
      // 敌方反击致死：直接进入结算态（结算浮层随之呈现），不回瞄准
      if (duelRef.current.finished) {
        dispatch({ type: "FINISH" });
      } else {
        dispatch({ type: "RESET_TO_AIMING" });
      }
    }, 1000);
  }, [dispatch, duel.lastEnemyShot, schedule]);

  /** 敌方拉弓窗口内点按防御：闪避率随神识增长（封顶 45%），闪避失败退化为格挡（减半） */
  const handleDefense = useCallback(() => {
    // 仅拉弓窗口内可防御：箭已离弦（isFlying）防御会重启拉弓、触发双箭，故拒绝
    if (defenseUsed || !enemyShooting.isDrawing) {
      return;
    }
    const enemyDamage = duel.lastEnemyShot?.damage ?? 0;
    if (enemyDamage <= 0) {
      return;
    }

    const divineSense = player.attributes.divineSense ?? 0;
    const dodgeChance = Math.min(0.45, Math.max(0.2, 0.2 + divineSense * 0.004));
    const dodged = Math.random() < dodgeChance;
    const defense: EnemyDefense = dodged
      ? { kind: "dodge", refund: enemyDamage }
      : { kind: "block", refund: Math.ceil(enemyDamage * 0.5) };

    setDefenseUsed(true);
    setDefenseBadge(defense.kind);
    playCue(dodged ? "playerMiss" : "uiConfirm");
    // 立即入系统：改写 lastEnemyShot（dodge 视为未命中 / block 减伤），
    // 敌矢拉弓随之按新战报重演（dodge 改为偏弹道、block 仍命中但减伤）
    try {
      onApplyDefense(player, duel, defense);
    } catch (error) {
      console.error("[battle] 防御结算异常：", error);
    }
  }, [defenseUsed, duel, enemyShooting.isDrawing, onApplyDefense, player]);

  // 玩家箭矢视觉上命中对手：插箭停留 + 结算伤害
  //
  // 关键结构：onApplyShot/onSkipShot 会回调上层 App 的整套状态更新与重渲染，
  // 是整条链路上唯一可能抛异常的环节。RESOLVE 与敌方回合推进绝不能排在它之后
  // 裸奔——否则一旦异常，动画状态机滞留飞行阶段：箭矢插在对手身上纹丝不动、
  // 伤害数字永不弹出，正是「命中后卡死、伤害没结算」的症状。
  // 因此结算调用包在 try/catch 里：成则用其战局判定终局，败则按当前 duel 强行推进，
  // 动画状态机在任何情况下都走完 RESOLVE → 台词 → 敌方回合/结算。
  const handlePlayerArrowHit = useCallback(
    (x: number, y: number, angleDeg: number) => {
      const pending = pendingResultRef.current;

      // 兜底：本次飞行已无待结算结果（回调重复触发等）——
      // 绝不能静默返回，否则界面将永久滞留在飞行阶段
      if (!pending) {
        dispatch({ type: "RESET_TO_AIMING" });
        return;
      }

      // Clear pending result immediately to prevent double-triggering
      pendingResultRef.current = null;

      // 箭矢停留在对手身上，1 秒后淡出
      addStuckArrow(x, y, angleDeg, false);

      // 兜底：发射结算未能给出待生效伤害（灵力/箭矢不足、战斗已结束等）——
      // 这一箭本未扣箭矢/灵力，不作数、不消耗回合，退回瞄准再来
      if (!pending.result.pendingDamage) {
        dispatch({ type: "RESET_TO_AIMING" });
        return;
      }

      const dodged = Math.random() > hitChance;

      if (dodged) {
        playCue("playerMiss");
      } else if (pending.critical) {
        playCue("playerCrit");
      } else {
        playCue("playerHit");
      }

      let result: import("../../systems/battleSystem").ArcheryShotResult | null =
        null;
      try {
        const basePlayer = pending.result.player;
        const baseDuel = pending.result.duel;
        result = dodged
          ? onSkipShot(basePlayer, baseDuel, "这一箭擦中衣角，被对方身法卸开。")
          : onApplyShot(basePlayer, baseDuel, pending.arrowId, pending.result.pendingDamage);
      } catch (error) {
        // 结算异常不得阻塞状态机：伤害数字与回合推进照常演出，错误留档待查
        console.error("[battle] 命中结算异常，按当前战局强行推进：", error);
      }

      if (dodged) {
        setMissMarker({
          key: Date.now(),
          text: "身法避开",
          x,
          y,
        });
        schedule(() => setMissMarker(null), 1500);
      }

      dispatch({
        type: "RESOLVE",
        hit: !dodged,
        damage: dodged ? 0 : pending.damage,
        critical: dodged ? false : pending.critical,
      });

      // Show enemy dialogue based on visual hit
      schedule(() => {
        if (dodged) {
          setEnemyDialogue(getEnemyDialogue("playerMiss"));
        } else if (pending.damage < 10) {
          setEnemyDialogue(getEnemyDialogue("lowDamage"));
        } else {
          setEnemyDialogue(getEnemyDialogue("playerAttack"));
        }
      }, 300);

      // After showing damage, proceed to enemy turn
      schedule(() => {
        // 结算异常时取不到新战局：用 ref 中的最新 duel 兜底判断终局
        const finished = result
          ? result.duel.finished
          : duelRef.current.finished;
        if (finished) {
          dispatch({ type: "FINISH" });
        } else {
          dispatch({ type: "ENEMY_TURN" });
        }
      }, dodged ? 600 : 1000);
    },
    [dispatch, onApplyShot, onSkipShot, addStuckArrow, hitChance, schedule],
  );

  // 敌方箭矢视觉上命中玩家：插箭停留 + 展示战报伤害
  const handleEnemyArrowHit = useCallback(
    (x: number, y: number, angleDeg: number) => {
      addStuckArrow(x, y, angleDeg, true);
      resolveEnemyShot();
    },
    [addStuckArrow, resolveEnemyShot],
  );

  // 箭囊实物箭或已解锁的灵力箭均可开弓（灵力箭的可用性由按钮禁用态把控）
  const canShoot =
    !duel.finished && animation.phase === "aiming" && Boolean(selectedArrow);
  const canSelectArrow = !duel.finished && animation.phase === "aiming";

  // 箭囊已空且灵力不足以化箭：本局再无任何箭可射，提供撤退出路
  // （演武切磋无消耗，永无弹尽粮绝之虞）
  const outOfAmmo =
    !endless &&
    availableArrows.length === 0 &&
    spiritArrows.every((tier) => player.mana.current < tier.manaCost);

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

  // 战中丹药：整备携带的丹药（有库存者），瞄准阶段可服；演武不显示
  const carriedPills = (duel.loadout?.pillIds ?? [])
    .map((itemId) => ({
      itemId,
      definition: getPillDefinition(itemId),
      quantity: getInventoryQuantity(player.inventory, itemId),
    }))
    .filter((pill) => pill.definition && pill.quantity > 0);
  const canUsePills = !duel.finished && !endless && animation.phase === "aiming";

  const handleUsePill = (pillItemId: string) => {
    const result = onUsePill(pillItemId);
    if (result.battleResult) {
      dispatch({ type: "FINISH" });
    } else if (result.duel.round !== duel.round) {
      // 服药计一回合：敌方反击经敌方回合演出呈现
      dispatch({ type: "ENEMY_TURN" });
    }
    // 服用失败（丹药不足等）回合未推进：留在瞄准阶段，不白送敌方反击
  };

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
              {/* 箭囊与灵力俱竭：无法再射，允许认输撤退 */}
              {!duel.endless && animation.phase === "aiming" && outOfAmmo && (
                <button
                  type="button"
                  className="battle-exit-button"
                  onClick={() => onBattleEnd(null)}
                >
                  认输撤退
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="battle-screen-content">
        <div className="battle-field-wrap">
          <BattleField
            duel={duel}
            playerHealth={duel.playerHealth}
            playerMaxHealth={player.health.max}
            playerMana={player.mana.current}
            playerMaxMana={player.mana.max}
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
            playerArrowSpirit={isSpiritArrowId(selectedArrowId)}
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

          {animation.phase === "enemyTurn" && defenseBadge && (
            <div
              className={`battle-defense-badge battle-defense-${defenseBadge}`}
              aria-hidden="true"
            >
              {defenseBadge === "dodge" ? "闪避" : "格挡"}
            </div>
          )}

          {animation.phase === "enemyTurn" &&
            enemyShooting.isDrawing &&
            !defenseUsed &&
            duel.lastEnemyShot?.hit && (
              <button
                type="button"
                className="battle-defense-btn"
                onClick={handleDefense}
              >
                点按防御！
              </button>
            )}
        </div>

        <div className="battle-screen-sidebar">
          <BattleHUD
            duel={duel}
            player={player}
            availableArrows={availableArrows}
            spiritArrows={spiritArrows}
            selectedArrowId={selectedArrowId}
            currentZone={animation.currentZone}
            hitChance={hitChance}
            criticalChance={criticalChance}
            drawPower={animation.drawPower}
            canShoot={canShoot}
            canSelectArrow={canSelectArrow}
            onSelectArrow={setSelectedArrowId}
            monsterHealthPercent={monsterHealthPercent}
            playerHealthPercent={playerHealthPercent}
          />

          {carriedPills.length > 0 && (
            <div className="battle-pill-bar">
              {carriedPills.map((pill) => (
                <button
                  key={pill.itemId}
                  type="button"
                  className="pill-button"
                  disabled={!canUsePills}
                  onClick={() => handleUsePill(pill.itemId)}
                  title={pill.definition?.description}
                >
                  <span>{pill.definition?.name}</span>
                  <small>x{pill.quantity}</small>
                </button>
              ))}
            </div>
          )}

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
