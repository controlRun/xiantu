import { useState } from "react";

interface BattleLogProps {
  logs: string[];
}

export const BattleLog = ({ logs }: BattleLogProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="battle-log-container">
      <button
        type="button"
        className="battle-log-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>战斗日志</span>
        <span className="toggle-icon">{isExpanded ? "▼" : "▶"}</span>
      </button>
      {isExpanded && (
        <ol className="battle-log">
          {logs.map((log, index) => (
            <li key={`${log}-${index}`}>{log}</li>
          ))}
        </ol>
      )}
    </div>
  );
};
