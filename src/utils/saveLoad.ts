import { createInitialPlayer } from "../data/initialPlayer";
import { getLocation } from "../data/locations";
import { getNpcById } from "../data/npcs";
import { getRealmById } from "../data/realms";
import { getSectById } from "../data/sects";
import { clampSectRank } from "../systems/sectSystem";
import { createSpiritualRoot } from "../data/spiritualRoots";
import {
  SAVE_SCHEMA_VERSION,
  type ElementType,
  type EquipmentState,
  type ExpeditionNode,
  type ExpeditionNodeType,
  type InventoryStack,
  type JournalEntry,
  type JournalTone,
  type NpcRelationState,
  type Player,
  type SaveData,
  type SecretRealmRun,
  type SpiritualRoot,
} from "../types/game";

const SAVE_KEY = "xiantu.save.v1";

export const SAVE_SLOT_LABEL = "本地一号存档";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const normalizeInventory = (value: unknown): InventoryStack[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isObject(entry) || typeof entry.itemId !== "string") {
        return null;
      }

      return {
        itemId: entry.itemId,
        quantity: Math.max(1, Math.floor(toNumber(entry.quantity, 1))),
      };
    })
    .filter((entry): entry is InventoryStack => entry !== null);
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
};

const JOURNAL_TONES = new Set<JournalTone>(["neutral", "success", "warning"]);

/** 事件日志：旧档缺省 []，逐条消毒、按写入顺序截取最近 80 条 */
const normalizeJournal = (value: unknown): JournalEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: JournalEntry[] = [];

  for (const item of value) {
    if (!isObject(item) || typeof item.text !== "string") {
      continue;
    }

    entries.push({
      day: Math.floor(toNumber(item.day, 0)),
      tone: JOURNAL_TONES.has(item.tone as JournalTone)
        ? (item.tone as JournalTone)
        : "neutral",
      text: item.text.slice(0, 200),
    });
  }

  return entries.slice(-80);
};

/** NPC 关系状态：key 按 NPC 白名单消毒；旧档缺省 {}，单条字段逐项归一化 */
const normalizeNpcRelations = (
  value: unknown,
): Record<string, NpcRelationState> => {
  if (!isObject(value)) {
    return {};
  }

  const result: Record<string, NpcRelationState> = {};

  for (const [npcId, raw] of Object.entries(value)) {
    if (getNpcById(npcId) == null || !isObject(raw)) {
      continue;
    }

    const errand =
      isObject(raw.errand) && typeof raw.errand.errandId === "string"
        ? {
            errandId: raw.errand.errandId.slice(0, 64),
            acceptedDay: Math.floor(toNumber(raw.errand.acceptedDay, 0)),
          }
        : null;

    result[npcId] = {
      favor: Math.max(0, Math.floor(toNumber(raw.favor, 0))),
      lastTalkDay: Math.max(0, Math.floor(toNumber(raw.lastTalkDay, 0))),
      reactionShown: normalizeStringArray(raw.reactionShown),
      claimedTiers: normalizeStringArray(raw.claimedTiers),
      errand,
    };
  }

  return result;
};

const normalizePillUseCounts = (value: unknown): Record<string, number> => {
  if (!isObject(value)) {
    return {};
  }

  const result: Record<string, number> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "number" && Number.isFinite(entry) && entry > 0) {
      result[key] = Math.floor(entry);
    }
  }

  return result;
};

/** 三期战绩统计：缺省全 0，容忍部分字段缺失或损坏 */
const normalizeStats = (value: unknown): Player["stats"] => {
  const source = isObject(value) ? value : {};

  return {
    monstersKilled: Math.max(0, Math.floor(toNumber(source.monstersKilled, 0))),
    bossesKilled: Math.max(0, Math.floor(toNumber(source.bossesKilled, 0))),
    lastCultivateDay: Math.floor(toNumber(source.lastCultivateDay, 0)),
    lastBossDay: Math.floor(toNumber(source.lastBossDay, 0)),
  };
};

const EXPEDITION_NODE_TYPES: ExpeditionNodeType[] = [
  "combat",
  "gather",
  "chest",
  "ward",
  "encounter",
];

const isExpeditionNodeType = (value: unknown): value is ExpeditionNodeType =>
  typeof value === "string" &&
  EXPEDITION_NODE_TYPES.includes(value as ExpeditionNodeType);

/** 二期远征局：残缺/非法→undefined（旧 v5 档无此字段，安全）；不接入 migratePlayer 会在载入重建时永久毁局 */
const normalizeSecretRealmRun = (value: unknown): SecretRealmRun | undefined => {
  if (!isObject(value)) {
    return undefined;
  }

  if (typeof value.locationId !== "string") {
    return undefined;
  }

  const depth = Math.floor(toNumber(value.depth, 0));
  if (depth < 1 || depth > 5) {
    return undefined;
  }

  const nodes = Array.isArray(value.nodes)
    ? value.nodes
        .map((entry): ExpeditionNode | null => {
          if (
            !isObject(entry) ||
            typeof entry.id !== "string" ||
            !isExpeditionNodeType(entry.type)
          ) {
            return null;
          }

          return {
            id: entry.id,
            type: entry.type,
            resolved: entry.resolved === true,
            ...(typeof entry.monsterId === "string"
              ? { monsterId: entry.monsterId }
              : {}),
          };
        })
        .filter((entry): entry is ExpeditionNode => entry !== null)
    : [];

  return {
    locationId: value.locationId,
    depth,
    nodes,
    loot: normalizeInventory(value.loot),
  };
};

const ensureStarterArrows = (inventory: InventoryStack[]) => {
  const hasArrow = inventory.some((entry) =>
    ["wooden-arrow", "iron-arrow", "spirit-piercing-arrow"].includes(entry.itemId),
  );

  if (hasArrow) {
    return inventory;
  }

  return [
    ...inventory,
    { itemId: "wooden-arrow", quantity: 20 },
    { itemId: "iron-arrow", quantity: 6 },
  ];
};

const ensureStarterWeapon = (equipment: EquipmentState): EquipmentState => {
  if (equipment.weapon) {
    return equipment;
  }

  return {
    ...equipment,
    weapon: "ironwood-sword",
  };
};

const normalizeEquipment = (value: unknown): EquipmentState => {
  const emptyEquipment: EquipmentState = {
    weapon: null,
    armor: null,
    accessory: null,
  };

  if (!isObject(value)) {
    return emptyEquipment;
  }

  return {
    weapon: typeof value.weapon === "string" ? value.weapon : null,
    armor: typeof value.armor === "string" ? value.armor : null,
    accessory: typeof value.accessory === "string" ? value.accessory : null,
  };
};

const isElementType = (value: unknown): value is ElementType =>
  value === "metal" ||
  value === "wood" ||
  value === "water" ||
  value === "fire" ||
  value === "earth";

const isSpiritualRoot = (value: unknown): value is SpiritualRoot => {
  if (!isObject(value) || !Array.isArray(value.elements)) {
    return false;
  }

  return (
    value.elements.every(isElementType) &&
    typeof value.name === "string" &&
    typeof value.grade === "string" &&
    typeof value.purity === "number" &&
    typeof value.cultivationMultiplier === "number" &&
    typeof value.breakthroughBonus === "number"
  );
};

const migratePlayer = (value: unknown): Player => {
  const fallback = createInitialPlayer();

  if (!isObject(value)) {
    return fallback;
  }

  const legacyRealm = isObject(value.realm) ? value.realm : null;
  const realmId =
    typeof value.realmId === "string"
      ? value.realmId
      : typeof legacyRealm?.id === "string"
        ? legacyRealm.id
        : fallback.realmId;
  const realm = getRealmById(realmId);
  const legacyCultivation = isObject(value.cultivation)
    ? value.cultivation
    : null;
  const legacyAttributes = isObject(value.attributes) ? value.attributes : null;
  const legacyHealth = isObject(value.health) ? value.health : null;
  const legacyMana = isObject(value.mana) ? value.mana : null;

  return {
    ...fallback,
    id: typeof value.id === "string" ? value.id : fallback.id,
    name: typeof value.name === "string" ? value.name : fallback.name,
    gender: value.gender === "female" ? "female" : "male",
    realmId: realm.id,
    spiritualRoot: isSpiritualRoot(value.spiritualRoot)
      ? value.spiritualRoot
      : createSpiritualRoot(),
    cultivation: {
      current: Math.min(
        realm.breakthrough.requiredCultivation,
        toNumber(legacyCultivation?.current, fallback.cultivation.current),
      ),
      required: realm.breakthrough.requiredCultivation,
      lastGain: toNumber(legacyCultivation?.lastGain, 0),
    },
    age: toNumber(value.age, fallback.age),
    lifespan: toNumber(value.lifespan, fallback.lifespan),
    health: {
      current: toNumber(legacyHealth?.current, fallback.health.current),
      max: toNumber(legacyHealth?.max, fallback.health.max),
    },
    mana: {
      current: toNumber(legacyMana?.current, fallback.mana.current),
      max: toNumber(legacyMana?.max, fallback.mana.max),
    },
    spiritStones: toNumber(value.spiritStones, fallback.spiritStones),
    attributes: {
      rootBone: toNumber(legacyAttributes?.rootBone, fallback.attributes.rootBone),
      comprehension: toNumber(
        legacyAttributes?.comprehension,
        fallback.attributes.comprehension,
      ),
      luck: toNumber(legacyAttributes?.luck, fallback.attributes.luck),
      mind: toNumber(legacyAttributes?.mind, fallback.attributes.mind),
      divineSense: toNumber(
        legacyAttributes?.divineSense,
        fallback.attributes.divineSense,
      ),
    },
    inventory: ensureStarterArrows(normalizeInventory(value.inventory)),
    equipment: ensureStarterWeapon(normalizeEquipment(value.equipment)),
    learnedManualIds: normalizeStringArray(value.learnedManualIds),
    // 旧存档宗门 ID 已作废（五宗门重做），白名单校验不通过则回落散修
    sectId: getSectById(typeof value.sectId === "string" ? value.sectId : null)?.id ?? null,
    sectContribution: toNumber(value.sectContribution, fallback.sectContribution),
    // v7 新增：宗门职位（旧档缺省杂役 0；无宗门则恒 0，clamp 防越界）
    sectRank:
      getSectById(typeof value.sectId === "string" ? value.sectId : null)?.id == null
        ? 0
        : clampSectRank(toNumber(value.sectRank, 0)),
    locationId: getLocation(
      typeof value.locationId === "string" ? value.locationId : null,
    )?.id ?? fallback.locationId,
    caveDwellingId: (() => {
      const cave = getLocation(
        typeof value.caveDwellingId === "string" ? value.caveDwellingId : null,
      );
      return cave?.type === "spirit-land" ? cave.id : null;
    })(),
    // 二期新增：伤势（v3 旧档默认 0）与限次丹服用计数
    injury: Math.min(100, Math.max(0, Math.floor(toNumber(value.injury, 0)))),
    // v9 新增：丹毒（旧档默认 0）
    pillToxicity: Math.min(100, Math.max(0, Math.floor(toNumber(value.pillToxicity, 0)))),
    pillUseCounts: normalizePillUseCounts(value.pillUseCounts),
    // v8 新增：已领馈赠 NPC 白名单消毒（旧档缺省 []；NPC id 不可改名）
    npcGiftClaimedIds: normalizeStringArray(value.npcGiftClaimedIds).filter(
      (npcId) => getNpcById(npcId) != null,
    ),
    // v8 新增：NPC 关系（好感/反馈/托付；旧档缺省 {}，key 白名单消毒）
    npcRelations: normalizeNpcRelations(value.npcRelations),
    // 三期新增：战绩统计（v4 旧档默认全 0，目标派生自当前状态不受影响）
    stats: normalizeStats(value.stats),
    // 操作感一期新增：事件日志（旧档缺省 []）
    eventLog: normalizeJournal(value.eventLog),
    // 二期新增：秘境远征局（v5 旧档缺省，undefined = 无在途局）
    secretRealmRun: normalizeSecretRealmRun(value.secretRealmRun),
    createdAt:
      typeof value.createdAt === "string" ? value.createdAt : fallback.createdAt,
    updatedAt: new Date().toISOString(),
  };
};

const normalizeSaveData = (value: unknown): SaveData | null => {
  if (!isObject(value) || !isObject(value.player)) {
    return null;
  }

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: typeof value.savedAt === "string" ? value.savedAt : new Date().toISOString(),
    player: migratePlayer(value.player),
  };
};

export const createSaveData = (player: Player): SaveData => ({
  schemaVersion: SAVE_SCHEMA_VERSION,
  savedAt: new Date().toISOString(),
  player: {
    ...player,
    updatedAt: new Date().toISOString(),
  },
});

export const saveGame = (player: Player) => {
  const save = createSaveData(player);
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  return save;
};

export const loadGame = (): SaveData | null => {
  const rawSave = localStorage.getItem(SAVE_KEY);

  if (!rawSave) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSave) as unknown;
    const save = normalizeSaveData(parsed);

    if (save) {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    }

    return save;
  } catch {
    return null;
  }
};

export const clearSave = () => {
  localStorage.removeItem(SAVE_KEY);
};

/** 导出：序列化当前存档为美化 JSON 并触发浏览器下载 */
export const exportSaveToFile = (player: Player): void => {
  const json = JSON.stringify(createSaveData(player), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `xiantu-save-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

/** 导入：解析外部 JSON，经与读档同一套 normalizeSaveData 消毒；非法 → null */
export const parseImportedSave = (text: string): SaveData | null => {
  try {
    return normalizeSaveData(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
};
