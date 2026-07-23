/** 城镇商店库存：不同城镇售卖不同品类的货物，按倍率加价 */

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
];

export const getShop = (locationId: string | null | undefined) =>
  locationId
    ? shopDefinitions.find((shop) => shop.locationId === locationId) ?? null
    : null;
