import { useState } from "react";

interface BattleLogProps {
  logs: string[];
}

/** 触屏（coarse 指针）默认折叠日志，留出战场空间；桌面默认展开 */
const prefersCollapsed = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

export const BattleLog = ({ logs }: BattleLogProps) => {
  const [isExpanded, setIsExpanded] = useState(() => !prefersCollapsed());

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
