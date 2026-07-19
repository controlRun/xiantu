import { useEffect, useState } from "react";

interface ArrowProjectileProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  isFlying: boolean;
  onComplete: () => void;
}

export const ArrowProjectile = ({
  fromX,
  fromY,
  toX,
  toY,
  isFlying,
  onComplete,
}: ArrowProjectileProps) => {
  const [animationProgress, setAnimationProgress] = useState(0);

  useEffect(() => {
    if (!isFlying) {
      setAnimationProgress(0);
      return;
    }

    const duration = 600; // ms
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setAnimationProgress(progress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        onComplete();
      }
    };

    requestAnimationFrame(animate);
  }, [isFlying, onComplete]);

  if (!isFlying || animationProgress >= 1) {
    return null;
  }

  // Calculate current position
  const currentX = fromX + (toX - fromX) * animationProgress;
  const currentY = fromY + (toY - fromY) * animationProgress;

  // Calculate angle
  const angle = Math.atan2(toY - fromY, toX - fromX) * (180 / Math.PI);

  return (
    <g
      className="arrow-projectile"
      style={{
        transform: `translate(${currentX}px, ${currentY}px) rotate(${angle}deg)`,
        transformOrigin: "0 0",
      }}
    >
      {/* Arrow shaft */}
      <line
        x1="0"
        y1="0"
        x2="30"
        y2="0"
        stroke="rgba(239, 232, 210, 0.9)"
        strokeWidth="2"
      />
      {/* Arrow tip */}
      <polygon
        points="30,-3 38,0 30,3"
        fill="rgba(239, 232, 210, 0.9)"
      />
      {/* Arrow fletching */}
      <polygon
        points="0,-4 6,0 0,4"
        fill="rgba(239, 232, 210, 0.6)"
      />
    </g>
  );
};
