/**
 * 伤势系统：战败/突破失败累积伤势（0–100），
 * 伤势越高，战斗伤害、命中与修炼效率越低。
 * 静养 −15、化瘀丹 −40。
 */

export const MAX_INJURY = 100;

export const clampInjury = (value: number) =>
  Math.min(MAX_INJURY, Math.max(0, Math.round(value)));

export interface InjuryPenalty {
  /** 战斗伤害倍率（1 为无损） */
  damageMul: number;
  /** 命中惩罚（负值，直接加到命中率上） */
  hitPenalty: number;
  /** 修炼效率倍率（1 为无损） */
  cultivationMul: number;
}

export const getInjuryPenalty = (injury: number): InjuryPenalty => {
  const value = clampInjury(injury);

  return {
    damageMul: 1 - value * 0.003,
    hitPenalty: -value * 0.002,
    cultivationMul: 1 - value * 0.004,
  };
};

/** 面板用文案：伤势 50 → 伤害 −15%、命中 −10%、修炼 −20% */
export const describeInjuryPenalty = (injury: number): string[] => {
  const { damageMul, hitPenalty, cultivationMul } = getInjuryPenalty(injury);

  return [
    `战斗伤害 −${Math.round((1 - damageMul) * 100)}%`,
    `命中 −${Math.round(-hitPenalty * 100)}%`,
    `修炼效率 −${Math.round((1 - cultivationMul) * 100)}%`,
  ];
};
