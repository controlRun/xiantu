import type { BattleBackgroundId } from "../../types/game";
import { VIEW_H, VIEW_W } from "./battleLayout";

/**
 * 对战背景库：沙漠、竹林、悬崖、水上、屋顶、宫墙。
 * 每幅场景自含天幕、中景剪影与脚下暗域（箭矢力竭时没入其中），
 * 开战时由 battleSystem 随机选取一幅，整场战斗保持不变。
 * 渐变 id 均带场景前缀，避免同页 SVG 引用冲突。
 */

interface BattleBackgroundProps {
  scene: BattleBackgroundId;
}

const StarField = ({
  tint = "rgba(242, 223, 170, 0.9)",
  opacity = 0.5,
}: {
  tint?: string;
  opacity?: number;
}) => (
  <g opacity={opacity}>
    <circle cx="120" cy="60" r="1.4" fill={tint}>
      <animate attributeName="opacity" values="0.2;1;0.2" dur="3.2s" repeatCount="indefinite" />
    </circle>
    <circle cx="262" cy="118" r="1" fill={tint}>
      <animate attributeName="opacity" values="0.5;1;0.5" dur="4.1s" repeatCount="indefinite" />
    </circle>
    <circle cx="520" cy="58" r="1.2" fill={tint}>
      <animate attributeName="opacity" values="0.3;0.9;0.3" dur="3.6s" repeatCount="indefinite" />
    </circle>
    <circle cx="806" cy="96" r="1" fill={tint}>
      <animate attributeName="opacity" values="0.4;1;0.4" dur="2.9s" repeatCount="indefinite" />
    </circle>
    <circle cx="366" cy="42" r="1" fill={tint}>
      <animate attributeName="opacity" values="0.25;0.85;0.25" dur="4.6s" repeatCount="indefinite" />
    </circle>
  </g>
);

/** 脚下暗域：站台之下，箭矢力竭坠入处 */
const FloorFade = ({ id }: { id: string }) => (
  <rect x="0" y="312" width={VIEW_W} height={VIEW_H - 312} fill={`url(#${id})`} />
);

/* ============================ 沙漠 ============================ */
const DesertScene = () => (
  <g>
    <defs>
      <linearGradient id="bg-desert-sky" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#1a1326" />
        <stop offset="42%" stopColor="#3a2436" />
        <stop offset="72%" stopColor="#7a4030" />
        <stop offset="100%" stopColor="#98582f" />
      </linearGradient>
      <radialGradient id="bg-desert-sun">
        <stop offset="0%" stopColor="rgba(255, 206, 130, 0.9)" />
        <stop offset="45%" stopColor="rgba(240, 150, 90, 0.32)" />
        <stop offset="100%" stopColor="rgba(240, 150, 90, 0)" />
      </radialGradient>
      <linearGradient id="bg-desert-floor" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="rgba(48, 30, 20, 0)" />
        <stop offset="45%" stopColor="rgba(26, 16, 11, 0.85)" />
        <stop offset="100%" stopColor="rgba(5, 3, 2, 0.98)" />
      </linearGradient>
    </defs>

    <rect width={VIEW_W} height={VIEW_H} fill="url(#bg-desert-sky)" />

    {/* 大漠落日 */}
    <circle cx="640" cy="192" r="92" fill="url(#bg-desert-sun)" />
    <circle cx="640" cy="192" r="34" fill="rgba(255, 218, 152, 0.85)" />
    <StarField tint="rgba(242, 223, 170, 0.8)" opacity={0.35} />

    {/* 远沙丘 */}
    <path
      d="M 0 292 Q 150 244 300 282 Q 460 320 620 268 Q 760 230 900 284 L 900 360 L 0 360 Z"
      fill="rgba(102, 62, 44, 0.55)"
    />
    {/* 近沙丘 */}
    <path
      d="M 0 332 Q 180 292 360 322 Q 540 352 720 304 Q 812 282 900 316 L 900 420 L 0 420 Z"
      fill="rgba(66, 40, 29, 0.82)"
    />

    {/* 风卷飞沙 */}
    <g stroke="rgba(232, 199, 150, 0.3)" strokeWidth="1.2" strokeLinecap="round">
      <line x1="130" y1="252" x2="196" y2="246">
        <animate attributeName="opacity" values="0;0.8;0" dur="3.4s" repeatCount="indefinite" />
      </line>
      <line x1="420" y1="300" x2="498" y2="294">
        <animate attributeName="opacity" values="0;0.7;0" dur="4.2s" begin="0.8s" repeatCount="indefinite" />
      </line>
      <line x1="700" y1="332" x2="772" y2="326">
        <animate attributeName="opacity" values="0;0.75;0" dur="3.8s" begin="1.6s" repeatCount="indefinite" />
      </line>
    </g>

    <FloorFade id="bg-desert-floor" />
  </g>
);

/* ============================ 竹林 ============================ */
const BambooStalk = ({
  x,
  top,
  slant,
  opacity,
  width = 7,
}: {
  x: number;
  top: number;
  slant: number;
  opacity: number;
  width?: number;
}) => (
  <g opacity={opacity}>
    <path
      d={`M ${x} ${VIEW_H + 10} L ${x + slant} ${top}`}
      stroke="#1f3d2e"
      strokeWidth={width}
      strokeLinecap="round"
    />
    {/* 竹节 */}
    {[0.25, 0.45, 0.65, 0.82].map((ratio) => {
      const y = VIEW_H - (VIEW_H - top) * ratio;
      const nx = x + slant * ratio;
      return (
        <line
          key={ratio}
          x1={nx - width * 0.75}
          y1={y}
          x2={nx + width * 0.75}
          y2={y}
          stroke="#0e2118"
          strokeWidth="2"
        />
      );
    })}
    {/* 梢头竹叶 */}
    <g stroke="#28503c" strokeWidth="2.4" strokeLinecap="round" fill="none">
      <path d={`M ${x + slant} ${top} q -16 -6 -26 -2`} />
      <path d={`M ${x + slant} ${top + 6} q 16 -10 28 -8`} />
      <path d={`M ${x + slant} ${top + 14} q -14 4 -24 12`} />
    </g>
  </g>
);

const BambooScene = () => (
  <g>
    <defs>
      <linearGradient id="bg-bamboo-sky" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#0b1a15" />
        <stop offset="55%" stopColor="#122a20" />
        <stop offset="100%" stopColor="#0a1712" />
      </linearGradient>
      <radialGradient id="bg-bamboo-moon">
        <stop offset="0%" stopColor="rgba(214, 240, 214, 0.3)" />
        <stop offset="60%" stopColor="rgba(214, 240, 214, 0.07)" />
        <stop offset="100%" stopColor="rgba(214, 240, 214, 0)" />
      </radialGradient>
      <linearGradient id="bg-bamboo-floor" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="rgba(8, 18, 13, 0)" />
        <stop offset="45%" stopColor="rgba(6, 13, 10, 0.85)" />
        <stop offset="100%" stopColor="rgba(1, 4, 3, 0.98)" />
      </linearGradient>
    </defs>

    <rect width={VIEW_W} height={VIEW_H} fill="url(#bg-bamboo-sky)" />

    {/* 雾中淡月 */}
    <circle cx="450" cy="86" r="78" fill="url(#bg-bamboo-moon)" />
    <circle cx="450" cy="86" r="20" fill="rgba(220, 240, 220, 0.55)" />

    {/* 远竹（淡） */}
    <BambooStalk x={70} top={96} slant={10} opacity={0.35} width={5} />
    <BambooStalk x={210} top={60} slant={-8} opacity={0.35} width={5} />
    <BambooStalk x={452} top={110} slant={6} opacity={0.3} width={4} />
    <BambooStalk x={668} top={70} slant={-10} opacity={0.35} width={5} />
    <BambooStalk x={846} top={92} slant={8} opacity={0.3} width={5} />
    {/* 近竹（浓） */}
    <BambooStalk x={26} top={40} slant={14} opacity={0.85} width={9} />
    <BambooStalk x={150} top={76} slant={-12} opacity={0.7} width={7} />
    <BambooStalk x={742} top={52} slant={12} opacity={0.8} width={8} />
    <BambooStalk x={884} top={34} slant={-14} opacity={0.85} width={9} />

    {/* 流萤 */}
    <g>
      <circle cx="300" cy="220" r="1.8" fill="#d8e6a0">
        <animate attributeName="opacity" values="0;0.9;0" dur="3.1s" repeatCount="indefinite" />
        <animate attributeName="cy" values="224;206;224" dur="3.1s" repeatCount="indefinite" />
      </circle>
      <circle cx="560" cy="260" r="1.5" fill="#d8e6a0">
        <animate attributeName="opacity" values="0;0.8;0" dur="4s" begin="1s" repeatCount="indefinite" />
        <animate attributeName="cy" values="262;246;262" dur="4s" begin="1s" repeatCount="indefinite" />
      </circle>
      <circle cx="160" cy="300" r="1.4" fill="#cfe0a4">
        <animate attributeName="opacity" values="0;0.75;0" dur="3.6s" begin="1.8s" repeatCount="indefinite" />
      </circle>
    </g>

    {/* 林间薄雾 */}
    <ellipse className="mist-band mist-band-a" cx="320" cy="330" rx="260" ry="14" fill="rgba(150, 190, 160, 0.1)" />
    <ellipse className="mist-band mist-band-b" cx="660" cy="352" rx="240" ry="16" fill="rgba(140, 180, 150, 0.09)" />

    <FloorFade id="bg-bamboo-floor" />
  </g>
);

/* ============================ 悬崖 ============================ */
const CliffScene = () => (
  <g>
    <defs>
      <linearGradient id="bg-cliff-sky" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#101826" />
        <stop offset="45%" stopColor="#16222f" />
        <stop offset="78%" stopColor="#0b111b" />
        <stop offset="100%" stopColor="#05070c" />
      </linearGradient>
      <radialGradient id="bg-cliff-moon">
        <stop offset="0%" stopColor="rgba(242, 223, 170, 0.28)" />
        <stop offset="55%" stopColor="rgba(242, 223, 170, 0.08)" />
        <stop offset="100%" stopColor="rgba(242, 223, 170, 0)" />
      </radialGradient>
      <linearGradient id="bg-cliff-floor" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="rgba(6, 9, 15, 0)" />
        <stop offset="40%" stopColor="rgba(4, 6, 11, 0.85)" />
        <stop offset="100%" stopColor="rgba(0, 0, 0, 0.98)" />
      </linearGradient>
      <radialGradient id="bg-cliff-heart">
        <stop offset="0%" stopColor="rgba(120, 40, 50, 0.35)" />
        <stop offset="100%" stopColor="rgba(120, 40, 50, 0)" />
      </radialGradient>
    </defs>

    <rect width={VIEW_W} height={VIEW_H} fill="url(#bg-cliff-sky)" />

    {/* 残月与星尘 */}
    <circle cx="450" cy="86" r="74" fill="url(#bg-cliff-moon)" />
    <circle cx="450" cy="86" r="22" fill="rgba(242, 223, 170, 0.85)" />
    <circle cx="443" cy="80" r="22" fill="#141c2a" opacity="0.9" />
    <StarField />

    {/* 远峰如剑 */}
    <path
      d="M 0 300 L 70 208 L 140 262 L 230 176 L 320 252 L 420 196 L 500 254 L 600 186 L 700 250 L 790 206 L 900 282 L 900 340 L 0 340 Z"
      fill="rgba(22, 32, 46, 0.6)"
    />
    {/* 近崖 */}
    <path
      d="M 0 326 L 110 252 L 200 300 L 330 240 L 460 296 L 590 246 L 720 298 L 830 262 L 900 308 L 900 360 L 0 360 Z"
      fill="rgba(13, 20, 32, 0.8)"
    />
    {/* 峰顶孤松剪影 */}
    <g fill="rgba(10, 18, 26, 0.9)">
      <path d="M 228 176 l -10 14 l 6 0 l -9 12 l 26 0 l -9 -12 l 6 0 Z" />
      <path d="M 600 186 l -8 12 l 5 0 l -8 10 l 22 0 l -8 -10 l 5 0 Z" />
    </g>

    {/* 山腰流云 */}
    <g fill="rgba(140, 160, 185, 0.14)">
      <ellipse cx="240" cy="286" rx="120" ry="10">
        <animate attributeName="cx" values="240;300;240" dur="14s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="640" cy="272" rx="140" ry="11">
        <animate attributeName="cx" values="640;580;640" dur="17s" repeatCount="indefinite" />
      </ellipse>
    </g>

    {/* 深渊 */}
    <FloorFade id="bg-cliff-floor" />
    <ellipse cx="450" cy="470" rx="300" ry="46" fill="url(#bg-cliff-heart)">
      <animate attributeName="opacity" values="0.5;1;0.5" dur="4.5s" repeatCount="indefinite" />
    </ellipse>
    <g className="abyss-mist" opacity="0.5">
      <ellipse className="mist-band mist-band-a" cx="250" cy="430" rx="220" ry="16" fill="rgba(120, 140, 160, 0.14)" />
      <ellipse className="mist-band mist-band-b" cx="650" cy="452" rx="260" ry="18" fill="rgba(110, 130, 150, 0.12)" />
    </g>
    {/* 谷底幽光 */}
    <g opacity="0.6">
      <circle cx="380" cy="440" r="1.6" fill="#8fb3c9">
        <animate attributeName="cy" values="450;396" dur="5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0.8;0" dur="5s" repeatCount="indefinite" />
      </circle>
      <circle cx="520" cy="452" r="1.3" fill="#8fb3c9">
        <animate attributeName="cy" values="456;404" dur="6.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0.7;0" dur="6.4s" repeatCount="indefinite" />
      </circle>
    </g>
  </g>
);

/* ============================ 水上 ============================ */
const WaterScene = () => (
  <g>
    <defs>
      <linearGradient id="bg-water-sky" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#0c1322" />
        <stop offset="60%" stopColor="#152540" />
        <stop offset="100%" stopColor="#1a2c48" />
      </linearGradient>
      <linearGradient id="bg-water-lake" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#16283f" />
        <stop offset="35%" stopColor="#0c1a2c" />
        <stop offset="100%" stopColor="#03060b" />
      </linearGradient>
      <radialGradient id="bg-water-moon">
        <stop offset="0%" stopColor="rgba(226, 234, 246, 0.34)" />
        <stop offset="55%" stopColor="rgba(226, 234, 246, 0.1)" />
        <stop offset="100%" stopColor="rgba(226, 234, 246, 0)" />
      </radialGradient>
    </defs>

    <rect width={VIEW_W} height="322" fill="url(#bg-water-sky)" />

    {/* 满月 */}
    <circle cx="680" cy="84" r="70" fill="url(#bg-water-moon)" />
    <circle cx="680" cy="84" r="24" fill="rgba(236, 242, 250, 0.88)" />
    <StarField tint="rgba(220, 232, 248, 0.85)" opacity={0.45} />

    {/* 远岸横影 */}
    <path
      d="M 0 300 Q 220 288 450 296 Q 680 302 900 292 L 900 322 L 0 322 Z"
      fill="rgba(10, 18, 30, 0.7)"
    />

    {/* 湖面 */}
    <rect x="0" y="318" width={VIEW_W} height={VIEW_H - 318} fill="url(#bg-water-lake)" />

    {/* 水中月影（碎光） */}
    <g fill="rgba(220, 232, 246, 0.5)">
      <rect x="668" y="330" width="24" height="2.2" rx="1">
        <animate attributeName="opacity" values="0.15;0.6;0.15" dur="2.8s" repeatCount="indefinite" />
      </rect>
      <rect x="674" y="348" width="14" height="2" rx="1">
        <animate attributeName="opacity" values="0.5;0.1;0.5" dur="3.4s" repeatCount="indefinite" />
      </rect>
      <rect x="664" y="368" width="30" height="2.2" rx="1">
        <animate attributeName="opacity" values="0.1;0.5;0.1" dur="4s" repeatCount="indefinite" />
      </rect>
      <rect x="676" y="392" width="12" height="2" rx="1">
        <animate attributeName="opacity" values="0.45;0.08;0.45" dur="3s" repeatCount="indefinite" />
      </rect>
    </g>

    {/* 涟漪 */}
    <g fill="none" stroke="rgba(150, 180, 210, 0.18)" strokeWidth="1.4">
      <ellipse cx="260" cy="372" rx="66" ry="7">
        <animate attributeName="opacity" values="0.1;0.5;0.1" dur="4.4s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="520" cy="416" rx="84" ry="8">
        <animate attributeName="opacity" values="0.4;0.08;0.4" dur="5.2s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="120" cy="440" rx="70" ry="7">
        <animate attributeName="opacity" values="0.08;0.4;0.08" dur="4.8s" begin="0.9s" repeatCount="indefinite" />
      </ellipse>
    </g>

    {/* 残荷剪影 */}
    <g fill="rgba(8, 16, 24, 0.85)">
      <path d="M 168 336 q -22 -12 -44 -2 q 24 10 44 2 Z" />
      <path d="M 172 336 q 4 -22 -8 -34" fill="none" stroke="rgba(8, 16, 24, 0.85)" strokeWidth="2" />
      <path d="M 790 352 q 24 -10 46 2 q -24 8 -46 -2 Z" />
    </g>
  </g>
);

/* ============================ 屋顶 ============================ */
const RooftopScene = () => (
  <g>
    <defs>
      <linearGradient id="bg-roof-sky" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#120e1e" />
        <stop offset="55%" stopColor="#221832" />
        <stop offset="100%" stopColor="#171024" />
      </linearGradient>
      <linearGradient id="bg-roof-tiles" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#2e2a3a" />
        <stop offset="100%" stopColor="#161220" />
      </linearGradient>
      <radialGradient id="bg-roof-lantern">
        <stop offset="0%" stopColor="rgba(240, 120, 90, 0.55)" />
        <stop offset="100%" stopColor="rgba(240, 120, 90, 0)" />
      </radialGradient>
      <linearGradient id="bg-roof-floor" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="rgba(10, 8, 16, 0)" />
        <stop offset="45%" stopColor="rgba(8, 6, 13, 0.88)" />
        <stop offset="100%" stopColor="rgba(2, 1, 4, 0.98)" />
      </linearGradient>
    </defs>

    <rect width={VIEW_W} height={VIEW_H} fill="url(#bg-roof-sky)" />

    {/* 弯月 */}
    <circle cx="180" cy="76" r="18" fill="rgba(240, 232, 206, 0.8)" />
    <circle cx="187" cy="71" r="17" fill="#191230" />
    <StarField tint="rgba(232, 224, 246, 0.85)" opacity={0.5} />

    {/* 远处坊市轮廓（几扇未熄的窗） */}
    <g fill="rgba(16, 13, 26, 0.9)">
      <rect x="40" y="266" width="70" height="56" />
      <rect x="128" y="282" width="52" height="40" />
      <rect x="700" y="272" width="66" height="50" />
      <rect x="782" y="256" width="58" height="66" />
      <rect x="852" y="284" width="40" height="38" />
    </g>
    <g fill="rgba(240, 190, 110, 0.65)">
      <rect x="66" y="284" width="7" height="9">
        <animate attributeName="opacity" values="0.35;0.8;0.35" dur="3.6s" repeatCount="indefinite" />
      </rect>
      <rect x="800" y="276" width="7" height="9">
        <animate attributeName="opacity" values="0.7;0.3;0.7" dur="4.2s" repeatCount="indefinite" />
      </rect>
    </g>

    {/* 大殿飞檐屋脊 */}
    <path
      d="M 60 318 Q 250 240 450 232 Q 650 240 840 318 L 858 306 Q 652 222 450 214 Q 248 222 42 306 Z"
      fill="url(#bg-roof-tiles)"
      stroke="rgba(120, 108, 150, 0.5)"
      strokeWidth="1.5"
    />
    {/* 瓦垄 */}
    <g stroke="rgba(84, 74, 110, 0.4)" strokeWidth="1.2" fill="none">
      <path d="M 120 300 Q 280 252 450 246" />
      <path d="M 450 246 Q 620 252 780 300" />
      <path d="M 180 288 Q 320 258 450 254" />
      <path d="M 450 254 Q 580 258 720 288" />
    </g>
    {/* 翘角 */}
    <path d="M 60 318 q -18 -2 -26 -16 q 14 2 22 -2 Z" fill="#241f32" stroke="rgba(120, 108, 150, 0.5)" strokeWidth="1" />
    <path d="M 840 318 q 18 -2 26 -16 q -14 2 -22 -2 Z" fill="#241f32" stroke="rgba(120, 108, 150, 0.5)" strokeWidth="1" />
    {/* 脊兽点缀 */}
    <circle cx="450" cy="212" r="4" fill="rgba(150, 136, 180, 0.7)" />

    {/* 檐下灯笼 */}
    <g>
      <circle cx="250" cy="296" r="26" fill="url(#bg-roof-lantern)">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="3.2s" repeatCount="indefinite" />
      </circle>
      <line x1="250" y1="268" x2="250" y2="284" stroke="rgba(60, 40, 30, 0.8)" strokeWidth="1.5" />
      <rect x="242" y="284" width="16" height="20" rx="7" fill="rgba(214, 84, 60, 0.9)" stroke="rgba(240, 190, 110, 0.7)" strokeWidth="1" />
      <circle cx="650" cy="296" r="26" fill="url(#bg-roof-lantern)">
        <animate attributeName="opacity" values="1;0.6;1" dur="3.2s" repeatCount="indefinite" />
      </circle>
      <line x1="650" y1="268" x2="650" y2="284" stroke="rgba(60, 40, 30, 0.8)" strokeWidth="1.5" />
      <rect x="642" y="284" width="16" height="20" rx="7" fill="rgba(214, 84, 60, 0.9)" stroke="rgba(240, 190, 110, 0.7)" strokeWidth="1" />
    </g>

    <FloorFade id="bg-roof-floor" />
  </g>
);

/* ============================ 宫墙 ============================ */
const PalaceScene = () => (
  <g>
    <defs>
      <linearGradient id="bg-palace-sky" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#0d1520" />
        <stop offset="60%" stopColor="#142230" />
        <stop offset="100%" stopColor="#0f1a26" />
      </linearGradient>
      <linearGradient id="bg-palace-wall" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#612822" />
        <stop offset="55%" stopColor="#481d18" />
        <stop offset="100%" stopColor="#2c1210" />
      </linearGradient>
      <linearGradient id="bg-palace-glaze" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#5a4a22" />
        <stop offset="100%" stopColor="#322812" />
      </linearGradient>
      <radialGradient id="bg-palace-lantern">
        <stop offset="0%" stopColor="rgba(246, 176, 96, 0.5)" />
        <stop offset="100%" stopColor="rgba(246, 176, 96, 0)" />
      </radialGradient>
      <linearGradient id="bg-palace-floor" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="rgba(14, 10, 9, 0)" />
        <stop offset="45%" stopColor="rgba(10, 7, 6, 0.88)" />
        <stop offset="100%" stopColor="rgba(2, 1, 1, 0.98)" />
      </linearGradient>
    </defs>

    <rect width={VIEW_W} height="230" fill="url(#bg-palace-sky)" />

    {/* 月挂宫阙之上 */}
    <circle cx="760" cy="70" r="16" fill="rgba(240, 232, 206, 0.82)" />
    <circle cx="754" cy="66" r="15" fill="#101a26" />
    <StarField tint="rgba(226, 234, 246, 0.8)" opacity={0.4} />

    {/* 琉璃瓦顶 */}
    <path
      d="M 0 226 L 60 196 Q 450 168 840 196 L 900 226 Z"
      fill="url(#bg-palace-glaze)"
      stroke="rgba(214, 186, 110, 0.55)"
      strokeWidth="1.5"
    />
    {/* 瓦垄与檐口 */}
    <g stroke="rgba(122, 100, 48, 0.5)" strokeWidth="1">
      <line x1="150" y1="200" x2="146" y2="222" />
      <line x1="300" y1="190" x2="298" y2="222" />
      <line x1="450" y1="186" x2="450" y2="222" />
      <line x1="600" y1="190" x2="602" y2="222" />
      <line x1="750" y1="200" x2="754" y2="222" />
    </g>
    <rect x="0" y="222" width={VIEW_W} height="7" fill="rgba(214, 186, 110, 0.5)" />
    {/* 脊上走兽 */}
    <g fill="rgba(196, 168, 96, 0.75)">
      <circle cx="120" cy="193" r="3" />
      <circle cx="330" cy="181" r="3" />
      <circle cx="570" cy="181" r="3" />
      <circle cx="780" cy="193" r="3" />
    </g>

    {/* 朱红宫墙 */}
    <rect x="0" y="229" width={VIEW_W} height="112" fill="url(#bg-palace-wall)" />
    {/* 墙影横带 */}
    <rect x="0" y="262" width={VIEW_W} height="10" fill="rgba(20, 8, 6, 0.35)" />
    <rect x="0" y="306" width={VIEW_W} height="8" fill="rgba(20, 8, 6, 0.3)" />

    {/* 宫灯两盏 */}
    <g>
      <circle cx="300" cy="272" r="30" fill="url(#bg-palace-lantern)">
        <animate attributeName="opacity" values="0.65;1;0.65" dur="3.4s" repeatCount="indefinite" />
      </circle>
      <line x1="300" y1="229" x2="300" y2="252" stroke="rgba(50, 30, 18, 0.9)" strokeWidth="1.6" />
      <rect x="288" y="252" width="24" height="30" rx="10" fill="rgba(226, 120, 66, 0.92)" stroke="rgba(246, 208, 130, 0.8)" strokeWidth="1.2" />
      <rect x="293" y="248" width="14" height="4" rx="1.5" fill="rgba(246, 208, 130, 0.8)" />
      <line x1="300" y1="282" x2="300" y2="292" stroke="rgba(246, 208, 130, 0.7)" strokeWidth="1.4" />

      <circle cx="600" cy="272" r="30" fill="url(#bg-palace-lantern)">
        <animate attributeName="opacity" values="1;0.65;1" dur="3.4s" repeatCount="indefinite" />
      </circle>
      <line x1="600" y1="229" x2="600" y2="252" stroke="rgba(50, 30, 18, 0.9)" strokeWidth="1.6" />
      <rect x="588" y="252" width="24" height="30" rx="10" fill="rgba(226, 120, 66, 0.92)" stroke="rgba(246, 208, 130, 0.8)" strokeWidth="1.2" />
      <rect x="593" y="248" width="14" height="4" rx="1.5" fill="rgba(246, 208, 130, 0.8)" />
      <line x1="600" y1="282" x2="600" y2="292" stroke="rgba(246, 208, 130, 0.7)" strokeWidth="1.4" />
    </g>

    {/* 墙根青石暗域 */}
    <FloorFade id="bg-palace-floor" />
  </g>
);

export const BattleBackground = ({ scene }: BattleBackgroundProps) => {
  switch (scene) {
    case "desert":
      return <DesertScene />;
    case "bamboo":
      return <BambooScene />;
    case "cliff":
      return <CliffScene />;
    case "water":
      return <WaterScene />;
    case "rooftop":
      return <RooftopScene />;
    case "palace":
      return <PalaceScene />;
    default:
      return <CliffScene />;
  }
};
