/** 「志」页签：短期 / 长期目标两栏，进度纯派生自玩家当前状态 */

import type { Player } from "../types/game";
import { evaluateGoals, type GoalProgress } from "../systems/goalSystem";

const GoalItem = ({ entry }: { entry: GoalProgress }) => {
  const percent = Math.round((entry.progress / entry.total) * 100);

  return (
    <li className={`goal-item${entry.done ? " done" : ""}`}>
      <div className="goal-item-head">
        <span className="goal-item-name">
          <span className="goal-item-mark" aria-hidden="true">
            {entry.done ? "✓" : "○"}
          </span>
          {entry.goal.name}
        </span>
        <span className="goal-item-count">
          {entry.progress}/{entry.total}
        </span>
      </div>
      <p className="goal-item-desc">{entry.goal.description}</p>
      <span className="goal-bar" aria-hidden="true">
        <span className="goal-bar-fill" style={{ width: `${percent}%` }} />
      </span>
    </li>
  );
};

const GoalSection = ({
  title,
  subtitle,
  entries,
}: {
  title: string;
  subtitle: string;
  entries: GoalProgress[];
}) => {
  const doneCount = entries.filter((entry) => entry.done).length;

  return (
    <section className="goals-section">
      <h3 className="goals-section-title">
        {title}
        <small>
          {doneCount}/{entries.length} · {subtitle}
        </small>
      </h3>
      <ul className="goals-list">
        {entries.map((entry) => (
          <GoalItem key={entry.goal.id} entry={entry} />
        ))}
      </ul>
    </section>
  );
};

export const GoalsPanel = ({ player }: { player: Player }) => {
  const entries = evaluateGoals(player);
  const shortGoals = entries.filter((entry) => entry.goal.tier === "short");
  const longGoals = entries.filter((entry) => entry.goal.tier === "long");

  return (
    <div className="goals-panel">
      <p className="goals-intro">
        修仙路远，立志而后行。目标进度随修行自然推进，无需刻意记挂。
      </p>
      <GoalSection title="近期所图" subtitle="短期" entries={shortGoals} />
      <GoalSection title="平生之志" subtitle="长期" entries={longGoals} />
    </div>
  );
};
