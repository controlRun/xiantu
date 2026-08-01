import type { ReactNode } from "react";
import { getItemDefinition } from "../../data/items";
import type { BattleResult as BattleResultType, ItemCost } from "../../types/game";

interface BattleResultProps {
  result: BattleResultType;
  onContinue: () => void;
}

/** 一行账目：标签 + 数值（数值可为正/负着色） */
const LedgerRow = ({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "gain" | "loss" | "neutral";
}) => (
  <div className="ledger-row">
    <span className="ledger-row-label">{label}</span>
    <span className={`ledger-row-value ledger-${tone}`}>{value}</span>
  </div>
);

/** 缴获物品逐件列出 */
const LootRows = ({ items }: { items: ItemCost[] }) => (
  <>
    {items.map((item) => (
      <LedgerRow
        key={item.itemId}
        label={getItemDefinition(item.itemId)?.name ?? item.itemId}
        value={`+${item.quantity}`}
        tone="gain"
      />
    ))}
  </>
);

/** 一段账目（带错峰浮入） */
const LedgerSection = ({
  title,
  order,
  children,
}: {
  title: string;
  order: number;
  children: ReactNode;
}) => (
  <section
    className="ledger-section"
    style={{ animationDelay: `${0.12 + order * 0.09}s` }}
  >
    <h2 className="ledger-section-title">{title}</h2>
    {children}
  </section>
);

export const BattleResult = ({ result, onContinue }: BattleResultProps) => {
  const isVictory = result.victory;
  const penalty = result.penalty;
  const hasPenalty =
    penalty !== undefined &&
    (penalty.injury > 0 ||
      penalty.lostStones > 0 ||
      penalty.lostItems.length > 0 ||
      penalty.lostDays > 0);

  const arrowsUsed = result.arrowsUsed ?? [];
  const arrowsFired = arrowsUsed.reduce((sum, a) => sum + a.quantity, 0);
  const totalDamage = result.totalDamage ?? 0;
  const daysSpent = result.daysSpent ?? 0;
  const hasSpoils =
    isVictory &&
    (result.reward.spiritStones > 0 ||
      result.reward.cultivation > 0 ||
      result.reward.items.length > 0);
  const hasConsumption = arrowsUsed.length > 0 || daysSpent > 0;
  const hasRecord = totalDamage > 0;

  // 胜局以「缴获」领起，败局以「代价」领起——一眼看到重点
  const sections: { title: string; node: ReactNode }[] = [];

  const spoils = (
    <LedgerSection key="spoils" title="缴获" order={sections.length}>
      {result.reward.spiritStones > 0 && (
        <LedgerRow label="灵石" value={`+${result.reward.spiritStones}`} tone="gain" />
      )}
      {result.reward.cultivation > 0 && (
        <LedgerRow label="修为" value={`+${result.reward.cultivation}`} tone="gain" />
      )}
      <LootRows items={result.reward.items} />
    </LedgerSection>
  );

  const costs = (
    <LedgerSection key="costs" title="此战代价" order={sections.length}>
      {penalty && penalty.injury > 0 && (
        <LedgerRow label="伤势" value={`+${penalty.injury}`} tone="loss" />
      )}
      {penalty && penalty.lostStones > 0 && (
        <LedgerRow label="灵石" value={`−${penalty.lostStones}`} tone="loss" />
      )}
      {penalty &&
        penalty.lostItems.map((lost) => (
          <LedgerRow
            key={lost.itemId}
            label={getItemDefinition(lost.itemId)?.name ?? lost.itemId}
            value={`−${lost.quantity}`}
            tone="loss"
          />
        ))}
    </LedgerSection>
  );

  const consumption = (
    <LedgerSection key="consumption" title="消耗" order={sections.length}>
      {arrowsUsed.map((arrow) => (
        <LedgerRow
          key={arrow.itemId}
          label={getItemDefinition(arrow.itemId)?.name ?? arrow.itemId}
          value={`×${arrow.quantity}`}
          tone="loss"
        />
      ))}
      {daysSpent > 0 && (
        <LedgerRow label="寿元" value={`−${daysSpent} 日`} tone="loss" />
      )}
    </LedgerSection>
  );

  const record = (
    <LedgerSection key="record" title="战绩" order={sections.length}>
      <LedgerRow label="总伤害" value={`${totalDamage}`} tone="neutral" />
      {arrowsFired > 0 && (
        <LedgerRow label="出箭" value={`${arrowsFired} 支`} tone="neutral" />
      )}
    </LedgerSection>
  );

  if (isVictory) {
    if (hasSpoils) sections.push({ title: "spoils", node: spoils });
    if (hasRecord) sections.push({ title: "record", node: record });
    if (hasConsumption) sections.push({ title: "consumption", node: consumption });
    if (hasPenalty) sections.push({ title: "costs", node: costs });
  } else {
    if (hasPenalty) sections.push({ title: "costs", node: costs });
    if (hasRecord) sections.push({ title: "record", node: record });
    if (hasConsumption) sections.push({ title: "consumption", node: consumption });
  }

  return (
    <div className={`battle-result-overlay ${isVictory ? "victory" : "defeat"}`}>
      <div className="result-content">
        <div className="result-icon">{isVictory ? "🏆" : "💀"}</div>
        <h1 className="result-title">{isVictory ? "胜利" : "失败"}</h1>
        <p className="result-subtitle">
          {isVictory
            ? `斩落${result.monster.name}，此战功成。`
            : result.isSparring
              ? "切磋落败，对方点到为止。"
              : result.retreated
                ? "主动撤退，虽败犹存性命。"
                : `不敌${result.monster.name}，且回去好生调养。`}
        </p>

        <div className="result-ledger">{sections.map((s) => s.node)}</div>

        <button className="result-continue-btn" onClick={onContinue}>
          继续
        </button>
      </div>
    </div>
  );
};
