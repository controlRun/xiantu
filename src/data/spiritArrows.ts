import { getRealmById } from "./realms";
import type { Player } from "../types/game";

/** 灵力化箭档位：id 统一以 "spirit-" 前缀区分于实物箭矢 */
export interface SpiritArrowTier {
  id: string;
  name: string;
  /** 每射一箭消耗的灵力 */
  manaCost: number;
  /** 基础威力（实际威力随境界成长） */
  basePower: number;
  /** 每层境界追加的威力系数 */
  realmPowerScale: number;
  accuracy: number;
  /** 解锁所需境界 order（凡人 order 0 不可用） */
  minRealmOrder: number;
  /** 解锁提示文案 */
  unlockHint: string;
  description: string;
}

export const SPIRIT_ARROW_PREFIX = "spirit-";

/**
 * 灵力化箭：无需箭囊，以灵力凝气成箭。
 * 消耗越高，威力越强；威力另随境界（等级与修为）成长。
 */
export const spiritArrowTiers: SpiritArrowTier[] = [
  {
    id: "spirit-qi",
    name: "凝气箭",
    manaCost: 4,
    basePower: 7,
    realmPowerScale: 1.2,
    accuracy: 0.85,
    minRealmOrder: 1,
    unlockHint: "炼气一层解锁",
    description: "引灵气凝于指尖化为一箭，威力平平，胜在无需箭囊。",
  },
  {
    id: "spirit-gather",
    name: "聚灵箭",
    manaCost: 8,
    basePower: 12,
    realmPowerScale: 1.5,
    accuracy: 0.8,
    minRealmOrder: 3,
    unlockHint: "炼气三层解锁",
    description: "聚周身灵力于一线，箭身隐有光华，威力倍增。",
  },
  {
    id: "spirit-light",
    name: "玄光箭",
    manaCost: 14,
    basePower: 18,
    realmPowerScale: 1.8,
    accuracy: 0.76,
    minRealmOrder: 6,
    unlockHint: "炼气六层解锁",
    description: "灵力凝实如玄光离弦，破空有声，寻常护体灵气难以抵挡。",
  },
  {
    id: "spirit-void",
    name: "破虚箭",
    manaCost: 24,
    basePower: 26,
    realmPowerScale: 2.2,
    accuracy: 0.72,
    minRealmOrder: 10,
    unlockHint: "筑基初期解锁",
    description: "筑基修士方可驾驭的灵力化箭，箭出隐有破虚之势，威力骇人。",
  },
];

/**
 * 判定是否灵力化箭：必须精确匹配已登记的档位 id。
 *
 * 早先按 "spirit-" 前缀粗判，但实物箭「破灵箭」(spirit-piercing-arrow) 同样以
 * spirit- 开头，会被误判为灵力箭——getSpiritArrowTier 查无此档返回 undefined，
 * getCombatArrow 随之返回 undefined，shootArrow 便以「没有这种箭矢」拒发：
 * 不扣箭、无伤害、无敌方回合，战斗卡死在命中演出之后。
 * 改为按档位精确匹配，彻底杜绝此类命名碰撞。
 */
export const isSpiritArrowId = (arrowId: string) =>
  spiritArrowTiers.some((tier) => tier.id === arrowId);

export const getSpiritArrowTier = (arrowId: string): SpiritArrowTier | undefined =>
  spiritArrowTiers.find((tier) => tier.id === arrowId);

/** 当前境界已解锁的灵力箭（不看灵力余量，用于 UI 展示） */
export const getUnlockedSpiritArrowTiers = (player: Player): SpiritArrowTier[] => {
  const realm = getRealmById(player.realmId);

  return spiritArrowTiers.filter(
    (tier) => realm.order >= tier.minRealmOrder,
  );
};

/** 当前灵力足够支付的已解锁灵力箭（用于判断能否出战） */
export const getUsableSpiritArrowTiers = (player: Player): SpiritArrowTier[] =>
  getUnlockedSpiritArrowTiers(player).filter(
    (tier) => player.mana.current >= tier.manaCost,
  );

/** 灵力箭有效威力：基础威力 + 境界层数 × 成长系数（战斗公式另有全局境界加成） */
export const getSpiritArrowPower = (
  player: Player,
  tier: SpiritArrowTier,
): number => {
  const realm = getRealmById(player.realmId);

  return tier.basePower + Math.floor(realm.order * tier.realmPowerScale);
};
