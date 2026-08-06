/**
 * NPC 表：纯声明式配置。台词分两层——
 * firstLines 只在馈赠未领时讲一次；此后每次交谈自 dailyLines 随机取一组。
 * 馈赠发放与已领标记由 npcSystem/存档负责，本表只描述人物本身。
 *
 * 注意：NPC id 一经发布不可改名——存档迁移按 id 白名单消毒，
 * 改名会把玩家已领的馈赠标记静默清空。
 */

export interface NpcGift {
  /** 赠予物品（itemId 必须存在于 items 表） */
  itemId?: string;
  quantity?: number;
  /** 赠予灵石 */
  spiritStones?: number;
  /** 赠言：一句修行箴言，随馈赠一并入 notice */
  maxim?: string;
}

export interface NpcDefinition {
  id: string;
  name: string;
  /** 身份标签，如「掌柜」「执事」 */
  title: string;
  locationId: string;
  /** 单字头像章 */
  portrait: string;
  /** 首次台词（馈赠未领时） */
  firstLines: string[];
  /** 日常台词：每次交谈随机取一组 */
  dailyLines: string[][];
  gift?: NpcGift;
}

export const npcs: NpcDefinition[] = [
  {
    id: "npc-zhou-shopkeep",
    name: "周守拙",
    title: "杂货铺掌柜",
    locationId: "qingshi-town",
    portrait: "周",
    firstLines: [
      "哟，面生得很，是刚踏上修行路的吧。",
      "青石镇小，留不住仙人，可老头子我在这迎来送往四十年，见过的少年郎没有一千也有八百。",
      "拿着，这几块灵石你收好。莫嫌少——路要一步一步走，灵石要一块一块攒。",
    ],
    dailyLines: [
      [
        "铺子里箭矢丹药都齐整，出门在外，别舍不得买命钱。",
        "记住喽：穷家富路，修行也一样。",
      ],
      [
        "昨儿有个散修拿妖核换粮，眼神里的疲惫藏都藏不住。",
        "孩子，修行是长跑，别把身子骨先熬干了。",
      ],
      [
        "镇上人说山里起了雾，雾里有光。",
        "老话讲，雾深之处，不是机缘就是凶险，看你自己掂量。",
      ],
    ],
    gift: { spiritStones: 20 },
  },
  {
    id: "npc-liu-storyteller",
    name: "柳三变",
    title: "说书人",
    locationId: "qingshi-town",
    portrait: "柳",
    firstLines: [
      "啪——话说那妖芯秘境深处，石傀睁眼，山摇地动！",
      "……看官莫笑，这段书，老头子我讲的是真事。",
      "相逢即是有缘，送你一句话，比灵石值钱：境界是船，心境是水，水枯了，船再好也搁浅。",
    ],
    dailyLines: [
      [
        "想知道哪一段？剑冢夜哭，还是碧水宫沉舟？",
        "罢了罢了，好故事要留给听得懂的人。",
      ],
      [
        "说书四十年，我最爱讲的不是仙人斩妖，是凡人熬过冬夜。",
        "修行修到最后，修的也是这股熬得住的劲儿。",
      ],
      [
        "有朝一日你筑基成功，记得回来听书。",
        "那时候，老头子我就讲你的故事。",
      ],
    ],
    gift: { maxim: "境界是船，心境是水，水枯则船搁浅" },
  },
  {
    id: "npc-shen-merchant",
    name: "沈万钧",
    title: "万宝商行大掌柜",
    locationId: "yunlin-city",
    portrait: "沈",
    firstLines: [
      "云鳞城万宝商行，南来北往的货都过我手，仙凡两界的账我都算得清。",
      "看你气度，不是寻常散修。做买卖讲究个眼缘——这两瓶回春丹你拿去，算我下的注。",
      "日后若发达了，商行的大门永远为你敞开。",
    ],
    dailyLines: [
      [
        "低买高卖是本事，该出手时不手软才是格局。",
        "修行与做生意，其实是一个道理。",
      ],
      [
        "最近秘境附近的药材涨了价，敏锐的人已经闻到风向了。",
        "你若有货，不妨多留几日。",
      ],
    ],
    gift: { itemId: "healing-pill", quantity: 2 },
  },
  {
    id: "npc-gu-jinjian",
    name: "顾青崖",
    title: "金剑宗执事",
    locationId: "jinjian-sect",
    portrait: "顾",
    firstLines: [
      "剑坪之上，风都是锋利的。你能走到这里，眼里想必也有锋刃。",
      "金剑宗不轻易赠言，但祖师有训：遇璞玉不可不琢。",
      "记住——剑在鞘中也要养其意气，出鞘那一刻，才不负十年磨一剑。",
    ],
    dailyLines: [
      [
        "剑冢里的残剑比活人更懂剑。",
        "有空去拭一拭锈，听一听鸣。",
      ],
      [
        "庚金主杀，却最忌滥杀。",
        "剑气养胸中，不是养在别人的伤口上。",
      ],
      [
        "巡山的弟子昨日报说，崖下又有散修挑衅。",
        "我金剑宗立派三百年，靠的不是剑快，是剑正。",
      ],
    ],
    gift: { maxim: "剑在鞘中亦养意气，出鞘方不负十年之磨" },
  },
  {
    id: "npc-su-qingyun",
    name: "苏接舆",
    title: "青云门药圃执事",
    locationId: "qingyun-men",
    portrait: "苏",
    firstLines: [
      "青峰的灵息草一茬接一茬，人却难得来几个懂行的。",
      "你站在这儿气息不乱，是个能沉得住气的。这几株灵息草送你，算是结个善缘。",
      "青云门重根基，记住：根扎得深，风来得再大也不怕。",
    ],
    dailyLines: [
      [
        "药圃的活儿琐碎，可修行的道理都在琐碎里。",
        "浇水要匀，修行要稳，一个样。",
      ],
      [
        "山间晨雾最养心境，你若早起，去观云台上坐坐。",
        "吐纳之间，天地自宽。",
      ],
    ],
    gift: { itemId: "spirit-grass", quantity: 3 },
  },
  {
    id: "npc-shi-houtu",
    name: "石铁牛",
    title: "厚土堡锻体执事",
    locationId: "houtou-bao",
    portrait: "石",
    firstLines: [
      "哈！看你这身板，风一吹就晃，来我厚土堡做什么？",
      "罢了，相逢即是缘。这十支铁箭你拿去练手——箭术和锻体一样，都是笨功夫，笨功夫最养人。",
      "记住：山不解释自己的高度。",
    ],
    dailyLines: [
      [
        "堡墙的石头一块几百斤，弟子们扛着走三里。",
        "疼吗？疼。可筋骨就是这么长出来的。",
      ],
      [
        "有人嫌锻体苦，跑去学什么速成法术。",
        "哼，风一吹就散的架子，修到高处全是窟窿。",
      ],
    ],
    gift: { itemId: "iron-arrow", quantity: 10 },
  },
  {
    id: "npc-dan-danxia",
    name: "丹虹",
    title: "丹霞谷丹房执事",
    locationId: "danxia-gu",
    portrait: "丹",
    firstLines: [
      "嘘——轻些，炉里的火正到关键处。",
      "……好了，丹成。今日手气不错，这一炉聚气丹里拣一粒品相最好的送你。",
      "炼丹如炼心，火候差一息，仙丹变废渣。你修行也一样，莫贪快。",
    ],
    dailyLines: [
      [
        "谷里的丹炉三百年不熄，靠的不是一代人的火，是一代代人的守。",
        "你若有耐心，我可以教你看火色。",
      ],
      [
        "灵息草三分、妖核一分，君臣佐使，缺一不可。",
        "丹方如此，修行也如此——偏科是要吃苦头的。",
      ],
      [
        "昨夜炸了一炉，眉毛都燎了。",
        "嗨，丹霞谷弟子谁没烧过几回眉毛，不丢人。",
      ],
    ],
    gift: { itemId: "qi-gathering-pill", quantity: 1 },
  },
  {
    id: "npc-shui-bishui",
    name: "水清浅",
    title: "碧水宫水脉执事",
    locationId: "bishui-palace",
    portrait: "水",
    firstLines: [
      "大泽之上，宫阙随波不随流——欢迎来到碧水宫。",
      "你远道而来，气息微浮。这枚回灵丹你服下，且学学水的性子：不争，故能成其深。",
      "至柔者至坚，这是宫主常挂在嘴边的话。",
    ],
    dailyLines: [
      [
        "水脉淤了要疏，心绪淤了也要疏。",
        "打坐如静水，沉淀之后自然澄澈。",
      ],
      [
        "泽上夜雾起时，灵气最盛，也最冷。",
        "修行御水之道，先要学会与冷共处。",
      ],
    ],
    gift: { itemId: "mana-pill", quantity: 1 },
  },
];

export const getNpcById = (npcId: string | null): NpcDefinition | undefined =>
  npcId === null ? undefined : npcs.find((npc) => npc.id === npcId);

export const getNpcsByLocationId = (locationId: string): NpcDefinition[] =>
  npcs.filter((npc) => npc.locationId === locationId);

/** 日常台词随机取一组；rng 可注入，保冒烟确定性 */
export const getNpcDailyLines = (
  npc: NpcDefinition,
  rng: () => number = Math.random,
): string[] => {
  if (npc.dailyLines.length === 0) {
    return [];
  }

  const index = Math.min(
    Math.floor(rng() * npc.dailyLines.length),
    npc.dailyLines.length - 1,
  );

  return npc.dailyLines[index];
};
