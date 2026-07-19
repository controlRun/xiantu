import type { ArcheryDuelState, ArrowDefinition, Player, TargetZoneId } from "../../types/game";
import { getInventoryQuantity } from "../../systems/inventorySystem";
import { targetZones } from "../../data/arrows";

interface BattleHUDProps {
  duel: ArcheryDuelState;
  player: Player;
  availableArrows: ArrowDefinition[];
  selectedArrowId: string;
  currentZone: TargetZoneId;
  hitChance: number;
  criticalChance: number;
  drawPower: number;
  canShoot: boolean;
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

export const BattleHUD = ({
  duel,
  player,
  availableArrows,
  selectedArrowId,
  currentZone,
  hitChance,
  criticalChance,
  drawPower,
  canShoot,
  onSelectArrow,
  monsterHealthPercent,
  playerHealthPercent,
}: BattleHUDProps) => {
  const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

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
            {duel.monsterHealth}/{duel.monster.health}
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
        <strong>选择箭矢</strong>
        <div className="arrow-buttons">
          {availableArrows.map((arrow) => {
            const quantity = getInventoryQuantity(
              player.inventory,
              arrow.itemId,
            );
            return (
              <button
                key={arrow.itemId}
                type="button"
                className={`arrow-button ${selectedArrowId === arrow.itemId ? "active" : ""}`}
                disabled={!canShoot || quantity <= 0}
                onClick={() => onSelectArrow(arrow.itemId)}
              >
                <span>{arrow.name}</span>
                <small>x{quantity}</small>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
