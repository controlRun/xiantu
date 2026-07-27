/** 水墨互动世界地图：路网连线 + 15 处地点散布其上，点选标记展开地点卡片；赶路时小人沿道路行走 */

import {
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
} from "react";
import { getSectById } from "../data/sects";
import { ROUTE_PATHS } from "../data/routes";
import {
  WORLD_LOCATIONS,
  type LocationType,
  type MapLocation,
} from "../data/locations";
import type { ElementType } from "../types/game";

/** 一次赶路动画的描述 */
export interface TravelSpec {
  /** 连续行程路径（SVG path d） */
  d: string;
  /** 动画时长（毫秒） */
  duration: number;
  /** 途经中转地点坐标（不含起终点） */
  junctions: { x: number; y: number }[];
}

interface WorldMapProps {
  currentLocationId: string;
  selectedId: string | null;
  onSelect: (loc: MapLocation) => void;
  /** 赶路中：禁用点选 */
  disabled?: boolean;
  /** 当前赶路动画；为 null 时不渲染行走层 */
  travel?: TravelSpec | null;
  /** 小人抵达终点后的回调 */
  onTravelEnd?: () => void;
  /** 被境界门槛封锁功能的地点（仍可点选查看，标记灰化加锁） */
  lockedIds?: ReadonlySet<string>;
}

/** 五行配色：宗门山门按主修属性着色 */
const ELEMENT_COLORS: Record<ElementType, string> = {
  metal: "#e0b861",
  wood: "#7fae6d",
  water: "#69a9dd",
  fire: "#dd7460",
  earth: "#b8925c",
};

const TYPE_LABEL: Record<LocationType, string> = {
  city: "大城",
  town: "城镇",
  sect: "宗门",
  wild: "野外",
  "spirit-land": "灵地",
  mine: "灵矿",
  arena: "演武场",
  "secret-realm": "秘境",
};

const MarkerShape = ({ loc }: { loc: MapLocation }) => {
  switch (loc.type) {
    case "city":
      return (
        <g className="marker-shape">
          <rect
            x="-10" y="-10" width="20" height="20" rx="2.5"
            fill="#e0b861" stroke="#5c4a22" strokeWidth="2"
          />
          <rect
            x="-4.5" y="-4.5" width="9" height="9"
            fill="none" stroke="#5c4a22" strokeWidth="1.6"
          />
        </g>
      );
    case "town":
      return (
        <g className="marker-shape">
          <circle r="8.5" fill="#d9d2c2" stroke="#4a4436" strokeWidth="2" />
          <circle r="2.6" fill="#4a4436" />
        </g>
      );
    case "sect": {
      const sect = loc.sectId ? getSectById(loc.sectId) : null;
      const color = sect ? ELEMENT_COLORS[sect.element] : "#c9c2b2";
      return (
        <g className="marker-shape">
          <path
            d="M0,-13 L12.5,9 L-12.5,9 Z"
            fill={color}
            stroke="#39434f"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <line
            x1="0" y1="-2" x2="0" y2="9"
            stroke="#f4efe4" strokeWidth="1.8" opacity="0.85"
          />
        </g>
      );
    }
    case "wild":
      return (
        <g className="marker-shape">
          <path
            d="M0,-12 Q11,-3 0,12 Q-11,-3 0,-12 Z"
            fill="#7fae6d" stroke="#3f5233" strokeWidth="1.8"
          />
          <line
            x1="0" y1="-7" x2="0" y2="8"
            stroke="#3f5233" strokeWidth="1.2" opacity="0.7"
          />
        </g>
      );
    case "spirit-land":
      return (
        <g className="marker-shape">
          <circle className="spirit-halo" r="17" fill="url(#map-spirit-glow)" />
          <path
            d="M0,-12 L10,0 L0,12 L-10,0 Z"
            fill="#c3eef5" stroke="#3d7d8c" strokeWidth="1.8" strokeLinejoin="round"
          />
          <circle r="2.4" fill="#3d7d8c" />
        </g>
      );
    case "mine":
      return (
        <g className="marker-shape">
          <line
            x1="-7" y1="10" x2="6" y2="-7"
            stroke="#6b5d49" strokeWidth="3.2" strokeLinecap="round"
          />
          <path
            d="M-3,-9 Q4,-14 11,-6"
            fill="none" stroke="#98a0ab" strokeWidth="3.4" strokeLinecap="round"
          />
        </g>
      );
    case "arena":
      return (
        <g className="marker-shape">
          <circle r="11" fill="#c96a54" stroke="#4a2c22" strokeWidth="2" />
          <circle r="6.5" fill="#e8dcc0" stroke="#4a2c22" strokeWidth="1.4" />
          <circle r="2.4" fill="#4a2c22" />
        </g>
      );
    case "secret-realm":
      return (
        <g className="marker-shape">
          <circle className="secret-halo" r="17" fill="url(#map-secret-glow)" />
          {/* 漩涡门形：两道旋臂环抱虚核 */}
          <path
            d="M0,-11 A11,11 0 0 1 11,0"
            fill="none" stroke="#b78ae0" strokeWidth="2.6" strokeLinecap="round"
          />
          <path
            d="M0,11 A11,11 0 0 1 -11,0"
            fill="none" stroke="#b78ae0" strokeWidth="2.6" strokeLinecap="round"
          />
          <circle r="4.2" fill="#241a33" stroke="#b78ae0" strokeWidth="1.6" />
          <circle r="1.5" fill="#e3ccf7" />
        </g>
      );
    default:
      return <circle r="7" fill="#c9c2b2" stroke="#39434f" strokeWidth="2" />;
  }
};

const MapMarker = ({
  loc,
  isCurrent,
  isSelected,
  disabled,
  locked,
  onSelect,
}: {
  loc: MapLocation;
  isCurrent: boolean;
  isSelected: boolean;
  disabled: boolean;
  locked: boolean;
  onSelect: (loc: MapLocation) => void;
}) => (
  <g
    className={[
      "map-marker",
      `type-${loc.type}`,
      isCurrent ? "is-current" : "",
      isSelected ? "is-selected" : "",
      disabled ? "is-disabled" : "",
      locked ? "is-locked" : "",
    ]
      .filter(Boolean)
      .join(" ")}
    transform={`translate(${loc.x}, ${loc.y})`}
    onClick={() => {
      if (!disabled) onSelect(loc);
    }}
    role="button"
    aria-label={`${loc.name}（${TYPE_LABEL[loc.type]}）`}
  >
    <title>{`${loc.name} · ${TYPE_LABEL[loc.type]}`}</title>
    {/* 隐形命中圆：保证移动端可点性 */}
    <circle className="hit-circle" r="40" fill="transparent" />
    {isCurrent && (
      <g className="player-here" aria-hidden="true">
        <circle className="player-ring" r="16" fill="none" stroke="#7ed8ff" strokeWidth="2" />
        <circle className="player-dot" r="5" fill="#7ed8ff" stroke="#1f3d4d" strokeWidth="1.4" />
      </g>
    )}
    {isSelected && (
      <circle
        className="select-ring"
        r="21"
        fill="none"
        stroke="#e0b861"
        strokeWidth="2"
        strokeDasharray="5 6"
        strokeLinecap="round"
      />
    )}
    <MarkerShape loc={loc} />
    {locked && (
      <g className="lock-badge" aria-hidden="true" transform="translate(13 -13)">
        <circle r="7.5" fill="#20242c" stroke="#8b93a3" strokeWidth="1.4" />
        <rect x="-3" y="-1" width="6" height="5" rx="1" fill="#c9c2b2" />
        <path
          d="M-1.8,-1 L-1.8,-2.6 A1.8,1.8 0 0 1 1.8,-2.6 L1.8,-1"
          fill="none" stroke="#c9c2b2" strokeWidth="1.4"
        />
      </g>
    )}
    <text className="map-label" y="32" textAnchor="middle">
      {loc.name}
    </text>
  </g>
);

/** 赶路动画层：小人沿行程路径行走，金色尾迹、途经脉冲、抵达扩散环 */
const TravelOverlay = ({
  travel,
  onTravelEnd,
}: {
  travel: TravelSpec;
  onTravelEnd: () => void;
}) => {
  const pathRef = useRef<SVGPathElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const figureRef = useRef<SVGGElement>(null);
  const onEndRef = useRef(onTravelEnd);
  const [passed, setPassed] = useState<number[]>([]);
  const [arrived, setArrived] = useState(false);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(
    null,
  );

  useEffect(() => {
    onEndRef.current = onTravelEnd;
  });

  useLayoutEffect(() => {
    const path = pathRef.current;
    const trail = trailRef.current;
    const figure = figureRef.current;
    if (!path || !trail || !figure) return;

    const total = path.getTotalLength();
    const end = path.getPointAtLength(total);
    setEndPoint({ x: end.x, y: end.y });

    // 逐段拼子路径测量，得到各中转点的累计弧长
    const parts = travel.d.trim().split(/(?=[MQ])/);
    const measurer = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    const junctionLengths = travel.junctions.map((_, i) => {
      measurer.setAttribute("d", parts[0] + parts.slice(1, 2 + i).join(""));
      return measurer.getTotalLength();
    });
    const passedFlags = junctionLengths.map(() => false);

    const place = (len: number) => {
      const pt = path.getPointAtLength(len);
      figure.setAttribute(
        "transform",
        `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`,
      );
      trail.setAttribute("stroke-dasharray", `${len} ${total + 12}`);
    };

    let raf = 0;
    let timer: number | undefined;

    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    if (reduceMotion) {
      place(total);
      setArrived(true);
      timer = window.setTimeout(() => onEndRef.current(), 350);
    } else {
      place(0);
      const startAt = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - startAt) / travel.duration, 1);
        const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const len = eased * total;
        place(len);
        junctionLengths.forEach((jl, i) => {
          if (!passedFlags[i] && len >= jl) {
            passedFlags[i] = true;
            setPassed((prev) => [...prev, i]);
          }
        });
        if (p < 1) {
          raf = requestAnimationFrame(tick);
        } else {
          setArrived(true);
          timer = window.setTimeout(() => onEndRef.current(), 650);
        }
      };
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      if (timer !== undefined) window.clearTimeout(timer);
    };
    // travel 各字段在一段行程内保持稳定引用，足以作为依赖
  }, [travel.d, travel.duration, travel.junctions]);

  return (
    <g className="travel-layer" aria-hidden="true">
      {/* 行进路线高亮（供测量与视觉引导） */}
      <path ref={pathRef} className="travel-path" d={travel.d} />
      <path ref={trailRef} className="travel-trail" d={travel.d} />

      {passed.map((i) => (
        <circle
          key={i}
          className="route-node-pulse"
          cx={travel.junctions[i].x}
          cy={travel.junctions[i].y}
          r="9"
        />
      ))}

      {arrived && endPoint && (
        <g
          className="travel-arrive"
          transform={`translate(${endPoint.x} ${endPoint.y})`}
        >
          <circle className="travel-arrive-ring" r="8" />
          <circle className="travel-arrive-ring ring-2" r="8" />
        </g>
      )}

      {/* 赶路人：光晕 + 斗笠行袍 */}
      <g ref={figureRef} className="traveler">
        <circle className="traveler-halo" r="13" fill="url(#traveler-glow)" />
        <g className="traveler-fig">
          <path
            d="M -4 0 Q 0 10 4 0 L 2.6 8.5 Q 0 11 -2.6 8.5 Z"
            fill="#3f5266"
            stroke="#232f3b"
            strokeWidth="1"
          />
          <path
            d="M -6 -0.5 Q 0 -7.5 6 -0.5 Q 0 2.5 -6 -0.5 Z"
            fill="#e6d9b8"
            stroke="#6b5a33"
            strokeWidth="1.1"
          />
          <circle r="1.2" cy="-1.6" fill="#6b5a33" />
        </g>
      </g>
    </g>
  );
};

export const WorldMap = ({
  currentLocationId,
  selectedId,
  onSelect,
  disabled = false,
  travel = null,
  onTravelEnd,
  lockedIds,
}: WorldMapProps) => (
  <div className="world-map-wrap">
    <svg
      className={`world-map-svg${disabled ? " is-traveling" : ""}`}
      viewBox="0 0 900 480"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="仙途世界地图"
    >
      <defs>
        <radialGradient id="map-spirit-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(126, 216, 255, 0.5)" />
          <stop offset="70%" stopColor="rgba(126, 216, 255, 0.12)" />
          <stop offset="100%" stopColor="rgba(126, 216, 255, 0)" />
        </radialGradient>
        <radialGradient id="map-secret-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(183, 138, 224, 0.5)" />
          <stop offset="70%" stopColor="rgba(183, 138, 224, 0.12)" />
          <stop offset="100%" stopColor="rgba(183, 138, 224, 0)" />
        </radialGradient>
        <radialGradient id="traveler-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(232, 196, 93, 0.55)" />
          <stop offset="65%" stopColor="rgba(232, 196, 93, 0.16)" />
          <stop offset="100%" stopColor="rgba(232, 196, 93, 0)" />
        </radialGradient>
      </defs>

      {/* 水墨底纹：远山、水泽、雾带与题字 */}
      <g className="map-ink-bg" aria-hidden="true">
        <path
          d="M0,430 Q110,330 240,392 Q340,436 460,378 Q590,318 700,392 Q800,452 900,360 L900,480 L0,480 Z"
          fill="#2c3a48"
          opacity="0.12"
        />
        <path
          d="M0,96 Q150,30 310,92 Q430,138 570,76 Q720,16 900,108 L900,0 L0,0 Z"
          fill="#2c3a48"
          opacity="0.08"
        />
        <path
          d="M120,260 Q220,200 340,246 Q430,282 520,250"
          fill="none"
          stroke="#2c3a48"
          strokeWidth="2.5"
          opacity="0.07"
          strokeLinecap="round"
        />
        <ellipse cx="818" cy="310" rx="112" ry="152" fill="#5f9fd6" opacity="0.07" />
        <ellipse cx="450" cy="246" rx="330" ry="56" fill="#e8eef4" opacity="0.05" />
        <ellipse cx="170" cy="150" rx="120" ry="34" fill="#e8eef4" opacity="0.05" />
        <text x="748" y="58" className="map-title-text">九天山川</text>
        <text x="74" y="452" className="map-title-text map-title-sub">云深不知处</text>
      </g>

      {/* 路网：与当前地点相连的道路高亮 */}
      <g className="map-routes" aria-hidden="true">
        {ROUTE_PATHS.map((route) => (
          <path
            key={route.key}
            className={`map-route${
              route.a === currentLocationId || route.b === currentLocationId
                ? " is-active"
                : ""
            }`}
            d={route.d}
          />
        ))}
      </g>

      {WORLD_LOCATIONS.map((loc) => (
        <MapMarker
          key={loc.id}
          loc={loc}
          isCurrent={loc.id === currentLocationId}
          isSelected={loc.id === selectedId}
          disabled={disabled}
          locked={lockedIds?.has(loc.id) ?? false}
          onSelect={onSelect}
        />
      ))}

      {travel && onTravelEnd && (
        <TravelOverlay travel={travel} onTravelEnd={onTravelEnd} />
      )}
    </svg>
  </div>
);
