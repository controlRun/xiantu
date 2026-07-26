import type { ElementType, SpiritualRoot } from "../types/game";

const elementLabels: Record<ElementType, string> = {
  metal: "金",
  wood: "木",
  water: "水",
  fire: "火",
  earth: "土",
};

const elementPool: ElementType[] = ["metal", "wood", "water", "fire", "earth"];

const gradeByCount: Record<
  number,
  Pick<
    SpiritualRoot,
    "grade" | "purity" | "cultivationMultiplier" | "breakthroughBonus" | "battleCritBonus"
  >
> = {
  1: {
    grade: "heaven",
    purity: 95,
    cultivationMultiplier: 1.6,
    breakthroughBonus: 0.12,
    battleCritBonus: 0.05,
  },
  2: {
    grade: "earth",
    purity: 82,
    cultivationMultiplier: 1.35,
    breakthroughBonus: 0.08,
    battleCritBonus: 0.04,
  },
  3: {
    grade: "true",
    purity: 68,
    cultivationMultiplier: 1.12,
    breakthroughBonus: 0.04,
    battleCritBonus: 0.02,
  },
  4: {
    grade: "ordinary",
    purity: 52,
    cultivationMultiplier: 0.96,
    breakthroughBonus: 0,
    battleCritBonus: 0.01,
  },
  5: {
    grade: "mixed",
    purity: 38,
    cultivationMultiplier: 0.82,
    breakthroughBonus: -0.03,
    battleCritBonus: 0,
  },
};

const rootCountWeights = [5, 15, 35, 30, 15];

const pickRootCount = () => {
  const total = rootCountWeights.reduce((sum, value) => sum + value, 0);
  let roll = Math.random() * total;

  for (let index = 0; index < rootCountWeights.length; index += 1) {
    roll -= rootCountWeights[index];

    if (roll <= 0) {
      return index + 1;
    }
  }

  return 5;
};

const shuffle = <T,>(items: T[]) =>
  [...items].sort(() => Math.random() - 0.5);

export const formatSpiritualRootName = (elements: ElementType[]) =>
  `${elements.map((element) => elementLabels[element]).join("")}灵根`;

export const createSpiritualRoot = (): SpiritualRoot => {
  const count = pickRootCount();
  const elements = shuffle(elementPool).slice(0, count);
  const grade = gradeByCount[count];

  return {
    elements,
    ...grade,
    name: formatSpiritualRootName(elements),
  };
};
