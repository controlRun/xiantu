import { useMemo, useState } from "react";
import type {
  ArrowDefinition,
  BattleLoadout,
  MonsterDefinition,
  Player,
  RetreatRule,
} from "../../types/game";
import {
  getSpiritArrowPower,
  type SpiritArrowTier,
} from "../../data/spiritArrows";
import { getMonsterBehavior } from "../../data/monsterBehaviors";
import { getMonstersForRealmOrder } from "../../data/monsters";
import { pillDefinitions } from "../../data/pills";
import { getRealmById } from "../../data/realms";
import { getInventoryQuantity } from "../../systems/inventorySystem";

const MAX_CARRIED_ARROWS = 3;
const MAX_CARRIED_PILLS = 2;

const retreatOptions: {
  value: RetreatRule;
  label: string;
  description: string;
}[] = [
  {
    value: "never",
    label: "死战不退",
    description: "战至最后一刻，绝不主动撤退。",
  },
  {
    value: "hp50",
    label: "血量五成即撤",
    description: "气血跌至五成以下，自动收弓撤退。",
  },
  {
    value: "hp30",
    label: "血量三成即撤",
    description: "气血跌至三成以下，自动收弓撤退。",
  },
  {
    value: "round6",
    label: "六回合即撤",
    description: "鏖战满六回合，自动收弓撤退。",
  },
];

interface BattlePrepScreenProps {
  player: Player;
  mode: "wild" | "sparring" | "boss";
  /** 野外遭遇的区域名 */
  area?: string;
  /** 固定对手（秘境 Boss）：跳过随机遭遇池，直接展示其档案 */
  fixedMonster?: MonsterDefinition;
  /** 候选实物箭：野战为库存 > 0 的兼容箭；演武为全部兼容箭种（无消耗） */
  physicalArrows: ArrowDefinition[];
  /** 候选灵力箭：当前境界已解锁的档位 */
  spiritArrows: SpiritArrowTier[];
  onConfirm: (loadout: BattleLoadout) => void;
  onCancel: () => void;
}

export const BattlePrepScreen = ({
  player,
  mode,
  area,
  fixedMonster,
  physicalArrows,
  spiritArrows,
  onConfirm,
  onCancel,
}: BattlePrepScreenProps) => {
  const isSparring = mode === "sparring";
  const isBoss = mode === "boss";

  // 默认携带：最强三种实物箭，不足三种则以已解锁灵力箭补足
  const [arrowIds, setArrowIds] = useState<string[]>(() => {
    const ids: string[] = [];
    for (const arrow of physicalArrows.slice(-MAX_CARRIED_ARROWS)) {
      ids.push(arrow.itemId);
    }
    for (const tier of spiritArrows) {
      if (ids.length >= MAX_CARRIED_ARROWS) break;
      ids.push(tier.id);
    }
    return ids;
  });

  const pillCandidates = useMemo(
    () =>
      pillDefinitions.filter(
        (pill) => getInventoryQuantity(player.inventory, pill.itemId) > 0,
      ),
    [player.inventory],
  );
  const [pillIds, setPillIds] = useState<string[]>(() =>
    isSparring
      ? []
      : pillCandidates.slice(0, MAX_CARRIED_PILLS).map((pill) => pill.itemId),
  );
  const [retreatRule, setRetreatRule] = useState<RetreatRule>("hp30");

  /** 野外可能遭遇的对手预览（Boss 战固定对手，不走随机池） */
  const encounterPool = useMemo(() => {
    if (isSparring || fixedMonster) return [];
    const realm = getRealmById(player.realmId);
    const pool = getMonstersForRealmOrder(realm.order);
    const areaPool = area ? pool.filter((monster) => monster.area === area) : pool;
    return areaPool.length > 0 ? areaPool : pool;
  }, [isSparring, fixedMonster, area, player.realmId]);

  const toggleArrow = (id: string) => {
    setArrowIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((existing) => existing !== id);
      }
      if (prev.length >= MAX_CARRIED_ARROWS) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const togglePill = (itemId: string) => {
    setPillIds((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((existing) => existing !== itemId);
      }
      if (prev.length >= MAX_CARRIED_PILLS) {
        return prev;
      }
      return [...prev, itemId];
    });
  };

  const handleConfirm = () => {
    if (arrowIds.length === 0) {
      return;
    }

    onConfirm({
      arrowIds,
      pillIds: isSparring ? [] : pillIds,
      retreatRule: isSparring ? "never" : retreatRule,
    });
  };

  return (
    <div className="battle-prep">
      <div className="battle-prep-header">
        <div>
          <p className="eyebrow">
            {isBoss ? "妖芯秘境" : isSparring ? "演武场" : area ?? "野外"}
          </p>
          <h1>战前整备</h1>
        </div>
        <button type="button" className="battle-exit-button" onClick={onCancel}>
          返回
        </button>
      </div>

      <div className="battle-prep-body">
        {isSparring && (
          <p className="prep-mode-tag">
            无消耗训练：演武不耗箭矢与灵力，可尽情练习瞄准、测试箭矢伤害。
          </p>
        )}

        {/* 遭遇预览 */}
        <section className="prep-section">
          <h2 className="prep-section-title">{isBoss ? "守关者" : "遭遇"}</h2>
          {isSparring ? (
            <p className="prep-hint">
              对手随机（野兽 / 邪修 / 守卫三种脾性），用于练习应对不同性格的敌人。
            </p>
          ) : fixedMonster ? (
            <div className="prep-encounter-list">
              <div className="prep-encounter-card boss">
                <div className="prep-encounter-head">
                  <strong>{fixedMonster.name}</strong>
                  <span
                    className={`prep-behavior-tag ${getMonsterBehavior(fixedMonster).id}`}
                  >
                    {getMonsterBehavior(fixedMonster).label}
                  </span>
                </div>
                <p className="prep-encounter-desc">
                  {getMonsterBehavior(fixedMonster).description}
                </p>
                <p className="prep-encounter-stats">
                  气血 {fixedMonster.health} · 攻击 {fixedMonster.attack} · 防御{" "}
                  {fixedMonster.defense}
                </p>
              </div>
            </div>
          ) : (
            <div className="prep-encounter-list">
              {encounterPool.map((monster) => {
                const behavior = getMonsterBehavior(monster);
                return (
                  <div key={monster.id} className="prep-encounter-card">
                    <div className="prep-encounter-head">
                      <strong>{monster.name}</strong>
                      <span className={`prep-behavior-tag ${behavior.id}`}>
                        {behavior.label}
                      </span>
                    </div>
                    <p className="prep-encounter-desc">{behavior.description}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 箭矢携带 */}
        <section className="prep-section">
          <h2 className="prep-section-title">
            携带箭矢
            <small>
              {arrowIds.length}/{MAX_CARRIED_ARROWS}
            </small>
          </h2>
          <p className="prep-hint">
            最多携带 {MAX_CARRIED_ARROWS} 种箭矢参战。
          </p>
          <div className="prep-arrow-list">
            {physicalArrows.map((arrow) => {
              const selected = arrowIds.includes(arrow.itemId);
              const quantity = getInventoryQuantity(player.inventory, arrow.itemId);
              return (
                <button
                  key={arrow.itemId}
                  type="button"
                  className={`prep-toggle ${selected ? "selected" : ""}`}
                  onClick={() => toggleArrow(arrow.itemId)}
                  disabled={!selected && arrowIds.length >= MAX_CARRIED_ARROWS}
                >
                  <span className="prep-toggle-name">{arrow.name}</span>
                  <small>
                    {isSparring ? "演武无限" : `库存 x${quantity}`} · 威{arrow.power} · 准
                    {Math.round(arrow.accuracy * 100)}%
                  </small>
                </button>
              );
            })}
            {spiritArrows.map((tier) => {
              const selected = arrowIds.includes(tier.id);
              return (
                <button
                  key={tier.id}
                  type="button"
                  className={`prep-toggle spirit ${selected ? "selected" : ""}`}
                  onClick={() => toggleArrow(tier.id)}
                  disabled={!selected && arrowIds.length >= MAX_CARRIED_ARROWS}
                >
                  <span className="prep-toggle-name">{tier.name}</span>
                  <small>
                    {isSparring ? "演武无限" : `灵${tier.manaCost}`} · 威
                    {getSpiritArrowPower(player, tier)} · 准
                    {Math.round(tier.accuracy * 100)}%
                  </small>
                </button>
              );
            })}
            {physicalArrows.length === 0 && spiritArrows.length === 0 && (
              <p className="prep-hint">没有任何可用箭矢，请先补充箭矢或提升境界解锁灵力化箭。</p>
            )}
          </div>
        </section>

        {/* 丹药携带（演武无需） */}
        {!isSparring && (
          <section className="prep-section">
            <h2 className="prep-section-title">
              携带丹药
              <small>
                {pillIds.length}/{MAX_CARRIED_PILLS}
              </small>
            </h2>
            {pillCandidates.length > 0 ? (
              <div className="prep-arrow-list">
                {pillCandidates.map((pill) => {
                  const selected = pillIds.includes(pill.itemId);
                  const quantity = getInventoryQuantity(player.inventory, pill.itemId);
                  const effectText = [
                    pill.effects.heal ? `回血 ${pill.effects.heal}` : "",
                    pill.effects.restoreMana ? `回灵 ${pill.effects.restoreMana}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <button
                      key={pill.itemId}
                      type="button"
                      className={`prep-toggle ${selected ? "selected" : ""}`}
                      onClick={() => togglePill(pill.itemId)}
                      disabled={!selected && pillIds.length >= MAX_CARRIED_PILLS}
                    >
                      <span className="prep-toggle-name">{pill.name}</span>
                      <small>
                        库存 x{quantity} · {effectText}
                      </small>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="prep-hint">
                背包中没有可带入战斗的丹药（回春丹 / 回灵丹），可在炼丹页炼制。
              </p>
            )}
          </section>
        )}

        {/* 撤退策略（演武无需） */}
        {!isSparring && (
          <section className="prep-section">
            <h2 className="prep-section-title">撤退策略</h2>
            <div className="prep-retreat-list">
              {retreatOptions.map((option) => (
                <label
                  key={option.value}
                  className={`prep-retreat-option ${retreatRule === option.value ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="retreat-rule"
                    checked={retreatRule === option.value}
                    onChange={() => setRetreatRule(option.value)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="battle-prep-footer">
        <button
          type="button"
          className="prep-confirm-button"
          disabled={arrowIds.length === 0}
          onClick={handleConfirm}
        >
          {isBoss ? "挑战守关者" : isSparring ? "下场演武" : "出战"}
        </button>
      </div>
    </div>
  );
};
