/**
 * 渡劫确认弹窗：化神期飞升大乘的唯一凭依。
 * 条件未满足 → 列出缺失项与获取途径，仅可关闭；
 * 条件满足 → 给出成功率，成败两极端（飞升灵界 / 身死道消），慎之慎之。
 */

import type { BreakthroughRequirement } from "./BreakthroughDialog";

interface TribulationDialogProps {
  /** 当前境界名 */
  realmName: string;
  /** 渡劫成功率（0–1） */
  chance: number;
  requirements: BreakthroughRequirement[];
  /** 消耗一览（灵石 + 材料），来自 describeTribulationCosts */
  costLine: string;
  canTribulate: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const TARGET_REALM_NAME = "大乘初期";

export const TribulationDialog = ({
  realmName,
  chance,
  requirements,
  costLine,
  canTribulate,
  onConfirm,
  onCancel,
}: TribulationDialogProps) => {
  const missingReqs = requirements.filter((req) => !req.met);
  const metReqs = requirements.filter((req) => req.met);

  return (
    <div
      className="bt-dialog-mask"
      role="dialog"
      aria-modal="true"
      aria-label={`渡劫 · 飞升${TARGET_REALM_NAME}`}
      onClick={onCancel}
    >
      <div
        className="bt-dialog-card tribulation-card"
        onClick={(event) => event.stopPropagation()}
      >
        {canTribulate ? (
          <>
            <h3 className="bt-dialog-title">渡劫 · 飞升{TARGET_REALM_NAME}</h3>
            <p className="bt-dialog-chance">
              当前 {realmName} · 天雷已聚，可一试劫数
            </p>

            <div className="bt-chance-panel">
              <span className="bt-chance-num">
                {Math.round(chance * 100)}%
              </span>
              <span className="bt-chance-label">渡劫成功率</span>
            </div>

            <div className="breakthrough-requirements">
              {requirements.map((req) => (
                <RequirementRow key={req.key} req={req} />
              ))}
            </div>

            <div className="bt-dialog-risk tribulation-risk">
              <p>消耗：{costLine}</p>
              <p>
                天劫非同小可：渡劫所耗灵石与材料成败皆扣、不予退还；
                若失败，则神形俱灭、身死道消，一生修为尽付流水。
                须以渡厄丹镇守元神护持，慎之慎之。
              </p>
            </div>

            <div className="bt-dialog-actions">
              <button type="button" onClick={onConfirm}>
                引天雷渡劫
              </button>
              <button type="button" className="secondary" onClick={onCancel}>
                再想想
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="bt-dialog-title">渡劫 · 飞升{TARGET_REALM_NAME}</h3>
            <p className="bt-dialog-status-warn">
              条件未满足，缺少 {missingReqs.length} 项，暂不可渡劫
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
