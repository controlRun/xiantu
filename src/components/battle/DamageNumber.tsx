import { useEffect, useState } from "react";

interface DamageNumberProps {
  value: number;
  x: number;
  y: number;
  isCritical: boolean;
  isVisible: boolean;
}

export const DamageNumber = ({
  value,
  x,
  y,
  isCritical,
  isVisible,
}: DamageNumberProps) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show if visible AND value > 0 (don't show "0" damage)
    if (isVisible && value > 0) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 1200);
      return () => clearTimeout(timer);
    }
    setShow(false);
  }, [isVisible, value]);

  if (!show) {
    return null;
  }

  return (
    <g className={`damage-number ${isCritical ? "critical" : ""}`}>
      {/* Glow effect for critical hits */}
      {isCritical && (
        <circle
          cx={x}
          cy={y}
          r="30"
          fill="none"
          stroke="rgba(232, 93, 93, 0.6)"
          strokeWidth="3"
          className="damage-glow"
        />
      )}
      <text
        x={x}
        y={y}
        textAnchor="middle"
        fill={isCritical ? "#e85d5d" : "#f2dfaa"}
        fontSize={isCritical ? "28" : "20"}
        fontWeight="700"
        className="damage-float"
        style={{
          filter: isCritical ? "drop-shadow(0 0 8px rgba(232, 93, 93, 0.8))" : "none",
        }}
      >
        {isCritical ? "暴击! " : ""}
        {value}
      </text>
    </g>
  );
};
