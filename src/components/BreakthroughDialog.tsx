/**
 * 突破确认弹窗：点「突破」后先核验必备条件。
 * 条件未满足 → 列出缺失项与获取途径，仅可关闭；
 * 条件满足 → 给出突破成功率，由玩家决定是否确认突破。
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

const RequirementRow = ({ req }: { req: BreakthroughRequirement }) => {
  const percent =
    req.need > 0
      ? Math.min(100, Math.round((req.current / req.need) * 100))
      : 100;
  return (
    <div className={`bt-req ${req.met ? "met" : "missing"}`}>
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
};

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
  const missingReqs = requirements.filter((req) => !req.met);
  const metReqs = requirements.filter((req) => req.met);

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
        {canBreakthrough ? (
          <>
            <h3 className="bt-dialog-title">冲击 · {nextRealmName}</h3>
            <p className="bt-dialog-chance">
              当前 {realmName} · 万事俱备，可尝试破境
            </p>

            <div className="bt-chance-panel">
              <span className="bt-chance-num">
                {Math.round(chance * 100)}%
              </span>
              <span className="bt-chance-label">突破成功率</span>
            </div>

            <div className="breakthrough-requirements">
              {requirements.map((req) => (
                <RequirementRow key={req.key} req={req} />
              ))}
            </div>

            <div className="bt-dialog-risk">
              <p>消耗：{costLine}</p>
              <p>
                灵石与材料成败皆扣、不予退还；若失败将损失约一成八修为、添伤势并需调养。
              </p>
            </div>

            <div className="bt-dialog-actions">
              <button type="button" onClick={onConfirm}>
                确定突破
              </button>
              <button type="button" className="secondary" onClick={onCancel}>
                再想想
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="bt-dialog-title">冲击 · {nextRealmName}</h3>
            <p className="bt-dialog-status-warn">
              条件未满足，缺少 {missingReqs.length} 项，暂无法破境
            </p>

            <div className="breakthrough-requirements">
              {missingReqs.map((req) => (
                <RequirementRow key={req.key} req={req} />
              ))}
            </div>

            {metReqs.length > 0 && (
              <p className="bt-met-hint">
                已满足 {metReqs.length} 项（
                {metReqs.map((req) => req.label).join("、")}）
              </p>
            )}

            <div className="bt-dialog-actions">
              <button type="button" className="secondary" onClick={onCancel}>
                关闭
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
