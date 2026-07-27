/** 世界路网：地点之间的道路连线（二次贝塞尔弧）与最短行程寻路 */

import { WORLD_LOCATIONS } from "./locations";

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
];

const LOC_MAP = new Map(WORLD_LOCATIONS.map((loc) => [loc.id, loc]));

const ADJACENCY = (() => {
  const map = new Map<string, string[]>();
  const link = (from: string, to: string) => {
    map.set(from, [...(map.get(from) ?? []), to]);
  };
  for (const route of WORLD_ROUTES) {
    link(route.a, route.b);
    link(route.b, route.a);
  }
  return map;
})();

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
): EdgeGeometry => {
  const from = LOC_MAP.get(fromId);
  const to = LOC_MAP.get(toId);
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
export const ROUTE_PATHS: { key: string; a: string; b: string; d: string }[] =
  WORLD_ROUTES.map((route) => {
    const g = getEdgeGeometry(route.a, route.b, route.bend);
    return {
      key: `${route.a}--${route.b}`,
      a: route.a,
      b: route.b,
      d: `M ${g.sx} ${g.sy} Q ${g.cx.toFixed(1)} ${g.cy.toFixed(1)} ${g.ex} ${g.ey}`,
    };
  });

/** BFS 最短行程链：返回途经地点 id 序列（含起终点）；不连通时返回 null */
export const findRouteChain = (
  fromId: string,
  toId: string,
): string[] | null => {
  if (fromId === toId) return [fromId];
  const prev = new Map<string, string>();
  const visited = new Set<string>([fromId]);
  const queue: string[] = [fromId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of ADJACENCY.get(current) ?? []) {
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
export const travelPathD = (chain: string[]): string => {
  if (chain.length < 2) {
    const loc = LOC_MAP.get(chain[0] ?? "");
    return loc ? `M ${loc.x} ${loc.y} L ${loc.x + 0.1} ${loc.y}` : "";
  }
  let d = "";
  for (let i = 0; i < chain.length - 1; i++) {
    const from = chain[i];
    const to = chain[i + 1];
    const route = WORLD_ROUTES.find(
      (r) => (r.a === from && r.b === to) || (r.a === to && r.b === from),
    );
    if (!route) continue;
    const bend = route.a === from ? route.bend : -route.bend;
    const g = getEdgeGeometry(from, to, bend);
    if (d === "") {
      d = `M ${g.sx} ${g.sy} `;
    }
    d += `Q ${g.cx.toFixed(1)} ${g.cy.toFixed(1)} ${g.ex} ${g.ey} `;
  }
  return d.trim();
};
