import type { CultivateGainPreview } from "../systems/cultivationSystem";
import { formatAge, formatMonths } from "../systems/timeSystem";

interface CultivateTimePickerProps {
  /** 当前所选月数（已夹值） */
  months: number;
  /** 时长上限（月），受寿元约束 */
  cap: number;
  preview: CultivateGainPreview;
  remainingYears: number;
  onChange: (months: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 闭关时长选择弹窗：拖动时间条或点加减按钮（步长 1 个月）。
 * 点遮罩即取消；卡片内点击不冒泡。
 */
export const CultivateTimePicker = ({
  months,
  cap,
  preview,
  remainingYears,
  onChange,
  onConfirm,
  onCancel,
}: CultivateTimePickerProps) => {
  const clamp = (value: number) => Math.max(1, Math.min(cap, value));

  return (
    <div
      className="cult-picker-mask"
      role="dialog"
      aria-label="选择闭关时长"
      onClick={onCancel}
    >
      <div
        className="cult-picker-card"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="cult-picker-title">选择闭关时长</h3>

        <div className="cult-picker-stepper">
          <button
            type="button"
            className="secondary cult-picker-step"
            onClick={() => onChange(clamp(months - 1))}
            disabled={months <= 1}
            aria-label="减少一个月"
          >
            −
          </button>
          <strong className="cult-picker-value">{formatMonths(months)}</strong>
          <button
            type="button"
            className="secondary cult-picker-step"
            onClick={() => onChange(clamp(months + 1))}
            disabled={months >= cap}
            aria-label="增加一个月"
          >
            ＋
          </button>
        </div>

        <input
          type="range"
          className="cult-time-slider"
          min={1}
          max={cap}
          step={1}
          value={months}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label="闭关时长"
        />
        <div className="cult-time-scale">
          <span>1个月</span>
          <span>{formatMonths(cap)}</span>
        </div>

        <div className="cult-time-meta">
          <span>
            预计修为 +{preview.gain}
            {preview.capped && "（已达瓶颈，此境圆满）"}
          </span>
          <span>寿元剩余 {formatAge(remainingYears)} 年</span>
        </div>

        <div className="cult-time-actions">
          <button type="button" onClick={onConfirm} disabled={preview.gain <= 0}>
            开始闭关
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            取消
          </button>
        </div>

        {preview.gain <= 0 && (
          <p className="cult-time-hint">修为已圆满，可尝试突破</p>
        )}
      </div>
    </div>
  );
};
