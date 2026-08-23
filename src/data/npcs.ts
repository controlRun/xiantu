/**
 * NPC 表：纯声明式配置。台词分几层——
 * firstLines 只在馈赠未领时讲一次；此后每次交谈先看「世事反馈」（reactions，
 * 按玩家境界/战绩/伤势命中、讲过不复读），再看知己分阶台词（closeLines），
 * 最后退回 dailyLines 随机取一组。
 * 馈赠发放、好感、托付状态由 npcSystem/存档负责，本表只描述人物本身。
 *
 * 注意：NPC id 一经发布不可改名——存档迁移按 id 白名单消毒，
 * 改名会把玩家已领的馈赠标记静默清空。
 */

import type { ItemCost, NpcFavorTierKey } from "../types/game";

export interface NpcGift {
  /** 赠予物品（itemId 必须存在于 items 表） */
  itemId?: string;
  quantity?: number;
  /** 赠予灵石 */
  spiritStones?: number;
  /** 赠言：一句修行箴言，随馈赠一并入 notice */
  maxim?: string;
}

/** 世事反馈条件：按玩家状态命中（声明式，仿 goals 的 cond 模式） */
export type NpcReactionCond =
  | { kind: "bossKilled" } // stats.bossesKilled > 0
  | { kind: "monstersKilled"; count: number } // stats.monstersKilled >= count
  | { kind: "realmOrder"; order: number } // realm.order >= order
  | { kind: "sectRank"; min: number } // sectRank >= min（无宗门恒 0）
  | { kind: "injury"; min: number }; // injury >= min

export interface NpcReaction {
  /** 唯一 id，讲过一次入 relation.reactionShown（不复读） */
  id: string;
  cond: NpcReactionCond;
  lines: string[];
}

export interface NpcErrand {
  id: string;
  name: string;
  description: string;
  /** 好感门槛 */
  minFavor: number;
  /** 交付物（斩妖 = 交付妖核，全走物品交付） */
  requires: ItemCost[];
  /** 限时（游戏日）；逾期对话提醒，不惩罚 */
  timeLimitDays: number;
  rewards: {
    favor: number;
    spiritStones?: number;
    itemRewards?: ItemCost[];
    maxim?: string;
  };
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
  /** 世事反馈：按玩家状态命中的专属台词（讲过不复读） */
  reactions?: NpcReaction[];
  /** 偏好物品：投赠好感翻倍并回特殊话 */
  likes?: string[];
  /** 知己分阶后的专属台词 */
  closeLines?: string[][];
  /** 分阶回礼：知己/莫逆 各一次 */
  tierGifts?: Partial<Record<NpcFavorTierKey, NpcGift>>;
  /** 人情托付 */
  errands?: NpcErrand[];
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
    reactions: [
      {
        id: "zhou-realm",
        cond: { kind: "realmOrder", order: 5 },
        lines: [
          "哟，练气圆满啦？",
          "这才多久没见，气势都不一样了。修行是真功夫，你一天都没荒废。",
        ],
      },
      {
        id: "zhou-kills",
        cond: { kind: "monstersKilled", count: 10 },
        lines: [
          "听说你近来在野外闯荡，斩了不老少妖兽。",
          "好样的，铺子里这些箭矢丹药，就是给你们这样的少年郎备的。",
        ],
      },
      {
        id: "zhou-injury",
        cond: { kind: "injury", min: 30 },
        lines: [
          "你这气色不对，伤得不轻啊。",
          "穷家富路是活命，身子骨才是本钱——去歇几日，别硬扛。",
        ],
      },
    ],
    likes: ["qi-gathering-pill", "healing-pill"],
    closeLines: [
      [
        "如今你也是常客了，老头子我看着你长起来，跟看着自家娃一样。",
        "铺子里有你的份例，缺什么吱一声。",
      ],
    ],
    tierGifts: {
      intimate: { spiritStones: 30 },
      soulmate: { spiritStones: 60, maxim: "莫嫌少，这是老头子攒着给你成家用的" },
    },
    errands: [
      {
        id: "errand-zhou-grass",
        name: "采灵息草",
        description: "铺子里灵息草断了货，你去山中采三株回来，算帮我个忙。",
        minFavor: 20,
        requires: [{ itemId: "spirit-grass", quantity: 3 }],
        timeLimitDays: 10,
        rewards: { favor: 8, spiritStones: 30, maxim: "路要一步一步走，灵石要一块一块攒" },
      },
    ],
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
    reactions: [
      {
        id: "liu-boss",
        cond: { kind: "bossKilled" },
        lines: [
          "听闻你镇压了秘境石傀！",
          "啪——好故事！这一回，老头子终于讲到你的名号了。",
        ],
      },
      {
        id: "liu-realm",
        cond: { kind: "realmOrder", order: 8 },
        lines: [
          "又破了一重境界？",
          "好，说书人的耳朵最灵，你这一路的功业，我都替你记着。",
        ],
      },
      {
        id: "liu-kills",
        cond: { kind: "monstersKilled", count: 20 },
        lines: [
          "你斩妖如砍瓜切菜的名声，已经传到镇口了。",
          "放心，改日我把它编成书，开头就说『却说那无名少年，一箭裂空』。",
        ],
      },
    ],
    likes: ["beast-core-low", "spirit-grass"],
    closeLines: [
      [
        "旁人听书是图个热闹，你是真把这日子过成了书。",
        "等哪天你踏遍九州，老头子我这卷书，就只讲你一人。",
      ],
    ],
    tierGifts: {
      intimate: { maxim: "境界是船，心境是水——你这条船，如今行得稳了" },
      soulmate: { spiritStones: 50, maxim: "这一锭，当是你传奇开篇的润笔钱" },
    },
    errands: [
      {
        id: "errand-liu-beastcore",
        name: "寻妖核泡酒",
        description: "天冷了，我想泡一坛驱寒酒，缺两份低阶妖核。劳你跑一趟。",
        minFavor: 20,
        requires: [{ itemId: "beast-core-low", quantity: 2 }],
        timeLimitDays: 12,
        rewards: { favor: 10, spiritStones: 20, maxim: "好故事，要先有好酒" },
      },
    ],
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
    reactions: [
      {
        id: "shen-realm",
        cond: { kind: "realmOrder", order: 10 },
        lines: [
          "筑基大成了？",
          "我就说你气度不凡。商行这注，下对了。",
        ],
      },
      {
        id: "shen-kills",
        cond: { kind: "monstersKilled", count: 30 },
        lines: [
          "近来妖核行情看涨，你手里想必攒了不少。",
          "若有意出手，我商行给你最高价，就当结个善缘。",
        ],
      },
      {
        id: "shen-injury",
        cond: { kind: "injury", min: 40 },
        lines: [
          "伤成这样还往铺子里跑？",
          "回春丹拿去两瓶，记我账上——大伤大养，小伤小补，身体是最大的本钱。",
        ],
      },
    ],
    likes: ["beast-core-low", "iron-arrow"],
    closeLines: [
      [
        "你我如今算半个合伙人，商行的账，你可以看。",
        "修行缺什么，别跟我客气。",
      ],
    ],
    tierGifts: {
      intimate: { itemId: "healing-pill", quantity: 2 },
      soulmate: { spiritStones: 100, maxim: "小辈，这是商行给你的红股" },
    },
    errands: [
      {
        id: "errand-shen-beastcore",
        name: "收妖核周转",
        description: "商行缺三份低阶妖核周转，你有渠道，替我收来，价钱好说。",
        minFavor: 20,
        requires: [{ itemId: "beast-core-low", quantity: 3 }],
        timeLimitDays: 12,
        rewards: { favor: 8, spiritStones: 50 },
      },
    ],
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
    reactions: [
      {
        id: "gu-sectrank",
        cond: { kind: "sectRank", min: 2 },
        lines: [
          "宗门里你已不是无名之辈了。",
          "位次越高，剑要越正——剑气养胸中，莫养在虚名上。",
        ],
      },
      {
        id: "gu-realm",
        cond: { kind: "realmOrder", order: 8 },
        lines: [
          "剑意又精进了一分。",
          "看得出你夜以继日。剑者，恒也。",
        ],
      },
      {
        id: "gu-injury",
        cond: { kind: "injury", min: 30 },
        lines: [
          "带伤来剑坪？",
          "剑客最忌急于求成。伤要养透了，剑才稳。",
        ],
      },
    ],
    likes: ["iron-arrow", "qi-gathering-pill"],
    closeLines: [
      [
        "剑冢里的残剑，如今也认你的手了。",
        "这剑坪的风，往后也会对你温柔些。",
      ],
    ],
    tierGifts: {
      intimate: { itemId: "iron-arrow", quantity: 10 },
      soulmate: { itemId: "qi-gathering-pill", quantity: 2, maxim: "剑在鞘中亦养意气" },
    },
    errands: [
      {
        id: "errand-gu-beastcore",
        name: "斩妖磨剑",
        description: "剑坪弟子习箭，缺些低阶妖核练靶。你走一趟，猎两份来。",
        minFavor: 20,
        requires: [{ itemId: "beast-core-low", quantity: 2 }],
        timeLimitDays: 12,
        rewards: { favor: 10, itemRewards: [{ itemId: "iron-arrow", quantity: 10 }], maxim: "剑不磨不快" },
      },
    ],
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
    reactions: [
      {
        id: "su-realm",
        cond: { kind: "realmOrder", order: 6 },
        lines: [
          "根基又厚了一层。",
          "好，青云门讲的就是厚积薄发，你这步走得稳。",
        ],
      },
      {
        id: "su-kills",
        cond: { kind: "monstersKilled", count: 5 },
        lines: [
          "你身上有妖气，近来猎过妖兽？",
          "惜命一点，药圃里我替你备着伤药。",
        ],
      },
      {
        id: "su-injury",
        cond: { kind: "injury", min: 30 },
        lines: [
          "气息浮了，伤着了？",
          "去观云台坐坐，山雾最养心境。伤是磨刀石，不是绊脚石。",
        ],
      },
    ],
    likes: ["spirit-grass", "mana-pill"],
    closeLines: [
      [
        "药圃的灵息草，如今看到你都会点头。",
        "修行如浇花，你这样的，省心。",
      ],
    ],
    tierGifts: {
      intimate: { itemId: "spirit-grass", quantity: 5 },
      soulmate: { itemId: "mana-pill", quantity: 2, maxim: "根扎得深，风大也不怕" },
    },
    errands: [
      {
        id: "errand-su-beastcore",
        name: "配药缺妖核",
        description: "药圃配一味寒性药，缺两份低阶妖核。你去猎来，我匀你些伤药。",
        minFavor: 20,
        requires: [{ itemId: "beast-core-low", quantity: 2 }],
        timeLimitDays: 12,
        rewards: { favor: 10, itemRewards: [{ itemId: "healing-pill", quantity: 1 }] },
      },
    ],
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
    reactions: [
      {
        id: "shi-kills",
        cond: { kind: "monstersKilled", count: 15 },
        lines: [
          "猎了这么多妖兽，筋骨练出来了！",
          "好，这才像我厚土堡的人——笨功夫，最养人。",
        ],
      },
      {
        id: "shi-realm",
        cond: { kind: "realmOrder", order: 8 },
        lines: [
          "又进一步？",
          "山不解释自己的高度，但山一直在那儿。你也是。",
        ],
      },
      {
        id: "shi-injury",
        cond: { kind: "injury", min: 40 },
        lines: [
          "伤成这样？",
          "锻体锻的是筋骨，不是头铁。回去养好再来，堡里不差这一天。",
        ],
      },
    ],
    likes: ["iron-arrow", "spirit-grass"],
    closeLines: [
      [
        "你这身板，如今扛得起堡墙的石头了。",
        "来，跟俺过两招，筋骨要常练常新。",
      ],
    ],
    tierGifts: {
      intimate: { itemId: "iron-arrow", quantity: 10 },
      soulmate: { itemId: "spirit-grass", quantity: 5, maxim: "山不解释自己的高度" },
    },
    errands: [
      {
        id: "errand-shi-beastcore",
        name: "猎妖核练靶",
        description: "弟子们练箭缺靶子，猎三份低阶妖核来，我教你几手拉弓的窍门。",
        minFavor: 20,
        requires: [{ itemId: "beast-core-low", quantity: 3 }],
        timeLimitDays: 12,
        rewards: { favor: 10, itemRewards: [{ itemId: "iron-arrow", quantity: 10 }] },
      },
    ],
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
    reactions: [
      {
        id: "dan-realm",
        cond: { kind: "realmOrder", order: 8 },
        lines: [
          "修行又进一境，看来没白烧眉毛。",
          "丹如人心，火候到了自然成。你如今火候正好。",
        ],
      },
      {
        id: "dan-kills",
        cond: { kind: "monstersKilled", count: 10 },
        lines: [
          "斩了那么多妖兽，妖核是好东西。",
          "若拿给我炼，保管还你一炉好丹。",
        ],
      },
      {
        id: "dan-injury",
        cond: { kind: "injury", min: 30 },
        lines: [
          "伤着了吧？",
          "炼丹人都知道，火再旺也得添水。养伤也是修行，别贪快。",
        ],
      },
    ],
    likes: ["spirit-grass", "qi-gathering-pill"],
    closeLines: [
      [
        "丹房的炉火，如今也认你的气息。",
        "来，我教你认一认火色，早晚用得上。",
      ],
    ],
    tierGifts: {
      intimate: { itemId: "qi-gathering-pill", quantity: 1 },
      soulmate: { itemId: "healing-pill", quantity: 2, maxim: "丹如人心，火候自会到" },
    },
    errands: [
      {
        id: "errand-dan-grass",
        name: "丹房缺灵息草",
        description: "丹房缺灵息草当药引，采四株来，我炼一炉好丹谢你。",
        minFavor: 20,
        requires: [{ itemId: "spirit-grass", quantity: 4 }],
        timeLimitDays: 12,
        rewards: { favor: 10, itemRewards: [{ itemId: "qi-gathering-pill", quantity: 1 }], maxim: "火候差一息，仙丹变废渣" },
      },
    ],
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
    reactions: [
      {
        id: "shui-realm",
        cond: { kind: "realmOrder", order: 10 },
        lines: [
          "筑基有成，气度沉静了不少。",
          "学水之性，果然没有白学。至柔者至坚。",
        ],
      },
      {
        id: "shui-kills",
        cond: { kind: "monstersKilled", count: 25 },
        lines: [
          "杀伐之气重了。",
          "剑可随身，心要能收。别让血气盖过了本心。",
        ],
      },
      {
        id: "shui-injury",
        cond: { kind: "injury", min: 30 },
        lines: [
          "心绪浮了，伤着了？",
          "来泽边坐坐。水会教你，冷的时候先沉下去，再浮起来。",
        ],
      },
    ],
    likes: ["mana-pill", "spirit-grass"],
    closeLines: [
      [
        "大泽认得你了。",
        "你的气息，如今已和这片水融在一处。",
      ],
    ],
    tierGifts: {
      intimate: { itemId: "mana-pill", quantity: 1 },
      soulmate: { itemId: "spirit-grass", quantity: 5, maxim: "至柔者至坚" },
    },
    errands: [
      {
        id: "errand-shui-grass",
        name: "泽畔采灵息草",
        description: "水脉滋养的灵息草最是清冽，采三株来，我以回灵丹相酬。",
        minFavor: 20,
        requires: [{ itemId: "spirit-grass", quantity: 3 }],
        timeLimitDays: 12,
        rewards: { favor: 10, itemRewards: [{ itemId: "mana-pill", quantity: 1 }] },
      },
    ],
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
