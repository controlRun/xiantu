export type CultivationActionKind = "cultivate" | "mind" | "rest";

export type CultivationActionState =
  | { kind: CultivationActionKind; phase: "animating" }
  | {
      kind: "cultivate";
      phase: "result";
      gain: number;
      current: number;
      required: number;
      breakthroughReady: boolean;
    }
  | {
      kind: "mind";
      phase: "result";
      newMind: number;
      cultivationCost: number;
      spiritStoneCost: number;
    }
  | {
      kind: "rest";
      phase: "result";
      healthRecovered: number;
      manaRecovered: number;
      health: number;
      healthMax: number;
      mana: number;
      manaMax: number;
    };

interface CultivationOverlayProps {
  state: CultivationActionState;
  onClose: () => void;
}

const KIND_HINT: Record<CultivationActionKind, string> = {
  cultivate: "吐纳调息 · 灵气入体",
  mind: "观想莲台 · 澄心凝思",
  rest: "吐故纳新 · 气息归元",
};

const KIND_LABEL: Record<CultivationActionKind, string> = {
  cultivate: "修炼",
  mind: "静心参悟",
  rest: "调息恢复",
};

/** 盘腿打坐的小人：灵光呼吸、气旋环绕、灵气粒子上升 */
const MeditationFigure = () => (
  <svg
    className="cultivation-figure"
    viewBox="0 0 240 240"
    role="img"
    aria-label="盘腿修炼"
  >
    <defs>
      <radialGradient id="cult-meditate-glow" cx="50%" cy="46%" r="55%">
        <stop offset="0%" stopColor="rgba(126, 216, 255, 0.5)" />
        <stop offset="55%" stopColor="rgba(96, 168, 205, 0.18)" />
        <stop offset="100%" stopColor="rgba(96, 168, 205, 0)" />
      </radialGradient>
      <linearGradient id="cult-robe" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#e6ebf1" />
        <stop offset="100%" stopColor="#b9c4d0" />
      </linearGradient>
    </defs>

    <circle className="cult-glow" cx="120" cy="118" r="98" fill="url(#cult-meditate-glow)" />
    <circle
      className="cult-ring"
      cx="120" cy="122" r="92"
      fill="none"
      stroke="rgba(126, 216, 255, 0.5)"
      strokeWidth="1.6"
      strokeDasharray="4 14"
      strokeLinecap="round"
    />
    <circle
      className="cult-ring cult-ring-reverse"
      cx="120" cy="122" r="76"
      fill="none"
      stroke="rgba(224, 164, 88, 0.4)"
      strokeWidth="1.2"
      strokeDasharray="2 10"
      strokeLinecap="round"
    />

    <circle className="cult-particle cult-particle-1" cx="62" cy="150" r="3.2" fill="#7ed8ff" />
    <circle className="cult-particle cult-particle-2" cx="176" cy="158" r="2.6" fill="#7ed8ff" />
    <circle className="cult-particle cult-particle-3" cx="88" cy="172" r="2.2" fill="#e0a458" />
    <circle className="cult-particle cult-particle-4" cx="150" cy="170" r="3" fill="#7ed8ff" />
    <circle className="cult-particle cult-particle-5" cx="120" cy="182" r="2.4" fill="#e0a458" />
    <circle className="cult-particle cult-particle-6" cx="46" cy="118" r="2.2" fill="#7ed8ff" />

    <g className="cult-body" stroke="#39434f" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
      {/* 盘起的双腿 */}
      <path
        d="M56 186 Q88 168 120 172 Q152 168 184 186 Q168 202 120 202 Q72 202 56 186 Z"
        fill="url(#cult-robe)"
      />
      <path d="M78 188 Q120 178 162 188" fill="none" strokeWidth="2" opacity="0.55" />
      {/* 躯干道袍 */}
      <path d="M92 116 Q120 102 148 116 L162 176 Q120 190 78 176 Z" fill="url(#cult-robe)" />
      {/* 交叠的手臂 */}
      <path d="M94 126 Q78 152 104 170" fill="none" />
      <path d="M146 126 Q162 152 136 170" fill="none" />
      {/* 结印的双手 */}
      <circle cx="120" cy="170" r="6" fill="#e8d9c3" strokeWidth="2.4" />
      {/* 头部与发髻 */}
      <circle cx="120" cy="88" r="21" fill="#e8d9c3" />
      <path
        d="M100 82 Q104 62 120 60 Q136 62 140 82 Q130 72 120 72 Q110 72 100 82 Z"
        fill="#39434f"
        strokeWidth="2"
      />
      <circle cx="120" cy="56" r="7" fill="#39434f" strokeWidth="2" />
      <line x1="108" y1="52" x2="134" y2="60" strokeWidth="2.4" />
      {/* 闭目调息 */}
      <path d="M110 88 Q114 91 118 88" fill="none" strokeWidth="2" />
      <path d="M122 88 Q126 91 130 88" fill="none" strokeWidth="2" />
      {/* 衣领灵纹 */}
      <path d="M120 108 L120 168" stroke="#7ed8ff" strokeWidth="2" opacity="0.7" fill="none" />
    </g>
  </svg>
);

/** 金莲绽放：参悟时观想的莲台，花瓣呼吸开合，莲心明珠脉动 */
const LotusFigure = () => (
  <svg
    className="cultivation-figure"
    viewBox="0 0 240 240"
    role="img"
    aria-label="观想莲台"
  >
    <defs>
      <radialGradient id="cult-lotus-glow" cx="50%" cy="48%" r="55%">
        <stop offset="0%" stopColor="rgba(232, 196, 93, 0.5)" />
        <stop offset="55%" stopColor="rgba(232, 176, 88, 0.16)" />
        <stop offset="100%" stopColor="rgba(232, 176, 88, 0)" />
      </radialGradient>
      <linearGradient id="cult-petal-outer" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f0d9a8" />
        <stop offset="100%" stopColor="#c99a4e" />
      </linearGradient>
      <linearGradient id="cult-petal-inner" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fdf4dc" />
        <stop offset="100%" stopColor="#e8c47e" />
      </linearGradient>
    </defs>

    <circle className="cult-glow" cx="120" cy="124" r="98" fill="url(#cult-lotus-glow)" />
    <circle
      className="cult-ring"
      cx="120" cy="124" r="92"
      fill="none"
      stroke="rgba(232, 196, 93, 0.5)"
      strokeWidth="1.6"
      strokeDasharray="3 12"
      strokeLinecap="round"
    />
    <circle
      className="cult-ring cult-ring-reverse"
      cx="120" cy="124" r="74"
      fill="none"
      stroke="rgba(246, 231, 196, 0.35)"
      strokeWidth="1.2"
      strokeDasharray="2 9"
      strokeLinecap="round"
    />

    <circle className="cult-particle cult-particle-1" cx="60" cy="146" r="2.8" fill="#e8c45d" />
    <circle className="cult-particle cult-particle-2" cx="180" cy="152" r="2.4" fill="#f6e7c4" />
    <circle className="cult-particle cult-particle-3" cx="92" cy="168" r="2" fill="#e8c45d" />
    <circle className="cult-particle cult-particle-4" cx="152" cy="166" r="2.8" fill="#f6e7c4" />
    <circle className="cult-particle cult-particle-5" cx="120" cy="180" r="2.2" fill="#e8c45d" />
    <circle className="cult-particle cult-particle-6" cx="196" cy="112" r="2" fill="#f6e7c4" />

    <g className="lotus-flower" stroke="#a8823f" strokeWidth="2.4" strokeLinejoin="round">
      {/* 莲座 */}
      <path d="M74 168 Q120 200 166 168 Q144 196 120 198 Q96 196 74 168 Z" fill="#b98d4c" stroke="#8a6731" />
      {/* 外层花瓣 */}
      <path d="M120 172 Q54 156 46 98 Q96 102 120 142 Z" fill="url(#cult-petal-outer)" />
      <path d="M120 172 Q186 156 194 98 Q144 102 120 142 Z" fill="url(#cult-petal-outer)" />
      {/* 中层花瓣 */}
      <path d="M120 174 Q70 146 74 84 Q108 96 120 132 Z" fill="url(#cult-petal-inner)" />
      <path d="M120 174 Q170 146 166 84 Q132 96 120 132 Z" fill="url(#cult-petal-inner)" />
      {/* 中央花瓣 */}
      <path d="M120 176 Q98 122 120 66 Q142 122 120 176 Z" fill="url(#cult-petal-inner)" />
      {/* 莲心明珠 */}
      <circle className="lotus-pearl" cx="120" cy="112" r="8" fill="#fff3d0" strokeWidth="1.5" />
    </g>
  </svg>
);

/** 太极运转：调息时阴阳相济，缓缓旋转，气息粒子升腾 */
const TaijiFigure = () => (
  <svg
    className="cultivation-figure"
    viewBox="0 0 240 240"
    role="img"
    aria-label="太极调息"
  >
    <defs>
      <radialGradient id="cult-taiji-glow" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stopColor="rgba(143, 227, 192, 0.45)" />
        <stop offset="55%" stopColor="rgba(122, 200, 168, 0.15)" />
        <stop offset="100%" stopColor="rgba(122, 200, 168, 0)" />
      </radialGradient>
    </defs>

    <circle className="cult-glow" cx="120" cy="120" r="98" fill="url(#cult-taiji-glow)" />
    <circle
      className="cult-ring"
      cx="120" cy="120" r="92"
      fill="none"
      stroke="rgba(143, 227, 192, 0.45)"
      strokeWidth="1.6"
      strokeDasharray="5 13"
      strokeLinecap="round"
    />
    <circle
      className="cult-ring cult-ring-reverse"
      cx="120" cy="120" r="78"
      fill="none"
      stroke="rgba(126, 216, 255, 0.32)"
      strokeWidth="1.2"
      strokeDasharray="2 9"
      strokeLinecap="round"
    />

    <circle className="cult-particle cult-particle-1" cx="56" cy="140" r="2.8" fill="#8fe3c0" />
    <circle className="cult-particle cult-particle-2" cx="184" cy="150" r="2.4" fill="#7ed8ff" />
    <circle className="cult-particle cult-particle-3" cx="84" cy="176" r="2" fill="#8fe3c0" />
    <circle className="cult-particle cult-particle-4" cx="156" cy="174" r="2.8" fill="#8fe3c0" />
    <circle className="cult-particle cult-particle-5" cx="120" cy="188" r="2.2" fill="#7ed8ff" />
    <circle className="cult-particle cult-particle-6" cx="44" cy="104" r="2" fill="#8fe3c0" />

    <g className="taiji-rotor">
      <circle cx="120" cy="120" r="62" fill="#e9eef3" stroke="#39434f" strokeWidth="3" />
      <path
        d="M120 58 A62 62 0 0 1 120 182 A31 31 0 0 1 120 120 A31 31 0 0 0 120 58 Z"
        fill="#333d49"
      />
      <circle cx="120" cy="89" r="9.5" fill="#e9eef3" />
      <circle cx="120" cy="151" r="9.5" fill="#333d49" />
    </g>
  </svg>
);

const ResultCard = ({
  state,
  onClose,
}: {
  state: Extract<CultivationActionState, { phase: "result" }>;
  onClose: () => void;
}) => {
  if (state.kind === "cultivate") {
    const percent =
      state.required > 0
        ? Math.min(100, Math.round((state.current / state.required) * 100))
        : 0;
    return (
      <div className="cultivation-card">
        <p className="eyebrow">修炼结果</p>
        <h2>灵气入体</h2>
        <p className="cultivation-gain">修为 +{state.gain}</p>
        <div className="progress-track" aria-label="修为进度">
          <div className="progress-value" style={{ width: `${percent}%` }} />
        </div>
        <p className="cultivation-value">
          {state.current} / {state.required} 修为
        </p>
        {state.breakthroughReady && (
          <p className="cultivation-breakthrough-hint">
            突破条件已满足，可尝试破境！
          </p>
        )}
        <button type="button" onClick={onClose}>
          收功
        </button>
      </div>
    );
  }

  if (state.kind === "mind") {
    return (
      <div className="cultivation-card">
        <p className="eyebrow">参悟结果</p>
        <h2>心境澄明</h2>
        <p className="cultivation-gain">心境 +1</p>
        <p className="cultivation-sub">当前心境 {state.newMind}</p>
        <p className="cultivation-cost">
          消耗 修为 {state.cultivationCost} · 灵石 {state.spiritStoneCost}
        </p>
        <button type="button" onClick={onClose}>
          收功
        </button>
      </div>
    );
  }

  const healthPercent =
    state.healthMax > 0 ? Math.round((state.health / state.healthMax) * 100) : 0;
  const manaPercent =
    state.manaMax > 0 ? Math.round((state.mana / state.manaMax) * 100) : 0;
  return (
    <div className="cultivation-card">
      <p className="eyebrow">调息结果</p>
      <h2>气息归元</h2>
      <div className="cultivation-dual-gain">
        <span className="gain-health">气血 +{state.healthRecovered}</span>
        <span className="gain-mana">灵力 +{state.manaRecovered}</span>
      </div>
      <div className="cultivation-vital">
        <div className="cultivation-vital-label">
          <span>气血</span>
          <span>
            {state.health} / {state.healthMax}
          </span>
        </div>
        <div className="mobile-bar">
          <div
            className="mobile-bar-fill mobile-bar-hp"
            style={{ width: `${healthPercent}%` }}
          />
        </div>
      </div>
      <div className="cultivation-vital">
        <div className="cultivation-vital-label">
          <span>灵力</span>
          <span>
            {state.mana} / {state.manaMax}
          </span>
        </div>
        <div className="mobile-bar">
          <div
            className="mobile-bar-fill mobile-bar-mana"
            style={{ width: `${manaPercent}%` }}
          />
        </div>
      </div>
      <button type="button" onClick={onClose}>
        收功
      </button>
    </div>
  );
};

export const CultivationOverlay = ({ state, onClose }: CultivationOverlayProps) => {
  return (
    <div
      className={`cultivation-overlay kind-${state.kind}`}
      role="dialog"
      aria-label={KIND_LABEL[state.kind]}
    >
      <div className="cultivation-backdrop" aria-hidden="true" />
      {state.phase === "animating" ? (
        <div className="cultivation-stage">
          {state.kind === "cultivate" && <MeditationFigure />}
          {state.kind === "mind" && <LotusFigure />}
          {state.kind === "rest" && <TaijiFigure />}
          <p className="cultivation-hint">{KIND_HINT[state.kind]}</p>
        </div>
      ) : (
        <ResultCard state={state} onClose={onClose} />
      )}
    </div>
  );
};
