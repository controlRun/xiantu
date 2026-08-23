/**
 * NPC 系统：一次性馈赠（幂等）+ 好感/赠礼/世事反馈/人情托付。
 * 全部纯函数，状态经 Player 传入传出；关系状态持久化在 player.npcRelations。
 */

import { getItemDefinition } from "../data/items";
import {
  getNpcDailyLines,
  type NpcDefinition,
  type NpcErrand,
  type NpcGift,
  type NpcReactionCond,
} from "../data/npcs";
import { getRealmById } from "../data/realms";
import type {
  ItemRarity,
  NpcFavorTierKey,
  NpcRelationState,
  Player,
} from "../types/game";
import {
  addItemStacks,
  consumeItemCosts,
  getInventoryQuantity,
  hasItemCosts,
} from "./inventorySystem";
import { advanceTime, getGameDay } from "./timeSystem";

export interface NpcGiftResult {
  player: Player;
  /** 本次是否实际发放（无馈赠或已领 → false） */
  granted: boolean;
  message: string;
}

/** 领取 NPC 一次性馈赠：幂等，重复领取原样返回 */
export const claimNpcGift = (
  player: Player,
  npc: NpcDefinition,
): NpcGiftResult => {
  const gift = npc.gift;

  if (!gift || player.npcGiftClaimedIds.includes(npc.id)) {
    return { player, granted: false, message: "" };
  }

  const gains: string[] = [];
  let nextPlayer: Player = player;

  if (gift.spiritStones && gift.spiritStones > 0) {
    nextPlayer = {
      ...nextPlayer,
      spiritStones: nextPlayer.spiritStones + gift.spiritStones,
    };
    gains.push(`灵石 x${gift.spiritStones}`);
  }

  if (gift.itemId) {
    const item = getItemDefinition(gift.itemId);
    const quantity = gift.quantity ?? 1;
    nextPlayer = {
      ...nextPlayer,
      inventory: addItemStacks(nextPlayer.inventory, [
        { itemId: gift.itemId, quantity },
      ]),
    };
    gains.push(`${item?.name ?? gift.itemId} x${quantity}`);
  }

  nextPlayer = {
    ...nextPlayer,
    npcGiftClaimedIds: [...nextPlayer.npcGiftClaimedIds, npc.id],
  };

  const giftLine = gains.length > 0 ? `得${gains.join("、")}` : "";
  const maximLine = gift.maxim ? `「${gift.maxim}」` : "";
  const message = [`${npc.name}赠你一份见面礼`, giftLine, maximLine]
    .filter((part) => part.length > 0)
    .join("，");

  // 对话不耗时日，advanceTime 仅刷新 updatedAt
  return { player: advanceTime(nextPlayer, 0), granted: true, message };
};

/* ------------------------------------------------------------------ */
/* 好感与分阶                                                          */
/* ------------------------------------------------------------------ */

/** 好感分阶：泛泛 → 熟识 → 知己 → 莫逆 */
export const FAVOR_TIERS: ReadonlyArray<{
  key: NpcFavorTierKey;
  name: string;
  min: number;
}> = [
  { key: "stranger", name: "泛泛", min: 0 },
  { key: "acquainted", name: "熟识", min: 20 },
  { key: "intimate", name: "知己", min: 60 },
  { key: "soulmate", name: "莫逆", min: 120 },
];

/** 赠礼好感：按品级；命中偏好翻倍 */
const RARITY_FAVOR: Record<ItemRarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 5,
  epic: 10,
};

const DAILY_TALK_FAVOR = 1;
const LIKED_FAVOR_MULT = 2;
/** 知己分阶门槛（FAVOR_TIERS[2].min），台词/托付按此判定 */
export const INTIMATE_FAVOR = 60;

const freshRelation = (): NpcRelationState => ({
  favor: 0,
  lastTalkDay: 0,
  reactionShown: [],
  claimedTiers: [],
  errand: null,
});

/** 读关系状态；无则全新默认（不改原对象） */
export const getNpcRelation = (
  player: Player,
  npcId: string,
): NpcRelationState => player.npcRelations[npcId] ?? freshRelation();

const withNpcRelation = (
  player: Player,
  npcId: string,
  relation: NpcRelationState,
): Player => ({
  ...player,
  npcRelations: { ...player.npcRelations, [npcId]: relation },
});

/** 好感 → 最高命中的分阶 */
export const getFavorTier = (favor: number) => {
  let tier = FAVOR_TIERS[0];
  for (const candidate of FAVOR_TIERS) {
    if (favor >= candidate.min) tier = candidate;
  }
  return tier;
};

/* ------------------------------------------------------------------ */
/* 世事反馈（reactions）                                               */
/* ------------------------------------------------------------------ */

const matchesReactionCond = (player: Player, cond: NpcReactionCond): boolean => {
  switch (cond.kind) {
    case "bossKilled":
      return player.stats.bossesKilled > 0;
    case "monstersKilled":
      return player.stats.monstersKilled >= cond.count;
    case "realmOrder":
      return getRealmById(player.realmId).order >= cond.order;
    case "sectRank":
      return player.sectRank >= cond.min;
    case "injury":
      return player.injury >= cond.min;
  }
};

export interface NpcLineSelection {
  lines: string[];
  /** 本次命中的世事反馈 id；无则 null（讲过一次入 reactionShown） */
  reactionId: string | null;
}

/**
 * 选台词：馈赠未领 → firstLines；否则首条未讲且命中的反馈 → 知己档 closeLines → 日常随机。
 * rng 可注入，保冒烟确定性。
 */
export const selectNpcLines = (
  player: Player,
  npc: NpcDefinition,
  rng: () => number = Math.random,
): NpcLineSelection => {
  const giftPending = !!npc.gift && !player.npcGiftClaimedIds.includes(npc.id);
  if (giftPending) {
    return { lines: npc.firstLines, reactionId: null };
  }

  const relation = getNpcRelation(player, npc.id);

  if (npc.reactions && npc.reactions.length > 0) {
    const pending = npc.reactions.find(
      (reaction) =>
        !relation.reactionShown.includes(reaction.id) &&
        matchesReactionCond(player, reaction.cond),
    );
    if (pending) {
      return { lines: pending.lines, reactionId: pending.id };
    }
  }

  if (npc.closeLines && npc.closeLines.length > 0 && relation.favor >= INTIMATE_FAVOR) {
    const index = Math.min(
      Math.floor(rng() * npc.closeLines.length),
      npc.closeLines.length - 1,
    );
    return { lines: npc.closeLines[index], reactionId: null };
  }

  return { lines: getNpcDailyLines(npc, rng), reactionId: null };
};

export interface NpcTalkResult {
  player: Player;
  favorGained: number;
}

/** 记一次交谈：非今日首谈 +1 好感；若命中世事反馈则标记已讲 */
export const recordTalk = (
  player: Player,
  npc: NpcDefinition,
  reactionId: string | null,
): NpcTalkResult => {
  const today = getGameDay(player);
  const relation = getNpcRelation(player, npc.id);
  const favorGained = relation.lastTalkDay === today ? 0 : DAILY_TALK_FAVOR;
  const nextRelation: NpcRelationState = {
    ...relation,
    favor: relation.favor + favorGained,
    lastTalkDay: today,
    reactionShown: reactionId
      ? [...relation.reactionShown, reactionId]
      : relation.reactionShown,
  };
  return {
    player: advanceTime(withNpcRelation(player, npc.id, nextRelation), 0),
    favorGained,
  };
};

/* ------------------------------------------------------------------ */
/* 赠礼                                                               */
/* ------------------------------------------------------------------ */

export interface NpcGiftGiveResult {
  player: Player;
  ok: boolean;
  favorGained: number;
  liked: boolean;
  reaction: string;
  message: string;
}

/** 投赠 1 件物品：扣物 + 好感（偏好翻倍），返回反应台词 */
export const giftToNpc = (
  player: Player,
  npc: NpcDefinition,
  itemId: string,
): NpcGiftGiveResult => {
  const item = getItemDefinition(itemId);
  if (!item || getInventoryQuantity(player.inventory, itemId) < 1) {
    return {
      player,
      ok: false,
      favorGained: 0,
      liked: false,
      reaction: "",
      message: "身上并无此物",
    };
  }

  const liked = !!npc.likes?.includes(itemId);
  const base = RARITY_FAVOR[item.rarity];
  const favorGained = liked ? base * LIKED_FAVOR_MULT : base;
  const relation = getNpcRelation(player, npc.id);
  const reaction = liked
    ? `「${item.name}……有心了。这礼，我记下了。」`
    : `「${item.name}……也罢，收下了。」`;

  const nextPlayer = withNpcRelation(
    {
      ...player,
      inventory: consumeItemCosts(player.inventory, [{ itemId, quantity: 1 }]),
    },
    npc.id,
    { ...relation, favor: relation.favor + favorGained },
  );

  return {
    player: advanceTime(nextPlayer, 0),
    ok: true,
    favorGained,
    liked,
    reaction,
    message: `赠予${npc.name}${item.name} ×1，好感 +${favorGained}。${reaction}`,
  };
};

/* ------------------------------------------------------------------ */
/* 分阶回礼                                                           */
/* ------------------------------------------------------------------ */

/** 发放一份 NpcGift（灵石/物品），返回增益清单；不记 NPC 领取标记 */
const applyGift = (
  player: Player,
  gift: NpcGift,
): { player: Player; gains: string[] } => {
  const gains: string[] = [];
  let nextPlayer: Player = player;

  if (gift.spiritStones && gift.spiritStones > 0) {
    nextPlayer = {
      ...nextPlayer,
      spiritStones: nextPlayer.spiritStones + gift.spiritStones,
    };
    gains.push(`灵石 x${gift.spiritStones}`);
  }

  if (gift.itemId) {
    const item = getItemDefinition(gift.itemId);
    const quantity = gift.quantity ?? 1;
    nextPlayer = {
      ...nextPlayer,
      inventory: addItemStacks(nextPlayer.inventory, [
        { itemId: gift.itemId, quantity },
      ]),
    };
    gains.push(`${item?.name ?? gift.itemId} x${quantity}`);
  }

  return { player: nextPlayer, gains };
};

export interface NpcTierRewardResult {
  player: Player;
  granted: boolean;
  message: string;
}

/** 好感跨入新分阶时发放该阶回礼（每阶一次） */
export const claimTierReward = (
  player: Player,
  npc: NpcDefinition,
): NpcTierRewardResult => {
  const relation = getNpcRelation(player, npc.id);
  const tier = getFavorTier(relation.favor);
  const gift = npc.tierGifts?.[tier.key];

  if (!gift || relation.claimedTiers.includes(tier.key)) {
    return { player, granted: false, message: "" };
  }

  const { player: afterGift, gains } = applyGift(player, gift);
  const relationAfter = getNpcRelation(afterGift, npc.id);
  const result = withNpcRelation(afterGift, npc.id, {
    ...relationAfter,
    claimedTiers: [...relationAfter.claimedTiers, tier.key],
  });

  const giftLine = gains.length > 0 ? `得${gains.join("、")}` : "";
  const maximLine = gift.maxim ? `「${gift.maxim}」` : "";
  const message = [`${npc.name}道你已是${tier.name}之交`, giftLine, maximLine]
    .filter((part) => part.length > 0)
    .join("，");

  return { player: advanceTime(result, 0), granted: true, message };
};

/* ------------------------------------------------------------------ */
/* 人情托付                                                           */
/* ------------------------------------------------------------------ */

export const getActiveErrand = (
  player: Player,
  npc: NpcDefinition,
): NpcErrand | null => {
  const state = getNpcRelation(player, npc.id).errand;
  if (!state) return null;
  return npc.errands?.find((errand) => errand.id === state.errandId) ?? null;
};

export const getErrandDaysLeft = (
  player: Player,
  npc: NpcDefinition,
): number | null => {
  const state = getNpcRelation(player, npc.id).errand;
  if (!state) return null;
  const errand = npc.errands?.find((e) => e.id === state.errandId);
  if (!errand) return null;
  return errand.timeLimitDays - (getGameDay(player) - state.acceptedDay);
};

export const isErrandOverdue = (
  player: Player,
  npc: NpcDefinition,
): boolean => (getErrandDaysLeft(player, npc) ?? 0) < 0;

export interface NpcErrandAcceptResult {
  player: Player;
  ok: boolean;
  message: string;
}

/** 接受托付：校验托付存在、无在途、好感达标 */
export const acceptNpcErrand = (
  player: Player,
  npc: NpcDefinition,
  errandId: string,
): NpcErrandAcceptResult => {
  const errand = npc.errands?.find((e) => e.id === errandId);
  if (!errand) {
    return { player, ok: false, message: `${npc.name}并无此托付` };
  }

  const relation = getNpcRelation(player, npc.id);
  if (relation.errand) {
    return { player, ok: false, message: "你已受托付在身，先把手上这事办了" };
  }
  if (relation.favor < errand.minFavor) {
    return { player, ok: false, message: `交情未到，${npc.name}不便相托` };
  }

  const nextRelation: NpcRelationState = {
    ...relation,
    errand: { errandId, acceptedDay: getGameDay(player) },
  };

  return {
    player: advanceTime(withNpcRelation(player, npc.id, nextRelation), 0),
    ok: true,
    message: `你接下了${npc.name}的托付：「${errand.name}」——${errand.description}`,
  };
};

export interface NpcErrandCompleteResult {
  player: Player;
  ok: boolean;
  message: string;
}

/** 交付托付：物资齐则扣物 + 好感 + 奖励，清在途；逾期附「误期」话 */
export const completeNpcErrand = (
  player: Player,
  npc: NpcDefinition,
): NpcErrandCompleteResult => {
  const relation = getNpcRelation(player, npc.id);
  const state = relation.errand;
  const errand = state
    ? npc.errands?.find((e) => e.id === state.errandId)
    : undefined;

  if (!state || !errand) {
    return { player, ok: false, message: "你身上并无要交付的托付" };
  }
  if (!hasItemCosts(player.inventory, errand.requires)) {
    const missing = errand.requires
      .map((cost) => {
        const item = getItemDefinition(cost.itemId);
        return `${item?.name ?? cost.itemId} ×${cost.quantity}`;
      })
      .join("、");
    return { player, ok: false, message: `物资未备齐，还差${missing}` };
  }

  const overdue = getGameDay(player) > state.acceptedDay + errand.timeLimitDays;
  const overdueLine = overdue ? "虽误了些时日，到底交到了" : "";

  let nextPlayer: Player = {
    ...player,
    inventory: consumeItemCosts(player.inventory, errand.requires),
  };

  const relationAfter = getNpcRelation(nextPlayer, npc.id);
  nextPlayer = withNpcRelation(nextPlayer, npc.id, {
    ...relationAfter,
    favor: relationAfter.favor + errand.rewards.favor,
    errand: null,
  });

  const gains: string[] = [];
  if (errand.rewards.spiritStones && errand.rewards.spiritStones > 0) {
    nextPlayer = {
      ...nextPlayer,
      spiritStones:
        nextPlayer.spiritStones + errand.rewards.spiritStones,
    };
    gains.push(`灵石 x${errand.rewards.spiritStones}`);
  }
  if (errand.rewards.itemRewards && errand.rewards.itemRewards.length > 0) {
    nextPlayer = {
      ...nextPlayer,
      inventory: addItemStacks(nextPlayer.inventory, errand.rewards.itemRewards),
    };
    gains.push(
      errand.rewards.itemRewards
        .map(
          (cost) =>
            `${getItemDefinition(cost.itemId)?.name ?? cost.itemId} ×${cost.quantity}`,
        )
        .join("、"),
    );
  }

  const maximLine = errand.rewards.maxim
    ? `「${errand.rewards.maxim}」`
    : "";
  const message = [
    `你完成了${npc.name}的托付：「${errand.name}」`,
    gains.length > 0 ? `得${gains.join("、")}` : "",
    `好感 +${errand.rewards.favor}`,
    maximLine,
    overdueLine,
  ]
    .filter((part) => part.length > 0)
    .join("，");

  return { player: advanceTime(nextPlayer, 0), ok: true, message };
};
