/** 水墨互动世界地图：14 处地点散布其上，点选标记以展开地点卡片 */

import { getSectById } from "../data/sects";
import {
  WORLD_LOCATIONS,
  type LocationType,
  type MapLocation,
} from "../data/locations";
import type { ElementType } from "../types/game";

interface WorldMapProps {
  currentLocationId: string;
  selectedId: string | null;
  onSelect: (loc: MapLocation) => void;
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
    default:
      return <circle r="7" fill="#c9c2b2" stroke="#39434f" strokeWidth="2" />;
  }
};

const MapMarker = ({
  loc,
  isCurrent,
  isSelected,
  onSelect,
}: {
  loc: MapLocation;
  isCurrent: boolean;
  isSelected: boolean;
  onSelect: (loc: MapLocation) => void;
}) => (
  <g
    className={[
      "map-marker",
      `type-${loc.type}`,
      isCurrent ? "is-current" : "",
      isSelected ? "is-selected" : "",
    ]
      .filter(Boolean)
      .join(" ")}
    transform={`translate(${loc.x}, ${loc.y})`}
    onClick={() => onSelect(loc)}
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
    <text className="map-label" y="32" textAnchor="middle">
      {loc.name}
    </text>
  </g>
);

export const WorldMap = ({
  currentLocationId,
  selectedId,
  onSelect,
}: WorldMapProps) => (
  <div className="world-map-wrap">
    <svg
      className="world-map-svg"
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

      {WORLD_LOCATIONS.map((loc) => (
        <MapMarker
          key={loc.id}
          loc={loc}
          isCurrent={loc.id === currentLocationId}
          isSelected={loc.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </svg>
  </div>
);
