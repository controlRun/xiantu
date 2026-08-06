/**
 * 突破确认弹窗：点「突破」后展开需求清单与代价说明，二次确认后才执行。
 * 必须项未满足时确认键禁用并给出提示；点遮罩即取消。
 */

/** 结构化突破需求条目（由 App 派生传入） */
export interface BreakthroughRequirement {
  key: string;
  label: string;
  met: boolean;
  current: number;
  need: number;
  acquisition: string;
}

interface BreakthroughDialogProps {
  /** 当前境界名 */
  realmName: string;
  /** 目标境界名 */
  nextRealmName: string;
  /** 突破成功率（0–1） */
  chance: number;
  requirements: BreakthroughRequirement[];
  /** 消耗一览（灵石 + 材料），来自 describeBreakthroughCosts */
  costLine: string;
  canBreakthrough: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const BreakthroughDialog = ({
  realmName,
  nextRealmName,
  chance,
  requirements,
  costLine,
  canBreakthrough,
  onConfirm,
  onCancel,
}: BreakthroughDialogProps) => {
  const missingCount = requirements.filter((req) => !req.met).length;

  return (
    <div
      className="bt-dialog-mask"
      role="dialog"
      aria-modal="true"
      aria-label={`冲击${nextRealmName}`}
      onClick={onCancel}
    >
      <div
        className="bt-dialog-card"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="bt-dialog-title">冲击 · {nextRealmName}</h3>
        <p className="bt-dialog-chance">
          当前 {realmName} · 成功率 {Math.round(chance * 100)}%
        </p>

        <div className="breakthrough-requirements">
          {requirements.map((req) => {
            const percent =
              req.need > 0
                ? Math.min(100, Math.round((req.current / req.need) * 100))
                : 100;
            return (
              <div
                className={`bt-req ${req.met ? "met" : "missing"}`}
                key={req.key}
              >
                <div className="bt-req-head">
                  <span className="bt-req-label">{req.label}</span>
                  <span className="bt-req-nums">
                    {req.current} / {req.need}
                  </span>
                  <span className="bt-req-flag">{req.met ? "✓" : "缺"}</span>
                </div>
                <div className="progress-track bt-req-track">
                  <div
                    className={`progress-value ${req.met ? "" : "short"}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                {!req.met && (
                  <p className="bt-req-hint">获取途径：{req.acquisition}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="bt-dialog-risk">
          <p>消耗：{costLine}</p>
          <p>
            灵石与材料成败皆扣、不予退还；若失败将损失约一成八修为、添伤势并需调养。
          </p>
        </div>

        <div className="bt-dialog-actions">
          <button type="button" onClick={onConfirm} disabled={!canBreakthrough}>
            确认突破
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            取消
          </button>
        </div>

        {!canBreakthrough && (
          <p className="bt-dialog-hint">
            尚有 {missingCount} 项缺失未达标，无法尝试突破
          </p>
        )}
      </div>
    </div>
  );
};
