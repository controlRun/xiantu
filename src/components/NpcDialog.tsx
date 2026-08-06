/** NPC 对话框：逐句点按推进；点遮罩中途告辞（不发奖，可再开） */

import { useState } from "react";
import type { NpcDefinition } from "../data/npcs";

interface NpcDialogProps {
  npc: NpcDefinition;
  lines: string[];
  /** 馈赠尚未领取：头部显示「初见之礼」标记 */
  giftAvailable: boolean;
  /** 中途点遮罩告辞：不发奖 */
  onClose: () => void;
  /** 末句收尾：由 App 结算馈赠 */
  onFinish: () => void;
}

export const NpcDialog = ({
  npc,
  lines,
  giftAvailable,
  onClose,
  onFinish,
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
      </div>
    </div>
  );
};
