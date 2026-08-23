import { useCallback, useRef, useState } from "react";
import type {
  AimPosition,
  ArcheryDuelState,
  TargetZoneId,
} from "../../types/game";
import { powerTierColor, type FlightEndReason } from "../../utils/arrowPhysics";
import { clamp, detectTargetZone } from "../../utils/zoneDetection";
import { ArrowProjectile } from "./ArrowProjectile";
import {
  BOW_ORIGIN,
  ENEMY_BOW_ORIGIN,
  ENEMY_BODY_Y,
  ENEMY_HIT_RADIUS,
  ENEMY_X,
  FIGURE_SCALE,
  PLATFORM_TOP_Y,
  PLAYER_BODY_Y,
  PLAYER_HIT_RADIUS,
  PLAYER_X,
  VIEW_H,
  VIEW_W,
} from "./battleLayout";
import { BattleBackground } from "./BattleBackground";
import { BowDisplay } from "./BowDisplay";
import { ChargeBar } from "./ChargeBar";
import { DamageNumber } from "./DamageNumber";
import { EnemyFigure } from "./EnemyFigure";
import { SpeechBubble } from "./SpeechBubble";
import { StuckArrow, type StuckArrowState } from "./StuckArrow";
import { TrajectoryPreview } from "./TrajectoryPreview";

export interface MissMarker {
  key: number;
  text: string;
  x: number;
  y: number;
}

export type PointerKind = "touch" | "mouse";

/** 触屏弹弓手感参数（SVG 画布坐标系，天然跨设备一致） */
const TOUCH_AIM_SCALE = 2.0; // 拖拽 1px → 瞄准点反向移动 2px（小屏更跟手）
const TOUCH_FULL_DRAG = 150; // 拖满 150px = 蓄力 100%（拇指短拖即满蓄）
/** 触屏部位判定容差：放大判区，胸腹更宽容，降低小屏点选挫败 */
const TOUCH_ZONE_TOLERANCE = 1.3;

interface TouchAimState {
  anchorX: number;
  anchorY: number;
  fingerX: number;
  fingerY: number;
  power: number;
}

interface BattleFieldProps {
  duel: ArcheryDuelState;
  playerHealth: number;
  playerMaxHealth: number;
  playerMana: number;
  playerMaxMana: number;
  aimPosition: AimPosition;
  currentZone: TargetZoneId;
  drawPower: number;
  isDrawing: boolean;
  isFlying: boolean;
  /** 处于瞄准/蓄力阶段（显示准星、轨迹、蓄力条） */
  aimActive: boolean;
  showDamage: boolean;
  lastDamage: number;
  lastCritical: boolean;
  lastHit: boolean;
  stuckArrows: StuckArrowState[];
  missMarker: MissMarker | null;
  /** 本箭为灵力化箭（飞行箭身呈青蓝灵光色） */
  playerArrowSpirit?: boolean;
  /** 角色台词（气泡贴着说话者头顶弹出） */
  dialogue: string | null;
  onDialogueDone: () => void;
  // Enemy shooting
  isEnemyShooting: boolean;
  enemyDrawPower: number;
  enemyArrowFlying: boolean;
  enemyTargetX: number;
  enemyTargetY: number;
  enemyShowDamage: boolean;
  enemyLastDamage: number;
  enemyLastCritical: boolean;
  enemyLastHit: boolean;
  onPointerMove: (
    position: AimPosition,
    zone: TargetZoneId,
    dragPower?: number,
  ) => void;
  onPointerDown: (pointerType: PointerKind) => void;
  onPointerUp: () => void;
  onFlightComplete: (reason: FlightEndReason, x: number, y: number) => void;
  onEnemyFlightComplete: (reason: FlightEndReason, x: number, y: number) => void;
  onPlayerArrowHit: (x: number, y: number, angleDeg: number) => void;
  onEnemyArrowHit: (x: number, y: number, angleDeg: number) => void;
}

export const BattleField = ({
  duel,
  playerHealth,
  playerMaxHealth,
  playerMana,
  playerMaxMana,
  aimPosition,
  currentZone,
  drawPower,
  isDrawing,
  isFlying,
  aimActive,
  showDamage,
  lastDamage,
  lastCritical,
  lastHit,
  stuckArrows,
  missMarker,
  playerArrowSpirit = false,
  dialogue,
  onDialogueDone,
  isEnemyShooting,
  enemyDrawPower,
  enemyArrowFlying,
  enemyTargetX,
  enemyTargetY,
  enemyShowDamage,
  enemyLastDamage,
  enemyLastCritical,
  enemyLastHit,
  onPointerMove,
  onPointerDown,
  onPointerUp,
  onFlightComplete,
  onEnemyFlightComplete,
  onPlayerArrowHit,
  onEnemyArrowHit,
}: BattleFieldProps) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // 触屏弹弓手势状态：落指为锚点，拖拽方向取反即射击方向，拖距即蓄力
  const touchPointerIdRef = useRef<number | null>(null);
  const touchAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const [touchAim, setTouchAim] = useState<TouchAimState | null>(null);
  const [touchHintSeen, setTouchHintSeen] = useState(false);
  const [isCoarsePointer] = useState(
    () => window.matchMedia("(pointer: coarse)").matches,
  );

  /** 屏幕坐标 → SVG 画布坐标（对任意缩放/旋转都准确） */
  const toSvgPoint = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const loc = toSvgPoint(e);
      if (!loc) return;

      // ===== 触屏：弹弓式拖拽 =====
      if (e.pointerType === "touch") {
        if (e.pointerId !== touchPointerIdRef.current) return; // 忽略第二根手指
        const anchor = touchAnchorRef.current;
        if (!anchor) return;

        // 拖拽向量取反 = 射击方向；手指向左下拉，箭向右上飞，
        // 手指始终留在屏幕左半，不会盖住右侧的敌人
        const pullX = loc.x - anchor.x;
        const pullY = loc.y - anchor.y;
        const mirroredX = BOW_ORIGIN.x - pullX * TOUCH_AIM_SCALE;
        const mirroredY = BOW_ORIGIN.y - pullY * TOUCH_AIM_SCALE;

        // 与鼠标同一套半球约束：瞄准点不允许落到弓口之后
        const x = clamp(Math.max(mirroredX, BOW_ORIGIN.x + 2), 24, VIEW_W - 24);
        const y = clamp(mirroredY, 18, VIEW_H - 64);

        // 部位判定：把瞄准射线投影到敌人立柱上取最近点，
        // 抬射判头、平射判胸、压射判腿，与箭的实际指向严格一致
        let dirX = x - BOW_ORIGIN.x;
        let dirY = y - BOW_ORIGIN.y;
        const len = Math.hypot(dirX, dirY) || 1;
        dirX /= len;
        dirY /= len;
        const proj = Math.max(
          dirX * (ENEMY_X - BOW_ORIGIN.x) + dirY * (ENEMY_BODY_Y - BOW_ORIGIN.y),
          0,
        );
        const zone = detectTargetZone(
          BOW_ORIGIN.x + dirX * proj,
          BOW_ORIGIN.y + dirY * proj,
          ENEMY_X,
          ENEMY_BODY_Y,
          TOUCH_ZONE_TOLERANCE,
        );

        const power = clamp(Math.hypot(pullX, pullY) / TOUCH_FULL_DRAG, 0, 1);

        setTouchAim({
          anchorX: anchor.x,
          anchorY: anchor.y,
          fingerX: loc.x,
          fingerY: loc.y,
          power,
        });
        onPointerMove({ x, y }, zone, power);
        return;
      }

      // ===== 鼠标：指哪打哪 =====
      const x = clamp(Math.max(loc.x, BOW_ORIGIN.x + 2), 24, VIEW_W - 24);
      const y = clamp(loc.y, 18, VIEW_H - 64);
      const zone = detectTargetZone(x, y, ENEMY_X, ENEMY_BODY_Y);

      onPointerMove({ x, y }, zone);
    },
    [onPointerMove],
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // 捕获指针：抬手即使落在画布之外，pointerup/pointercancel 也会送达本元素，
    // 杜绝触屏"拉弓途中丢失抬手事件"后永久卡在蓄力阶段
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 个别旧浏览器不支持指针捕获，退回默认行为
    }
    const isTouch = e.pointerType === "touch";
    if (isTouch) {
      if (touchPointerIdRef.current !== null) return; // 多指时只认第一根
      const loc = toSvgPoint(e);
      if (!loc) return;
      touchPointerIdRef.current = e.pointerId;
      touchAnchorRef.current = { x: loc.x, y: loc.y };
      setTouchAim({
        anchorX: loc.x,
        anchorY: loc.y,
        fingerX: loc.x,
        fingerY: loc.y,
        power: 0,
      });
      setTouchHintSeen(true);
    }
    onPointerDown(isTouch ? "touch" : "mouse");
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "touch") {
      if (e.pointerId !== touchPointerIdRef.current) return;
      touchPointerIdRef.current = null;
      touchAnchorRef.current = null;
      setTouchAim(null);
    }
    onPointerUp();
  };

  const targetX = aimPosition.x;
  const targetY = aimPosition.y;

  // 弓身只在前侧 180° 内转动（瞄准点已约束在弓前，这里再加一道保险）
  const playerAimAngle = Math.max(
    -90,
    Math.min(
      90,
      Math.atan2(targetY - BOW_ORIGIN.y, targetX - BOW_ORIGIN.x) * (180 / Math.PI),
    ),
  );
  const enemyAimAngle =
    Math.atan2(enemyTargetY - ENEMY_BOW_ORIGIN.y, enemyTargetX - ENEMY_BOW_ORIGIN.x) *
    (180 / Math.PI);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="battle-field-svg"
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <defs>
        <linearGradient id="platform-stone" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(148, 120, 78, 0.95)" />
          <stop offset="35%" stopColor="rgba(112, 88, 56, 0.85)" />
          <stop offset="100%" stopColor="rgba(58, 45, 30, 0.75)" />
        </linearGradient>
        <linearGradient id="platform-shaft" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(96, 76, 50, 0.8)" />
          <stop offset="100%" stopColor="rgba(30, 24, 16, 0.55)" />
        </linearGradient>
        <radialGradient id="glow-player">
          <stop offset="0%" stopColor="rgba(114, 192, 140, 0.4)" />
          <stop offset="100%" stopColor="rgba(114, 192, 140, 0)" />
        </radialGradient>
        <radialGradient id="glow-enemy">
          <stop offset="0%" stopColor="rgba(232, 151, 93, 0.4)" />
          <stop offset="100%" stopColor="rgba(232, 151, 93, 0)" />
        </radialGradient>
      </defs>

      {/* ===== 对战背景（沙漠 / 竹林 / 悬崖 / 水上 / 屋顶 / 宫墙，开战时随机） ===== */}
      <BattleBackground scene={duel.background} />

      {/* ===== 玩家站台（左，高柱） ===== */}
      <g className="player-platform">
        <ellipse cx={PLAYER_X} cy={PLATFORM_TOP_Y} rx="62" ry="8" fill="url(#glow-player)" opacity="0.8" />
        {/* 柱身 */}
        <path
          d={`M ${PLAYER_X - 48} ${PLATFORM_TOP_Y + 18} L ${PLAYER_X - 34} ${PLATFORM_TOP_Y + 118} L ${PLAYER_X + 34} ${PLATFORM_TOP_Y + 118} L ${PLAYER_X + 48} ${PLATFORM_TOP_Y + 18} Z`}
          fill="url(#platform-shaft)"
          stroke="rgba(90, 72, 46, 0.55)"
          strokeWidth="1"
        />
        {/* 柱身裂纹 */}
        <path
          d={`M ${PLAYER_X - 18} ${PLATFORM_TOP_Y + 26} l 6 26 l -9 22 l 7 24`}
          fill="none"
          stroke="rgba(20, 16, 10, 0.6)"
          strokeWidth="1.2"
        />
        <path
          d={`M ${PLAYER_X + 20} ${PLATFORM_TOP_Y + 30} l -5 30 l 8 26`}
          fill="none"
          stroke="rgba(20, 16, 10, 0.5)"
          strokeWidth="1"
        />
        {/* 台基 */}
        <rect
          x={PLAYER_X - 56}
          y={PLATFORM_TOP_Y + 6}
          width="112"
          height="14"
          rx="2"
          fill="rgba(98, 78, 50, 0.85)"
          stroke="rgba(139, 111, 71, 0.6)"
          strokeWidth="1"
        />
        {/* 台面 */}
        <rect
          x={PLAYER_X - 56}
          y={PLATFORM_TOP_Y - 8}
          width="112"
          height="16"
          rx="3"
          fill="url(#platform-stone)"
          stroke="rgba(160, 130, 86, 0.9)"
          strokeWidth="1.5"
        />
        {/* 台面灵纹 */}
        <line
          x1={PLAYER_X - 40}
          y1={PLATFORM_TOP_Y}
          x2={PLAYER_X + 40}
          y2={PLATFORM_TOP_Y}
          stroke="rgba(114, 192, 140, 0.55)"
          strokeWidth="1.5"
          strokeDasharray="3,5"
        >
          <animate attributeName="opacity" values="0.4;1;0.4" dur="3s" repeatCount="indefinite" />
        </line>
      </g>

      {/* ===== 敌方站台（右，高柱） ===== */}
      <g className="enemy-platform">
        <ellipse cx={ENEMY_X} cy={PLATFORM_TOP_Y} rx="62" ry="8" fill="url(#glow-enemy)" opacity="0.8" />
        <path
          d={`M ${ENEMY_X - 48} ${PLATFORM_TOP_Y + 18} L ${ENEMY_X - 34} ${PLATFORM_TOP_Y + 118} L ${ENEMY_X + 34} ${PLATFORM_TOP_Y + 118} L ${ENEMY_X + 48} ${PLATFORM_TOP_Y + 18} Z`}
          fill="url(#platform-shaft)"
          stroke="rgba(90, 72, 46, 0.55)"
          strokeWidth="1"
        />
        <path
          d={`M ${ENEMY_X + 16} ${PLATFORM_TOP_Y + 26} l -6 28 l 9 24 l -7 22`}
          fill="none"
          stroke="rgba(20, 16, 10, 0.6)"
          strokeWidth="1.2"
        />
        <path
          d={`M ${ENEMY_X - 22} ${PLATFORM_TOP_Y + 32} l 5 28 l -8 24`}
          fill="none"
          stroke="rgba(20, 16, 10, 0.5)"
          strokeWidth="1"
        />
        <rect
          x={ENEMY_X - 56}
          y={PLATFORM_TOP_Y + 6}
          width="112"
          height="14"
          rx="2"
          fill="rgba(98, 78, 50, 0.85)"
          stroke="rgba(139, 111, 71, 0.6)"
          strokeWidth="1"
        />
        <rect
          x={ENEMY_X - 56}
          y={PLATFORM_TOP_Y - 8}
          width="112"
          height="16"
          rx="3"
          fill="url(#platform-stone)"
          stroke="rgba(160, 130, 86, 0.9)"
          strokeWidth="1.5"
        />
        <line
          x1={ENEMY_X - 40}
          y1={PLATFORM_TOP_Y}
          x2={ENEMY_X + 40}
          y2={PLATFORM_TOP_Y}
          stroke="rgba(232, 151, 93, 0.55)"
          strokeWidth="1.5"
          strokeDasharray="3,5"
        >
          <animate attributeName="opacity" values="0.4;1;0.4" dur="3.4s" repeatCount="indefinite" />
        </line>
      </g>

      {/* ===== 玩家（缩小身形，立于左台） ===== */}
      <g
        className="player-figure"
        style={{ color: "rgba(114, 192, 140, 0.92)" }}
        transform={`translate(${PLAYER_X}, ${PLATFORM_TOP_Y - 8}) scale(${FIGURE_SCALE})`}
      >
        {/* 足下光晕 */}
        <ellipse cx="0" cy="2" rx="26" ry="5" fill="url(#glow-player)" opacity="0.7" />
        {/* 双腿 */}
        <rect x="-10" y="-46" width="8" height="46" rx="4" fill="currentColor" />
        <rect x="3" y="-46" width="8" height="46" rx="4" fill="currentColor" />
        {/* 身躯 */}
        <rect x="-12" y="-92" width="24" height="50" rx="9" fill="currentColor" />
        {/* 发带飘动 */}
        <path d="M -3 -116 Q -14 -112 -18 -102" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.8">
          <animate attributeName="d" values="M -3 -116 Q -14 -112 -18 -102;M -3 -116 Q -16 -108 -20 -100;M -3 -116 Q -14 -112 -18 -102" dur="2.6s" repeatCount="indefinite" />
        </path>
        {/* 头颅与发髻 */}
        <circle cx="0" cy="-104" r="13" fill="currentColor" />
        <circle cx="0" cy="-118" r="4.5" fill="currentColor" />
        {/* 后臂（引弦手） */}
        <line x1="-6" y1="-82" x2="-15" y2="-68" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        {/* 持弓前臂 */}
        <line x1="6" y1="-82" x2="40" y2="-78" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      </g>

      {/* ===== 敌方（缩小身形，立于右台） ===== */}
      <g transform={`translate(${ENEMY_X}, ${PLATFORM_TOP_Y - 8 - 90 * FIGURE_SCALE}) scale(${FIGURE_SCALE})`}>
        <ellipse cx="0" cy="92" rx="26" ry="5" fill="url(#glow-enemy)" opacity="0.7" />
        <EnemyFigure
          monster={duel.monster}
          currentZone={currentZone}
          isHit={showDamage && lastHit}
          isShaking={showDamage && lastHit}
          hasBow={true}
          drawPower={isEnemyShooting ? enemyDrawPower : 0}
          aimAngle={isEnemyShooting || enemyArrowFlying ? enemyAimAngle : 180}
        />
      </g>

      {/* ===== 顶部血条 ===== */}
      <g className="health-bars-top">
        <g transform="translate(24, 18)">
          <rect x="0" y="0" width="240" height="22" rx="11" fill="rgba(0, 0, 0, 0.6)" stroke="rgba(114, 192, 140, 0.45)" strokeWidth="1.5" />
          <rect x="2" y="2" width={Math.max(0, (236 * playerHealth) / playerMaxHealth)} height="18" rx="9" fill="url(#player-health-gradient)" />
          <text x="120" y="15" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">
            {playerHealth} / {playerMaxHealth}
          </text>
          <text x="0" y="36" fill="rgba(114, 192, 140, 0.9)" fontSize="11" fontWeight="700">
            我 · 修士
          </text>
        </g>
        <g transform="translate(24, 48)">
          <rect x="0" y="0" width="240" height="14" rx="7" fill="rgba(0, 0, 0, 0.55)" stroke="rgba(93, 157, 232, 0.5)" strokeWidth="1" />
          <rect x="2" y="2" width={Math.max(0, (236 * playerMana) / Math.max(1, playerMaxMana))} height="10" rx="5" fill="url(#player-mana-gradient)" />
          <text x="120" y="10.5" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700">
            {playerMana} / {playerMaxMana}
          </text>
          <text x="0" y="29" fill="rgba(93, 157, 232, 0.9)" fontSize="10" fontWeight="700">
            灵 · 法力
          </text>
        </g>
        <g transform="translate(636, 18)">
          <rect x="0" y="0" width="240" height="22" rx="11" fill="rgba(0, 0, 0, 0.6)" stroke="rgba(232, 151, 93, 0.45)" strokeWidth="1.5" />
          <rect x="2" y="2" width={duel.endless ? 236 : Math.max(0, (236 * duel.monsterHealth) / duel.monster.health)} height="18" rx="9" fill="url(#enemy-health-gradient)" />
          <text x="120" y="15" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">
            {duel.endless ? "∞ / ∞" : `${duel.monsterHealth} / ${duel.monster.health}`}
          </text>
          <text x="240" y="36" textAnchor="end" fill="rgba(232, 151, 93, 0.9)" fontSize="11" fontWeight="700">
            敌 · {duel.monster.name}
          </text>
        </g>
        {/* 回合 */}
        <g transform={`translate(${VIEW_W / 2}, 18)`}>
          <rect x="-46" y="0" width="92" height="22" rx="11" fill="rgba(0, 0, 0, 0.55)" stroke="rgba(242, 223, 170, 0.35)" strokeWidth="1" />
          <text x="0" y="15" textAnchor="middle" fill="rgba(242, 223, 170, 0.95)" fontSize="11" fontWeight="700">
            第 {duel.round} 回合
          </text>
        </g>
      </g>

      <defs>
        <linearGradient id="player-health-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="55%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
        <linearGradient id="enemy-health-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="55%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
        <linearGradient id="player-mana-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>

      {/* ===== 角色左侧蓄力条 ===== */}
      <ChargeBar
        drawPower={drawPower}
        active={aimActive || isDrawing}
        x={34}
        y={160}
      />

      {/* ===== 预计飞行轨迹（虚线） ===== */}
      {aimActive && !isFlying && (
        <TrajectoryPreview
          fromX={BOW_ORIGIN.x}
          fromY={BOW_ORIGIN.y}
          toX={targetX}
          toY={targetY}
          drawPower={drawPower}
          isDrawing={isDrawing}
        />
      )}

      {/* 弓（随瞄准方向转动） */}
      <g transform={`translate(${BOW_ORIGIN.x}, ${BOW_ORIGIN.y})`}>
        <BowDisplay drawPower={drawPower} isDrawing={isDrawing} aimAngle={playerAimAngle} />
      </g>

      {/* ===== 玩家箭矢 ===== */}
      <ArrowProjectile
        fromX={BOW_ORIGIN.x}
        fromY={BOW_ORIGIN.y}
        toX={targetX}
        toY={targetY}
        isFlying={isFlying}
        drawPower={drawPower}
        targetX={ENEMY_X}
        targetY={ENEMY_BODY_Y}
        targetRadius={ENEMY_HIT_RADIUS}
        onComplete={onFlightComplete}
        onHit={onPlayerArrowHit}
        isSpirit={playerArrowSpirit}
      />

      {/* ===== 敌方箭矢 ===== */}
      <ArrowProjectile
        fromX={ENEMY_BOW_ORIGIN.x}
        fromY={ENEMY_BOW_ORIGIN.y}
        toX={enemyTargetX}
        toY={enemyTargetY}
        isFlying={enemyArrowFlying}
        drawPower={enemyDrawPower}
        targetX={PLAYER_X}
        targetY={PLAYER_BODY_Y}
        targetRadius={PLAYER_HIT_RADIUS}
        onComplete={onEnemyFlightComplete}
        onHit={onEnemyArrowHit}
        isEnemy={true}
      />

      {/* ===== 插在身上的箭矢（1 秒后淡出） ===== */}
      {stuckArrows.map((arrow) => (
        <StuckArrow
          key={arrow.id}
          x={arrow.x}
          y={arrow.y}
          angleDeg={arrow.angleDeg}
          isEnemy={arrow.isEnemy}
        />
      ))}

      {/* ===== 伤害数字 ===== */}
      <DamageNumber
        value={lastDamage}
        x={lastHit ? ENEMY_X : ENEMY_X - 40}
        y={ENEMY_BODY_Y - 78}
        isCritical={lastCritical}
        isVisible={showDamage}
      />
      <DamageNumber
        value={enemyLastDamage}
        x={PLAYER_X}
        y={PLAYER_BODY_Y - 78}
        isCritical={enemyLastCritical}
        isVisible={enemyShowDamage}
      />

      {/* 玩家落空提示（坠渊 / 出界 / 掠过） */}
      {missMarker && (
        <text
          key={missMarker.key}
          x={clamp(missMarker.x, 80, VIEW_W - 80)}
          y={clamp(missMarker.y, 60, VIEW_H - 40)}
          textAnchor="middle"
          fill="rgba(243, 239, 228, 0.85)"
          fontSize="15"
          fontWeight="700"
          className="miss-text"
        >
          {missMarker.text}
        </text>
      )}

      {/* 敌方被闪避提示 */}
      {enemyShowDamage && !enemyLastHit && (
        <text
          x={PLAYER_X}
          y={PLAYER_BODY_Y - 66}
          textAnchor="middle"
          fill="rgba(243, 239, 228, 0.75)"
          fontSize="15"
          fontWeight="700"
          className="miss-text"
        >
          侧身避开
        </text>
      )}

      {/* ===== 角色台词气泡（贴头顶弹出） ===== */}
      {dialogue && (
        <SpeechBubble text={dialogue} side="enemy" onDone={onDialogueDone} />
      )}

      {/* ===== 触屏拉弓反馈：锚点、拉弦虚线、指尖圈，颜色随蓄力档位变化 ===== */}
      {touchAim && (
        <g className="touch-aim-indicator" pointerEvents="none">
          <circle
            cx={touchAim.anchorX}
            cy={touchAim.anchorY}
            r="17"
            fill="none"
            stroke={powerTierColor(touchAim.power)}
            strokeWidth="1.6"
            opacity="0.55"
            className="touch-anchor-ring"
          />
          <circle
            cx={touchAim.anchorX}
            cy={touchAim.anchorY}
            r="2.6"
            fill={powerTierColor(touchAim.power)}
            opacity="0.7"
          />
          <line
            x1={touchAim.anchorX}
            y1={touchAim.anchorY}
            x2={touchAim.fingerX}
            y2={touchAim.fingerY}
            stroke={powerTierColor(touchAim.power)}
            strokeWidth="2.2"
            strokeDasharray="3,8"
            strokeLinecap="round"
            opacity={0.3 + touchAim.power * 0.55}
          />
          <circle
            cx={touchAim.fingerX}
            cy={touchAim.fingerY}
            r="7"
            fill="none"
            stroke={powerTierColor(touchAim.power)}
            strokeWidth="2"
            opacity="0.85"
          />
        </g>
      )}

      {/* 触屏玩家首次进入战场的操作提示 */}
      {isCoarsePointer && aimActive && !touchHintSeen && (
        <text
          x="56"
          y="456"
          fill="rgba(243, 239, 228, 0.75)"
          fontSize="14"
          fontWeight="700"
          className="touch-hint"
        >
          按住屏幕 ↙ 拖拽拉弓 · 松手放箭
        </text>
      )}
    </svg>
  );
};
