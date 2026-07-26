/** 敌方行为档位：三档反击性格，数据驱动，旧怪物缺省落 beast */

import type { MonsterBehaviorId, MonsterDefinition } from "../types/game";

export interface MonsterBehaviorProfile {
  id: MonsterBehaviorId;
  label: string;
  /** 反击命中率加成（叠在基础公式之上） */
  hitModifier: number;
  /** 反击暴击率 */
  critChance: number;
  /** 暴击伤害倍率 */
  critMultiplier: number;
  /** 连击概率（野兽特性：触发后再射一箭） */
  doubleShotChance: number;
  /** 连击时每一箭的伤害倍率 */
  doubleShotDamageScale: number;
  /** 对玩家造成的伤害乘算（守卫出手偏轻） */
  damageScale: number;
  /** 自身防御乘算（守卫特性：在伤害结算里放大 monster.defense） */
  defenseScale: number;
  /** 行为说明（整备页/战斗日志可引用） */
  description: string;
}

export const monsterBehaviors: Record<MonsterBehaviorId, MonsterBehaviorProfile> = {
  beast: {
    id: "beast",
    label: "野兽",
    hitModifier: -0.15,
    critChance: 0.02,
    critMultiplier: 1.5,
    doubleShotChance: 0.3,
    doubleShotDamageScale: 0.6,
    damageScale: 1,
    defenseScale: 1,
    description: "灵智未开，准头欠佳，但攻势急促，常接连扑射。",
  },
  evil: {
    id: "evil",
    label: "邪修",
    hitModifier: 0.03,
    critChance: 0.18,
    critMultiplier: 1.7,
    doubleShotChance: 0,
    doubleShotDamageScale: 1,
    damageScale: 1,
    defenseScale: 1,
    description: "出手阴辣，专攻要害，暴起发难时伤势极重。",
  },
  guard: {
    id: "guard",
    label: "守卫",
    hitModifier: 0.05,
    critChance: 0.04,
    critMultiplier: 1.5,
    doubleShotChance: 0,
    doubleShotDamageScale: 1,
    damageScale: 0.9,
    defenseScale: 1.6,
    description: "守御森严，护体灵气厚重，攻势沉稳而不急。",
  },
};

export const getMonsterBehavior = (monster: MonsterDefinition): MonsterBehaviorProfile =>
  monsterBehaviors[monster.behavior ?? "beast"];
