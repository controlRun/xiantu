/**
 * 物品获取途径提示：供突破缺失项、UI 引导使用。
 * 按「宗门兑换 → 炼器合成 → 战斗掉落」的稳定性归纳，数据驱动、无需硬编码。
 */
import { alchemyRecipes } from "../data/recipes";
import { craftRecipes } from "../data/craftRecipes";
import { monsters } from "../data/monsters";
import { sectDefinitions } from "../data/sects";

export const getItemAcquisition = (itemId: string): string => {
  // 宗门商店有售（贡献兑换，最稳定）
  for (const sect of sectDefinitions) {
    const sold = sect.shop.find((entry) => entry.item.itemId === itemId);
    if (sold) {
      return `宗门兑换（${sect.name} · 贡献 ${sold.contributionCost}）`;
    }
  }

  // 炼丹配方可产出
  const alchemy = alchemyRecipes.find((r) => r.output.itemId === itemId);
  if (alchemy) {
    return `炼丹合成（${alchemy.name}）`;
  }

  // 炼器配方可产出
  const recipe = craftRecipes.find((r) => r.output.itemId === itemId);
  if (recipe) {
    return `炼器合成（${recipe.name}）`;
  }

  // 怪物掉落（给出代表性来源地区与妖兽）
  const dropper = monsters.find((m) =>
    m.lootTable.some((drop) => drop.itemId === itemId),
  );
  if (dropper) {
    return `战斗掉落（${dropper.area} · ${dropper.name}）`;
  }

  return "战斗掉落、秘境采集或坊市购置";
};
