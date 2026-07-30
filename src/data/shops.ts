/**
 * 商店库存：按 locationId 维度配置，买入价 = ceil(基准价 × markup)。
 * 城镇商店（云鳞城/青石镇）价格最优；野外地为游商，markup 递增，
 * 越深处货越齐、价越贵，形成「城里补给出价最低」的价差动线。
 */

export interface ShopStock {
  locationId: string;
  itemIds: string[];
  /** 买入倍率：买入价 = ceil(基准价 * markup) */
  markup: number;
}

export const shopDefinitions: ShopStock[] = [
  {
    locationId: "yunlin-city",
    markup: 1.2,
    itemIds: [
      // 材料
      "spirit-grass",
      "beast-core-low",
      "wolf-fang",
      "mist-fox-tail",
      "serpent-scale",
      "iron-essence",
      // 丹药
      "qi-gathering-pill",
      "foundation-pill",
      "healing-pill",
      "mana-pill",
      "stasis-pill",
      // 箭矢
      "wooden-arrow",
      "wolf-fang-arrow",
      "iron-arrow",
      "mist-feather-arrow",
      "serpent-scale-arrow",
      "spirit-piercing-arrow",
      // 江湖流通功法
      "basic-breathing-manual",
      "wandering-step",
      // 装备
      "ironwood-sword",
      "cloud-thread-robe",
      "spirit-jade-pendant",
    ],
  },
  {
    locationId: "qingshi-town",
    markup: 1.4,
    itemIds: ["spirit-grass", "wooden-arrow", "wolf-fang-arrow", "qi-gathering-pill"],
  },
  // ---------- 野外地游商 ----------
  {
    locationId: "qingshi-foothills",
    markup: 1.5,
    itemIds: [
      "spirit-grass",
      "wolf-fang",
      "wooden-arrow",
      "wolf-fang-arrow",
      "qi-gathering-pill",
      "healing-pill",
    ],
  },
  {
    locationId: "misty-forest",
    markup: 1.6,
    itemIds: [
      "spirit-grass",
      "wolf-fang",
      "mist-fox-tail",
      "wooden-arrow",
      "wolf-fang-arrow",
      "mist-feather-arrow",
      "iron-arrow",
      "qi-gathering-pill",
      "healing-pill",
      "mana-pill",
    ],
  },
  {
    locationId: "luanshi-jian",
    markup: 1.7,
    itemIds: [
      "spirit-grass",
      "mist-fox-tail",
      "serpent-scale",
      "iron-essence",
      "iron-arrow",
      "mist-feather-arrow",
      "serpent-scale-arrow",
      "healing-pill",
      "mana-pill",
      "stasis-pill",
    ],
  },
  {
    locationId: "abandoned-road",
    markup: 1.8,
    itemIds: [
      "spirit-grass",
      "serpent-scale",
      "iron-essence",
      "beast-core-low",
      "serpent-scale-arrow",
      "spirit-piercing-arrow",
      "mana-pill",
      "stasis-pill",
      "foundation-pill",
    ],
  },
];

export const getShop = (locationId: string | null | undefined) =>
  locationId
    ? shopDefinitions.find((shop) => shop.locationId === locationId) ?? null
    : null;
