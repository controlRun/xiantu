/**
 * 采矿时机小游戏：指针在时机条上往复穿梭，档位越靠右速度越快（逐档翻倍）。
 * 按下「开始采矿」停住指针 → 落点档位决定本次灵石倍率。
 * 档位不等宽：×0 加长抬难、×1.5 缩短；倍率、宽度与速度放本组件。
 * 系统侧 mineOnce 仅收 quality 参数，取消不结算。
 */
import { useEffect, useRef, useState } from "react";
import { playCue } from "../utils/audioSystem";

interface MineTimingOverlayProps {
  locName: string;
  onSettle: (quality: number) => void;
  onCancel: () => void;
}

interface ZoneSpec {
  quality: number;
  label: string;
  /** 档位占条宽比例（0..1，可不等宽） */
  width: number;
  /** 指针在本档的相对速度：×0 最慢，逐档翻倍至 ×1.5 最快 */
  speedMult: number;
}

/** 档位从左到右：×0 加长、×1.5 缩短，越靠右越快越难 */
const ZONES: ZoneSpec[] = [
  { quality: 0, label: "×0", width: 0.38, speedMult: 1 },
  { quality: 1, label: "×1.0", width: 0.26, speedMult: 2 },
  { quality: 1.25, label: "×1.25", width: 0.22, speedMult: 4 },
  { quality: 1.5, label: "×1.5", width: 0.14, speedMult: 8 },
];

/** 各档累计偏移：供渲染定位与落点判定 */
const LAYOUT = ZONES.reduce<Array<ZoneSpec & { left: number; right: number }>>(
  (acc, zone) => {
    const left = acc.length === 0 ? 0 : acc[acc.length - 1].right;
    acc.push({ ...zone, left, right: left + zone.width });
    return acc;
  },
  [],
);

/** 基准速度（条宽/毫秒）：×0 档（speedMult=1）单程 / ONE_WAY_MS */
const ONE_WAY_MS = 2400;
const SPEED_BASE = 1 / ONE_WAY_MS;

const findZone = (pos: number) => {
  const clamped = Math.min(Math.max(pos, 0), 0.999999);
  return LAYOUT.findIndex(
    (zone) => clamped >= zone.left && clamped < zone.right,
  );
};

export const MineTimingOverlay = ({
  locName,
  onSettle,
  onCancel,
}: MineTimingOverlayProps) => {
  const needleRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0.5);
  const dirRef = useRef(1);
  const lastRef = useRef(0);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let raf = 0;
    lastRef.current = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - lastRef.current);
      lastRef.current = now;
      const zone = LAYOUT[Math.max(0, findZone(posRef.current))];
      const speed = zone.speedMult * SPEED_BASE * dt;
      let next = posRef.current + dirRef.current * speed;
      if (next >= 1) {
        next = 1;
        dirRef.current = -1;
      } else if (next <= 0) {
        next = 0;
        dirRef.current = 1;
      }
      posRef.current = next;
      if (needleRef.current) {
        needleRef.current.style.left = `${next * 100}%`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const stop = () => {
    if (settled) return;
    setSettled(true);
    playCue("uiConfirm");
    const zone = LAYOUT[Math.max(0, findZone(posRef.current))];
    onSettle(zone.quality);
  };

  return (
    <div
      className="bt-dialog-mask"
      role="dialog"
      aria-modal="true"
      aria-label="采掘时机"
      onClick={onCancel}
    >
      <div
        className="bt-dialog-card mine-timing"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="bt-dialog-title">采掘时机</h3>
        <p className="mine-timing-hint">
          于「{locName}」俯身探矿。指针在时机条上往复穿梭，档位越靠右去势越疾——
          ×0 空手而归，看准档位，按下「开始采矿」落定。
        </p>

        <div className="mine-timing-track">
          {LAYOUT.map((zone) => (
            <span
              key={zone.quality}
              className="mine-timing-zone"
              style={{
                left: `${zone.left * 100}%`,
                width: `${zone.width * 100}%`,
              }}
            >
              {zone.label}
            </span>
          ))}
          <div className="mine-timing-needle" ref={needleRef} />
        </div>

        <div className="mine-timing-actions">
          <button
            type="button"
            className="secondary mine-cancel-btn"
            onClick={onCancel}
            disabled={settled}
          >
            收手不采
          </button>
          <button
            type="button"
            className="mine-settle-btn"
            onClick={stop}
            disabled={settled}
          >
            开始采矿
          </button>
        </div>
      </div>
    </div>
  );
};
