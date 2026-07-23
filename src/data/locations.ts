/** 世界地图地点：主界面水墨地图的全部地点与功能绑定 */

export type LocationType =
  | "city"
  | "town"
  | "sect"
  | "wild"
  | "spirit-land"
  | "mine"
  | "arena";

/** 地点可开启的功能页面 */
export type FeatureId =
  | "shop"
  | "sect"
  | "wild"
  | "cave"
  | "alchemy"
  | "craft"
  | "mine"
  | "arena";

export interface MapLocation {
  id: string;
  name: string;
  type: LocationType;
  /** 地图 SVG 坐标（viewBox 900×480） */
  x: number;
  y: number;
  description: string;
  /** 宗门山门：对应 sectDefinitions 的 id */
  sectId?: string;
  /** 野外地点：绑定 monsters 的 area */
  monsterArea?: string;
  /** 灵地搭建洞府所需灵石 */
  caveCost?: number;
  /** 洞府在此地时的修炼收益倍率 */
  caveBonus?: number;
  /** 灵矿地点：对应 mines 的 mineId */
  mineId?: string;
}

export const START_LOCATION_ID = "qingshi-town";

export const WORLD_LOCATIONS: MapLocation[] = [
  {
    id: "qingshi-town",
    name: "青石镇",
    type: "town",
    x: 180,
    y: 360,
    description:
      "依山而建的边陲小镇，往来散修不绝。镇上设有基础商铺，是新入仙途者落脚起步之地。",
  },
  {
    id: "yunlin-city",
    name: "云鳞城",
    type: "city",
    x: 480,
    y: 285,
    description:
      "方圆数百里最大的城池，商号拍卖行林立，修行货物一应俱全。只要有灵石，几乎无所不能买。",
  },
  {
    id: "jinjian-sect",
    name: "金剑宗",
    type: "sect",
    x: 180,
    y: 100,
    sectId: "jinjian-sect",
    description:
      "立于西北孤峰之上的剑宗，主修金属性功法，养一身庚金剑气，出手锋锐无匹。",
  },
  {
    id: "qingyun-men",
    name: "青云门",
    type: "sect",
    x: 430,
    y: 75,
    sectId: "qingyun-men",
    description:
      "东岳青峰上的正道仙门，主修木属功法，重根基与心境，吐纳生生不息。",
  },
  {
    id: "houtou-bao",
    name: "厚土堡",
    type: "sect",
    x: 690,
    y: 90,
    sectId: "houtou-bao",
    description:
      "北方荒原上以青石垒成的堡垒，主修土属锻体法门，门人根基浑厚，气沉如山。",
  },
  {
    id: "danxia-gu",
    name: "丹霞谷",
    type: "sect",
    x: 105,
    y: 235,
    sectId: "danxia-gu",
    description:
      "隐于南方赤崖之间的谷地，主修火属功法，以丹道立宗，丹炉日夜不熄。",
  },
  {
    id: "bishui-palace",
    name: "碧水宫",
    type: "sect",
    x: 800,
    y: 230,
    sectId: "bishui-palace",
    description:
      "建于东方大泽之畔的水上宫阙，主修水属功法，行功至柔至柔，长于周旋防守。",
  },
  {
    id: "qingshi-foothills",
    name: "青石山脚",
    type: "wild",
    x: 330,
    y: 410,
    monsterArea: "青石山脚",
    description:
      "青石山下的草坡石滩，常有恶狼野兽出没，是初入修行者的第一处历练地。",
  },
  {
    id: "misty-forest",
    name: "迷雾林",
    type: "wild",
    x: 520,
    y: 420,
    monsterArea: "青石山腰",
    description:
      "山腰终年雾气缭绕，林深处有妖狐匿迹，寻常修士不敢深入。",
  },
  {
    id: "luanshi-jian",
    name: "乱石涧",
    type: "wild",
    x: 830,
    y: 400,
    monsterArea: "乱石涧",
    description:
      "乱石横生、涧水湍急的峡谷，玄蛇盘踞其间，也出产难得的炼器材料。",
  },
  {
    id: "abandoned-road",
    name: "废弃古道",
    type: "wild",
    x: 855,
    y: 120,
    monsterArea: "废弃古道",
    description:
      "荒废多年的古驿道，匪患与邪修聚集，风险不小，收获也厚。",
  },
  {
    id: "lingxi-valley",
    name: "灵溪谷",
    type: "spirit-land",
    x: 320,
    y: 190,
    caveCost: 30,
    caveBonus: 1,
    description:
      "幽静山谷，一溪灵水穿谷而过，灵气平和。在此花费 30 灵石搭建洞府后，可修炼、炼丹、炼器。",
  },
  {
    id: "ziwu-mountain",
    name: "紫雾灵山",
    type: "spirit-land",
    x: 640,
    y: 205,
    caveCost: 120,
    caveBonus: 1.25,
    description:
      "紫雾缭绕的灵山，灵气浓郁远胜寻常之地。在此搭建洞府修炼进境更速，需 120 灵石。",
  },
  {
    id: "qingshi-mine",
    name: "青岩灵矿",
    type: "mine",
    x: 690,
    y: 440,
    mineId: "qingshi-mine",
    description:
      "深入岩层的灵矿矿脉，耗费气血灵力开采，可获灵石与炼器材料。",
  },
  {
    id: "training-grounds",
    name: "演武场",
    type: "arena",
    x: 250,
    y: 275,
    description:
      "城外平地上圈出的演武之所，立有木桩箭靶与幻阵。修士来此切磋演武，以阵法幻化灵兽虚影模拟对战，不涉生死、只验身手。",
  },
];

export const getLocation = (locationId: string | null | undefined) =>
  locationId
    ? WORLD_LOCATIONS.find((loc) => loc.id === locationId) ?? null
    : null;

export const getSectLocation = (sectId: string | null | undefined) =>
  sectId
    ? WORLD_LOCATIONS.find((loc) => loc.sectId === sectId) ?? null
    : null;
