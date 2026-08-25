/**
 * 秘境节点远征系统（二期）
 *
 * 纯函数 player-in/player-out。局状态 player.secretRealmRun 持久化，刷新可续。
 * 战斗节点不走本系统结算，由 App 发起对战、结束后经 settleExpeditionBattle 归并；
 * 非战斗节点（采集/宝箱/禁制/奇遇）由 resolveExpeditionNode 掷收益入 run.loot。
 *
 * 风险动线：深入越远遍历成本（气血/灵力/寿元）越高；战败丢 run.loot（引擎另计战败惩罚，
 * 本系统不叠加 injury/寿元）；主动撤退/通关则 run.loot 入库。
 */

import { getItemDefinition } from "../data/items";
import {
  DEPTH_CHEST_POOLS,
  DEPTH_ENCOUNTER_POOLS,
  DEPTH_GATHER_POOLS,
  DEPTH_NODE_WEIGHTS,
  DEPTH_TRAVERSAL_COST,
  DEPTH_WARD_POOLS,
  EXPEDITION_LOCATION_ID,
  EXPEDITION_MAX_DEPTH,
  getDepthMonsterIds,
  type ExpeditionDrop,
  type LayerDepth,
} from "../data/expeditionNodes";
import { getMonsterById } from "../data/monsters";
import { getRealmById } from "../data/realms";
import type {
  BattleResult,
  ExpeditionNode,
  ExpeditionNodeType,
  ItemCost,
  Player,
  SecretRealmRun,
} from "../types/game";
import { getEquippedWeapon } from "./equipmentSystem";
import { clampInjury } from "./injurySystem";
import { addItemStacks } from "./inventorySystem";
import { getSectPassiveBonuses } from "./sectSystem";
import { advanceTime } from "./timeSystem";

const randomInt = (min: number, max: number) =>
  min + Math.floor(Math.random() * (max - min + 1));

const rollDrops = (drops: ExpeditionDrop[]): ItemCost[] =>
  drops
    .filter((drop) => Math.random() <= drop.chance)
    .map((drop) => ({ itemId: drop.itemId, quantity: drop.quantity }));

const formatLoot = (items: ItemCost[]): string => {
  if (items.length === 0) {
    return "未获得额外物品";
  }

  return items
    .map(
      (item) =>
        `${getItemDefinition(item.itemId)?.name ?? item.itemId} x${item.quantity}`,
    )
    .join("，");
};

const isLayerDepth = (depth: number): depth is LayerDepth =>
  depth >= 1 && depth <= 4;

/** 开局/下潜前的可行性检查（箭矢可用性由 App 侧 availableArrows 另守） */
export interface ExpeditionCheck {
  canStart: boolean;
  missingReasons: string[];
}

export const getExpeditionCheck = (player: Player): ExpeditionCheck => {
  const missingReasons: string[] = [];
  const realm = getRealmById(player.realmId);

  if (realm.order < 9) {
    missingReasons.push("境界不足，秘境深处灵压难承");
  }

  if (player.health.current <= 1) {
    missingReasons.push("气血太低，先调息恢复");
  }

  if (!getEquippedWeapon(player)) {
    missingReasons.push("尚未装备武器，请先在背包中穿戴");
  }

  if (player.secretRealmRun) {
    missingReasons.push("已有远征在途，先结算当前之局");
  }

  return { canStart: missingReasons.length === 0, missingReasons };
};

/** 按层权重掷 3 个异型分支节点 */
export const rollLayerNodes = (
  depth: LayerDepth,
  locationId = EXPEDITION_LOCATION_ID,
): ExpeditionNode[] => {
  const weights = DEPTH_NODE_WEIGHTS[depth];
  const remaining: ExpeditionNodeType[] = Object.keys(weights) as ExpeditionNodeType[];
  const nodes: ExpeditionNode[] = [];

  for (let i = 0; i < 3; i++) {
    const totalWeight = remaining.reduce((sum, type) => sum + weights[type], 0);
    let roll = Math.random() * totalWeight;
    let chosen = remaining[0];

    for (const type of remaining) {
      roll -= weights[type];
      if (roll <= 0) {
        chosen = type;
        break;
      }
    }

    const monsterId =
      chosen === "combat" ? pickDepthMonsterId(depth, locationId) : undefined;
    nodes.push({ id: `d${depth}-n${i}`, type: chosen, resolved: false, monsterId });
    remaining.splice(remaining.indexOf(chosen), 1);
  }

  return nodes;
};

/** 按层候选掷一固定怪 id（掷节点时绑定，展示与应战一致） */
const pickDepthMonsterId = (depth: LayerDepth, locationId: string): string => {
  const ids = getDepthMonsterIds(locationId, depth);
  return ids[randomInt(0, ids.length - 1)];
};

/** 下潜/开局遍历成本：气血·灵力按最大值百分比扣（保底 1/0）+ 折寿 */
export const applyTraversalCost = (player: Player, depth: LayerDepth): Player => {
  const cost = DEPTH_TRAVERSAL_COST[depth];
  // 宗门所长：如碧水宫谙熟秘境周旋，气血/灵力消耗随职位递减（寿元不减）
  const reduction = getSectPassiveBonuses(player).traversalCostReduction;
  const healthLoss = Math.floor(player.health.max * cost.healthPct * (1 - reduction));
  const manaLoss = Math.floor(player.mana.max * cost.manaPct * (1 - reduction));

  return advanceTime(
    {
      ...player,
      health: {
        ...player.health,
        current: Math.max(1, player.health.current - healthLoss),
      },
      mana: {
        ...player.mana,
        current: Math.max(0, player.mana.current - manaLoss),
      },
    },
    cost.days,
  );
};

/** 开局：建第 1 层之局并结算 L1 遍历成本 */
export const startExpedition = (
  player: Player,
  locationId: string = EXPEDITION_LOCATION_ID,
): Player => {
  const run: SecretRealmRun = {
    locationId,
    depth: 1,
    nodes: rollLayerNodes(1, locationId),
    loot: [],
  };

  return { ...applyTraversalCost(player, 1), secretRealmRun: run };
};

/** 战斗节点固定怪物（按 node.monsterId 取，展示与应战一致） */
export const getNodeMonster = (node: ExpeditionNode) =>
  node.monsterId ? getMonsterById(node.monsterId) : undefined;

export interface NodeResolution {
  player: Player;
  run: SecretRealmRun;
  logs: string[];
  message: string;
}

/**
 * 结算非战斗节点（采集/宝箱/禁制/奇遇）：收益入 run.loot、节点标 resolved。
 * 战斗节点不在此结算（走对战 → settleExpeditionBattle）。
 * @param force 禁制节点专用：true = 强闯（伤势 + 奖励减半），false = 耗灵力解禁
 */
export const resolveExpeditionNode = (
  player: Player,
  run: SecretRealmRun,
  nodeId: string,
  force = false,
): NodeResolution => {
  const node = run.nodes.find((n) => n.id === nodeId);

  if (!node || node.resolved || !isLayerDepth(run.depth)) {
    return {
      player,
      run,
      logs: [],
      message: "此节点无法结算",
    };
  }

  const depth = run.depth;
  const logs: string[] = [];
  let nextPlayer = player;
  let loot: ItemCost[] = [];
  let message = "";

  if (node.type === "gather") {
    const pool = DEPTH_GATHER_POOLS[depth];
    const cultivation = randomInt(pool.cultivation[0], pool.cultivation[1]);
    loot = rollDrops(pool.rewards);
    nextPlayer = grantCultivation(player, cultivation);
    logs.push(`你于此层采得灵植矿材，修为 +${cultivation}`);
    message = `采集得手：修为 +${cultivation}`;
  } else if (node.type === "chest") {
    const pool = DEPTH_CHEST_POOLS[depth];
    const spiritStones = randomInt(pool.spiritStones[0], pool.spiritStones[1]);
    loot = rollDrops(pool.rewards);
    nextPlayer = { ...player, spiritStones: player.spiritStones + spiritStones };
    logs.push(`宝箱开启，得灵石 +${spiritStones}`);
    message = `开箱得宝：灵石 +${spiritStones}`;
  } else if (node.type === "ward") {
    const pool = DEPTH_WARD_POOLS[depth];
    if (force) {
      // 宗门伤势抵抗（碧水宫/厚土堡）削弱强闯反噬，封顶七成
      const injuryResist = Math.min(0.75, getSectPassiveBonuses(player).injuryResist);
      const injuryGain = Math.round(
        randomInt(pool.forceInjury[0], pool.forceInjury[1]) * (1 - injuryResist),
      );
      loot = halveDrops(rollDrops(pool.rewards));
      nextPlayer = { ...player, injury: clampInjury(player.injury + injuryGain) };
      logs.push(`你强行破禁，禁制反噬，伤势 +${injuryGain}，所得减半`);
      message = `强闯禁制：伤势 +${injuryGain}`;
    } else {
      loot = rollDrops(pool.rewards);
      nextPlayer = {
        ...player,
        mana: {
          ...player.mana,
          current: Math.max(0, player.mana.current - pool.manaCost),
        },
      };
      logs.push(`你以灵力 ${pool.manaCost} 化解古禁，安然取宝`);
      message = `解禁成功：灵力 -${pool.manaCost}`;
    }
  } else if (node.type === "encounter") {
    const pool = DEPTH_ENCOUNTER_POOLS[depth];
    const cultivation = randomInt(pool.cultivation[0], pool.cultivation[1]);
    const mindGain = Math.random() <= pool.mindChance ? 1 : 0;
    loot = rollDrops(pool.rewards);
    nextPlayer = grantCultivation(player, cultivation);
    nextPlayer = {
      ...nextPlayer,
      attributes: {
        ...nextPlayer.attributes,
        mind: nextPlayer.attributes.mind + mindGain,
      },
    };
    logs.push(
      `奇遇临身，修为 +${cultivation}${mindGain > 0 ? "，心境 +1" : ""}`,
    );
    message = `奇遇：修为 +${cultivation}${mindGain > 0 ? "，心境 +1" : ""}`;
  } else {
    return {
      player,
      run,
      logs: [],
      message: "战斗节点须经对战结算",
    };
  }

  logs.push(formatLoot(loot));

  const nextRun: SecretRealmRun = {
    ...run,
    nodes: run.nodes.map((n) => (n.id === nodeId ? { ...n, resolved: true } : n)),
    loot: mergeLoot(run.loot, loot),
  };

  return { player: nextPlayer, run: nextRun, logs, message };
};

/** 继续深入：层数 +1、掷新节点、结算新层遍历成本；第 4 层后进入 Boss 层（无节点） */
export const descendExpedition = (
  player: Player,
  run: SecretRealmRun,
): { player: Player; run: SecretRealmRun } => {
  const nextDepth = run.depth + 1;

  if (nextDepth > EXPEDITION_MAX_DEPTH) {
    return { player, run };
  }

  if (nextDepth === EXPEDITION_MAX_DEPTH) {
    // Boss 层：不掷节点，遍历成本按 L4 计（最深层之一）
    return {
      player: applyTraversalCost(player, 4),
      run: { ...run, depth: nextDepth, nodes: [] },
    };
  }

  const depth = nextDepth as LayerDepth;
  return {
    player: applyTraversalCost(player, depth),
    run: { ...run, depth: nextDepth, nodes: rollLayerNodes(depth, run.locationId) },
  };
};

export type ExpeditionOutcome = "continue" | "complete" | "retreated" | "defeated";

export interface ExpeditionBattleSettlement {
  player: Player;
  /** 结算后残局；null = 局已终结 */
  run: SecretRealmRun | null;
  outcome: ExpeditionOutcome;
  message: string;
}

/**
 * 对战结束后归并远征局（仅 run.loot 归属，引擎已计胜败惩罚/掉落/寿元，不叠加）：
 * - 战斗节点胜：节点 resolved，局留，待玩家「继续深入/携宝而归」
 * - Boss 胜：run.loot 入库，局终结（通关）
 * - 主动撤退：run.loot 入库，局终结
 * - 战败：丢弃 run.loot，局终结
 */
export const settleExpeditionBattle = (
  player: Player,
  run: SecretRealmRun,
  result: BattleResult,
): ExpeditionBattleSettlement => {
  const isBoss = result.monster.isBoss === true;

  if (result.victory && !isBoss) {
    const nextRun: SecretRealmRun = {
      ...run,
      nodes: run.nodes.map((n) =>
        n.type === "combat" && !n.resolved ? { ...n, resolved: true } : n,
      ),
    };
    return {
      player,
      run: nextRun,
      outcome: "continue",
      message: `斩除${result.monster.name}，可继续深入或携宝而归`,
    };
  }

  if (result.victory && isBoss) {
    return {
      player: bankExpeditionLoot(player, run),
      run: null,
      outcome: "complete",
      message: `击败守关者${result.monster.name}，远征通关，所获尽数入库`,
    };
  }

  if (result.retreated) {
    return {
      player: bankExpeditionLoot(player, run),
      run: null,
      outcome: "retreated",
      message: "你且战且退，携已得之宝撤出秘境",
    };
  }

  return {
    player: clearRun(player),
    run: null,
    outcome: "defeated",
    message: "你折戟秘境，此局所积未入库之宝尽数遗落",
  };
};

/** run.loot 入库存并清局 */
export const bankExpeditionLoot = (player: Player, run: SecretRealmRun): Player => ({
  ...clearRun(player),
  inventory: addItemStacks(player.inventory, run.loot),
});

/** 放弃/异常兜底：直接清局（不入库） */
export const abandonExpedition = (player: Player): Player => clearRun(player);

const clearRun = (player: Player): Player => {
  const next = { ...player };
  delete next.secretRealmRun;
  return next;
};

/** 修为入账（同 explorationSystem：封顶突破所需、记 lastGain） */
const grantCultivation = (player: Player, cultivation: number): Player => {
  const realm = getRealmById(player.realmId);
  const requiredCultivation = realm.breakthrough.requiredCultivation;

  return {
    ...player,
    cultivation: {
      current: Math.min(requiredCultivation, player.cultivation.current + cultivation),
      required: requiredCultivation,
      lastGain: cultivation,
    },
  };
};

const mergeLoot = (existing: ItemCost[], additions: ItemCost[]): ItemCost[] => {
  const merged = [...existing];

  for (const item of additions) {
    const found = merged.find((stack) => stack.itemId === item.itemId);
    if (found) {
      found.quantity += item.quantity;
    } else {
      merged.push({ ...item });
    }
  }

  return merged;
};

/** 强闯禁制：掉落数量减半（向上取整保底 1） */
const halveDrops = (items: ItemCost[]): ItemCost[] =>
  items.map((item) => ({
    itemId: item.itemId,
    quantity: Math.max(1, Math.ceil(item.quantity / 2)),
  }));
