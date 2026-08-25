import type { EquipmentDefinition, EquipmentSlot } from "../types/game";

export const equipmentDefinitions: EquipmentDefinition[] = [
  {
    itemId: "ironwood-sword",
    name: "铁木剑",
    slot: "weapon",
    description: "以铁木削成的入门法剑，锋芒虽浅，却胜在趁手。",
    effects: {
      attack: 8,
      defense: 0,
    },
    compatibleArrows: [
      "wooden-arrow",
      "wolf-fang-arrow",
      "mist-feather-arrow",
      "iron-arrow",
      "serpent-scale-arrow",
      "spirit-piercing-arrow",
    ],
  },
  {
    itemId: "cloud-thread-robe",
    name: "云纹法袍",
    slot: "armor",
    description: "织入微弱灵纹的法袍，可抵御山野妖兽的撕咬。",
    effects: {
      attack: 0,
      defense: 6,
    },
  },
  {
    itemId: "spirit-jade-pendant",
    name: "凝神玉佩",
    slot: "accessory",
    description: "温润玉佩可安定心神，战斗时更易把握气机，出手更中要害。",
    effects: {
      attack: 3,
      defense: 3,
      critBonus: 0.03,
    },
  },
  {
    itemId: "spirit-crystal-sword",
    name: "仙晶剑",
    slot: "weapon",
    description: "整柄由仙晶铸成的法剑，锋芒内含仙灵之气，出手锋锐无匹。",
    effects: {
      attack: 30,
      defense: 6,
      accuracyBonus: 0.03,
    },
    compatibleArrows: [
      "serpent-scale-arrow",
      "spirit-piercing-arrow",
      "poison-arrow",
      "thunder-arrow",
      "armorbreak-arrow",
      "spirit-crystal-arrow",
    ],
  },
  {
    itemId: "thundercloud-robe",
    name: "雷云法袍",
    slot: "armor",
    description: "织入雷纹的法袍，受击可卸去大半劲力，亦能化解伤势淤积。",
    effects: {
      attack: 0,
      defense: 18,
      injuryResist: 0.12,
    },
  },
];

export const equipmentSlotLabels: Record<EquipmentSlot, string> = {
  weapon: "武器",
  armor: "法袍",
  accessory: "饰物",
};

export const getEquipmentDefinition = (itemId: string) =>
  equipmentDefinitions.find((equipment) => equipment.itemId === itemId);
