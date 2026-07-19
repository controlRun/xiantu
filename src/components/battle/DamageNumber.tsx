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
    if (isVisible) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 1000);
      return () => clearTimeout(timer);
    }
    setShow(false);
  }, [isVisible]);

  if (!show) {
    return null;
  }

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fill={isCritical ? "#e85d5d" : "#f2dfaa"}
      fontSize={isCritical ? "24" : "18"}
      fontWeight="700"
      className="damage-float"
    >
      {isCritical ? "暴击! " : ""}
      {value}
    </text>
  );
};
