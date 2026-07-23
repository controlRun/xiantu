import type {
  ArrowDefinition,
  TargetZoneDefinition,
  TargetZoneId,
} from "../types/game";

export const arrowDefinitions: ArrowDefinition[] = [
  {
    itemId: "wooden-arrow",
    name: "木羽箭",
    power: 10,
    accuracy: 0.88,
    description: "以硬木削成的普通箭矢，命中稳定，适合试探与补刀。",
  },
  {
    itemId: "wolf-fang-arrow",
    name: "狼牙箭",
    power: 14,
    accuracy: 0.82,
    description: "狼牙磨制箭头，威力介于木铁之间，量大易得。",
  },
  {
    itemId: "iron-arrow",
    name: "精铁箭",
    power: 18,
    accuracy: 0.76,
    description: "箭头淬有精铁，威力更足，但飞行稍沉。",
  },
  {
    itemId: "mist-feather-arrow",
    name: "雾羽箭",
    power: 16,
    accuracy: 0.9,
    description: "雾狐尾羽为翎，飞行极稳，命中之冠。",
  },
  {
    itemId: "serpent-scale-arrow",
    name: "玄鳞箭",
    power: 24,
    accuracy: 0.72,
    description: "玄蛇硬鳞熔铸箭头，破甲之力强于精铁。",
  },
  {
    itemId: "spirit-piercing-arrow",
    name: "破灵箭",
    power: 30,
    accuracy: 0.62,
    description: "刻入破灵纹的昂贵箭矢，伤害极高，适合瞄准要害。",
  },
];

export const targetZones: TargetZoneDefinition[] = [
  {
    id: "head",
    name: "头部",
    accuracyModifier: -0.28,
    damageMultiplier: 2.2,
    criticalChance: 0.25,
    description: "最难命中，一旦射中往往足以重创敌人。",
  },
  {
    id: "chest",
    name: "胸腹",
    accuracyModifier: 0,
    damageMultiplier: 1.15,
    criticalChance: 0.1,
    description: "攻守均衡的目标，适合稳定压低气血。",
  },
  {
    id: "arm",
    name: "手臂",
    accuracyModifier: 0.12,
    damageMultiplier: 0.85,
    criticalChance: 0.05,
    description: "容易命中，可削弱对方架势，伤害偏低。",
  },
  {
    id: "leg",
    name: "腿部",
    accuracyModifier: 0.1,
    damageMultiplier: 0.75,
    criticalChance: 0.05,
    description: "命中较稳，适合保守换血。",
  },
];

export const getArrowDefinition = (itemId: string) =>
  arrowDefinitions.find((arrow) => arrow.itemId === itemId);

export const getTargetZone = (targetId: TargetZoneId) =>
  targetZones.find((target) => target.id === targetId) ?? targetZones[1];
