/** NPC 赠礼选择器：列出可赠物品，点条目投赠 1 件；作罢取消不结算 */

import { getItemDefinition } from "../data/items";

interface GiftItem {
  itemId: string;
  quantity: number;
}

interface NpcGiftPickerProps {
  npcName: string;
  items: GiftItem[];
  /** 该 NPC 偏好的物品 id（投赠好感翻倍） */
  npcLikes: string[];
  onGift: (itemId: string) => void;
  onCancel: () => void;
}

export const NpcGiftPicker = ({
  npcName,
  items,
  npcLikes,
  onGift,
  onCancel,
}: NpcGiftPickerProps) => {
  return (
    <div
      className="bt-dialog-mask"
      role="dialog"
      aria-modal="true"
      aria-label="赠礼"
      onClick={onCancel}
    >
      <div
        className="bt-dialog-card npc-gift-picker"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="bt-dialog-title">赠礼予{npcName}</h3>
        <p className="npc-gift-hint">
          挑一件身上的物什投赠，好感随心意增长——标「所爱」之物最能打动对方。
        </p>

        <ul className="npc-gift-list">
          {items.length === 0 ? (
            <li className="empty-text">身无长物，改日备礼再来</li>
          ) : (
            items.map(({ itemId, quantity }) => {
              const item = getItemDefinition(itemId);
              const liked = npcLikes.includes(itemId);
              return (
                <li key={itemId}>
                  <button
                    type="button"
                    className={`npc-gift-item${liked ? " liked" : ""}`}
                    onClick={() => onGift(itemId)}
                  >
                    <span className="npc-gift-item-name">
                      {item?.name ?? itemId}
                      {liked && <span className="npc-gift-liked">所爱</span>}
                    </span>
                    <span className="npc-gift-item-qty">×{quantity}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="bt-dialog-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            作罢
          </button>
        </div>
      </div>
    </div>
  );
};
