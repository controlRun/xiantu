/**
 * 宗门任务三选一：从本宗 3 项任务中择一执行。
 * 壳仿 BreakthroughDialog（bt-dialog-mask/card）；气血/灵力不足的任务置灰，
 * 但最终校验仍以 sectSystem.completeSectTask 为准。
 */
import { getItemDefinition } from "../data/items";
import type { Player, SectTask } from "../types/game";

interface SectTaskPickerProps {
  tasks: SectTask[];
  player: Player;
  onPick: (taskId: string) => void;
  onCancel: () => void;
}

const formatItems = (task: SectTask) => {
  if (task.itemRewards.length === 0) {
    return "无物品";
  }

  return task.itemRewards
    .map(
      (item) =>
        `${getItemDefinition(item.itemId)?.name ?? item.itemId} x${item.quantity}`,
    )
    .join("、");
};

export const SectTaskPicker = ({
  tasks,
  player,
  onPick,
  onCancel,
}: SectTaskPickerProps) => (
  <div
    className="bt-dialog-mask"
    role="dialog"
    aria-modal="true"
    aria-label="宗门任务"
    onClick={onCancel}
  >
    <div
      className="bt-dialog-card sect-task-picker"
      onClick={(event) => event.stopPropagation()}
    >
      <h3 className="bt-dialog-title">宗门任务</h3>
      <p className="sect-task-hint">择一而任，耗时 7 日，气血灵力如实消耗。</p>

      <div className="sect-task-list">
        {tasks.map((task) => {
          const lowHealth = player.health.current <= task.healthCost;
          const lowMana = player.mana.current < task.manaCost;
          const blocked = lowHealth || lowMana;

          return (
            <article
              key={task.id}
              className={`sect-task-card${blocked ? " blocked" : ""}`}
            >
              <div className="sect-task-head">
                <strong>{task.name}</strong>
                <span className="cost-tag">耗时 7 日</span>
              </div>
              <p className="sect-task-desc">{task.description}</p>
              <dl className="sect-task-meta">
                <div>
                  <dt>气血</dt>
                  <dd>{task.healthCost}</dd>
                </div>
                <div>
                  <dt>灵力</dt>
                  <dd>{task.manaCost}</dd>
                </div>
                <div>
                  <dt>贡献</dt>
                  <dd>+{task.contributionReward}</dd>
                </div>
                <div>
                  <dt>灵石</dt>
                  <dd>
                    {task.spiritStoneReward[0]}~{task.spiritStoneReward[1]}
                  </dd>
                </div>
                <div>
                  <dt>修为</dt>
                  <dd>
                    {task.cultivationReward[0]}~{task.cultivationReward[1]}
                  </dd>
                </div>
                <div>
                  <dt>物品</dt>
                  <dd>{formatItems(task)}</dd>
                </div>
              </dl>
              {blocked && (
                <p className="sect-task-warn">
                  {lowHealth && "气血不足"} {lowHealth && lowMana && "、"}
                  {lowMana && "灵力不足"}，先调息恢复
                </p>
              )}
              <button
                type="button"
                className="secondary"
                disabled={blocked}
                onClick={() => onPick(task.id)}
              >
                接下此任
              </button>
            </article>
          );
        })}
      </div>

      <div className="bt-dialog-actions">
        <button type="button" className="secondary" onClick={onCancel}>
          再想想
        </button>
      </div>
    </div>
  </div>
);
