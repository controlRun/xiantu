import { useEffect, useRef, useState } from "react";
import {
  ENEMY_BODY_Y,
  ENEMY_X,
  PLAYER_BODY_Y,
  PLAYER_X,
} from "./battleLayout";

interface SpeechBubbleProps {
  text: string;
  /** 说话者 —— 气泡贴着该角色头顶弹出 */
  side: "player" | "enemy";
  onDone?: () => void;
}

const FONT_SIZE = 14;
const LINE_HEIGHT = 21;
const MAX_CHARS_PER_LINE = 11;
const PAD_X = 15;
const LIFETIME = 2600; // ms：弹出 → 停留 → 淡出

/** 将台词拆成均衡的 1~2 行 */
const wrapText = (text: string): string[] => {
  if (text.length <= MAX_CHARS_PER_LINE) {
    return [text];
  }
  const cut = Math.ceil(text.length / 2);
  return [text.slice(0, cut), text.slice(cut)];
};

/**
 * 战场内漫画气泡：紧贴说话者头顶弹出，
 * 弧线小尾指向角色，2.6 秒内完成弹出-停留-淡出的完整生命周期。
 */
export const SpeechBubble = ({ text, side, onDone }: SpeechBubbleProps) => {
  const [nonce, setNonce] = useState(0);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // 每次新台词都重启气泡动画；到点自动收掉
  useEffect(() => {
    setNonce((n) => n + 1);
    const timer = window.setTimeout(() => onDoneRef.current?.(), LIFETIME);
    return () => clearTimeout(timer);
  }, [text]);

  const lines = wrapText(text);
  const width = Math.max(...lines.map((l) => l.length)) * (FONT_SIZE + 0.6) + PAD_X * 2;
  const height = lines.length * LINE_HEIGHT + 14;

  const isEnemy = side === "enemy";
  const accent = isEnemy ? "rgba(232, 151, 93, 0.85)" : "rgba(114, 192, 140, 0.85)";
  const fill = "rgba(22, 18, 14, 0.93)";

  // 气泡尾尖 —— 指向说话者头顶
  const tipX = isEnemy ? ENEMY_X - 14 : PLAYER_X + 14;
  const tipY = (isEnemy ? ENEMY_BODY_Y : PLAYER_BODY_Y) - 58;

  // 气泡主体在尾尖的左上（敌方）或右上（我方）
  const rectX = isEnemy ? tipX - 10 - width : tipX + 10;
  const rectY = tipY - 24 - height;
  const rectBottom = rectY + height;

  // 小尾基部贴住气泡底边，弧线下探到角色头顶
  const tailBaseNear = isEnemy ? rectX + width - 34 : rectX + 16;
  const tailBaseFar = isEnemy ? rectX + width - 12 : rectX + 38;
  const tailCurve = isEnemy ? 10 : -10;

  return (
    <g key={nonce} pointerEvents="none">
      <g
        className="speech-bubble-pop"
        style={{ transformOrigin: `${tipX}px ${tipY}px` }}
      >
        {/* 气泡主体 */}
        <rect
          x={rectX}
          y={rectY}
          width={width}
          height={height}
          rx="10"
          fill={fill}
          stroke={accent}
          strokeWidth="1.6"
          style={{ filter: "drop-shadow(0 3px 8px rgba(0, 0, 0, 0.45))" }}
        />

        {/* 小尾填充（盖住接缝处的边框） */}
        <polygon
          points={`${tailBaseNear},${rectBottom - 1.5} ${tailBaseFar},${rectBottom - 1.5} ${tipX},${tipY}`}
          fill={fill}
        />
        {/* 小尾弧线描边 */}
        <path
          d={`M ${tailBaseNear} ${rectBottom} Q ${tailBaseNear + tailCurve} ${rectBottom + 14} ${tipX} ${tipY}`}
          fill="none"
          stroke={accent}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d={`M ${tailBaseFar} ${rectBottom} Q ${tailBaseFar + tailCurve} ${rectBottom + 10} ${tipX} ${tipY}`}
          fill="none"
          stroke={accent}
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        {/* 说话者印记 */}
        <circle
          cx={isEnemy ? rectX + width - 2 : rectX + 2}
          cy={rectY + 2}
          r="5.5"
          fill={accent}
          opacity="0.9"
        />
        <text
          x={isEnemy ? rectX + width - 2 : rectX + 2}
          y={rectY + 5}
          textAnchor="middle"
          fontSize="8"
          fontWeight="700"
          fill="rgba(20, 16, 12, 1)"
        >
          {isEnemy ? "敌" : "我"}
        </text>

        {/* 台词 */}
        {lines.map((line, index) => (
          <text
            key={index}
            x={rectX + width / 2}
            y={rectY + 21 + index * LINE_HEIGHT}
            textAnchor="middle"
            fontSize={FONT_SIZE}
            fontWeight="600"
            fill="#f2dfaa"
          >
            {line}
          </text>
        ))}
      </g>
    </g>
  );
};
