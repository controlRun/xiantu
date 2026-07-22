import { useEffect, useState } from "react";

interface EnemyDialogueProps {
  message: string | null;
  onDismiss?: () => void;
}

export const EnemyDialogue = ({ message, onDismiss }: EnemyDialogueProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [message, onDismiss]);

  if (!message || !visible) {
    return null;
  }

  return (
    <div className="enemy-dialogue">
      <div className="dialogue-bubble">
        <p className="dialogue-text">{message}</p>
      </div>
    </div>
  );
};

// Random dialogue generator
export const getEnemyDialogue = (context: "playerAttack" | "enemyAttack" | "playerMiss" | "enemyMiss" | "lowDamage"): string => {
  const dialogues: Record<string, string[]> = {
    playerAttack: [
      "接招吧！",
      "看我的厉害！",
      "这一箭如何？",
      "尝尝这一箭！",
    ],
    enemyAttack: [
      "该我出手了！",
      "轮到我了！",
      "看我反击！",
      "你也接我一箭！",
    ],
    playerMiss: [
      "就这？",
      "射偏了吧？",
      "哈哈，没射中！",
      "再练练吧！",
    ],
    enemyMiss: [
      "可恶，射偏了！",
      "下次不会这么幸运了！",
      "哼，算你躲得快！",
    ],
    lowDamage: [
      "杀伤力不够，还得练！",
      "就这点本事？",
      "不痛不痒！",
      "给我挠痒吗？",
    ],
  };

  const options = dialogues[context];
  return options[Math.floor(Math.random() * options.length)];
};
