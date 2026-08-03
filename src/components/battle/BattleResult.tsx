import type { ReactNode } from "react";
import { getItemDefinition } from "../../data/items";
import type { BattleResult as BattleResultType, ItemCost } from "../../types/game";

interface BattleResultProps {
  result: BattleResultType;
  onContinue: () => void;
}

/** 结算四种心境：胜 / 败 / 主动撤退 / 演武切磋 */
type ResultMood = "victory" | "defeat" | "retreat" | "sparring";

const MOOD_META: Record<
  ResultMood,
  { seal: string; title: string; eyebrow: string }
> = {
  victory: { seal: "捷", title: "大捷", eyebrow: "历练 · 战报" },
  defeat: { seal: "败", title: "败北", eyebrow: "历练 · 战报" },
  retreat: { seal: "退", title: "全身而退", eyebrow: "历练 · 战报" },
  sparring: { seal: "武", title: "点到为止", eyebrow: "演武 · 战报" },
};

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
  const mood: ResultMood = result.isSparring
    ? "sparring"
    : isVictory
      ? "victory"
      : result.retreated
        ? "retreat"
        : "defeat";
  const meta = MOOD_META[mood];

  const foeLine = isVictory
    ? `斩落「${result.monster.name}」`
    : result.isSparring
      ? `与「${result.monster.name}」过招`
      : result.retreated
        ? "收箭撤离，留存有用之身"
        : `不敌「${result.monster.name}」`;
  const subtitle = isVictory
    ? "此战功成，缴获已尽入囊中。"
    : result.isSparring
      ? "幻影散去何曾伤，胜负不过一笑中。"
      : result.retreated
        ? "主动撤退，虽败犹存性命。"
        : "且回去好生调养，来日方长。";

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
    <div
      className={`battle-result-overlay ${mood}`}
      role="dialog"
      aria-label={`战斗结算：${meta.title}`}
    >
      <div className="result-scene" aria-hidden="true">
        <span className="result-mist result-mist-a" />
        <span className="result-mist result-mist-b" />
        <span className="result-vignette" />
      </div>

      <div className="result-page">
        <p className="result-eyebrow">{meta.eyebrow}</p>

        <div className="result-verdict">
          <span className="result-seal" aria-hidden="true">
            {meta.seal}
          </span>
          <div className="result-verdict-text">
            <h1 className="result-title">{meta.title}</h1>
            <p className="result-foe">{foeLine}</p>
          </div>
        </div>

        <p className="result-subtitle">{subtitle}</p>

        <div className="result-ledger">{sections.map((s) => s.node)}</div>

        <button type="button" className="result-continue-btn" onClick={onContinue}>
          收起战报
        </button>
      </div>
    </div>
  );
};
