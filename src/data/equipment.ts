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
    description: "温润玉佩可安定心神，战斗时更易把握气机。",
    effects: {
      attack: 3,
      defense: 3,
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
