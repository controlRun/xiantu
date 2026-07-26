import { getItemDefinition } from "../../data/items";
import type { BattleResult as BattleResultType } from "../../types/game";

interface BattleResultProps {
  result: BattleResultType;
  onContinue: () => void;
}

export const BattleResult = ({ result, onContinue }: BattleResultProps) => {
  const isVictory = result.victory;
  const penalty = result.penalty;
  const hasPenalty =
    penalty !== undefined &&
    (penalty.injury > 0 ||
      penalty.lostStones > 0 ||
      penalty.lostItems.length > 0 ||
      penalty.lostDays > 0);

  return (
    <div className={`battle-result-overlay ${isVictory ? "victory" : "defeat"}`}>
      <div className="result-content">
        <div className="result-icon">
          {isVictory ? "🏆" : "💀"}
        </div>
        <h1 className="result-title">
          {isVictory ? "胜利" : "失败"}
        </h1>
        <p className="result-subtitle">
          {isVictory
            ? "恭喜你战胜了对手！"
            : result.isSparring
              ? "切磋落败，对方点到为止。"
              : result.retreated
                ? "主动撤退，虽败犹存性命。"
                : "战斗失败，继续修炼！"}
        </p>
        <div className="result-rewards">
          <div className="reward-item">
            <span className="reward-label">灵石</span>
            <span className="reward-value">+{result.reward.spiritStones}</span>
          </div>
          <div className="reward-item">
            <span className="reward-label">修为</span>
            <span className="reward-value">+{result.reward.cultivation}</span>
          </div>
        </div>
        {hasPenalty && penalty && (
          <div className="result-penalty">
            <p className="result-penalty-title">此战代价</p>
            <ul className="result-penalty-list">
              {penalty.injury > 0 && <li>伤势 +{penalty.injury}</li>}
              {penalty.lostStones > 0 && (
                <li>灵石 −{penalty.lostStones}</li>
              )}
              {penalty.lostItems.map((lost) => (
                <li key={lost.itemId}>
                  {getItemDefinition(lost.itemId)?.name ?? lost.itemId} −
                  {lost.quantity}
                </li>
              ))}
              {penalty.lostDays > 0 && (
                <li>调养疗伤，耗费 {penalty.lostDays} 日寿元</li>
              )}
            </ul>
          </div>
        )}
        <button className="result-continue-btn" onClick={onContinue}>
          继续
        </button>
      </div>
    </div>
  );
};
