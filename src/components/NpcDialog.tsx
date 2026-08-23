/** NPC 对话框：逐句点按推进；点遮罩中途告辞（不发奖，可再开）。 */
/** 头部显好感分阶；底部操作行：赠礼 / 接受托付 / 交付。 */

import { useState } from "react";
import type { NpcDefinition } from "../data/npcs";

interface NpcDialogProps {
  npc: NpcDefinition;
  lines: string[];
  /** 馈赠尚未领取：头部显示「初见之礼」标记 */
  giftAvailable: boolean;
  /** 好感分阶名（如「熟识」） */
  favorTierName: string;
  favor: number;
  /** 可接受托付（有托付 && 好感达标 && 无在途） */
  canAcceptErrand: boolean;
  /** 可交付（在途 && 物资齐） */
  canDeliver: boolean;
  /** 在途托付状态文案（无在途则 null） */
  errandStatus: string | null;
  /** 托付逾期警示 */
  errandOverdue: boolean;
  /** 中途点遮罩告辞：不发奖 */
  onClose: () => void;
  /** 末句收尾：由 App 结算馈赠/好感 */
  onFinish: () => void;
  /** 打开赠礼选择器 */
  onGift: () => void;
  /** 接受托付 */
  onAcceptErrand: () => void;
  /** 交付托付 */
  onDeliverErrand: () => void;
}

export const NpcDialog = ({
  npc,
  lines,
  giftAvailable,
  favorTierName,
  favor,
  canAcceptErrand,
  canDeliver,
  errandStatus,
  errandOverdue,
  onClose,
  onFinish,
  onGift,
  onAcceptErrand,
  onDeliverErrand,
}: NpcDialogProps) => {
  const [step, setStep] = useState(0);
  const isLast = step >= lines.length - 1;

  const handleAdvance = () => {
    if (isLast) {
      onFinish();
      return;
    }
    setStep((current) => current + 1);
  };

  return (
    <div className="npc-dialog-mask" onClick={onClose}>
      <div
        className="npc-dialog-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="npc-dialog-head">
          <span className="npc-portrait" aria-hidden="true">
            {npc.portrait}
          </span>
          <span className="npc-dialog-id">
            <strong className="npc-name">{npc.name}</strong>
            <span className="npc-title-tag">{npc.title}</span>
          </span>
          {giftAvailable && <span className="npc-gift-tag">初见之礼</span>}
          <span
            className={`npc-favor-tag${favor >= 60 ? " favor-intimate" : ""}`}
            title={`好感 ${favor}`}
          >
            {favorTierName} · {favor}
          </span>
        </div>

        <button
          type="button"
          className="npc-dialog-line"
          key={step}
          onClick={handleAdvance}
        >
          {lines[step]}
        </button>

        <p className="npc-dialog-hint">
          {isLast
            ? giftAvailable
              ? "点击受礼告辞"
              : "点击告辞"
            : "点击继续 · 点外侧告辞"}
        </p>

        {errandStatus && (
          <p
            className={`npc-errand-status${errandOverdue ? " overdue" : ""}`}
          >
            {errandStatus}
          </p>
        )}

        <div className="npc-dialog-actions">
          <button type="button" className="secondary" onClick={onGift}>
            赠礼
          </button>
          {canAcceptErrand && (
            <button type="button" className="secondary" onClick={onAcceptErrand}>
              接受托付
            </button>
          )}
          {canDeliver && (
            <button type="button" className="primary" onClick={onDeliverErrand}>
              交付
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
