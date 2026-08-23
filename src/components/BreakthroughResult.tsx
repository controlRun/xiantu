/**
 * 突破仪式感结算：全屏一页账目，复用 BattleResult 的 .battle-result-overlay 壳。
 * 成败皆弹：晋 → 寿元/气血/灵力上限差量；挫 → 修为损失/伤势/调养天数。
 * 差量由 App 侧快照计算（attemptBreakthrough 返回结构不动）。
 */

export interface BreakthroughLedgerRow {
  label: string;
  value: string;
  tone: "gain" | "loss" | "neutral";
}

export interface BreakthroughOutcome {
  success: boolean;
  fromRealm: string;
  toRealm: string;
  message: string;
  rows: BreakthroughLedgerRow[];
}

interface BreakthroughResultProps {
  outcome: BreakthroughOutcome;
  onClose: () => void;
}

const LedgerRow = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: BreakthroughLedgerRow["tone"];
}) => (
  <div className="ledger-row">
    <span className="ledger-row-label">{label}</span>
    <span className={`ledger-row-value ledger-${tone}`}>{value}</span>
  </div>
);

export const BreakthroughResult = ({
  outcome,
  onClose,
}: BreakthroughResultProps) => {
  const title = outcome.success ? "境界大进" : "冲关受挫";
  const foeLine = outcome.success
    ? `自「${outcome.fromRealm}」破关而入「${outcome.toRealm}」`
    : `冲击「${outcome.toRealm}」未果`;
  const subtitle = outcome.success
    ? "灵台澄明，道基再上一层。"
    : "气机紊乱，所幸留得有用之身。";

  return (
    <div
      className={`battle-result-overlay${outcome.success ? "" : " defeat"}`}
      role="dialog"
      aria-label={`突破结算：${title}`}
    >
      <div className="result-scene" aria-hidden="true">
        <span className="result-mist result-mist-a" />
        <span className="result-mist result-mist-b" />
        <span className="result-vignette" />
      </div>

      <div className="result-page">
        <p className="result-eyebrow">境界 · 突破</p>

        <div className="result-verdict">
          <span className="result-seal" aria-hidden="true">
            {outcome.success ? "晋" : "挫"}
          </span>
          <div className="result-verdict-text">
            <h1 className="result-title">{title}</h1>
            <p className="result-foe">{foeLine}</p>
          </div>
        </div>

        <p className="result-subtitle">{subtitle}</p>

        <div className="result-ledger">
          <section className="ledger-section" style={{ animationDelay: "0.12s" }}>
            <h2 className="ledger-section-title">
              {outcome.success ? "此晋所得" : "冲关代价"}
            </h2>
            {outcome.rows.map((row, index) => (
              <LedgerRow
                key={`${row.label}-${index}`}
                label={row.label}
                value={row.value}
                tone={row.tone}
              />
            ))}
          </section>
        </div>

        <p className="result-subtitle">{outcome.message}</p>

        <button type="button" className="result-continue-btn" onClick={onClose}>
          收功
        </button>
      </div>
    </div>
  );
};
