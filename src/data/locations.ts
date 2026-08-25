/** 世界地图地点：主界面水墨地图的全部地点与功能绑定 */

export type LocationType =
  | "city"
  | "town"
  | "sect"
  | "wild"
  | "spirit-land"
  | "mine"
  | "arena"
  | "secret-realm";

/** 地点可开启的功能页面 */
export type FeatureId =
  | "shop"
  | "sect"
  | "wild"
  | "cave"
  | "alchemy"
  | "craft"
  | "mine"
  | "arena"
  | "boss"
  /** 野外地游商：复用商店买卖面板，库存见 shops.ts 的野外地条目 */
  | "merchant"
  /** 秘境节点远征：逐层深入、分支择一、携宝而归（二期） */
  | "expedition";

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
  /** 境界门槛：玩家境界 order 低于此值时地点功能全部锁定（缺省 0 不限） */
  minRealmOrder?: number;
  /** 秘境守关 Boss：优先于全局默认守关者（缺省回落到通用秘境 Boss） */
  bossMonsterId?: string;
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
    minRealmOrder: 2,
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
    minRealmOrder: 4,
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
    minRealmOrder: 7,
    description:
      "荒废多年的古驿道，匪患与邪修聚集，风险不小，收获也厚。",
  },
  {
    id: "lingsha-blood-forest",
    name: "灵煞血林",
    type: "wild",
    x: 560,
    y: 45,
    monsterArea: "灵煞血林",
    minRealmOrder: 13,
    description:
      "北岭深处一片血红古林，煞气蚀骨，林中噬魂妖猿成群，唯有结丹之士敢入。",
  },
  {
    id: "huanggu-demon-cave",
    name: "荒骨魔窟",
    type: "wild",
    x: 700,
    y: 310,
    monsterArea: "荒骨魔窟",
    minRealmOrder: 16,
    description:
      "大泽之南的荒废魔窟，白骨累累、阴风惨惨，元婴境鬼修盘踞其中。",
  },
  {
    id: "tianzhu-summit",
    name: "天柱绝顶",
    type: "wild",
    x: 805,
    y: 55,
    monsterArea: "天柱绝顶",
    minRealmOrder: 19,
    description:
      "撑天孤峰之巅，罡风如刀。万古魔将在此镇守绝顶，是化神修士的试炼之地。",
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
    minRealmOrder: 6,
    description:
      "紫雾缭绕的灵山，灵气浓郁远胜寻常之地。在此搭建洞府修炼进境更速，需 120 灵石。",
  },
  {
    id: "yaoxin-secret-realm",
    name: "妖芯秘境",
    type: "secret-realm",
    x: 770,
    y: 155,
    minRealmOrder: 9,
    description:
      "古道尽头裂隙之后的隐秘之境，紫雾翻涌如涡。传说其中镇着一具上古石傀，守着一炉筑基丹药与若干奇珍，每日仅容一人入内挑战。",
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

/** 地图页界：凡间 / 灵界 */
export type WorldId = "mortal" | "spirit";

/** 灵界飞升起始点：云海镇 */
export const SPIRIT_START_LOCATION_ID = "sp-yunhai-town";
/** 灵界洞府灵地：仙府随主迁居的落点 */
export const SPIRIT_CAVE_LOCATION_ID = "sp-lingquan-cave";

/** 灵界地点（渡劫飞升后解锁的第二张地图页） */
export const SPIRIT_LOCATIONS: MapLocation[] = [
  {
    id: "sp-yunhai-town",
    name: "云海镇",
    type: "town",
    x: 200,
    y: 360,
    description:
      "悬于云海之上的浮游灵镇，雾气缭绕如临仙境。大乘散修自凡间飞升，多在此落脚休整，打探灵界消息。",
  },
  {
    id: "sp-lingxu-city",
    name: "灵墟城",
    type: "city",
    x: 470,
    y: 130,
    description:
      "灵界腹地最大的仙城，仙家坊市鳞次栉比，奇珍异宝、天材地宝应有尽有。只要出得起灵石，几乎无所不售。",
  },
  {
    id: "sp-lingquan-cave",
    name: "灵泉洞府",
    type: "spirit-land",
    x: 340,
    y: 260,
    caveCost: 300,
    caveBonus: 1.3,
    description:
      "一汪灵泉自岩隙渗出，泉水蕴含精纯灵气。于此地开辟洞府，吐纳修行事半功倍，是飞升者安身立命之所。",
  },
  {
    id: "sp-tianchi-lou",
    name: "天池楼",
    type: "arena",
    x: 100,
    y: 180,
    description:
      "天池之上悬浮的演武高楼，灵阵幻化灵界妖灵虚影供大乘修士切磋演武，不限生死、只炼斗法。",
  },
  {
    id: "sp-bingpo-gorge",
    name: "冰魄涧",
    type: "wild",
    x: 260,
    y: 80,
    monsterArea: "冰魄涧",
    description:
      "万古不化的冰涧，寒气蚀骨。冰魄魂妖游弋其间，涧心深处偶见天芝玉露，是采药猎妖的险地。",
  },
  {
    id: "sp-jiuxiao-feng",
    name: "九霄峰",
    type: "wild",
    x: 620,
    y: 80,
    monsterArea: "九霄峰",
    description:
      "直插九霄的孤峰，罡风如刀。九霄大鹏盘踞峰顶，振翅间雷光隐现，是猎取雷髓仙晶的绝佳去处。",
  },
  {
    id: "sp-yaochi-garden",
    name: "瑶池林",
    type: "wild",
    x: 760,
    y: 300,
    monsterArea: "瑶池林",
    description:
      "瑶池仙水滋养的灵木林，灵芝仙草俯拾皆是。瑶池灵蛇盘绕古木，守护着这片难得的灵药福地。",
  },
  {
    id: "sp-leiting-ya",
    name: "雷庭崖",
    type: "wild",
    x: 420,
    y: 420,
    monsterArea: "雷庭崖",
    description:
      "常年雷云密布的悬崖，天雷不时劈落，崖壁间凝出点点雷髓。雷煞厉鬼与雷霄神雕争踞此地，雷声即战鼓。",
  },
  {
    id: "sp-xianjing-mine",
    name: "仙晶矿",
    type: "mine",
    x: 830,
    y: 180,
    mineId: "spirit-crystal-mine",
    description:
      "灵界深处的仙晶矿脉，出产通体剔透的仙晶与雷髓。矿中灵力暴烈，采掘颇为凶险，收益亦丰厚。",
  },
  {
    id: "sp-shanggu-yaojing",
    name: "上古妖境",
    type: "secret-realm",
    x: 640,
    y: 250,
    minRealmOrder: 22,
    bossMonsterId: "spirit-ancient-beast",
    description:
      "封印着上古妖神的一方小世界，法则残缺、妖气冲天。深处沉睡着远古巨兽，镇压着无数天材地宝与失传道法。",
  },
];

/** 全部地点：凡间 + 灵界（getLocation 等跨界查询统一走此集合） */
export const ALL_LOCATIONS = [...WORLD_LOCATIONS, ...SPIRIT_LOCATIONS];

const SPIRIT_LOCATION_IDS = new Set(SPIRIT_LOCATIONS.map((loc) => loc.id));

export const isSpiritLocation = (loc: MapLocation) =>
  SPIRIT_LOCATION_IDS.has(loc.id);

export const getWorldId = (loc: MapLocation): WorldId =>
  isSpiritLocation(loc) ? "spirit" : "mortal";

export const getLocation = (locationId: string | null | undefined) =>
  locationId
    ? ALL_LOCATIONS.find((loc) => loc.id === locationId) ?? null
    : null;

export const getSectLocation = (sectId: string | null | undefined) =>
  sectId
    ? WORLD_LOCATIONS.find((loc) => loc.sectId === sectId) ?? null
    : null;
