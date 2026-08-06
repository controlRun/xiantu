/**
 * 修行目标表：纯声明式配置，进度由 goalSystem 从玩家状态实时派生，
 * 绝不存函数或进度副本进存档。
 */

export type GoalTier = "short" | "long";

export type GoalCondition =
  /** 当日（游戏日）内打坐修炼过 */
  | { kind: "cultivateToday" }
  /** 突破条件齐备（缺项为 0） */
  | { kind: "breakthroughReady" }
  /** 背包持有某物达到数量 */
  | { kind: "collect"; itemId: string; count: number }
  /** 已拜入宗门 */
  | { kind: "joinSect" }
  /** 已建立洞府 */
  | { kind: "buildCave" }
  /** 击杀过秘境 Boss */
  | { kind: "bossKill"; bossId: string }
  /** 境界 order 达到指定值 */
  | { kind: "reachOrder"; order: number }
  /** 领受过 NPC 馈赠达到数量 */
  | { kind: "npcGift"; count: number };

export interface GoalDefinition {
  id: string;
  tier: GoalTier;
  name: string;
  description: string;
  cond: GoalCondition;
}

export const goals: GoalDefinition[] = [
  {
    id: "goal-cultivate-today",
    tier: "short",
    name: "今日打坐",
    description: "今日之内打坐修炼一次，日积跬步。",
    cond: { kind: "cultivateToday" },
  },
  {
    id: "goal-breakthrough-ready",
    tier: "short",
    name: "突破在即",
    description: "备齐突破所需的修为、心境、灵石与材料。",
    cond: { kind: "breakthroughReady" },
  },
  {
    id: "goal-collect-spirit-grass",
    tier: "short",
    name: "灵息草 ×10",
    description: "筑基丹主药，野外采集与商铺皆有。",
    cond: { kind: "collect", itemId: "spirit-grass", count: 10 },
  },
  {
    id: "goal-collect-beast-core",
    tier: "short",
    name: "低阶妖核 ×4",
    description: "筑基丹辅药，击杀妖兽偶有所得。",
    cond: { kind: "collect", itemId: "beast-core-low", count: 4 },
  },
  {
    id: "goal-collect-qi-pill",
    tier: "short",
    name: "聚气丹 ×2",
    description: "筑基丹药引，可自行炼制或向商铺购入。",
    cond: { kind: "collect", itemId: "qi-gathering-pill", count: 2 },
  },
  {
    id: "goal-npc-gift",
    tier: "short",
    name: "结缘之礼",
    description: "与各地人物攀谈，领受三份见面馈赠。",
    cond: { kind: "npcGift", count: 3 },
  },
  {
    id: "goal-join-sect",
    tier: "long",
    name: "拜入宗门",
    description: "择一仙门拜师，得传正道功法与宗门供养。",
    cond: { kind: "joinSect" },
  },
  {
    id: "goal-build-cave",
    tier: "long",
    name: "建立洞府",
    description: "于灵地搭建洞府，自此安居修炼、炼丹炼器。",
    cond: { kind: "buildCave" },
  },
  {
    id: "goal-boss-kill",
    tier: "long",
    name: "秘境伏魔",
    description: "深入妖芯秘境，镇压守关的秘境石傀。",
    cond: { kind: "bossKill", bossId: "secret-realm-golem" },
  },
  {
    id: "goal-reach-foundation",
    tier: "long",
    name: "冲击筑基",
    description: "修为圆满、服下筑基丹，叩开筑基境之门。",
    cond: { kind: "reachOrder", order: 10 },
  },
];
