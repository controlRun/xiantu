/**
 * 丹毒系统：服丹累积丹毒（0–100），
 * 丹毒越高，修炼效率与突破成功率越低（与伤势平行：伤势降战力，丹毒滞修行）。
 * 洗心丹 −40、静养 −10。
 */

export const MAX_PILL_TOXICITY = 100;

export const clampPillToxicity = (value: number) =>
  Math.min(MAX_PILL_TOXICITY, Math.max(0, Math.round(value)));

export interface PillToxicityPenalty {
  /** 修炼效率倍率（1 为无损） */
  cultivationMul: number;
  /** 突破成功率减益（直接减到成功率上） */
  breakthroughPenalty: number;
}

export const getPillToxicityPenalty = (toxicity: number): PillToxicityPenalty => {
  const value = clampPillToxicity(toxicity);

  return {
    cultivationMul: 1 - value * 0.004,
    breakthroughPenalty: value * 0.0015,
  };
};

/** 面板用文案：丹毒 50 → 修炼 −20%、突破 −7.5% */
export const describePillToxicityPenalty = (toxicity: number): string[] => {
  const { cultivationMul, breakthroughPenalty } = getPillToxicityPenalty(toxicity);

  return [
    `修炼效率 −${Math.round((1 - cultivationMul) * 100)}%`,
    `突破成功率 −${Math.round(breakthroughPenalty * 100)}%`,
  ];
};
