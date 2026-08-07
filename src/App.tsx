import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { craftRecipes, getCraftRecipe } from "./data/craftRecipes";
import {
  getUnlockedSpiritArrowTiers,
  getUsableSpiritArrowTiers,
} from "./data/spiritArrows";
import {
  equipmentSlotLabels,
} from "./data/equipment";
import { getItemDefinition } from "./data/items";
import { createInitialPlayer } from "./data/initialPlayer";
import {
  getLocation,
  WORLD_LOCATIONS,
  type FeatureId,
  type LocationType,
  type MapLocation,
} from "./data/locations";
import { findRouteChain, travelPathD } from "./data/routes";
import { getMineTable } from "./data/mines";
import {
  getNpcById,
  getNpcDailyLines,
  getNpcsByLocationId,
} from "./data/npcs";
import { getNextRealm, getRealmById } from "./data/realms";
import { alchemyRecipes } from "./data/recipes";
import { getSectById } from "./data/sects";
import { getShop } from "./data/shops";
import {
  craftAlchemyRecipe,
  formatCostList,
  getAlchemyCheck,
} from "./systems/alchemySystem";
import {
  applyPlayerShot,
  canUseSpiritArrows,
  getAvailableArrowsForBattle,
  getBattlePhysicalArrows,
  getBattleSpiritArrows,
  getBossChallengeCheck,
  getCompatibleArrowDefinitions,
  markBossAttempt,
  restPlayer,
  retreatFromBattle,
  shootArrow,
  skipPlayerShot,
  startArcheryBattle,
  startBossBattle,
  startSparringBattle,
  useBattlePill,
} from "./systems/battleSystem";
import {
  craftRecipe,
  formatCraftCostList,
  getCraftCheck,
} from "./systems/craftSystem";
import {
  attemptBreakthrough,
  cultivate,
  describeBreakthroughCosts,
  getBreakthroughCheck,
  getCultivateGainForMonths,
  getCultivateMonthsCap,
  getCultivationGain,
  getMindTrainingCost,
  trainMind,
  useQiGatheringPill,
} from "./systems/cultivationSystem";
import { exploreSecretRealm } from "./systems/explorationSystem";
import {
  equipItem,
  getEquipmentEffects,
  getEquippedWeapon,
  getWeaponCompatibleArrows,
} from "./systems/equipmentSystem";
import {
  formatManualEffects,
  getLearnedManuals,
  getManualEffects,
  learnManual,
} from "./systems/manualSystem";
import { getItemAcquisition } from "./systems/acquisitionSystem";
import { getInventoryQuantity } from "./systems/inventorySystem";
import { getPillDefinition } from "./data/pills";
import { describeInjuryPenalty } from "./systems/injurySystem";
import { useOutOfBattlePill } from "./systems/pillSystem";
import {
  buildCaveDwelling,
  estimateTravelDays,
  getBuildCaveCheck,
  getCaveLocation,
  getCurrentLocation,
  getLocationFeatures,
  isAt,
  isLocationRealmLocked,
  travelTo,
} from "./systems/mapSystem";
import { getNextGoalSummary } from "./systems/goalSystem";
import {
  abandonExpedition,
  bankExpeditionLoot,
  descendExpedition,
  getExpeditionCheck,
  getNodeMonster,
  resolveExpeditionNode,
  settleExpeditionBattle,
  startExpedition,
} from "./systems/expeditionSystem";
import {
  DEPTH_TRAVERSAL_COST,
  DEPTH_WARD_POOLS,
  NODE_TYPE_FLAVOR,
  NODE_TYPE_LABEL,
} from "./data/expeditionNodes";
import { getMonsterTypicalOrder, getRealmPowerBand } from "./data/balance";
import { getMonsterBehavior } from "./data/monsterBehaviors";
import { getSecretRealmBoss, monsters } from "./data/monsters";
import { BreakthroughDialog } from "./components/BreakthroughDialog";
import { GoalsPanel } from "./components/GoalsPanel";
import { NpcDialog } from "./components/NpcDialog";
import {
  getMonsterDifficulty,
  getPlayerPower,
} from "./systems/powerSystem";
import { getMineCheck, mineOnce, type MineResult } from "./systems/mineSystem";
import { claimNpcGift } from "./systems/npcSystem";
import {
  buyItem,
  getBuyPrice,
  getSellPrice,
  sellItem,
} from "./systems/shopSystem";
import {
  completeSectTask,
  exchangeSectReward,
  getPromotionCheck,
  getSectPassiveBonuses,
  getSectRankDefinition,
  joinSect,
  promoteSect,
} from "./systems/sectSystem";
import type {
  AlchemyResult,
  ArcheryDuelState,
  BattleLoadout,
  BattleResult,
  ElementType,
  ExpeditionNode,
  ExplorationResult,
  ItemType,
  MonsterDefinition,
  Player,
  PlayerGender,
  SaveData,
  SectActionResult,
  SectDefinition,
  TargetZoneId,
} from "./types/game";
import { ITEM_TYPE_LABELS, ITEM_TYPE_ORDER } from "./types/game";
import {
  clearSave,
  exportSaveToFile,
  loadGame,
  parseImportedSave,
  saveGame,
  SAVE_SLOT_LABEL,
} from "./utils/saveLoad";
import {
  formatAge,
  getRemainingYears,
  isPlayerDead,
} from "./systems/timeSystem";
import { BattlePrepScreen } from "./components/battle/BattlePrepScreen";
import { BattleScreen } from "./components/battle/BattleScreen";
import { CultivateTimePicker } from "./components/CultivateTimePicker";
import {
  CultivationOverlay,
  type CultivationActionKind,
  type CultivationActionState,
} from "./components/CultivationOverlay";
import { DeathEndingScreen } from "./components/DeathEndingScreen";
import { StartScreen } from "./components/StartScreen";
import { WorldMap } from "./components/WorldMap";
import { useMobileGameLayout } from "./hooks/useMobileGameLayout";

type NoticeTone = "neutral" | "success" | "warning";

interface Notice {
  tone: NoticeTone;
  text: string;
}

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const statLabels: Record<keyof Player["attributes"], string> = {
  rootBone: "根骨",
  comprehension: "悟性",
  luck: "气运",
  mind: "心境",
  divineSense: "神识",
};

const rootGradeLabels: Record<Player["spiritualRoot"]["grade"], string> = {
  mixed: "杂灵根",
  ordinary: "凡品灵根",
  true: "真灵根",
  earth: "地灵根",
  heaven: "天灵根",
};

const exploreTypeLabels: Record<ExplorationResult["event"]["type"], string> = {
  gather: "采集",
  treasure: "宝箱",
  spring: "灵泉",
  ambush: "伏击",
  insight: "感悟",
};

/** 世界地图视图状态机：地图 → 地点卡片 → 功能页面 / 全局页面 */
type GlobalPanelId =
  | "inventory"
  | "equipment"
  | "manual"
  | "root"
  | "goals"
  | "save";

type WorldView =
  | { screen: "map" }
  | { screen: "location"; locationId: string }
  | { screen: "feature"; feature: FeatureId; locationId: string }
  | { screen: "global"; panel: GlobalPanelId };

/** 钻入子页面：owner 标明归属的功能页，仅该页激活时渲染（一屏装不下的长内容折叠至下一级） */
type SubPageId = "expedition-loot";

const SUBPAGE_META: Record<
  SubPageId,
  { owner: FeatureId; title: string; backLabel: string }
> = {
  "expedition-loot": {
    owner: "expedition",
    title: "本局所积 · 未入库",
    backLabel: "返回远征",
  },
};

const GLOBAL_PANELS: { id: GlobalPanelId; label: string; glyph: string }[] = [
  { id: "inventory", label: "背包", glyph: "藏" },
  { id: "equipment", label: "装备", glyph: "器" },
  { id: "manual", label: "功法", glyph: "诀" },
  { id: "root", label: "根基", glyph: "根" },
  { id: "goals", label: "志", glyph: "志" },
  { id: "save", label: "存档", glyph: "存" },
];

const GLOBAL_PANEL_TITLES: Record<GlobalPanelId, string> = {
  inventory: "背包",
  equipment: "随身法器 · 装备",
  manual: "识海 · 功法",
  root: "根基 · 灵根与资质",
  goals: "志 · 所图与所志",
  save: "本地存档",
};

const FEATURE_PAGE_TITLES: Record<FeatureId, string> = {
  shop: "买卖货物",
  sect: "山门",
  wild: "野外历练",
  cave: "洞府修炼",
  alchemy: "炼丹",
  craft: "炼器",
  mine: "采矿",
  arena: "模拟对战",
  boss: "秘境深处",
  merchant: "游商",
  expedition: "秘境远征",
};

const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  city: "大城",
  town: "城镇",
  sect: "宗门山门",
  wild: "野外",
  "spirit-land": "灵地",
  mine: "灵矿",
  arena: "演武场",
  "secret-realm": "秘境",
};

const ELEMENT_LABELS: Record<ElementType, string> = {
  metal: "主修金行",
  wood: "主修木行",
  water: "主修水行",
  fire: "主修火行",
  earth: "主修土行",
};

/** 五行配色：宗门抵达页背景光晕按主修属性着色 */
const ELEMENT_ACCENTS: Record<ElementType, string> = {
  metal: "#e0b861",
  wood: "#7fae6d",
  water: "#69a9dd",
  fire: "#dd7460",
  earth: "#b8925c",
};

/** #rrggbb → rgba() 字符串 */
const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** 一次赶路行程的动画描述 */
interface TravelState {
  targetId: string;
  targetName: string;
  /** 实际消耗天数（行路结算） */
  days: number;
  /** 连续行程路径 d 串 */
  pathD: string;
  /** 动画时长（毫秒） */
  duration: number;
  /** 途经中转地点坐标 */
  junctions: { x: number; y: number }[];
}

export function App() {
  // 手机端：紧凑对战布局 + 竖屏时自动旋转为横屏（body 上挂 game-mobile 等类）
  const { isMobile } = useMobileGameLayout();

  const [restoredSave, setRestoredSave] = useState<SaveData | null>(() =>
    loadGame(),
  );
  /** 开局先停留在存档选择/角色创建界面，选择后才进入游戏 */
  const [hasEnteredGame, setHasEnteredGame] = useState(false);
  /** 寿元耗尽 · 坐化结局浮层（由下方 effect 依据 isPlayerDead 驱动） */
  const [deathEnding, setDeathEnding] = useState(false);
  const [player, setPlayer] = useState<Player>(
    () => restoredSave?.player ?? createInitialPlayer(),
  );
  const [notice, setNotice] = useState<Notice>({
    tone: "neutral",
    text: "仙途漫漫，始于足下",
  });
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [archeryDuel, setArcheryDuel] = useState<ArcheryDuelState | null>(null);
  const [alchemyResult, setAlchemyResult] = useState<AlchemyResult | null>(null);
  const [craftResult, setCraftResult] = useState<AlchemyResult | null>(null);
  const [explorationResult, setExplorationResult] =
    useState<ExplorationResult | null>(null);
  const [sectResult, setSectResult] = useState<SectActionResult | null>(null);
  /** 背包类型筛选：null = 全部 */
  const [inventoryFilter, setInventoryFilter] = useState<ItemType | null>(null);
  const [isInBattleMode, setIsInBattleMode] = useState(false);
  /** 战前整备页：外出历练 / 演武 / 秘境 Boss 前先选箭矢、丹药与撤退策略 */
  const [battlePrep, setBattlePrep] = useState<{
    mode: "wild" | "sparring" | "boss";
    area?: string;
    /** 远征战斗节点按层固定的怪物（绕过地区随机） */
    fixedMonster?: MonsterDefinition;
  } | null>(null);
  /** 远征节点结算弹层：logs + 「继续深入 / 携宝而归」抉择 */
  const [expeditionNodeResult, setExpeditionNodeResult] = useState<{
    logs: string[];
    message: string;
  } | null>(null);
  /** 世界地图视图 */
  const [view, setView] = useState<WorldView>({ screen: "map" });
  /** 进入全局页前的视图，用于返回 */
  const [prevView, setPrevView] = useState<WorldView>({ screen: "map" });
  /** 当前钻入的子页面（隶属于所在 feature 页；返回 = 清空，绝不碰 prevView） */
  const [subPage, setSubPage] = useState<SubPageId | null>(null);
  /** 地图上选中的地点 */
  const [selectedLocId, setSelectedLocId] = useState<string | null>(null);
  /** 正在交谈的 NPC（对话框打开中） */
  const [activeNpcId, setActiveNpcId] = useState<string | null>(null);
  /** 最近一次采矿结果 */
  const [mineResult, setMineResult] = useState<MineResult | null>(null);
  /** 手机端商店页签：购入 / 售出 */
  const [shopTab, setShopTab] = useState<"buy" | "sell">("buy");
  /** 地图左上角角色状态胶囊：点击展开详情浮层 */
  const [statusOpen, setStatusOpen] = useState(false);
  /** 赶路动画状态：小人沿路网从所在地走向目的地 */
  const [traveling, setTraveling] = useState<TravelState | null>(null);
  /** 修炼/参悟/调息：先播放 2 秒动画，再展示对应结果 */
  const [cultivationAction, setCultivationAction] =
    useState<CultivationActionState | null>(null);
  const cultivationActionTimerRef = useRef<number | null>(null);
  /** 闭关时间条：null = 面板收起；数值 = 滑块当前所选月数 */
  const [cultivateMonths, setCultivateMonths] = useState<number | null>(null);
  /** 突破确认弹窗：点「突破」后先展示缺失项与代价，二次确认才执行 */
  const [breakthroughOpen, setBreakthroughOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (cultivationActionTimerRef.current !== null) {
        window.clearTimeout(cultivationActionTimerRef.current);
      }
    };
  }, []);

  // 寿尽坐化：任一 setPlayer 路径提交后终检。突破加寿与增龄落在同一次提交内，
  // 故不会误报；未进入游戏（开局界面 / 转世重置之后）绝不触发。
  useEffect(() => {
    if (!hasEnteredGame) {
      setDeathEnding(false);
      return;
    }
    if (isPlayerDead(player)) {
      setDeathEnding(true);
    }
  }, [player, hasEnteredGame]);

  // 视图一变即清子页面与闭关时间条：进新 feature / 返回 location / 切 global / resetToStart 全覆盖
  useEffect(() => {
    setSubPage(null);
    setCultivateMonths(null);
  }, [view]);

  // 自动存档：游戏内任何 player 变更 800ms 防抖落盘。
  // 门控 hasEnteredGame：转世/清档（resetToStart）先置 false 再换新角色，
  // 本 effect 跳过，绝不把新角色覆写回刚清空的存档槽。
  // 绝不 setPlayer(saveGame 返回值)——updatedAt 抖动会引发无限自存循环。
  useEffect(() => {
    if (!hasEnteredGame) return;
    const timer = window.setTimeout(() => saveGame(player), 800);
    return () => window.clearTimeout(timer);
  }, [player, hasEnteredGame]);

  // 关页兜底：800ms 防抖窗口内关页也不丢进度（localStorage.setItem 同步，beforeunload 内安全）
  const playerRef = useRef(player);
  playerRef.current = player;
  const hasEnteredGameRef = useRef(hasEnteredGame);
  hasEnteredGameRef.current = hasEnteredGame;
  useEffect(() => {
    const flush = () => {
      if (hasEnteredGameRef.current) {
        saveGame(playerRef.current);
      }
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, []);

  const realm = getRealmById(player.realmId);
  const nextRealm = getNextRealm(player.realmId);
  const currentSect = getSectById(player.sectId);
  const currentLocation = getCurrentLocation(player);
  const caveLocation = getCaveLocation(player);
  /** 当前野外功能页绑定的灵兽区域（历练/探索遭遇对应区域灵兽） */
  const activeWildArea =
    view.screen === "feature" && view.feature === "wild"
      ? getLocation(view.locationId)?.monsterArea
      : undefined;
  const learnedManuals = getLearnedManuals(player);
  const manualEffects = getManualEffects(player);
  const equipmentEffects = getEquipmentEffects(player);
  const breakthroughCheck = getBreakthroughCheck(player);
  const cultivationGain = getCultivationGain(player);
  /** 闭关时间条派生：上限受寿元约束；面板收起时 planMonths 仅供兜底 */
  const cultivateCap = getCultivateMonthsCap(player);
  const planMonths = Math.min(cultivateMonths ?? 1, Math.max(1, cultivateCap));
  const cultivatePreview = getCultivateGainForMonths(player, planMonths);
  const mindTrainingCost = getMindTrainingCost(player);
  const breakthroughCosts = describeBreakthroughCosts(player);

  /**
   * 突破需求结构化清单：修为/灵石/心境/材料逐项列出进度，
   * 缺失项置顶并挂获取途径，替代原先的纯文字 missingReasons。
   */
  const breakthroughRequirements = nextRealm
    ? (() => {
        const bt = realm.breakthrough;
        const reqs: {
          key: string;
          label: string;
          met: boolean;
          current: number;
          need: number;
          acquisition: string;
        }[] = [
          {
            key: "cultivation",
            label: "修为",
            met: player.cultivation.current >= bt.requiredCultivation,
            current: player.cultivation.current,
            need: bt.requiredCultivation,
            acquisition: "打坐修炼或服聚气丹",
          },
          {
            key: "spirit-stones",
            label: "灵石",
            met: player.spiritStones >= bt.spiritStoneCost,
            current: player.spiritStones,
            need: bt.spiritStoneCost,
            acquisition: "战斗缴获、游商交易或宗门任务",
          },
          {
            key: "mind",
            label: "心境",
            met: player.attributes.mind >= bt.minMind,
            current: player.attributes.mind,
            need: bt.minMind,
            acquisition: "静心参悟提升心境",
          },
          ...bt.requiredItems.map((cost) => {
            const owned = getInventoryQuantity(player.inventory, cost.itemId);
            return {
              key: `item-${cost.itemId}`,
              label: getItemDefinition(cost.itemId)?.name ?? cost.itemId,
              met: owned >= cost.quantity,
              current: owned,
              need: cost.quantity,
              acquisition: getItemAcquisition(cost.itemId),
            };
          }),
        ];
        // 缺失项置顶（稳定排序，同类保持原顺序）
        return reqs.sort((a, b) => Number(a.met) - Number(b.met));
      })()
    : [];

  const remainingYears = getRemainingYears(player);
  const equippedWeapon = getEquippedWeapon(player);
  const compatibleArrowIds = getWeaponCompatibleArrows(player);
  const availableArrows = getAvailableArrowsForBattle(player);
  /** 灵力化箭：境界解锁的档位（战斗中按灵力余量禁用） */
  const spiritArrows = getUnlockedSpiritArrowTiers(player);
  const spiritArrowsUsable = getUsableSpiritArrowTiers(player);
  /** 境界门槛封锁的地点集合：地图上灰化加锁，仍可点选查看 */
  const realmLockedIds = new Set(
    WORLD_LOCATIONS.filter((loc) => isLocationRealmLocked(player, loc)).map(
      (loc) => loc.id,
    ),
  );
  /** 地图页目标摘要：进度最接近完成的短期目标 */
  const goalSummary = getNextGoalSummary(player);
  /** 自身战力估算：地点卡难度提示用，仅展示 */
  const playerPower = getPlayerPower(player);
  const cultivationPercent = Math.min(
    100,
    Math.round((player.cultivation.current / player.cultivation.required) * 100),
  );

  /** 播放 2 秒修炼动作动画，随后展示结果卡片（可附带提示文案） */
  const startCultivationAction = (
    kind: CultivationActionKind,
    result: Extract<CultivationActionState, { phase: "result" }>,
    noticeText: string,
  ) => {
    setCultivationAction({ kind, phase: "animating" });
    cultivationActionTimerRef.current = window.setTimeout(() => {
      cultivationActionTimerRef.current = null;
      setCultivationAction(result);
      setNotice({ tone: "success", text: noticeText });
    }, 2000);
  };

  const closeCultivationAction = () => {
    if (cultivationActionTimerRef.current !== null) {
      window.clearTimeout(cultivationActionTimerRef.current);
      cultivationActionTimerRef.current = null;
    }
    setCultivationAction(null);
  };

  const handleCultivate = (months: number) => {
    if (cultivationAction) return;
    const nextPlayer = cultivate(player, months);
    setPlayer(nextPlayer);
    setCultivateMonths(null);
    startCultivationAction(
      "cultivate",
      {
        kind: "cultivate",
        phase: "result",
        gain: nextPlayer.cultivation.lastGain,
        current: nextPlayer.cultivation.current,
        required: nextPlayer.cultivation.required,
        breakthroughReady: getBreakthroughCheck(nextPlayer).canBreakthrough,
        months,
      },
      `灵气入体，本次修为 +${nextPlayer.cultivation.lastGain}`,
    );
  };

  const handleBreakthrough = () => {
    // 先关弹窗再执行：成功后境界变化，不残留旧需求清单
    setBreakthroughOpen(false);
    const result = attemptBreakthrough(player);
    setPlayer(result.player);
    setNotice({
      tone: result.success ? "success" : "warning",
      text: result.message,
    });
  };

  const handleTrainMind = () => {
    if (cultivationAction) return;
    const cost = getMindTrainingCost(player);
    const result = trainMind(player);

    if (!result.success) {
      setNotice({ tone: "warning", text: result.message });
      return;
    }

    setPlayer(result.player);
    startCultivationAction(
      "mind",
      {
        kind: "mind",
        phase: "result",
        newMind: result.player.attributes.mind,
        cultivationCost: cost.cultivation,
        spiritStoneCost: cost.spiritStones,
      },
      result.message,
    );
  };

  const handleUseQiGatheringPill = () => {
    const result = useQiGatheringPill(player);
    setPlayer(result.player);
    setNotice({
      tone: result.success ? "success" : "warning",
      text: result.message,
    });
  };

  /** 战斗外服用丹药（聚气丹走修炼路径，其余走统一丹药路由） */
  const handleUsePill = (pillItemId: string) => {
    const result = useOutOfBattlePill(player, pillItemId);
    setPlayer(result.player);
    setNotice({
      tone: result.success ? "success" : "warning",
      text: result.message,
    });
  };

  const handleLearnManual = (manualItemId: string) => {
    const result = learnManual(player, manualItemId);
    setPlayer(result.player);
    setSectResult(result);
    setNotice({
      tone: result.success ? "success" : "warning",
      text: result.message,
    });
  };

  const handleEquipItem = (itemId: string) => {
    const result = equipItem(player, itemId);
    setPlayer(result.player);
    setSectResult(result);
    setNotice({
      tone: result.success ? "success" : "warning",
      text: result.message,
    });
  };

  const handleExplore = () => {
    if (player.health.current <= 1) {
      setNotice({ tone: "warning", text: "气血太低，先调息恢复" });
      return;
    }

    if (!equippedWeapon) {
      setNotice({ tone: "warning", text: "尚未装备武器，请先在背包中穿戴" });
      return;
    }

    if (availableArrows.length === 0 && spiritArrowsUsable.length === 0) {
      setNotice({
        tone: "warning",
        text: "箭囊已空且灵力不足，先补充箭矢或调息恢复灵力",
      });
      return;
    }

    // 先进入战前整备页，选定携带箭矢、丹药与撤退策略再出战
    setBattlePrep({ mode: "wild", area: activeWildArea });
  };

  const handleSparring = () => {
    if (player.health.current <= 1) {
      setNotice({ tone: "warning", text: "气血太低，先调息恢复" });
      return;
    }

    // 演武无消耗：只需持械且有兼容箭种定义即可下场（不看库存与灵力）
    if (!equippedWeapon) {
      setNotice({ tone: "warning", text: "尚未装备武器，请先在背包中穿戴" });
      return;
    }

    if (
      compatibleArrowIds.length === 0 &&
      spiritArrows.length === 0
    ) {
      setNotice({
        tone: "warning",
        text: "所持兵器没有兼容箭种，无法演武",
      });
      return;
    }

    setBattlePrep({ mode: "sparring" });
  };

  /** 秘境 Boss 挑战：装备与箭矢校验同历练，每日次数由 getBossChallengeCheck 判定 */
  const handleBossChallenge = () => {
    const check = getBossChallengeCheck(player);

    if (!check.canChallenge) {
      setNotice({ tone: "warning", text: check.reason ?? "今日已挑战过守关者" });
      return;
    }

    if (player.health.current <= 1) {
      setNotice({ tone: "warning", text: "气血太低，先调息恢复" });
      return;
    }

    if (!equippedWeapon) {
      setNotice({ tone: "warning", text: "尚未装备武器，请先在背包中穿戴" });
      return;
    }

    if (availableArrows.length === 0 && spiritArrowsUsable.length === 0) {
      setNotice({
        tone: "warning",
        text: "箭囊已空且灵力不足，先补充箭矢或调息恢复灵力",
      });
      return;
    }

    setBattlePrep({ mode: "boss" });
  };

  /** 整备完毕，依携带配置开战 */
  const handlePrepConfirm = (loadout: BattleLoadout) => {
    if (!battlePrep) {
      return;
    }

    // Boss 战开战即占用当日挑战次数（无论胜败），再固定迎战石傀
    if (battlePrep.mode === "boss") {
      setPlayer(markBossAttempt(player));
    }
    const duel =
      battlePrep.mode === "sparring"
        ? startSparringBattle(player, loadout)
        : battlePrep.mode === "boss"
          ? startBossBattle(player, loadout)
          : startArcheryBattle(
              player,
              battlePrep.area,
              loadout,
              battlePrep.fixedMonster,
            );
    setBattlePrep(null);
    setArcheryDuel(duel);
    setBattleResult(null);
    setIsInBattleMode(true);
    setNotice({
      tone: "neutral",
      text:
        battlePrep.mode === "sparring"
          ? `演武场上与${duel.monster.name}切磋，无消耗训练可尽情试箭`
          : battlePrep.mode === "boss"
            ? `秘境深处，与${duel.monster.name}遥遥对峙，今日仅此一战之机`
            : `持${equippedWeapon?.name ?? "弓"}遭遇${duel.monster.name}，选择箭矢与瞄准部位后射击`,
    });
  };

  /** 远征战斗的视图判定：战斗为 overlay，期间 view 不变，feature 仍是 expedition */
  const isExpeditionBattleView = () =>
    view.screen === "feature" && view.feature === "expedition";

  /**
   * 远征战斗结束归并（三处出口共用：handleBattleEnd 双分支 + handleAutoRetreat）。
   * 仅处理 run.loot 归属，胜败惩罚/掉落/寿元已由引擎计入 result.player，不叠加。
   */
  const settleExpeditionBattleIfActive = (result: BattleResult) => {
    if (!result.player.secretRealmRun) {
      return;
    }

    const settlement = settleExpeditionBattle(
      result.player,
      result.player.secretRealmRun,
      result,
    );
    setPlayer(settlement.player);
    setBattleResult(null);

    if (settlement.outcome === "continue") {
      setExpeditionNodeResult({ logs: result.logs, message: settlement.message });
    } else {
      setExpeditionNodeResult(null);
      setNotice({
        tone: settlement.outcome === "defeated" ? "warning" : "success",
        text: settlement.message,
      });
    }
  };

  /** 撤退策略自动触发：补记原因日志后走撤退结算 */
  const handleAutoRetreat = (reason: string) => {
    if (!archeryDuel || archeryDuel.finished) {
      return;
    }
    const retreat = retreatFromBattle(player, {
      ...archeryDuel,
      logs: [...archeryDuel.logs, reason],
    });
    setPlayer(retreat.player);
    setArcheryDuel(null);
    setIsInBattleMode(false);
    if (isExpeditionBattleView() && retreat.battleResult) {
      settleExpeditionBattleIfActive(retreat.battleResult);
      return;
    }
    setBattleResult(retreat.battleResult);
    setNotice({ tone: "warning", text: retreat.message });
  };

  const handleBattleEnd = (result: BattleResult | null) => {
    setIsInBattleMode(false);

    if (result) {
      setArcheryDuel(null);
      if (isExpeditionBattleView() && result.player.secretRealmRun) {
        settleExpeditionBattleIfActive(result);
        return;
      }
      setBattleResult(result);
      setNotice({
        tone: result.victory ? "success" : "warning",
        text: result.message,
      });
      return;
    }

    if (archeryDuel && !archeryDuel.endless && !archeryDuel.finished) {
      const retreat = retreatFromBattle(player, archeryDuel);
      setPlayer(retreat.player);
      setArcheryDuel(null);
      if (isExpeditionBattleView() && retreat.battleResult) {
        settleExpeditionBattleIfActive(retreat.battleResult);
        return;
      }
      setBattleResult(retreat.battleResult);
      setNotice({ tone: "warning", text: retreat.message });
      return;
    }

    setArcheryDuel(null);
    setBattleResult(null);
    setNotice({ tone: "neutral", text: "已退出对战，返回演武场外" });
  };

  const handleRest = () => {
    if (cultivationAction) return;
    const healthRecovered = player.health.max - player.health.current;
    const manaRecovered = player.mana.max - player.mana.current;
    const nextPlayer = restPlayer(player);
    setPlayer(nextPlayer);
    startCultivationAction(
      "rest",
      {
        kind: "rest",
        phase: "result",
        healthRecovered,
        manaRecovered,
        health: nextPlayer.health.current,
        healthMax: nextPlayer.health.max,
        mana: nextPlayer.mana.current,
        manaMax: nextPlayer.mana.max,
      },
      "调息完毕，气血与灵力已恢复",
    );
  };

  const handleSecretExplore = () => {
    if (player.health.current <= 1) {
      setNotice({ tone: "warning", text: "气血太低，先调息恢复" });
      return;
    }

    if (player.mana.current <= 0) {
      setNotice({ tone: "warning", text: "灵力枯竭，先调息恢复" });
      return;
    }

    const result = exploreSecretRealm(player, activeWildArea);
    setPlayer(result.player);
    setExplorationResult(result);
    setBattleResult(result.battle ?? battleResult);
    setArcheryDuel(null);
    setNotice({ tone: "success", text: result.message });
  };

  const handleCraft = (recipeId: string) => {
    const recipe = alchemyRecipes.find((item) => item.id === recipeId);

    if (!recipe) {
      setNotice({ tone: "warning", text: "没有找到对应丹方" });
      return;
    }

    const result = craftAlchemyRecipe(player, recipe);
    setPlayer(result.player);
    setAlchemyResult(result);
    setNotice({
      tone: result.success ? "success" : "warning",
      text: result.message,
    });
  };

  const handleCraftRecipe = (recipeId: string) => {
    const recipe = getCraftRecipe(recipeId);

    if (!recipe) {
      setNotice({ tone: "warning", text: "没有找到对应器方" });
      return;
    }

    const result = craftRecipe(player, recipe);
    setPlayer(result.player);
    setCraftResult(result);
    setNotice({
      tone: result.success ? "success" : "warning",
      text: result.message,
    });
  };

  const handleJoinSect = (sectId: string) => {
    const result = joinSect(player, sectId);
    setPlayer(result.player);
    setSectResult(result);
    setNotice({
      tone: result.success ? "success" : "warning",
      text: result.message,
    });
  };

  const handleSectTask = () => {
    const result = completeSectTask(player);
    setPlayer(result.player);
    setSectResult(result);
    setNotice({
      tone: result.success ? "success" : "warning",
      text: result.message,
    });
  };

  const handleSectExchange = (rewardId: string) => {
    const result = exchangeSectReward(player, rewardId);
    setPlayer(result.player);
    setSectResult(result);
    setNotice({
      tone: result.success ? "success" : "warning",
      text: result.message,
    });
  };

  const handleSectPromote = () => {
    const result = promoteSect(player);
    setPlayer(result.player);
    setSectResult(result);
    setNotice({
      tone: result.success ? "success" : "warning",
      text: result.message,
    });
  };

  /** NPC 对话收尾：末句点击结算一次性馈赠（幂等）；中途点遮罩告辞不进此路 */
  const handleNpcFinish = (npcId: string) => {
    const npc = getNpcById(npcId);
    setActiveNpcId(null);

    if (!npc) {
      return;
    }

    const result = claimNpcGift(player, npc);

    if (result.granted) {
      setPlayer(result.player);
      setNotice({ tone: "success", text: result.message });
    }
  };

  /** 前往某地：按距离耗费 1–3 日，小人沿路网行走，抵达后进入抵达页 */
  const handleTravelTo = (loc: MapLocation) => {
    if (traveling) return;
    const chain = findRouteChain(currentLocation.id, loc.id);
    const { player: arrived, days } = travelTo(player, loc.id);
    setPlayer(arrived);
    setSelectedLocId(loc.id);

    if (!chain || chain.length < 2) {
      setView({ screen: "location", locationId: loc.id });
      setExplorationResult(null); // 换地即清旧探索记录，避免新区顶旧结果
      setNotice({
        tone: days > 0 ? "success" : "neutral",
        text:
          days > 0 ? `行路 ${days} 日，抵达${loc.name}` : `你已在${loc.name}`,
      });
      return;
    }

    setNotice({
      tone: "neutral",
      text:
        days > 0
          ? `启程 · 前往${loc.name}，行路约 ${days} 日`
          : `移步${loc.name}`,
    });
    setTraveling({
      targetId: loc.id,
      targetName: loc.name,
      days,
      pathD: travelPathD(chain),
      duration: Math.min(
        1500 + days * 900 + (chain.length - 2) * 350,
        4200,
      ),
      junctions: chain.slice(1, -1).map((id) => {
        const node = getLocation(id);
        return { x: node?.x ?? 0, y: node?.y ?? 0 };
      }),
    });
  };

  /** 赶路动画结束：播报抵达并进入抵达页 */
  const endTravel = () => {
    if (!traveling) return;
    setNotice({
      tone: "success",
      text: `行路 ${traveling.days} 日，抵达${traveling.targetName}`,
    });
    setView({ screen: "location", locationId: traveling.targetId });
    setExplorationResult(null); // 换地即清旧探索记录，避免新区顶旧结果
    setTraveling(null);
  };

  /** 进入地点功能：若不在该地则先赶路 */
  const enterFeature = (loc: MapLocation, feature: FeatureId) => {
    if (!isAt(player, loc.id)) {
      const { player: arrived, days } = travelTo(player, loc.id);
      setPlayer(arrived);
      setNotice({
        tone: "success",
        text: `行路 ${days} 日，抵达${loc.name}`,
      });
      setExplorationResult(null); // 换地即清旧探索记录，避免新区顶旧结果
    }
    setView({ screen: "feature", feature, locationId: loc.id });
  };

  /** 于灵地搭建洞府（若不在该地则先赶路） */
  const handleBuildCave = (loc: MapLocation) => {
    let working = player;

    if (!isAt(player, loc.id)) {
      const { player: arrived, days } = travelTo(player, loc.id);
      working = arrived;
      setNotice({
        tone: "success",
        text: `行路 ${days} 日，抵达${loc.name}`,
      });
    }

    const result = buildCaveDwelling(working, loc);
    setPlayer(result.player);
    setNotice({
      tone: result.success ? "success" : "warning",
      text: result.message,
    });
  };

  const handleBuyItem = (itemId: string) => {
    if (view.screen !== "feature" || view.feature !== "shop") return;
    const result = buyItem(player, view.locationId, itemId);
    setPlayer(result.player);
    setNotice({
      tone: result.ok ? "success" : "warning",
      text: result.message,
    });
  };

  const handleSellItem = (itemId: string) => {
    const result = sellItem(player, itemId);
    setPlayer(result.player);
    setNotice({
      tone: result.ok ? "success" : "warning",
      text: result.message,
    });
  };

  const handleMine = (loc: MapLocation) => {
    const result = mineOnce(player, loc);
    setPlayer(result.player);
    setMineResult(result.ok ? result : null);
    setNotice({
      tone: result.ok ? "success" : "warning",
      text: result.message,
    });
  };

  const handleSave = () => {
    const save = saveGame(player);
    setPlayer(save.player);
    setNotice({ tone: "success", text: `${SAVE_SLOT_LABEL} 已保存` });
  };

  const handleLoad = () => {
    const save = loadGame();

    if (!save) {
      setNotice({ tone: "warning", text: "没有找到可读取的存档" });
      return;
    }

    setPlayer(save.player);
    setArcheryDuel(null);
    setBattleResult(null);
    setNotice({
      tone: "success",
      text: `已读取 ${formatDateTime(save.savedAt)} 的存档`,
    });
  };

  /** 清空一切局内状态并回到开局界面（清档与转世重修共用） */
  const resetToStart = (noticeText: string) => {
    clearSave();
    setRestoredSave(null);
    setHasEnteredGame(false);
    setDeathEnding(false);
    setPlayer(createInitialPlayer());
    setArcheryDuel(null);
    setBattleResult(null);
    setIsInBattleMode(false);
    setBattlePrep(null);
    setExpeditionNodeResult(null);
    setAlchemyResult(null);
    setCraftResult(null);
    setExplorationResult(null);
    setSectResult(null);
    setMineResult(null);
    setTraveling(null);
    closeCultivationAction(); // 兼清其 2s 动画定时器
    setCultivateMonths(null);
    setView({ screen: "map" });
    setPrevView({ screen: "map" });
    setSelectedLocId(null);
    setStatusOpen(false);
    setNotice({ tone: "warning", text: noticeText });
  };

  const handleReset = () => resetToStart("旧存档已清除，请重新创建角色");

  /** 坐化之后转世重修：重开新角色，清档再叩仙途 */
  const handleReincarnate = () => resetToStart("前世尘缘已了，转世重修，再叩仙途");

  /** 存档导出/导入：JSON 文件备份，防长时间游玩后刷新丢进度 */
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const handleExportSave = () => {
    exportSaveToFile(player);
    setNotice({ tone: "success", text: "存档已导出为 JSON 文件" });
  };

  const handleImportClick = () => importInputRef.current?.click();

  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // 允许重复导入同一文件
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const save = parseImportedSave(String(reader.result ?? ""));
      if (!save) {
        setNotice({ tone: "warning", text: "导入失败：不是有效的仙途存档文件" });
        return;
      }
      // 先落盘——随后触发的自动存档只重写同内容，无覆盖风险
      saveGame(save.player);
      setPlayer(save.player);
      setRestoredSave(save);
      setNotice({
        tone: "success",
        text: `已导入 ${formatDateTime(save.savedAt)} 的存档`,
      });
    };
    reader.onerror = () =>
      setNotice({ tone: "warning", text: "导入失败：文件读取错误" });
    reader.readAsText(file);
  };

  /** 开局界面：读取本地存档进入游戏 */
  const handleLoadSave = () => {
    if (!restoredSave) return;
    setPlayer(restoredSave.player);
    setHasEnteredGame(true);
    setNotice({ tone: "success", text: `已读取 ${SAVE_SLOT_LABEL}` });
  };

  /** 开局界面：按道号与性别创建角色并立即存档 */
  const handleCreateCharacter = (name: string, gender: PlayerGender) => {
    const fresh = saveGame(createInitialPlayer(name, gender)).player;
    setPlayer(fresh);
    setHasEnteredGame(true);
    setNotice({ tone: "success", text: `${name} 踏入仙途，存档已创建` });
  };

  // 开局：存档选择 / 角色创建界面
  if (!hasEnteredGame) {
    return (
      <StartScreen
        save={restoredSave}
        onLoad={handleLoadSave}
        onCreate={handleCreateCharacter}
      />
    );
  }

  // 寿元耗尽 · 坐化结局：压倒战斗/备战等一切局内界面
  if (deathEnding) {
    return (
      <DeathEndingScreen player={player} onReincarnate={handleReincarnate} />
    );
  }

  // Fullscreen battle prep（战前整备页，先于战斗呈现）
  if (battlePrep) {
    return (
      <BattlePrepScreen
        player={player}
        mode={battlePrep.mode}
        area={battlePrep.area}
        fixedMonster={
          battlePrep.mode === "boss" ? getSecretRealmBoss() : undefined
        }
        physicalArrows={
          battlePrep.mode === "sparring"
            ? getCompatibleArrowDefinitions(player)
            : availableArrows
        }
        spiritArrows={spiritArrows}
        onConfirm={handlePrepConfirm}
        onCancel={() => setBattlePrep(null)}
      />
    );
  }

  // Fullscreen battle mode
  if (isInBattleMode && archeryDuel) {
    return (
      <BattleScreen
        duel={archeryDuel}
        player={player}
        availableArrows={getBattlePhysicalArrows(player, archeryDuel)}
        spiritArrows={getBattleSpiritArrows(player, archeryDuel)}
        onShoot={(arrowId, zoneId, drawPower) => {
          const result = shootArrow(player, archeryDuel, arrowId, zoneId, drawPower);
          setPlayer(result.player);
          setArcheryDuel(result.duel);
          if (result.battleResult) {
            setBattleResult(result.battleResult);
          }
          return result;
        }}
        onApplyShot={(basePlayer, baseDuel, arrowId, pendingDamage) => {
          const result = applyPlayerShot(basePlayer, baseDuel, arrowId, pendingDamage);
          setPlayer(result.player);
          setArcheryDuel(result.duel);
          if (result.battleResult) {
            setBattleResult(result.battleResult);
          }
          return result;
        }}
        onSkipShot={(basePlayer, baseDuel, missReason) => {
          const result = skipPlayerShot(basePlayer, baseDuel, missReason);
          setPlayer(result.player);
          setArcheryDuel(result.duel);
          if (result.battleResult) {
            setBattleResult(result.battleResult);
          }
          return result;
        }}
        onUsePill={(pillItemId) => {
          const result = useBattlePill(player, archeryDuel, pillItemId);
          setPlayer(result.player);
          setArcheryDuel(result.duel);
          if (result.battleResult) {
            setBattleResult(result.battleResult);
          }
          return result;
        }}
        onAutoRetreat={handleAutoRetreat}
        onBattleEnd={handleBattleEnd}
        battleResult={battleResult}
      />
    );
  }

  /** 洞府操作按钮：桌面内嵌于面板，移动端钉在页脚（不随正文滚动） */
  const mainPanelActions = (
    <div className="action-row">
      <button
        type="button"
        onClick={() => setCultivateMonths(planMonths)}
        disabled={Boolean(cultivationAction) || cultivateCap === 0}
        title={cultivateCap === 0 ? "寿元将尽，不足一次闭关" : undefined}
      >
        修炼
      </button>
      <button
        type="button"
        className="secondary"
        onClick={handleTrainMind}
        disabled={Boolean(cultivationAction)}
      >
        静心参悟
      </button>
      <button
        type="button"
        className="secondary"
        onClick={() => setBreakthroughOpen(true)}
        disabled={Boolean(cultivationAction) || !nextRealm}
        title={!nextRealm ? "当前版本暂未开放更高境界" : undefined}
      >
        突破
      </button>
      <button
        type="button"
        className="secondary"
        onClick={handleRest}
        disabled={Boolean(cultivationAction)}
      >
        调息恢复
      </button>
    </div>
  );

  const mainPanel = (
        <section className="main-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">当前境界</p>
              <h2>{realm.name}</h2>
            </div>
            <span>{cultivationPercent}%</span>
          </div>

          <div className="progress-track" aria-label="修为进度">
            <div
              className="progress-value"
              style={{ width: `${cultivationPercent}%` }}
            />
          </div>
          <p className="cultivation-value">
            {player.cultivation.current} / {player.cultivation.required} 修为
          </p>

          <dl className="condition-grid">
            <div>
              <dt>下个境界</dt>
              <dd>{nextRealm?.name ?? "暂未开放"}</dd>
            </div>
            <div>
              <dt>修炼收益/7日</dt>
              <dd>+{cultivationGain}</dd>
            </div>
            <div>
              <dt>突破概率</dt>
              <dd>{nextRealm ? formatPercent(breakthroughCheck.chance) : "-"}</dd>
            </div>
            <div>
              <dt>所需材料</dt>
              <dd>{breakthroughCosts}</dd>
            </div>
            <div>
              <dt>心境要求</dt>
              <dd>
                {player.attributes.mind} / {realm.breakthrough.minMind}
              </dd>
            </div>
            <div>
              <dt>参悟消耗</dt>
              <dd>
                修为 {mindTrainingCost.cultivation}，灵石{" "}
                {mindTrainingCost.spiritStones}
              </dd>
            </div>
          </dl>

          {!isMobile && mainPanelActions}
        </section>
  );

  const sidePanel = (
        <section className="side-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">根基</p>
              <h2>灵根与资质</h2>
            </div>
          </div>
          <dl className="stat-list">
            <div>
              <dt>灵根</dt>
              <dd>{player.spiritualRoot.name}</dd>
            </div>
            <div>
              <dt>品阶</dt>
              <dd>{rootGradeLabels[player.spiritualRoot.grade]}</dd>
            </div>
            <div>
              <dt>纯度</dt>
              <dd>{player.spiritualRoot.purity}</dd>
            </div>
            {Object.entries(player.attributes).map(([key, value]) => (
              <div key={key}>
                <dt>{statLabels[key as keyof Player["attributes"]]}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
  );

  // 背包筛选：为每件物品附类型，统计各类型数量，按类型→名称排序后过滤
  const inventoryEntries = player.inventory.map((entry) => ({
    entry,
    type: (getItemDefinition(entry.itemId)?.type ?? "material") as ItemType,
  }));
  const inventoryTypeCounts = ITEM_TYPE_ORDER.reduce<Record<ItemType, number>>(
    (acc, type) => {
      acc[type] = inventoryEntries.filter((e) => e.type === type).length;
      return acc;
    },
    {} as Record<ItemType, number>,
  );
  const visibleInventory = inventoryEntries
    .filter((e) => inventoryFilter === null || e.type === inventoryFilter)
    .sort((a, b) => {
      const byType = ITEM_TYPE_ORDER.indexOf(a.type) - ITEM_TYPE_ORDER.indexOf(b.type);
      if (byType !== 0) return byType;
      return (getItemDefinition(a.entry.itemId)?.name ?? "").localeCompare(
        getItemDefinition(b.entry.itemId)?.name ?? "",
        "zh",
      );
    });

  const inventoryPanel = (
        <section className="inventory-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">随身</p>
              <h2>背包</h2>
            </div>
          </div>
          <div className="inventory-filters" role="tablist" aria-label="背包类型筛选">
            <button
              type="button"
              className={`filter-chip ${inventoryFilter === null ? "active" : ""}`}
              onClick={() => setInventoryFilter(null)}
            >
              全部
            </button>
            {ITEM_TYPE_ORDER.map((type) => {
              const count = inventoryTypeCounts[type];
              return (
                <button
                  key={type}
                  type="button"
                  className={`filter-chip ${inventoryFilter === type ? "active" : ""} ${count === 0 ? "empty" : ""}`}
                  onClick={() => setInventoryFilter(type)}
                >
                  {ITEM_TYPE_LABELS[type]}
                  {count > 0 && <span className="filter-chip-count">{count}</span>}
                </button>
              );
            })}
          </div>
          <div className="inventory-list">
            {player.inventory.length === 0 ? (
              <p className="empty-text">背包空空如也</p>
            ) : visibleInventory.length === 0 ? (
              <p className="empty-text">此类物品暂无</p>
            ) : (
              visibleInventory.map(({ entry }) => {
                const item = getItemDefinition(entry.itemId);

                return (
                  <div className="inventory-item" key={entry.itemId}>
                    <div>
                      <strong>{item?.name ?? entry.itemId}</strong>
                      <p>{item?.description ?? "未知物品"}</p>
                    </div>
                    <div className="inventory-actions">
                      <span>x{entry.quantity}</span>
                      {entry.itemId === "qi-gathering-pill" && (
                        <button
                          type="button"
                          className="mini-button"
                          onClick={handleUseQiGatheringPill}
                        >
                          服用
                        </button>
                      )}
                      {entry.itemId !== "qi-gathering-pill" &&
                        getPillDefinition(entry.itemId) && (
                          <button
                            type="button"
                            className="mini-button"
                            onClick={() => handleUsePill(entry.itemId)}
                          >
                            服用
                          </button>
                        )}
                      {item?.type === "manual" && (
                        <button
                          type="button"
                          className="mini-button"
                          onClick={() => handleLearnManual(entry.itemId)}
                        >
                          学习
                        </button>
                      )}
                      {item?.type === "equipment" && (
                        <button
                          type="button"
                          className="mini-button"
                          onClick={() => handleEquipItem(entry.itemId)}
                        >
                          穿戴
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
  );

  const equipmentPanel = (
        <section className="equipment-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">随身法器</p>
              <h2>装备</h2>
            </div>
            <span>
              攻 {equipmentEffects.attack} / 防 {equipmentEffects.defense}
            </span>
          </div>

          <dl className="stat-list">
            {Object.entries(player.equipment).map(([slot, itemId]) => {
              const item = itemId ? getItemDefinition(itemId) : null;

              return (
                <div key={slot}>
                  <dt>{equipmentSlotLabels[slot as keyof typeof equipmentSlotLabels]}</dt>
                  <dd>{item?.name ?? "未装备"}</dd>
                </div>
              );
            })}
          </dl>
        </section>
  );

  const manualPanel = (
        <section className="manual-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">识海</p>
              <h2>功法</h2>
            </div>
            <span>{learnedManuals.length} 本</span>
          </div>

          <dl className="recipe-meta manual-effect-grid">
            <div>
              <dt>修炼</dt>
              <dd>+{Math.round(manualEffects.cultivationBonus * 100)}%</dd>
            </div>
            <div>
              <dt>突破</dt>
              <dd>+{Math.round(manualEffects.breakthroughBonus * 100)}%</dd>
            </div>
            <div>
              <dt>炼丹</dt>
              <dd>+{Math.round(manualEffects.alchemyBonus * 100)}%</dd>
            </div>
            <div>
              <dt>战斗</dt>
              <dd>
                攻 +{Math.round(manualEffects.battleAttackBonus * 100)}% / 防 +
                {Math.round(manualEffects.battleDefenseBonus * 100)}%
              </dd>
            </div>
          </dl>

          <div className="sect-list">
            {learnedManuals.length === 0 ? (
              <p className="empty-text">尚未学习功法</p>
            ) : (
              learnedManuals.map((manual) => (
                <article className="sect-item" key={manual.itemId}>
                  <div>
                    <strong>{manual.name}</strong>
                    <p>{manual.description}</p>
                    <p>{formatManualEffects(manual.effects)}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
  );

  /** 野外操作：移动端页脚并排历练/探索；桌面仍在两面板内各自内嵌 */
  const wildActions = (
    <div className="action-row">
      <button type="button" onClick={handleExplore}>
        外出历练
      </button>
      <button type="button" className="secondary" onClick={handleSecretExplore}>
        深入探索
      </button>
    </div>
  );

  const battlePanel = (
        <section className="battle-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">山野</p>
              <h2>弓箭对射</h2>
            </div>
            {equippedWeapon ? (
              <span className="weapon-info">持械：{equippedWeapon.name}</span>
            ) : null}
          </div>

          {!equippedWeapon ? (
            <p className="empty-battle-hint">
              尚未装备武器。请先在背包中穿戴武器，方可外出历练。
            </p>
          ) : availableArrows.length === 0 &&
            spiritArrowsUsable.length === 0 ? (
            <p className="empty-battle-hint">
              当前持{equippedWeapon.name}，但箭囊已空、灵力不足。可从战斗掉落、炼器补充箭矢，或调息恢复灵力以灵力化箭出战。
            </p>
          ) : battleResult ? (
            <>
              <dl className="condition-grid battle-summary">
                <div>
                  <dt>最近战斗</dt>
                  <dd>{battleResult.monster.name}</dd>
                </div>
                <div>
                  <dt>结果</dt>
                  <dd>{battleResult.victory ? "胜利" : "失败"}</dd>
                </div>
                <div>
                  <dt>灵石</dt>
                  <dd>+{battleResult.reward.spiritStones}</dd>
                </div>
                <div>
                  <dt>修为</dt>
                  <dd>+{battleResult.reward.cultivation}</dd>
                </div>
              </dl>
              <p className="empty-text">外出历练以继续战斗</p>
            </>
          ) : (
            <p className="empty-text">尚未外出历练</p>
          )}

          {!isMobile && (
            <div className="action-row">
              <button type="button" onClick={handleExplore}>
                外出历练
              </button>
            </div>
          )}
        </section>
  );

  const sparringActions = (
    <div className="action-row">
      <button type="button" onClick={handleSparring}>
        开始模拟对战
      </button>
    </div>
  );

  /** 演武场专属：模拟对战（幻影切磋，不涉生死） */
  const sparringPanel = (
        <section className="battle-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">演武</p>
              <h2>模拟对战</h2>
            </div>
            {equippedWeapon ? (
              <span className="weapon-info">持械：{equippedWeapon.name}</span>
            ) : null}
          </div>

          {!equippedWeapon ? (
            <p className="empty-battle-hint">
              尚未装备武器。请先在背包中穿戴武器，方可下场演武。
            </p>
          ) : battleResult ? (
            <>
              <dl className="condition-grid battle-summary">
                <div>
                  <dt>最近对战</dt>
                  <dd>{battleResult.monster.name}</dd>
                </div>
                <div>
                  <dt>结果</dt>
                  <dd>{battleResult.victory ? "胜利" : "失败"}</dd>
                </div>
                <div>
                  <dt>灵石</dt>
                  <dd>+{battleResult.reward.spiritStones}</dd>
                </div>
                <div>
                  <dt>修为</dt>
                  <dd>+{battleResult.reward.cultivation}</dd>
                </div>
              </dl>
              <p className="empty-text">再战一场以继续演武</p>
            </>
          ) : (
            <p className="empty-text">尚未下场演武</p>
          )}

          {!isMobile && sparringActions}
        </section>
  );

  const bossChallenge = getBossChallengeCheck(player);
  const bossMonster = bossChallenge.boss;
  const bossBehavior = getMonsterBehavior(bossMonster);

  const bossActions = (
    <div className="action-row">
      <button
        type="button"
        onClick={handleBossChallenge}
        disabled={!bossChallenge.canChallenge}
      >
        {bossChallenge.canChallenge ? "入秘境挑战" : "今日已挑战"}
      </button>
    </div>
  );

  const bossPanel = (
        <section className="battle-panel boss-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">妖芯秘境</p>
              <h2>挑战守关者</h2>
            </div>
            <span className={`prep-behavior-tag ${bossBehavior.id}`}>
              {bossBehavior.label}
            </span>
          </div>

          <p className="empty-text">{bossBehavior.description}</p>

          <dl className="condition-grid battle-summary">
            <div>
              <dt>气血</dt>
              <dd>{bossMonster.health}</dd>
            </div>
            <div>
              <dt>攻击</dt>
              <dd>{bossMonster.attack}</dd>
            </div>
            <div>
              <dt>防御</dt>
              <dd>{bossMonster.defense}</dd>
            </div>
            <div>
              <dt>今日挑战</dt>
              <dd>{bossChallenge.canChallenge ? "尚可入内" : "已用尽"}</dd>
            </div>
          </dl>

          <div className="boss-drops">
            <h3>战胜所获</h3>
            <ul>
              {bossMonster.lootTable.map((drop) => (
                <li key={drop.itemId}>
                  {getItemDefinition(drop.itemId)?.name ?? drop.itemId}
                  {" ×"}
                  {drop.quantity}
                  <small>{Math.round(drop.chance * 100)}%</small>
                </li>
              ))}
            </ul>
          </div>

          <p className="boss-daily-hint">
            秘境灵压沉重，每日仅容一人入内挑战，无论胜败，皆须明日再来。
          </p>

          {!isMobile && bossActions}
          {!bossChallenge.canChallenge && bossChallenge.reason && (
            <p className="feature-lock-reason">{bossChallenge.reason}</p>
          )}
        </section>
  );

  // ---------- 秘境节点远征（二期） ----------

  const expeditionRun = player.secretRealmRun;
  const expeditionCheck = getExpeditionCheck(player);
  /** 当前层禁制解禁灵力消耗（仅常规层 1–4；灵力不足则禁用解禁、须强闯） */
  const wardManaCost =
    expeditionRun && expeditionRun.depth < 5
      ? DEPTH_WARD_POOLS[expeditionRun.depth as 1 | 2 | 3 | 4].manaCost
      : undefined;

  const handleStartExpedition = () => {
    if (!expeditionCheck.canStart) {
      setNotice({ tone: "warning", text: expeditionCheck.missingReasons.join("；") });
      return;
    }

    setPlayer(startExpedition(player));
    setExpeditionNodeResult(null);
    setNotice({ tone: "neutral", text: "你踏碎阵门，深入妖芯秘境第一层" });
  };

  const handleExpeditionCombat = (node: ExpeditionNode) => {
    const monster = getNodeMonster(node);

    if (!monster) {
      return;
    }

    if (player.health.current <= 1) {
      setNotice({ tone: "warning", text: "气血太低，恐难御敌，先撤离调息" });
      return;
    }

    if (!equippedWeapon) {
      setNotice({ tone: "warning", text: "尚未装备武器，请先在背包中穿戴" });
      return;
    }

    if (availableArrows.length === 0 && spiritArrowsUsable.length === 0) {
      setNotice({
        tone: "warning",
        text: "箭囊已空且灵力不足，先撤离补充",
      });
      return;
    }

    setBattlePrep({ mode: "wild", fixedMonster: monster });
  };

  const handleResolveExpeditionNode = (nodeId: string, force = false) => {
    const run = player.secretRealmRun;

    if (!run) {
      return;
    }

    const result = resolveExpeditionNode(player, run, nodeId, force);
    setPlayer(result.player);
    setExpeditionNodeResult({ logs: result.logs, message: result.message });
  };

  const handleExpeditionDescend = () => {
    const run = player.secretRealmRun;

    if (!run) {
      return;
    }

    const descended = descendExpedition(player, run);
    setPlayer(descended.player);
    setExpeditionNodeResult(null);

    const nextDepth = descended.run.depth;
    setNotice({
      tone: "neutral",
      text:
        nextDepth >= 5
          ? "你踏至秘境最深处，守关者气息迫人而来"
          : `你摒神深入，抵秘境第 ${nextDepth} 层`,
    });
  };

  const handleExpeditionBank = () => {
    const run = player.secretRealmRun;

    if (!run) {
      return;
    }

    setPlayer(bankExpeditionLoot(player, run));
    setExpeditionNodeResult(null);
    setNotice({ tone: "success", text: "你携所得之宝撤出秘境，尽数入库" });
  };

  const handleExpeditionBoss = () => {
    if (!bossChallenge.canChallenge) {
      setNotice({
        tone: "warning",
        text: bossChallenge.reason ?? "今日已挑战过守关者",
      });
      return;
    }

    if (player.health.current <= 1) {
      setNotice({ tone: "warning", text: "气血太低，先调息恢复" });
      return;
    }

    if (!equippedWeapon) {
      setNotice({ tone: "warning", text: "尚未装备武器，请先在背包中穿戴" });
      return;
    }

    if (availableArrows.length === 0 && spiritArrowsUsable.length === 0) {
      setNotice({
        tone: "warning",
        text: "箭囊已空且灵力不足，先补充箭矢或调息恢复灵力",
      });
      return;
    }

    setBattlePrep({ mode: "boss" });
  };

  const expeditionNodeModal = expeditionNodeResult ? (
    <div className="expedition-modal-mask">
      <div className="expedition-modal">
        <h3>{expeditionNodeResult.message}</h3>
        <ol className="battle-log">
          {expeditionNodeResult.logs.map((log, index) => (
            <li key={`${log}-${index}`}>{log}</li>
          ))}
        </ol>
        <div className="action-row">
          <button type="button" onClick={handleExpeditionDescend}>
            继续深入
          </button>
          <button type="button" className="secondary" onClick={handleExpeditionBank}>
            携宝而归
          </button>
        </div>
      </div>
    </div>
  ) : null;

  /** NPC 对话：馈赠未领讲首次台词，否则随机取一组日常台词 */
  const activeNpc = getNpcById(activeNpcId);
  const activeNpcGiftPending =
    !!activeNpc?.gift &&
    !player.npcGiftClaimedIds.includes(activeNpc.id);
  const npcDialog = activeNpc ? (
    <NpcDialog
      key={activeNpc.id}
      npc={activeNpc}
      lines={
        activeNpcGiftPending
          ? activeNpc.firstLines
          : getNpcDailyLines(activeNpc)
      }
      giftAvailable={activeNpcGiftPending}
      onClose={() => setActiveNpcId(null)}
      onFinish={() => handleNpcFinish(activeNpc.id)}
    />
  ) : null;

  /** 远征战利品列表：折叠至「本局所积」子页面（父页一屏装不下时钻入查看） */
  const expeditionLootList = (
    <div className="expedition-loot">
      <h3>本局所积（未入库）</h3>
      {!expeditionRun ? (
        <p className="empty-text">本局已结束，所积已结算。</p>
      ) : expeditionRun.loot.length > 0 ? (
        <ul>
          {expeditionRun.loot.map((item) => (
            <li key={item.itemId}>
              {getItemDefinition(item.itemId)?.name ?? item.itemId}
              {" ×"}
              {item.quantity}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-text">尚无积存</p>
      )}
    </div>
  );

  /** 远征父页固定页脚：钻入战利品子页 + 撤离结算（按钮不随正文滚） */
  const expeditionFooter = (
    <>
      <button
        type="button"
        className="secondary"
        onClick={() => setSubPage("expedition-loot")}
      >
        本局所积（{expeditionRun?.loot.length ?? 0}）→
      </button>
      <button type="button" className="secondary" onClick={handleExpeditionBank}>
        撤离并结算
      </button>
    </>
  );

  /** 远征待命操作：移动端钉固定页脚，桌面内嵌正文 */
  const expeditionIdleActions = (
    <div className="action-row">
      <button
        type="button"
        onClick={handleStartExpedition}
        disabled={!expeditionCheck.canStart}
      >
        开始远征
      </button>
    </div>
  );

  /** 远征深度≥5 操作：移动端钉固定页脚，桌面内嵌正文 */
  const expeditionBossActions = (
    <div className="action-row">
      <button
        type="button"
        onClick={handleExpeditionBoss}
        disabled={!bossChallenge.canChallenge}
      >
        {bossChallenge.canChallenge ? "挑战守关者" : "今日已战"}
      </button>
      <button type="button" className="secondary" onClick={handleExpeditionBank}>
        携宝而归
      </button>
    </div>
  );

  const expeditionPanel = (
    <section className="battle-panel expedition-panel">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">妖芯秘境</p>
          <h2>节点远征</h2>
        </div>
        {expeditionRun && (
          <span className="expedition-depth">
            第 {expeditionRun.depth} / 5 层
          </span>
        )}
      </div>

      {!expeditionRun && (
        <>
          <p className="empty-text">
            逐层深入秘境，每层于战斗·采集·宝箱·禁制·奇遇中择一而行。深入越远，所耗气血·灵力·寿元越重，所获亦越丰。可随时携宝而归，唯战败则本局所积尽失。
          </p>
          <div className="expedition-ladder">
            <h3>遍历风险</h3>
            <table>
              <thead>
                <tr>
                  <th>层</th>
                  <th>气血</th>
                  <th>灵力</th>
                  <th>寿元</th>
                </tr>
              </thead>
              <tbody>
                {([1, 2, 3, 4] as const).map((depth) => (
                  <tr key={depth}>
                    <td>{depth}</td>
                    <td>-{Math.round(DEPTH_TRAVERSAL_COST[depth].healthPct * 100)}%</td>
                    <td>-{Math.round(DEPTH_TRAVERSAL_COST[depth].manaPct * 100)}%</td>
                    <td>+{DEPTH_TRAVERSAL_COST[depth].days} 日</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isMobile && expeditionIdleActions}
          {!expeditionCheck.canStart && (
            <p className="feature-lock-reason">
              {expeditionCheck.missingReasons.join("；")}
            </p>
          )}
        </>
      )}

      {expeditionRun && expeditionRun.depth < 5 && (
        <>
          <div className="expedition-nodes">
            {expeditionRun.nodes.map((node) => {
              const nodeMonster = getNodeMonster(node);
              return (
                <div
                  key={node.id}
                  className={`expedition-node ${node.type}${
                    node.resolved ? " resolved" : ""
                  }`}
                >
                  <div className="expedition-node-head">
                    <span className="expedition-node-type">
                      {NODE_TYPE_LABEL[node.type]}
                    </span>
                    {node.resolved && (
                      <span className="expedition-node-done">已结算</span>
                    )}
                  </div>
                  <p className="expedition-node-flavor">
                    {node.type === "combat" && nodeMonster
                      ? `${nodeMonster.name} · ${NODE_TYPE_FLAVOR[node.type]}`
                      : NODE_TYPE_FLAVOR[node.type]}
                  </p>
                  {!node.resolved && (
                    <div className="expedition-node-actions">
                      {node.type === "combat" && (
                        <button
                          type="button"
                          onClick={() => handleExpeditionCombat(node)}
                        >
                          迎战
                        </button>
                      )}
                      {node.type === "ward" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleResolveExpeditionNode(node.id, false)
                            }
                            disabled={
                              wardManaCost !== undefined &&
                              player.mana.current < wardManaCost
                            }
                          >
                            解禁（灵力 {wardManaCost ?? 0}）
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() =>
                              handleResolveExpeditionNode(node.id, true)
                            }
                          >
                            强闯
                          </button>
                        </>
                      )}
                      {node.type !== "combat" && node.type !== "ward" && (
                        <button
                          type="button"
                          onClick={() => handleResolveExpeditionNode(node.id)}
                        >
                          探查
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* 战利品与撤离已移入固定页脚 / 「本局所积」子页面，父页只留节点卡 */}
        </>
      )}

      {expeditionRun && expeditionRun.depth >= 5 && (
        <>
          <p className="empty-text">
            秘境尽头，{bossMonster.name}默然而立，周身灵压沉重如山。击败之，远征通关，所获尽数入库。
          </p>
          <dl className="condition-grid battle-summary">
            <div>
              <dt>气血</dt>
              <dd>{bossMonster.health}</dd>
            </div>
            <div>
              <dt>攻击</dt>
              <dd>{bossMonster.attack}</dd>
            </div>
            <div>
              <dt>防御</dt>
              <dd>{bossMonster.defense}</dd>
            </div>
            <div>
              <dt>今日挑战</dt>
              <dd>{bossChallenge.canChallenge ? "尚可入内" : "已用尽"}</dd>
            </div>
          </dl>
          {!isMobile && expeditionBossActions}
          {!bossChallenge.canChallenge && (
            <p className="feature-lock-reason">
              今日已战过守关者，可携宝而归，明日再来。
            </p>
          )}
        </>
      )}

      {expeditionNodeModal}
    </section>
  );

  const explorationPanel = (
        <section className="exploration-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">{activeWildArea ?? "野外"}</p>
              <h2>探索记录</h2>
            </div>
            {explorationResult && <span>{explorationResult.event.title}</span>}
          </div>

          {explorationResult ? (
            <>
              <dl className="condition-grid battle-summary">
                <div>
                  <dt>事件</dt>
                  <dd>{explorationResult.event.title}</dd>
                </div>
                <div>
                  <dt>类型</dt>
                  <dd>{exploreTypeLabels[explorationResult.event.type]}</dd>
                </div>
                <div>
                  <dt>灵石</dt>
                  <dd>+{explorationResult.reward.spiritStones}</dd>
                </div>
                <div>
                  <dt>修为</dt>
                  <dd>+{explorationResult.reward.cultivation}</dd>
                </div>
                <div>
                  <dt>心境</dt>
                  <dd>+{explorationResult.reward.mind}</dd>
                </div>
                <div>
                  <dt>气血 / 灵力</dt>
                  <dd>
                    {explorationResult.reward.healthChange >= 0 ? "+" : ""}
                    {explorationResult.reward.healthChange} /{" "}
                    {explorationResult.reward.manaChange >= 0 ? "+" : ""}
                    {explorationResult.reward.manaChange}
                  </dd>
                </div>
              </dl>
              <ol className="battle-log">
                {explorationResult.logs.map((log, index) => (
                  <li key={`${log}-${index}`}>{log}</li>
                ))}
              </ol>
            </>
          ) : (
            <p className="empty-text">尚未深入此地探索</p>
          )}

          {!isMobile && (
            <div className="action-row">
              <button type="button" onClick={handleSecretExplore}>
                深入探索
              </button>
            </div>
          )}
        </section>
  );

  const alchemyPanel = (
        <section className="alchemy-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">丹房</p>
              <h2>炼丹</h2>
            </div>
            {alchemyResult && (
              <span>{alchemyResult.success ? "成丹" : "废丹"}</span>
            )}
          </div>

          <div className="recipe-list">
            {alchemyRecipes.map((recipe) => {
              const check = getAlchemyCheck(player, recipe);
              const output = getItemDefinition(recipe.output.itemId);

              return (
                <article className="recipe-item" key={recipe.id}>
                  <div>
                    <strong>{recipe.name}</strong>
                    <p>{recipe.description}</p>
                    <dl className="recipe-meta">
                      <div>
                        <dt>产出</dt>
                        <dd>
                          {output?.name ?? recipe.output.itemId} x
                          {recipe.output.quantity}
                        </dd>
                      </div>
                      <div>
                        <dt>材料</dt>
                        <dd>{formatCostList(recipe.ingredients)}</dd>
                      </div>
                      <div>
                        <dt>灵石</dt>
                        <dd>{recipe.spiritStoneCost}</dd>
                      </div>
                      <div>
                        <dt>成功率</dt>
                        <dd>{formatPercent(check.successRate)}</dd>
                      </div>
                    </dl>
                    {check.missingReasons.length > 0 && (
                      <p className="recipe-warning">
                        {check.missingReasons.join("，")}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    disabled={!check.canCraft}
                    onClick={() => handleCraft(recipe.id)}
                  >
                    炼制
                  </button>
                </article>
              );
            })}
          </div>

          {alchemyResult && (
            <ol className="battle-log alchemy-log">
              {alchemyResult.logs.map((log, index) => (
                <li key={`${log}-${index}`}>{log}</li>
              ))}
            </ol>
          )}
        </section>
  );

  const craftPanel = (
        <section className="craft-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">器坊</p>
              <h2>炼器</h2>
            </div>
            {craftResult && (
              <span>{craftResult.success ? "器成" : "器毁"}</span>
            )}
          </div>

          <p className="craft-hint">
            以凡铁与灵兽材料炼制箭矢：狼牙、雾羽、玄鳞皆为杀兽所得。
          </p>

          <div className="recipe-list">
            {craftRecipes.map((recipe) => {
              const check = getCraftCheck(player, recipe);
              const output = getItemDefinition(recipe.output.itemId);

              return (
                <article className="recipe-item" key={recipe.id}>
                  <div>
                    <strong>{recipe.name}</strong>
                    <p>{recipe.description}</p>
                    <dl className="recipe-meta">
                      <div>
                        <dt>产出</dt>
                        <dd>
                          {output?.name ?? recipe.output.itemId} x
                          {recipe.output.quantity}
                        </dd>
                      </div>
                      <div>
                        <dt>材料</dt>
                        <dd>{formatCraftCostList(recipe.ingredients)}</dd>
                      </div>
                      <div>
                        <dt>灵石</dt>
                        <dd>{recipe.spiritStoneCost}</dd>
                      </div>
                      <div>
                        <dt>成功率</dt>
                        <dd>{formatPercent(check.successRate)}</dd>
                      </div>
                    </dl>
                    {check.missingReasons.length > 0 && (
                      <p className="recipe-warning">
                        {check.missingReasons.join("，")}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    disabled={!check.canCraft}
                    onClick={() => handleCraftRecipe(recipe.id)}
                  >
                    炼制
                  </button>
                </article>
              );
            })}
          </div>

          {craftResult && (
            <ol className="battle-log alchemy-log">
              {craftResult.logs.map((log, index) => (
                <li key={`${log}-${index}`}>{log}</li>
              ))}
            </ol>
          )}
        </section>
  );

  /** 宗门操作：移动端钉固定页脚，桌面内嵌正文。纯构造器，正文与页脚同源 */
  const sectActions = (featureSect: SectDefinition | null): ReactNode => {
    if (!featureSect) {
      return undefined;
    }

    const joinedHere = currentSect?.id === featureSect.id;

    if (joinedHere) {
      const promotion = getPromotionCheck(player);
      return (
        <div className="action-row">
          <button
            type="button"
            className="secondary"
            disabled={!promotion.canPromote}
            onClick={handleSectPromote}
          >
            {promotion.nextRank ? `晋升${promotion.nextRank.name}` : "已至极位"}
          </button>
          <button type="button" onClick={handleSectTask}>
            宗门任务
          </button>
        </div>
      );
    }

    // 已拜入他处：无可操作
    if (currentSect) {
      return undefined;
    }

    return (
      <div className="action-row">
        <button type="button" onClick={() => handleJoinSect(featureSect.id)}>
          拜入{featureSect.name}
        </button>
      </div>
    );
  };

  /** 山门页：只展示当前所在宗门山门，拜入/任务/兑换皆按此地宗门判定 */
  const renderSectPanel = (loc: MapLocation) => {
    const featureSect = loc.sectId ? getSectById(loc.sectId) : null;

    if (!featureSect) {
      return <p className="empty-text">此地并无宗门山门</p>;
    }

    const joinedHere = currentSect?.id === featureSect.id;
    const joinedElsewhere = currentSect && !joinedHere;
    const promotion = getPromotionCheck(player);
    const bonuses = getSectPassiveBonuses(player);
    const bonusLines = (
      [
        ["修炼效率", bonuses.cultivationBonus],
        ["炼器成功", bonuses.alchemyBonus],
        ["战斗伤害", bonuses.damageBonus],
        ["命中", bonuses.accuracyBonus],
        ["防御", bonuses.defenseBonus],
        ["伤势抵抗", bonuses.injuryResist],
        ["秘境消耗", bonuses.traversalCostReduction],
      ] as const
    )
      .filter(([, value]) => value > 0)
      .map(([label, value]) => `${label} +${Math.round(value * 100)}%`);

    return (
      <section className="sect-panel">
        <div className="panel-heading compact">
          <div>
            <p className="eyebrow">宗门 · {ELEMENT_LABELS[featureSect.element]}</p>
            <h2>{featureSect.name}</h2>
          </div>
          {joinedHere && (
            <span>
              {getSectRankDefinition(player.sectRank).name} · 贡献{" "}
              {player.sectContribution}
            </span>
          )}
        </div>

        <p className="sect-description">{featureSect.description}</p>
        <p className="sect-description">{featureSect.bonus.description}</p>

        {joinedElsewhere ? (
          <p className="empty-text">
            已拜入{currentSect.name}，当前版本暂不能改投{featureSect.name}
          </p>
        ) : joinedHere ? (
          <>
            <div className="recipe-item sect-rank">
              <div>
                <strong>当前职位 · {getSectRankDefinition(player.sectRank).name}</strong>
                {bonusLines.length > 0 && <p>本宗加成：{bonusLines.join("，")}</p>}
                {promotion.nextRank ? (
                  <p>
                    晋升{promotion.nextRank.name}：需境界更高、累计贡献{" "}
                    {promotion.nextRank.minContribution}
                  </p>
                ) : (
                  <p>已位极长老，执掌一宗权柄</p>
                )}
              </div>
              {!isMobile && (
                <button
                  type="button"
                  className="secondary"
                  disabled={!promotion.canPromote}
                  onClick={handleSectPromote}
                >
                  {promotion.nextRank ? `晋升${promotion.nextRank.name}` : "已至极位"}
                </button>
              )}
            </div>
            {!isMobile && (
              <div className="action-row sect-actions">
                <button type="button" onClick={handleSectTask}>
                  宗门任务
                </button>
              </div>
            )}
            <div className="recipe-list">
              {featureSect.shop.map((reward) => {
                const item = getItemDefinition(reward.item.itemId);
                const canExchange =
                  player.sectContribution >= reward.contributionCost &&
                  realm.order >= reward.minRealmOrder;

                return (
                  <article className="recipe-item" key={reward.id}>
                    <div>
                      <strong>{reward.name}</strong>
                      <p>{item?.description ?? "宗门库房物品"}</p>
                      <dl className="recipe-meta">
                        <div>
                          <dt>获得</dt>
                          <dd>
                            {item?.name ?? reward.item.itemId} x
                            {reward.item.quantity}
                          </dd>
                        </div>
                        <div>
                          <dt>贡献</dt>
                          <dd>{reward.contributionCost}</dd>
                        </div>
                      </dl>
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      disabled={!canExchange}
                      onClick={() => handleSectExchange(reward.id)}
                    >
                      兑换
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          !isMobile && (
            <div className="action-row">
              <button type="button" onClick={() => handleJoinSect(featureSect.id)}>
                拜入{featureSect.name}
              </button>
            </div>
          )
        )}

        {sectResult && (
          <ol className="battle-log alchemy-log">
            {sectResult.logs.map((log, index) => (
              <li key={`${log}-${index}`}>{log}</li>
            ))}
          </ol>
        )}
      </section>
    );
  };

  /** 商铺页：按城镇库存与倍率买入；卖出统一为基准价六成 */
  const renderShopPanel = (loc: MapLocation) => {
    const shop = getShop(loc.id);

    if (!shop) {
      return <p className="empty-text">此地并无商铺</p>;
    }

    const markupLabel = `加价 ${Math.round((shop.markup - 1) * 100)} 成`;

    /** 桌面端双栏原样保留 */
    const buyColumn = (
      <div className="shop-column">
        <h3>购入 · {markupLabel}</h3>
        <div className="recipe-list">
          {shop.itemIds.map((itemId) => {
            const item = getItemDefinition(itemId);

            if (!item) return null;

            const price = getBuyPrice(item, shop.markup);

            return (
              <article className="recipe-item" key={itemId}>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.description}</p>
                  <dl className="recipe-meta">
                    <div>
                      <dt>售价</dt>
                      <dd>灵石 x{price}</dd>
                    </div>
                  </dl>
                </div>
                <button
                  type="button"
                  className="secondary"
                  disabled={player.spiritStones < price}
                  onClick={() => handleBuyItem(itemId)}
                >
                  购入
                </button>
              </article>
            );
          })}
        </div>
      </div>
    );

    const sellColumn = (
      <div className="shop-column">
        <h3>售出 · 基准价六成</h3>
        <div className="recipe-list">
          {player.inventory.length === 0 ? (
            <p className="empty-text">背包空空如也，无可售之物</p>
          ) : (
            player.inventory.map((entry) => {
              const item = getItemDefinition(entry.itemId);

              if (!item) return null;

              const price = getSellPrice(item);

              return (
                <article className="recipe-item" key={entry.itemId}>
                  <div>
                    <strong>
                      {item.name} x{entry.quantity}
                    </strong>
                    <p>{item.description}</p>
                    <dl className="recipe-meta">
                      <div>
                        <dt>收购价</dt>
                        <dd>灵石 x{price}</dd>
                      </div>
                    </dl>
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleSellItem(entry.itemId)}
                  >
                    售出
                  </button>
                </article>
              );
            })
          )}
        </div>
      </div>
    );

    /** 手机端：页签 + 密集网格，整格即购/售按钮，一屏尽览 */
    const mobileBuyGrid = (
      <div className="shop-grid">
        {shop.itemIds.map((itemId) => {
          const item = getItemDefinition(itemId);

          if (!item) return null;

          const price = getBuyPrice(item, shop.markup);

          return (
            <button
              type="button"
              className="shop-cell"
              key={itemId}
              disabled={player.spiritStones < price}
              onClick={() => handleBuyItem(itemId)}
            >
              <strong>{item.name}</strong>
              <span>灵石 x{price}</span>
            </button>
          );
        })}
      </div>
    );

    const mobileSellGrid = (
      <div className="shop-grid">
        {player.inventory.length === 0 ? (
          <p className="empty-text">背包空空如也，无可售之物</p>
        ) : (
          player.inventory.map((entry) => {
            const item = getItemDefinition(entry.itemId);

            if (!item) return null;

            const price = getSellPrice(item);

            return (
              <button
                type="button"
                className="shop-cell"
                key={entry.itemId}
                onClick={() => handleSellItem(entry.itemId)}
              >
                <strong>
                  {item.name} x{entry.quantity}
                </strong>
                <span>售 灵石 x{price}</span>
              </button>
            );
          })
        )}
      </div>
    );

    return (
      <section className="shop-panel">
        <div className="panel-heading compact">
          <div>
            <p className="eyebrow">商贾</p>
            <h2>买卖货物</h2>
          </div>
          <span>灵石 {player.spiritStones}</span>
        </div>

        {isMobile ? (
          <>
            <div className="shop-tabs" role="tablist" aria-label="买卖">
              <button
                type="button"
                role="tab"
                aria-selected={shopTab === "buy"}
                className={`shop-tab${shopTab === "buy" ? " active" : ""}`}
                onClick={() => setShopTab("buy")}
              >
                购入 · {shop.itemIds.length}（{markupLabel}）
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={shopTab === "sell"}
                className={`shop-tab${shopTab === "sell" ? " active" : ""}`}
                onClick={() => setShopTab("sell")}
              >
                售出 · {player.inventory.length}（基准六成）
              </button>
            </div>
            {shopTab === "buy" ? mobileBuyGrid : mobileSellGrid}
          </>
        ) : (
          <div className="shop-columns">
            {buyColumn}
            {sellColumn}
          </div>
        )}
      </section>
    );
  };

  /** 采矿操作：移动端钉固定页脚，桌面内嵌正文。纯构造器，正文与页脚同源 */
  const mineActions = (loc: MapLocation): ReactNode => (
    <div className="action-row">
      <button
        type="button"
        disabled={!getMineCheck(player, loc).canMine}
        onClick={() => handleMine(loc)}
      >
        采矿一次
      </button>
    </div>
  );

  /** 灵矿页：耗费气血灵力与时日，产出灵石与材料 */
  const renderMinePanel = (loc: MapLocation) => {
    const table = getMineTable(loc.mineId);

    if (!table) {
      return <p className="empty-text">此地并无矿脉</p>;
    }

    const check = getMineCheck(player, loc);
    const dropNames = table.drops.map(
      (drop) =>
        `${getItemDefinition(drop.itemId)?.name ?? drop.itemId}（${Math.round(drop.chance * 100)}%）`,
    );

    return (
      <section className="mine-panel">
        <div className="panel-heading compact">
          <div>
            <p className="eyebrow">矿脉</p>
            <h2>采矿</h2>
          </div>
          <span>灵石 {player.spiritStones}</span>
        </div>

        <dl className="condition-grid">
          <div>
            <dt>耗气血</dt>
            <dd>{table.healthCost}</dd>
          </div>
          <div>
            <dt>耗灵力</dt>
            <dd>{table.manaCost}</dd>
          </div>
          <div>
            <dt>耗时</dt>
            <dd>{table.timeDays} 日</dd>
          </div>
          <div>
            <dt>灵石产出</dt>
            <dd>
              {table.spiritStones[0]}~{table.spiritStones[1]}（每层境界 +
              {table.perOrderBonus}）
            </dd>
          </div>
          <div>
            <dt>当前境界层</dt>
            <dd>{realm.order}</dd>
          </div>
          <div>
            <dt>或得材料</dt>
            <dd>{dropNames.length > 0 ? dropNames.join("、") : "无"}</dd>
          </div>
        </dl>

        {check.missingReasons.length > 0 && (
          <p className="recipe-warning">{check.missingReasons.join("，")}</p>
        )}

        {!isMobile && mineActions(loc)}

        {mineResult && <p className="mine-result">{mineResult.message}</p>}
      </section>
    );
  };

  /** 地点卡片：简介、前往、搭建洞府与功能入口（含锁定原因） */
  const renderLocationCard = (loc: MapLocation, full = false) => {
    const isHere = isAt(player, loc.id);
    const features = getLocationFeatures(player, loc);
    const npcsHere = getNpcsByLocationId(loc.id);
    const travelDays = estimateTravelDays(player, loc.id);
    const buildCheck =
      loc.type === "spirit-land" ? getBuildCaveCheck(player, loc) : null;
    const showBuild =
      buildCheck !== null && !player.caveDwellingId && loc.caveCost !== undefined;

    // 野外地点：按区域怪物代表境界换算推荐战力区间（仅展示，不拦入口）
    const areaMonsters =
      loc.type === "wild" && loc.monsterArea
        ? monsters.filter((monster) => monster.area === loc.monsterArea)
        : [];
    const areaBand =
      areaMonsters.length > 0
        ? getRealmPowerBand(
            Math.round(
              areaMonsters.reduce(
                (sum, monster) => sum + getMonsterTypicalOrder(monster),
                0,
              ) / areaMonsters.length,
            ),
          ).band
        : null;
    // 秘境地点：守关者相对自身战力的难度档
    const bossDifficulty =
      loc.type === "secret-realm"
        ? getMonsterDifficulty(getSecretRealmBoss(), playerPower)
        : null;

    return (
      <article className={`location-card${full ? " full" : ""}`}>
        {full && (
          <span className="arrival-seal" aria-hidden="true">
            已至
          </span>
        )}
        <div className="panel-heading compact">
          <div>
            <p className="eyebrow">
              {full ? "已抵达 · " : ""}
              {LOCATION_TYPE_LABELS[loc.type]}
              {!full && isHere ? " · 当前所在" : ""}
            </p>
            <h2>{loc.name}</h2>
          </div>
        </div>

        <p className="location-desc">{loc.description}</p>

        {areaBand && (
          <p className="location-power-hint">
            历练推荐战力 {areaBand[0]}–{areaBand[1]}
          </p>
        )}
        {bossDifficulty && (
          <p className="location-power-hint">
            自身战力 {playerPower} · 守关者
            <span className={`difficulty-word difficulty-${bossDifficulty.label}`}>
              {bossDifficulty.text}
            </span>
          </p>
        )}

        {/* 地图卡片仅允许「前往 / 进入」，其余操作须抵达后在抵达页进行 */}
        {full ? (
          showBuild &&
          buildCheck && (
            <div className="location-actions">
              <button
                type="button"
                className="secondary"
                disabled={!buildCheck.canBuild}
                onClick={() => handleBuildCave(loc)}
              >
                搭建洞府（灵石 x{buildCheck.cost}）
              </button>
            </div>
          )
        ) : (
          <div className="location-actions">
            {isHere ? (
              <button
                type="button"
                disabled={!!traveling}
                onClick={() =>
                  setView({ screen: "location", locationId: loc.id })
                }
              >
                进入{loc.name}
              </button>
            ) : (
              <button
                type="button"
                disabled={!!traveling}
                onClick={() => handleTravelTo(loc)}
              >
                前往（行路约 {travelDays} 日）
              </button>
            )}
          </div>
        )}

        {loc.type === "spirit-land" &&
          player.caveDwellingId &&
          player.caveDwellingId !== loc.id && (
            <p className="location-note">
              洞府已建于{caveLocation?.name ?? "他处"}，不可另建
            </p>
          )}

        {npcsHere.length > 0 && (
          <div className="npc-roster">
            <h3 className="npc-roster-title">此地人物</h3>
            <ul>
              {npcsHere.map((npc) => (
                <li key={npc.id}>
                  <button
                    type="button"
                    className="npc-roster-item"
                    disabled={!full}
                    onClick={() => setActiveNpcId(npc.id)}
                  >
                    <span className="npc-portrait" aria-hidden="true">
                      {npc.portrait}
                    </span>
                    <span className="npc-roster-text">
                      <span className="npc-name">{npc.name}</span>
                      <span className="npc-title-tag">{npc.title}</span>
                    </span>
                    {!full && (
                      <span className="feature-lock-reason">抵达后方可攀谈</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ul className="location-features">
          {features.map((feature) => (
            <li key={feature.feature}>
              <button
                type="button"
                className="location-feature-button"
                disabled={!full || feature.locked}
                onClick={() => enterFeature(loc, feature.feature)}
              >
                <span>{feature.label}</span>
                {feature.locked && feature.reason ? (
                  <span className="feature-lock-reason">{feature.reason}</span>
                ) : !full ? (
                  <span className="feature-lock-reason">抵达后开启</span>
                ) : null}
              </button>
            </li>
          ))}
          {features.length === 0 && (
            <li className="location-note">此地并无可做之事，仅作歇脚</li>
          )}
        </ul>

        {!full && features.length > 0 && (
          <p className="location-note">以上事务仅作提示，抵达此地方可操作</p>
        )}
      </article>
    );
  };

  const savePanel = (
        <section className="save-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">本地</p>
              <h2>存档</h2>
            </div>
          </div>
          <p className="save-meta">创建于 {formatDateTime(player.createdAt)}</p>
          <p className="save-meta">更新于 {formatDateTime(player.updatedAt)}</p>
          <div className="save-actions">
            <button type="button" onClick={handleSave}>
              保存
            </button>
            <button type="button" className="secondary" onClick={handleLoad}>
              读取
            </button>
            <button type="button" className="danger" onClick={handleReset}>
              清档
            </button>
            <button type="button" className="secondary" onClick={handleExportSave}>
              导出存档
            </button>
            <button type="button" className="secondary" onClick={handleImportClick}>
              导入存档
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={handleImportFile}
            />
          </div>
        </section>
  );

  const hpPercent = Math.round(
    (player.health.current / Math.max(player.health.max, 1)) * 100,
  );
  const manaPercent = Math.round(
    (player.mana.current / Math.max(player.mana.max, 1)) * 100,
  );

  // ===== 世界地图主界面：压缩状态条 + 水墨地图 + 地点卡片 + 全局栏 =====
  const selectedLocation = selectedLocId ? getLocation(selectedLocId) : null;

  const playerStatusBar = (
    <section className="player-status-bar" aria-label="角色状态">
      <div className="status-identity">
        <p className="eyebrow">
          {realm.majorRealm} · 身处{currentLocation.name}
        </p>
        <h2>
          {player.name}
          <span className="status-realm">{realm.name}</span>
        </h2>
      </div>

      <div className="status-bars">
        <div className="status-vital">
          <div className="mobile-vital-label">
            <span>修为 {cultivationPercent}%</span>
            <span>
              {player.cultivation.current} / {player.cultivation.required}
            </span>
          </div>
          <div className="mobile-bar">
            <div
              className="mobile-bar-fill mobile-bar-cultivation"
              style={{ width: `${cultivationPercent}%` }}
            />
          </div>
        </div>
        <div className="status-vital">
          <div className="mobile-vital-label">
            <span>气血</span>
            <span>
              {player.health.current} / {player.health.max}
            </span>
          </div>
          <div className="mobile-bar">
            <div
              className="mobile-bar-fill mobile-bar-hp"
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>
        <div className="status-vital">
          <div className="mobile-vital-label">
            <span>灵力</span>
            <span>
              {player.mana.current} / {player.mana.max}
            </span>
          </div>
          <div className="mobile-bar">
            <div
              className="mobile-bar-fill mobile-bar-mana"
              style={{ width: `${manaPercent}%` }}
            />
          </div>
        </div>
        {player.injury > 0 && (
          <div className="status-vital status-injury">
            <div className="mobile-vital-label">
              <span>伤势 {player.injury}</span>
              <span>{describeInjuryPenalty(player.injury).join(" · ")}</span>
            </div>
            <div className="mobile-bar">
              <div
                className="mobile-bar-fill mobile-bar-injury"
                style={{ width: `${player.injury}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <dl className="status-figures">
        <div>
          <dt>灵石</dt>
          <dd>{player.spiritStones}</dd>
        </div>
        <div>
          <dt>寿元</dt>
          <dd>
            {formatAge(player.age)} / {player.lifespan}（余{" "}
            {remainingYears.toFixed(1)} 年）
          </dd>
        </div>
        <div>
          <dt>灵根</dt>
          <dd>{rootGradeLabels[player.spiritualRoot.grade]}</dd>
        </div>
        <div>
          <dt>宗门</dt>
          <dd>{currentSect?.name ?? "散修"}</dd>
        </div>
        <div>
          <dt>洞府</dt>
          <dd>{caveLocation?.name ?? "尚无"}</dd>
        </div>
        <div>
          <dt>心境</dt>
          <dd>{player.attributes.mind}</dd>
        </div>
      </dl>
    </section>
  );

  const globalActionBar = (
    <nav className="global-bar" aria-label="全局功能">
      {GLOBAL_PANELS.map((panel) => {
        const active =
          view.screen === "global" && view.panel === panel.id;

        return (
          <button
            key={panel.id}
            type="button"
            className={`global-bar-chip${active ? " active" : ""}`}
            onClick={() => {
              if (view.screen !== "global") {
                setPrevView(view);
              }
              setView({ screen: "global", panel: panel.id });
            }}
          >
            <span className="global-bar-glyph" aria-hidden="true">
              {panel.glyph}
            </span>
            <span className="global-bar-label">{panel.label}</span>
          </button>
        );
      })}
    </nav>
  );

  /** 功能页正文：按功能类型渲染对应面板 */
  const renderFeatureBody = (loc: MapLocation, feature: FeatureId): ReactNode => {
    switch (feature) {
      case "shop":
        return renderShopPanel(loc);
      case "merchant":
        return renderShopPanel(loc);
      case "sect":
        return renderSectPanel(loc);
      case "wild":
        return (
          <>
            {battlePanel}
            {explorationPanel}
          </>
        );
      case "cave":
        return mainPanel;
      case "alchemy":
        return alchemyPanel;
      case "craft":
        return craftPanel;
      case "mine":
        return renderMinePanel(loc);
      case "arena":
        return sparringPanel;
      case "boss":
        return bossPanel;
      case "expedition":
        return expeditionPanel;
      default:
        return null;
    }
  };

  const globalPanelBody: Record<GlobalPanelId, ReactNode> = {
    inventory: inventoryPanel,
    equipment: equipmentPanel,
    manual: manualPanel,
    root: sidePanel,
    goals: <GoalsPanel player={player} />,
    save: savePanel,
  };

  /** 带返回键的整页容器（桌面手机同构，桌面限宽居中）；footer 为固定页脚（操作按钮不随正文滚） */
  const worldPage = (
    title: string,
    backLabel: string,
    onBack: () => void,
    body: ReactNode,
    extraClass = "",
    style?: CSSProperties,
    footer?: ReactNode,
  ) => (
    <section
      className={`world-page mobile-page${extraClass ? ` ${extraClass}` : ""}`}
      style={style}
    >
      <header className="mobile-page-header">
        <button type="button" className="mobile-back-button" onClick={onBack}>
          ← {backLabel}
        </button>
        <h2>{title}</h2>
      </header>
      <div className="mobile-page-body">{body}</div>
      {footer ? <footer className="mobile-page-footer">{footer}</footer> : null}
    </section>
  );

  const locationView =
    view.screen === "location" ? getLocation(view.locationId) : null;
  const featureView =
    view.screen === "feature" ? getLocation(view.locationId) : null;
  /** 当前激活的子页面：仅当隶属 feature 页仍在屏时生效（owner 守卫，视图切换由 effect 兜底清空） */
  const activeSubPage: SubPageId | null =
    view.screen === "feature" &&
    subPage &&
    SUBPAGE_META[subPage].owner === view.feature
      ? subPage
      : null;

  /** 子页面正文分发 */
  const renderSubPageBody = (id: SubPageId): ReactNode => {
    switch (id) {
      case "expedition-loot":
        return expeditionLootList;
      default:
        return null;
    }
  };
  /**
   * 功能页固定页脚映射：移动端把操作按钮钉在页脚（不随正文滚动）；
   * 桌面一律返回 undefined。例外：远征 running 态页脚桌面也在用，
   * 故 expedition 分支先于 isMobile 门处理。
   */
  const getFeatureFooter = (loc: MapLocation, feature: FeatureId): ReactNode => {
    if (feature === "expedition") {
      if (expeditionRun && expeditionRun.depth < 5) {
        return expeditionFooter;
      }
      if (!isMobile) {
        return undefined;
      }
      return expeditionRun ? expeditionBossActions : expeditionIdleActions;
    }

    if (!isMobile) {
      return undefined;
    }

    switch (feature) {
      case "cave":
        return mainPanelActions;
      case "wild":
        return wildActions;
      case "boss":
        return bossActions;
      case "arena":
        return sparringActions;
      case "mine":
        // 无矿脉之地不悬空按钮
        return getMineTable(loc.mineId) ? mineActions(loc) : undefined;
      case "sect":
        return sectActions(loc.sectId ? getSectById(loc.sectId) : null);
      default:
        // alchemy/craft/shop/inventory：整格即按钮，无页脚
        return undefined;
    }
  };

  /** 宗门抵达页：背景光晕按主修五行着色 */
  const locationViewSect =
    locationView?.type === "sect" && locationView.sectId
      ? getSectById(locationView.sectId)
      : null;

  return (
    <main
      className={`app-shell world-shell${
        view.screen === "map"
          ? " world-shell-map"
          : view.screen === "location"
            ? " world-shell-immersive"
            : ""
      }`}
    >
      {cultivationAction && (
        <CultivationOverlay
          state={cultivationAction}
          onClose={closeCultivationAction}
        />
      )}
      {cultivateMonths !== null && !cultivationAction && (
        <CultivateTimePicker
          months={planMonths}
          cap={Math.max(1, cultivateCap)}
          preview={cultivatePreview}
          remainingYears={getRemainingYears(player)}
          onChange={setCultivateMonths}
          onConfirm={() => handleCultivate(planMonths)}
          onCancel={() => setCultivateMonths(null)}
        />
      )}
      {breakthroughOpen && !cultivationAction && nextRealm && (
        <BreakthroughDialog
          realmName={realm.name}
          nextRealmName={nextRealm.name}
          chance={breakthroughCheck.chance}
          requirements={breakthroughRequirements}
          costLine={breakthroughCosts}
          canBreakthrough={breakthroughCheck.canBreakthrough}
          onConfirm={handleBreakthrough}
          onCancel={() => setBreakthroughOpen(false)}
        />
      )}
      <div
        key={`${notice.tone}-${notice.text}`}
        className={`world-notice notice-${notice.tone}`}
      >
        {notice.text}
      </div>

      {npcDialog}

      {view.screen === "map" && (
        <div className="world-map-full">
          <WorldMap
            currentLocationId={currentLocation.id}
            selectedId={selectedLocId}
            onSelect={(loc) => {
              if (!traveling) setSelectedLocId(loc.id);
            }}
            disabled={!!traveling}
            travel={
              traveling
                ? {
                    d: traveling.pathD,
                    duration: traveling.duration,
                    junctions: traveling.junctions,
                  }
                : null
            }
            onTravelEnd={endTravel}
            lockedIds={realmLockedIds}
          />

          {/* 左缘角色状态书签：竖条把手贴左缘，点击右移放大为状态抽屉 */}
          <button
            type="button"
            className={`status-chip${statusOpen ? " open" : ""}`}
            onClick={() => setStatusOpen((o) => !o)}
            aria-expanded={statusOpen}
            aria-label="角色状态，点击展开详情"
          >
            <span className="status-chip-medal" aria-hidden="true">
              <span className="status-chip-medal-char">
                {realm.majorRealm.charAt(0)}
              </span>
            </span>
            <span className="status-chip-name-v">{player.name}</span>
            <span className="status-chip-vbars" aria-hidden="true">
              <span className="vbar-track">
                <span
                  className="vbar-fill vbar-cult"
                  style={{ height: `${cultivationPercent}%` }}
                />
              </span>
              <span className="vbar-track">
                <span
                  className="vbar-fill vbar-hp"
                  style={{ height: `${hpPercent}%` }}
                />
              </span>
              <span className="vbar-track">
                <span
                  className="vbar-fill vbar-mana"
                  style={{ height: `${manaPercent}%` }}
                />
              </span>
            </span>
          </button>

          {/* 目标摘要：状态书签移居左缘后，摘要胶囊留守左上角 */}
          {goalSummary && (
            <div className="map-goal-summary">
              <span className="map-goal-glyph" aria-hidden="true">
                志
              </span>
              {goalSummary}
            </div>
          )}

          {statusOpen && (
            <>
              <div
                className="status-overlay-backdrop"
                onClick={() => setStatusOpen(false)}
              />
              <section
                className="status-overlay"
                role="dialog"
                aria-modal="true"
                aria-label="角色状态详情"
              >
                <div className="status-overlay-head">
                  <span>角色状态</span>
                  <button
                    type="button"
                    className="status-overlay-close"
                    onClick={() => setStatusOpen(false)}
                    aria-label="关闭角色状态"
                  >
                    ✕
                  </button>
                </div>
                {playerStatusBar}
              </section>
            </>
          )}

          {/* 右上角全局功能页签 */}
          <div className="map-corner-bar">{globalActionBar}</div>

          {/* 底部悬浮地点卡片 */}
          <aside className="world-side map-side-float" aria-label="地点详情">
            {selectedLocation ? (
              <div className="map-side-card">
                <button
                  type="button"
                  className="map-side-close"
                  onClick={() => setSelectedLocId(null)}
                  aria-label="收起地点卡片"
                >
                  ✕
                </button>
                {renderLocationCard(selectedLocation)}
              </div>
            ) : (
              <p className="map-hint">点选地图上的地点，查看详情与功能</p>
            )}
          </aside>
        </div>
      )}

      {view.screen === "location" &&
        locationView &&
        worldPage(
          `${locationView.name} · ${LOCATION_TYPE_LABELS[locationView.type]}`,
          "返回地图",
          () => setView({ screen: "map" }),
          renderLocationCard(locationView, true),
          `location-bg location-bg-${locationView.type}`,
          locationViewSect
            ? ({
                "--loc-accent-glow": hexToRgba(
                  ELEMENT_ACCENTS[locationViewSect.element],
                  0.24,
                ),
              } as CSSProperties)
            : undefined,
        )}

      {view.screen === "feature" &&
        featureView &&
        (activeSubPage
          ? worldPage(
              SUBPAGE_META[activeSubPage].title,
              SUBPAGE_META[activeSubPage].backLabel,
              () => setSubPage(null),
              renderSubPageBody(activeSubPage),
              "",
              undefined,
              expeditionRun ? (
                <button
                  type="button"
                  className="secondary"
                  onClick={handleExpeditionBank}
                >
                  撤离并结算
                </button>
              ) : undefined,
            )
          : worldPage(
              `${featureView.name} · ${FEATURE_PAGE_TITLES[view.feature]}`,
              `返回${featureView.name}`,
              () =>
                setView({ screen: "location", locationId: featureView.id }),
              renderFeatureBody(featureView, view.feature),
              "",
              undefined,
              getFeatureFooter(featureView, view.feature),
            ))}

      {view.screen === "global" &&
        worldPage(
          GLOBAL_PANEL_TITLES[view.panel],
          "返回",
          () => setView(prevView),
          globalPanelBody[view.panel],
        )}

      {view.screen !== "map" &&
        view.screen !== "global" &&
        !activeSubPage &&
        globalActionBar}
    </main>
  );
}
