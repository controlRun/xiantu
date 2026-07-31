/** 世界地图系统：移动、洞府、地点功能门禁 */

import {
  getLocation,
  START_LOCATION_ID,
  type FeatureId,
  type MapLocation,
} from "../data/locations";
import { getMineTable } from "../data/mines";
import { getRealmById, getRealmByOrder } from "../data/realms";
import { getShop } from "../data/shops";
import type { Player } from "../types/game";
import { advanceTime } from "./timeSystem";

export interface LocationFeature {
  feature: FeatureId;
  label: string;
  locked: boolean;
  reason?: string;
}

export const getCurrentLocation = (player: Player): MapLocation => {
  const location = getLocation(player.locationId);

  if (location) {
    return location;
  }

  return getLocation(START_LOCATION_ID) as MapLocation;
};

export const isAt = (player: Player, locationId: string) =>
  getCurrentLocation(player).id === locationId;

export const getCaveLocation = (player: Player): MapLocation | null =>
  getLocation(player.caveDwellingId);

/** 按地图坐标距离折算行程日数（1–3 日，同地 0 日） */
export const estimateTravelDays = (player: Player, toId: string) => {
  const from = getCurrentLocation(player);
  const to = getLocation(toId);

  if (!to || to.id === from.id) {
    return 0;
  }

  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.min(3, Math.max(1, Math.floor(distance / 180)));
};

/** 行程：耗费估算日数并移动到新地点 */
export const travelTo = (
  player: Player,
  toId: string,
): { player: Player; days: number } => {
  const to = getLocation(toId);
  const days = estimateTravelDays(player, toId);

  if (!to || days === 0) {
    return { player, days: 0 };
  }

  return {
    player: advanceTime({ ...player, locationId: to.id }, days),
    days,
  };
};

export interface BuildCaveCheck {
  canBuild: boolean;
  cost: number;
  missingReasons: string[];
}

export const getBuildCaveCheck = (
  player: Player,
  loc: MapLocation,
): BuildCaveCheck => {
  const cost = loc.caveCost ?? 0;
  const missingReasons: string[] = [];

  if (loc.type !== "spirit-land" || loc.caveCost === undefined) {
    missingReasons.push("此地并非可建洞府的灵地");
  }

  if (player.caveDwellingId) {
    const existing = getCaveLocation(player);
    missingReasons.push(
      existing ? `洞府已建于${existing.name}，无法另建` : "已建过洞府，无法另建",
    );
  }

  if (player.spiritStones < cost) {
    missingReasons.push(`灵石不足：搭建洞府需要 ${cost}`);
  }

  return {
    canBuild: missingReasons.length === 0,
    cost,
    missingReasons,
  };
};

export const buildCaveDwelling = (
  player: Player,
  loc: MapLocation,
): { player: Player; success: boolean; message: string } => {
  const check = getBuildCaveCheck(player, loc);

  if (!check.canBuild) {
    return {
      player,
      success: false,
      message: `无法搭建洞府：${check.missingReasons.join("；")}`,
    };
  }

  return {
    player: advanceTime(
      {
        ...player,
        spiritStones: player.spiritStones - check.cost,
        caveDwellingId: loc.id,
      },
      3,
    ),
    success: true,
    message: `于${loc.name}搭成洞府，自此有了安身修炼之所`,
  };
};

/** 地点是否被境界门槛封锁（可前往查看，但一切功能锁定） */
export const isLocationRealmLocked = (player: Player, loc: MapLocation) =>
  getRealmById(player.realmId).order < (loc.minRealmOrder ?? 0);

/** 地点卡片功能列表的唯一数据源：按地点类型与玩家状态判定可用功能 */
export const getLocationFeatures = (
  player: Player,
  loc: MapLocation,
): LocationFeature[] => {
  const features: LocationFeature[] = [];
  const isHere = isAt(player, loc.id);
  const caveLocation = getCaveLocation(player);
  const isOwnCave = caveLocation?.id === loc.id;

  if ((loc.type === "city" || loc.type === "town") && getShop(loc.id)) {
    features.push({
      feature: "shop",
      label: loc.type === "city" ? "商行 · 买卖货物" : "商铺 · 买卖货物",
      locked: false,
    });
  }

  if (loc.type === "sect" && loc.sectId) {
    features.push({
      feature: "sect",
      label: "山门 · 拜师学艺",
      locked: false,
    });
  }

  if (loc.type === "wild" && loc.monsterArea) {
    features.push({
      feature: "wild",
      label: "野外 · 历练探索",
      locked: false,
    });
  }

  // 野外地游商：shops.ts 中以 locationId 配置库存，复用商店买卖面板
  if (loc.type === "wild" && getShop(loc.id)) {
    features.push({
      feature: "merchant",
      label: "游商 · 补给买卖",
      locked: false,
    });
  }

  if (loc.type === "spirit-land") {
    if (isOwnCave) {
      features.push({
        feature: "cave",
        label: "洞府 · 修炼调息",
        locked: false,
      });
      features.push({
        feature: "alchemy",
        label: "洞府 · 炼丹",
        locked: false,
      });
      features.push({
        feature: "craft",
        label: "洞府 · 炼器",
        locked: false,
      });
    } else if (!caveLocation && loc.caveCost !== undefined) {
      features.push({
        feature: "cave",
        label: "洞府 · 修炼调息",
        locked: true,
        reason: isHere
          ? `在灵地搭建洞府后可用（灵石×${loc.caveCost}）`
          : `需先抵达此地搭建洞府（灵石×${loc.caveCost}）`,
      });
    } else if (caveLocation) {
      features.push({
        feature: "cave",
        label: "洞府 · 修炼调息",
        locked: true,
        reason: `洞府已建于${caveLocation.name}`,
      });
    }
  }

  if (loc.type === "mine" && loc.mineId && getMineTable(loc.mineId)) {
    features.push({
      feature: "mine",
      label: "灵矿 · 采矿",
      locked: false,
    });
  }

  if (loc.type === "arena") {
    features.push({
      feature: "arena",
      label: "演武 · 模拟对战",
      locked: false,
    });
  }

  if (loc.type === "secret-realm") {
    features.push({
      feature: "boss",
      label: "秘境 · 挑战守关者",
      locked: false,
    });
    features.push({
      feature: "expedition",
      label: "秘境 · 节点远征",
      locked: false,
    });
  }

  // 境界门槛：低于要求时全部功能锁定（仍可前往查看，不锁进入）
  if (isLocationRealmLocked(player, loc)) {
    const required = getRealmByOrder(loc.minRealmOrder ?? 0);
    const reason = `需${required?.name ?? "更高境界"}方可涉足`;
    return features.map((feature) => ({ ...feature, locked: true, reason }));
  }

  return features;
};
