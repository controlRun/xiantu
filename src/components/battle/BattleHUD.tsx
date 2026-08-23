import type {
  ArcheryDuelState,
  ArrowDefinition,
  BattleStatusEffect,
  BattleStatusKind,
  Player,
  TargetZoneId,
} from "../../types/game";
import { getInventoryQuantity } from "../../systems/inventorySystem";
import { targetZones } from "../../data/arrows";
import { getSpiritArrowPower, type SpiritArrowTier } from "../../data/spiritArrows";

interface BattleHUDProps {
  duel: ArcheryDuelState;
  player: Player;
  availableArrows: ArrowDefinition[];
  /** 当前境界已解锁的灵力化箭档位 */
  spiritArrows: SpiritArrowTier[];
  selectedArrowId: string;
  currentZone: TargetZoneId;
  hitChance: number;
  criticalChance: number;
  drawPower: number;
  canShoot: boolean;
  canSelectArrow: boolean;
  onSelectArrow: (arrowId: string) => void;
  monsterHealthPercent: number;
  playerHealthPercent: number;
}

const zoneLabels: Record<TargetZoneId, string> = {
  head: "头部",
  chest: "胸腹",
  arm: "手臂",
  leg: "腿部",
};

const statusLabels: Record<BattleStatusKind, string> = {
  poison: "中毒",
  stun: "眩晕",
  armorbreak: "破甲",
};

const getStatusEntries = (
  statuses: ArcheryDuelState["enemyStatuses"],
): [BattleStatusKind, BattleStatusEffect][] =>
  (Object.entries(statuses ?? {}) as [BattleStatusKind, BattleStatusEffect][]).filter(
    ([, effect]) => effect && effect.stacks > 0,
  );

export const BattleHUD = ({
  duel,
  player,
  availableArrows,
  spiritArrows,
  selectedArrowId,
  currentZone,
  hitChance,
  criticalChance,
  drawPower,
  canShoot,
  canSelectArrow,
  onSelectArrow,
  monsterHealthPercent,
  playerHealthPercent,
}: BattleHUDProps) => {
  const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
  const enemyStatuses = getStatusEntries(duel.enemyStatuses);
  const playerStatuses = getStatusEntries(duel.playerStatuses);

  return (
    <div className="battle-hud">
      {/* Health bars */}
      <div className="health-bars">
        <div className="health-bar-row">
          <span className="health-label">敌</span>
          <div className="health-bar">
            <div
              className="health-bar-fill enemy"
              style={{ width: `${monsterHealthPercent}%` }}
            />
          </div>
          <span className="health-value">
            {duel.endless ? "∞" : `${duel.monsterHealth}/${duel.monster.health}`}
          </span>
        </div>
        <div className="health-bar-row">
          <span className="health-label">我</span>
          <div className="health-bar">
            <div
              className="health-bar-fill player"
              style={{ width: `${playerHealthPercent}%` }}
            />
          </div>
          <span className="health-value">
            {duel.playerHealth}/{player.health.max}
          </span>
        </div>
      </div>

      {/* 敌方部位 debuff + 战斗状态徽章：腿伤降准头、臂伤削反击、毒/眩晕/破甲等 */}
      {((duel.enemyDebuffs?.leg ?? 0) > 0 ||
        (duel.enemyDebuffs?.arm ?? 0) > 0 ||
        enemyStatuses.length > 0) && (
        <div className="enemy-debuffs">
          {(duel.enemyDebuffs?.leg ?? 0) > 0 && (
            <span className="debuff-badge leg">腿伤 x{duel.enemyDebuffs?.leg}</span>
          )}
          {(duel.enemyDebuffs?.arm ?? 0) > 0 && (
            <span className="debuff-badge arm">臂伤 x{duel.enemyDebuffs?.arm}</span>
          )}
          {enemyStatuses.map(([kind, effect]) => (
            <span key={kind} className={`debuff-badge status ${kind}`}>
              {statusLabels[kind]} x{effect.stacks}
            </span>
          ))}
        </div>
      )}

      {/* 玩家战斗状态徽章：被反击命中挂上的毒/破甲等 */}
      {playerStatuses.length > 0 && (
        <div className="player-statuses">
          {playerStatuses.map(([kind, effect]) => (
            <span key={kind} className={`debuff-badge status ${kind} player`}>
              {statusLabels[kind]} x{effect.stacks}
            </span>
          ))}
        </div>
      )}

      {/* Round indicator */}
      <div className="round-indicator">
        第 {duel.round} 回合
      </div>

      {/* Stats display */}
      <div className="battle-stats">
        <div className="stat-item">
          <span className="stat-label">命中</span>
          <span className="stat-value">{formatPercent(hitChance)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">暴击</span>
          <span className="stat-value">{formatPercent(criticalChance)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">部位</span>
          <span className="stat-value">{zoneLabels[currentZone]}</span>
        </div>
        {drawPower > 0 && (
          <div className="stat-item">
            <span className="stat-label">蓄力</span>
            <span className="stat-value">{formatPercent(drawPower)}</span>
          </div>
        )}
      </div>

      {/* Arrow selection */}
      <div className="arrow-selection">
        <strong className="arrow-group-title">箭囊 · 实物箭</strong>
        <div className="arrow-buttons">
          {availableArrows.length > 0 ? (
            availableArrows.map((arrow) => {
              const quantity = getInventoryQuantity(
                player.inventory,
                arrow.itemId,
              );
              // 演武切磋（endless）无消耗：箭矢无限，不受库存限制
              const usable = duel.endless || quantity > 0;
              return (
                <button
                  key={arrow.itemId}
                  type="button"
                  className={`arrow-button ${selectedArrowId === arrow.itemId ? "active" : ""}`}
                  disabled={!canSelectArrow || !usable}
                  onClick={() => onSelectArrow(arrow.itemId)}
                >
                  <span>{arrow.name}</span>
                  <small>{duel.endless ? "∞" : `x${quantity}`}</small>
                </button>
              );
            })
          ) : (
            <p className="arrow-empty-hint">
              {spiritArrows.length > 0
                ? "箭囊空空，可消耗灵力化箭出战"
                : "箭囊空空，请从战斗掉落或炼器中补充箭矢"}
            </p>
          )}
        </div>

        {spiritArrows.length > 0 && (
          <>
            <strong className="arrow-group-title spirit">
              灵力化箭
              <span className="arrow-mana">
                {duel.endless
                  ? "演武无限"
                  : `灵力 ${player.mana.current}/${player.mana.max}`}
              </span>
            </strong>
            <div className="arrow-buttons">
              {spiritArrows.map((tier) => {
                // 演武切磋（endless）无消耗：化箭不耗灵力
                const affordable = duel.endless || player.mana.current >= tier.manaCost;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    className={`arrow-button spirit ${selectedArrowId === tier.id ? "active" : ""}`}
                    disabled={!canSelectArrow || !affordable}
                    onClick={() => onSelectArrow(tier.id)}
                    title={tier.description}
                  >
                    <span>{tier.name}</span>
                    <small>
                      灵{tier.manaCost} · 威{getSpiritArrowPower(player, tier)}
                    </small>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
