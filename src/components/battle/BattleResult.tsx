import type { BattleResult as BattleResultType } from "../../types/game";

interface BattleResultProps {
  result: BattleResultType;
  onContinue: () => void;
}

export const BattleResult = ({ result, onContinue }: BattleResultProps) => {
  const isVictory = result.victory;

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
          {isVictory ? "恭喜你战胜了对手！" : "战斗失败，继续修炼！"}
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
        <button className="result-continue-btn" onClick={onContinue}>
          继续
        </button>
      </div>
    </div>
  );
};
