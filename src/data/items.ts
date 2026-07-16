import type { ItemDefinition } from "../types/game";

export const itemDefinitions: ItemDefinition[] = [
  {
    id: "spirit-grass",
    name: "灵息草",
    type: "material",
    rarity: "common",
    description: "蕴含微弱灵气的草药，可用于炼制低阶丹药。",
    stackable: true,
  },
  {
    id: "beast-core-low",
    name: "低阶妖核",
    type: "material",
    rarity: "uncommon",
    description: "低阶妖兽体内凝成的妖力核心，是炼丹与炼器材料。",
    stackable: true,
  },
  {
    id: "qi-gathering-pill",
    name: "聚气丹",
    type: "pill",
    rarity: "uncommon",
    description: "辅助炼气期修士凝聚灵气，亦可作为小境界突破材料。",
    stackable: true,
  },
  {
    id: "foundation-pill",
    name: "筑基丹",
    type: "pill",
    rarity: "rare",
    description: "冲击筑基境的重要丹药，散修梦寐以求。",
    stackable: true,
  },
  {
    id: "basic-breathing-manual",
    name: "引气诀",
    type: "manual",
    rarity: "common",
    description: "最基础的引气入体法门，适合初入仙途者。",
    stackable: false,
  },
  {
    id: "qingyun-heart-method",
    name: "青云心法",
    type: "manual",
    rarity: "uncommon",
    description: "青云门基础内修心法，讲究气息绵长、心境澄明。",
    stackable: false,
  },
  {
    id: "danxia-fire-control",
    name: "丹霞控火诀",
    type: "manual",
    rarity: "uncommon",
    description: "丹霞谷控火入门法，能提升炼丹时的火候稳定。",
    stackable: false,
  },
  {
    id: "wandering-step",
    name: "游身步",
    type: "manual",
    rarity: "uncommon",
    description: "散修盟流传的轻身步法，适合山野厮杀与脱身。",
    stackable: false,
  },
];

export const getItemDefinition = (itemId: string) =>
  itemDefinitions.find((item) => item.id === itemId);
