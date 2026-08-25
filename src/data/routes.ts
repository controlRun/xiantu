/** 世界路网：地点之间的道路连线（二次贝塞尔弧）与最短行程寻路（凡间 + 灵界） */

import {
  SPIRIT_LOCATIONS,
  WORLD_LOCATIONS,
  type MapLocation,
  type WorldId,
} from "./locations";

export interface WorldRoute {
  /** 甲端地点 id */
  a: string;
  /** 乙端地点 id */
  b: string;
  /**
   * 道路弯曲度：控制点沿垂线的偏移量（viewBox 单位）。
   * 以 a→b 方向计算，正负决定弯向哪一侧；反向通行时取相反数即可复用同一条弧。
   */
  bend: number;
}

export interface RoutePath {
  key: string;
  a: string;
  b: string;
  d: string;
}

export const WORLD_ROUTES: WorldRoute[] = [
  // 青石镇周边
  { a: "qingshi-town", b: "training-grounds", bend: -12 },
  { a: "qingshi-town", b: "qingshi-foothills", bend: 16 },
  { a: "qingshi-town", b: "yunlin-city", bend: 26 },
  { a: "qingshi-town", b: "danxia-gu", bend: -16 },
  // 西陲环线
  { a: "danxia-gu", b: "training-grounds", bend: -10 },
  { a: "danxia-gu", b: "jinjian-sect", bend: -14 },
  { a: "training-grounds", b: "lingxi-valley", bend: -10 },
  { a: "lingxi-valley", b: "jinjian-sect", bend: 16 },
  { a: "lingxi-valley", b: "yunlin-city", bend: -18 },
  // 北岭山道
  { a: "jinjian-sect", b: "qingyun-men", bend: -18 },
  { a: "qingyun-men", b: "houtou-bao", bend: -16 },
  { a: "houtou-bao", b: "abandoned-road", bend: -12 },
  { a: "houtou-bao", b: "ziwu-mountain", bend: -14 },
  // 东泽一线
  { a: "abandoned-road", b: "yaoxin-secret-realm", bend: -10 },
  { a: "abandoned-road", b: "bishui-palace", bend: 12 },
  { a: "bishui-palace", b: "ziwu-mountain", bend: 16 },
  { a: "bishui-palace", b: "luanshi-jian", bend: -14 },
  // 中枢与南路
  { a: "yunlin-city", b: "ziwu-mountain", bend: -18 },
  { a: "yunlin-city", b: "misty-forest", bend: 12 },
  { a: "qingshi-foothills", b: "misty-forest", bend: 18 },
  { a: "misty-forest", b: "qingshi-mine", bend: -14 },
  { a: "qingshi-mine", b: "luanshi-jian", bend: 12 },
  { a: "ziwu-mountain", b: "qingshi-mine", bend: 16 },
  // 高阶野外（金丹及以上）
  { a: "qingyun-men", b: "lingsha-blood-forest", bend: -14 },
  { a: "lingsha-blood-forest", b: "houtou-bao", bend: 12 },
  { a: "ziwu-mountain", b: "huanggu-demon-cave", bend: 16 },
  { a: "huanggu-demon-cave", b: "yunlin-city", bend: -14 },
  { a: "abandoned-road", b: "tianzhu-summit", bend: -12 },
  { a: "tianzhu-summit", b: "houtou-bao", bend: -14 },
];

/** 灵界路网：以云海镇为枢纽，连通全图 10 地 */
export const SPIRIT_ROUTES: WorldRoute[] = [
  { a: "sp-yunhai-town", b: "sp-lingquan-cave", bend: -12 },
  { a: "sp-yunhai-town", b: "sp-tianchi-lou", bend: 10 },
  { a: "sp-yunhai-town", b: "sp-leiting-ya", bend: 16 },
  { a: "sp-lingquan-cave", b: "sp-lingxu-city", bend: 18 },
  { a: "sp-lingquan-cave", b: "sp-leiting-ya", bend: -10 },
  { a: "sp-tianchi-lou", b: "sp-bingpo-gorge", bend: -12 },
  { a: "sp-tianchi-lou", b: "sp-lingxu-city", bend: -18 },
  { a: "sp-bingpo-gorge", b: "sp-jiuxiao-feng", bend: -14 },
  { a: "sp-lingxu-city", b: "sp-jiuxiao-feng", bend: -12 },
  { a: "sp-lingxu-city", b: "sp-shanggu-yaojing", bend: -16 },
  { a: "sp-jiuxiao-feng", b: "sp-yaochi-garden", bend: 14 },
  { a: "sp-jiuxiao-feng", b: "sp-xianjing-mine", bend: -10 },
  { a: "sp-yaochi-garden", b: "sp-shanggu-yaojing", bend: 16 },
  { a: "sp-yaochi-garden", b: "sp-xianjing-mine", bend: -14 },
  { a: "sp-leiting-ya", b: "sp-shanggu-yaojing", bend: 10 },
];

interface RouteWorldConfig {
  locMap: Map<string, MapLocation>;
  adjacency: Map<string, string[]>;
  routes: WorldRoute[];
}

const buildWorldConfig = (
  locations: MapLocation[],
  routes: WorldRoute[],
): RouteWorldConfig => {
  const locMap = new Map(locations.map((loc) => [loc.id, loc]));
  const adjacency = new Map<string, string[]>();
  const link = (from: string, to: string) => {
    adjacency.set(from, [...(adjacency.get(from) ?? []), to]);
  };
  for (const route of routes) {
    link(route.a, route.b);
    link(route.b, route.a);
  }
  return { locMap, adjacency, routes };
};

export const ROUTE_WORLD_CONFIGS: Record<WorldId, RouteWorldConfig> = {
  mortal: buildWorldConfig(WORLD_LOCATIONS, WORLD_ROUTES),
  spirit: buildWorldConfig(SPIRIT_LOCATIONS, SPIRIT_ROUTES),
};

interface EdgeGeometry {
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  ex: number;
  ey: number;
}

/** 按行进方向取道路弧线几何（起点 / 控制点 / 终点） */
const getEdgeGeometry = (
  fromId: string,
  toId: string,
  bend: number,
  locMap: Map<string, MapLocation>,
): EdgeGeometry => {
  const from = locMap.get(fromId);
  const to = locMap.get(toId);
  if (!from || !to) {
    return { sx: 0, sy: 0, cx: 0, cy: 0, ex: 0, ey: 0 };
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    sx: from.x,
    sy: from.y,
    cx: (from.x + to.x) / 2 + (-dy / len) * bend,
    cy: (from.y + to.y) / 2 + (dx / len) * bend,
    ex: to.x,
    ey: to.y,
  };
};

/** 静态路线渲染数据（模块级只计算一次） */
export const getRoutePaths = (world: WorldId): RoutePath[] => {
  const { locMap, routes } = ROUTE_WORLD_CONFIGS[world];
  return routes.map((route) => {
    const g = getEdgeGeometry(route.a, route.b, route.bend, locMap);
    return {
      key: `${route.a}--${route.b}`,
      a: route.a,
      b: route.b,
      d: `M ${g.sx} ${g.sy} Q ${g.cx.toFixed(1)} ${g.cy.toFixed(1)} ${g.ex} ${g.ey}`,
    };
  });
};

/** 兼容导出：凡间路网静态数据（WorldMap 改走 props 后仍保留） */
export const ROUTE_PATHS = getRoutePaths("mortal");

/** BFS 最短行程链：返回途经地点 id 序列（含起终点）；不连通时返回 null */
export const findRouteChain = (
  fromId: string,
  toId: string,
  world: WorldId = "mortal",
): string[] | null => {
  const { adjacency } = ROUTE_WORLD_CONFIGS[world];
  if (fromId === toId) return [fromId];
  const prev = new Map<string, string>();
  const visited = new Set<string>([fromId]);
  const queue: string[] = [fromId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      prev.set(next, current);
      if (next === toId) {
        const chain = [next];
        let node = next;
        while (node !== fromId) {
          node = prev.get(node)!;
          chain.unshift(node);
        }
        return chain;
      }
      queue.push(next);
    }
  }
  return null;
};

/** 将行程链拼成一条连续 SVG 路径（反向通过的边自动翻转弧线） */
export const travelPathD = (
  chain: string[],
  world: WorldId = "mortal",
): string => {
  const { locMap, routes } = ROUTE_WORLD_CONFIGS[world];
  if (chain.length < 2) {
    const loc = locMap.get(chain[0] ?? "");
    return loc ? `M ${loc.x} ${loc.y} L ${loc.x + 0.1} ${loc.y}` : "";
  }
  let d = "";
  for (let i = 0; i < chain.length - 1; i++) {
    const from = chain[i];
    const to = chain[i + 1];
    const route = routes.find(
      (r) => (r.a === from && r.b === to) || (r.a === to && r.b === from),
    );
    if (!route) continue;
    const bend = route.a === from ? route.bend : -route.bend;
    const g = getEdgeGeometry(from, to, bend, locMap);
    if (d === "") {
      d = `M ${g.sx} ${g.sy} `;
    }
    d += `Q ${g.cx.toFixed(1)} ${g.cy.toFixed(1)} ${g.ex} ${g.ey} `;
  }
  return d.trim();
};
