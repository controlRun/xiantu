import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  getTargetZone,
  targetZones,
} from "./data/arrows";
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
import { getNextRealm, getRealmById } from "./data/realms";
import { alchemyRecipes } from "./data/recipes";
import { getSectById, sectDefinitions } from "./data/sects";
import {
  craftAlchemyRecipe,
  formatCostList,
  getAlchemyCheck,
} from "./systems/alchemySystem";
import {
  applyPlayerShot,
  canBattle,
  canUseSpiritArrows,
  getAvailableArrowsForBattle,
  getCombatArrow,
  restPlayer,
  shootArrow,
  skipPlayerShot,
  startArcheryBattle,
  startSparringBattle,
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
import { getInventoryQuantity } from "./systems/inventorySystem";
import {
  completeSectTask,
  exchangeSectReward,
  getAvailableSects,
  joinSect,
} from "./systems/sectSystem";
import type {
  AlchemyResult,
  ArcheryDuelState,
  BattleResult,
  ExplorationResult,
  Player,
  PlayerGender,
  SaveData,
  SectActionResult,
  TargetZoneId,
} from "./types/game";
import {
  clearSave,
  loadGame,
  saveGame,
  SAVE_SLOT_LABEL,
} from "./utils/saveLoad";
import { formatAge, getRemainingYears } from "./systems/timeSystem";
import { BattleScreen } from "./components/battle/BattleScreen";
import {
  CultivationOverlay,
  type CultivationActionKind,
  type CultivationActionState,
} from "./components/CultivationOverlay";
import { StartScreen } from "./components/StartScreen";
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

/** 手机端视图：home 为主界面中枢，其余为一级功能子页面 */
type MobileView =
  | "home"
  | "cultivate"
  | "battle"
  | "explore"
  | "alchemy"
  | "craft"
  | "inventory"
  | "equipment"
  | "manual"
  | "sect"
  | "save";

const mobileViewTitles: Record<Exclude<MobileView, "home">, string> = {
  cultivate: "修炼",
  battle: "对战",
  explore: "探索",
  alchemy: "炼丹",
  craft: "炼器",
  inventory: "背包",
  equipment: "装备",
  manual: "功法",
  sect: "宗门",
  save: "存档",
};

interface MobileTile {
  view: Exclude<MobileView, "home">;
  glyph: string;
  label: string;
  status: string;
  accent: string;
}

export function App() {
  // 手机端：紧凑对战布局 + 竖屏时自动旋转为横屏；isMobile 用于切换手机中枢布局
  const { isMobile } = useMobileGameLayout();

  const [restoredSave, setRestoredSave] = useState<SaveData | null>(() =>
    loadGame(),
  );
  /** 开局先停留在存档选择/角色创建界面，选择后才进入游戏 */
  const [hasEnteredGame, setHasEnteredGame] = useState(false);
  const [player, setPlayer] = useState<Player>(
    () => restoredSave?.player ?? createInitialPlayer(),
  );
  const [notice, setNotice] = useState<Notice>({
    tone: "neutral",
    text: "仙途漫漫，始于足下",
  });
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [archeryDuel, setArcheryDuel] = useState<ArcheryDuelState | null>(null);
  const [selectedArrowId, setSelectedArrowId] = useState("wooden-arrow");
  const [selectedTargetId, setSelectedTargetId] =
    useState<TargetZoneId>("chest");
  const [alchemyResult, setAlchemyResult] = useState<AlchemyResult | null>(null);
  const [craftResult, setCraftResult] = useState<AlchemyResult | null>(null);
  const [explorationResult, setExplorationResult] =
    useState<ExplorationResult | null>(null);
  const [sectResult, setSectResult] = useState<SectActionResult | null>(null);
  const [isInBattleMode, setIsInBattleMode] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("home");
  /** 修炼/参悟/调息：先播放 2 秒动画，再展示对应结果 */
  const [cultivationAction, setCultivationAction] =
    useState<CultivationActionState | null>(null);
  const cultivationActionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cultivationActionTimerRef.current !== null) {
        window.clearTimeout(cultivationActionTimerRef.current);
      }
    };
  }, []);

  const realm = getRealmById(player.realmId);
  const nextRealm = getNextRealm(player.realmId);
  const currentSect = getSectById(player.sectId);
  const availableSects = getAvailableSects(player);
  const learnedManuals = getLearnedManuals(player);
  const manualEffects = getManualEffects(player);
  const equipmentEffects = getEquipmentEffects(player);
  const breakthroughCheck = getBreakthroughCheck(player);
  const cultivationGain = getCultivationGain(player);
  const mindTrainingCost = getMindTrainingCost(player);
  const breakthroughCosts = describeBreakthroughCosts(player);
  const remainingYears = getRemainingYears(player);
  const equippedWeapon = getEquippedWeapon(player);
  const compatibleArrowIds = getWeaponCompatibleArrows(player);
  const availableArrows = getAvailableArrowsForBattle(player);
  /** 灵力化箭：境界解锁的档位（战斗中按灵力余量禁用） */
  const spiritArrows = getUnlockedSpiritArrowTiers(player);
  const spiritArrowsUsable = getUsableSpiritArrowTiers(player);
  const playerCanBattle = canBattle(player);
  const cultivationPercent = Math.min(
    100,
    Math.round((player.cultivation.current / player.cultivation.required) * 100),
  );
  const selectedArrow =
    getCombatArrow(player, selectedArrowId) ?? availableArrows[0];
  const selectedTarget = getTargetZone(selectedTargetId);
  const selectedArrowQuantity = selectedArrow
    ? getInventoryQuantity(player.inventory, selectedArrow.itemId)
    : 0;
  const selectedHitChance = selectedArrow
    ? Math.min(
        0.95,
        Math.max(
          0.1,
          selectedArrow.accuracy +
            selectedTarget.accuracyModifier +
            player.attributes.divineSense * 0.006 +
            player.attributes.luck * 0.003 +
            manualEffects.battleAttackBonus * 0.15,
        ),
      )
    : 0;
  const selectedCriticalChance = Math.min(
    0.45,
    Math.max(0.03, selectedTarget.criticalChance + player.attributes.luck * 0.004),
  );
  const canShoot =
    Boolean(archeryDuel) &&
    !archeryDuel?.finished &&
    selectedArrowQuantity > 0 &&
    Boolean(equippedWeapon);

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

  const handleCultivate = () => {
    if (cultivationAction) return;
    const nextPlayer = cultivate(player);
    setPlayer(nextPlayer);
    startCultivationAction(
      "cultivate",
      {
        kind: "cultivate",
        phase: "result",
        gain: nextPlayer.cultivation.lastGain,
        current: nextPlayer.cultivation.current,
        required: nextPlayer.cultivation.required,
        breakthroughReady: getBreakthroughCheck(nextPlayer).canBreakthrough,
      },
      `灵气入体，本次修为 +${nextPlayer.cultivation.lastGain}`,
    );
  };

  const handleBreakthrough = () => {
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

    // 默认选箭：箭囊最强实物箭；箭囊空空则取最省灵力的灵力箭
    const defaultArrowId =
      availableArrows[availableArrows.length - 1]?.itemId ??
      spiritArrowsUsable[0]?.id ??
      "";
    const duel = startArcheryBattle(player);
    setSelectedArrowId(defaultArrowId);
    setSelectedTargetId("chest");
    setArcheryDuel(duel);
    setBattleResult(null);
    setIsInBattleMode(true);
    setNotice({
      tone: "neutral",
      text: `持${equippedWeapon.name}遭遇${duel.monster.name}，选择箭矢与瞄准部位后射击`,
    });
  };

  const handleSparring = () => {
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

    // 默认选箭：箭囊最强实物箭；箭囊空空则取最省灵力的灵力箭
    const defaultArrowId =
      availableArrows[availableArrows.length - 1]?.itemId ??
      spiritArrowsUsable[0]?.id ??
      "";
    const duel = startSparringBattle(player);
    setSelectedArrowId(defaultArrowId);
    setSelectedTargetId("chest");
    setArcheryDuel(duel);
    setBattleResult(null);
    setIsInBattleMode(true);
    setNotice({
      tone: "neutral",
      text: `演武场上与${duel.monster.name}切磋，选择箭矢与瞄准部位后射击`,
    });
  };

  const handleBattleEnd = (result: BattleResult | null) => {
    setIsInBattleMode(false);
    if (result) {
      setNotice({
        tone: result.victory ? "success" : "warning",
        text: result.message,
      });
    } else {
      // 演武切磋中途退出
      setNotice({ tone: "neutral", text: "已退出对战，返回演武场外" });
    }
  };

  const handleShoot = () => {
    if (!archeryDuel) {
      setNotice({ tone: "warning", text: "尚未遭遇敌人" });
      return;
    }

    if (!selectedArrow) {
      setNotice({ tone: "warning", text: "没有可用的箭矢" });
      return;
    }

    const result = shootArrow(
      player,
      archeryDuel,
      selectedArrow.itemId,
      selectedTarget.id,
    );
    setPlayer(result.player);
    setArcheryDuel(result.duel);

    if (result.battleResult) {
      setBattleResult(result.battleResult);
    }

    setNotice({
      tone: result.battleResult
        ? result.battleResult.victory
          ? "success"
          : "warning"
        : "neutral",
      text: result.message,
    });
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

    const result = exploreSecretRealm(player);
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

  const handleReset = () => {
    clearSave();
    setRestoredSave(null);
    setHasEnteredGame(false);
    setPlayer(createInitialPlayer());
    setArcheryDuel(null);
    setBattleResult(null);
    setNotice({ tone: "warning", text: "旧存档已清除，请重新创建角色" });
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

  // Fullscreen battle mode
  if (isInBattleMode && archeryDuel) {
    return (
      <BattleScreen
        duel={archeryDuel}
        player={player}
        availableArrows={availableArrows}
        spiritArrows={spiritArrows}
        onShoot={(arrowId, zoneId, drawPower) => {
          const result = shootArrow(player, archeryDuel, arrowId, zoneId, drawPower);
          setPlayer(result.player);
          setArcheryDuel(result.duel);
          if (result.battleResult) {
            setBattleResult(result.battleResult);
          }
          return result;
        }}
        onApplyShot={(arrowId, pendingDamage) => {
          const result = applyPlayerShot(player, archeryDuel, arrowId, pendingDamage);
          setPlayer(result.player);
          setArcheryDuel(result.duel);
          if (result.battleResult) {
            setBattleResult(result.battleResult);
          }
          return result;
        }}
        onSkipShot={() => {
          const result = skipPlayerShot(player, archeryDuel);
          setPlayer(result.player);
          setArcheryDuel(result.duel);
          if (result.battleResult) {
            setBattleResult(result.battleResult);
          }
          return result;
        }}
        onBattleEnd={handleBattleEnd}
        battleResult={battleResult}
      />
    );
  }

  const profilePanel = (
        <aside className="profile-panel">
          <div className="ink-landscape" aria-hidden="true" />
          <div className="profile-heading">
            <div>
              <p className="eyebrow">{realm.majorRealm}</p>
              <h2>{player.name}</h2>
            </div>
            <span>{realm.name}</span>
          </div>

          <dl className="vital-grid">
            <div>
              <dt>寿元</dt>
              <dd>
                {formatAge(player.age)} / {player.lifespan}
              </dd>
            </div>
            <div>
              <dt>剩余</dt>
              <dd>{remainingYears.toFixed(1)} 年</dd>
            </div>
            <div>
              <dt>性别</dt>
              <dd>{player.gender === "female" ? "女" : "男"}</dd>
            </div>
            <div>
              <dt>灵石</dt>
              <dd>{player.spiritStones}</dd>
            </div>
            <div>
              <dt>气血</dt>
              <dd>
                {player.health.current} / {player.health.max}
              </dd>
            </div>
            <div>
              <dt>灵力</dt>
              <dd>
                {player.mana.current} / {player.mana.max}
              </dd>
            </div>
          </dl>
        </aside>
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
              <dt>修炼收益</dt>
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

          <div className="breakthrough-check">
            <strong>
              {breakthroughCheck.canBreakthrough ? "突破条件已满足" : "突破缺失项"}
            </strong>
            {breakthroughCheck.missingReasons.length > 0 ? (
              <ul className="requirement-list" aria-label="突破缺失条件">
                {breakthroughCheck.missingReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p>修为、心境、灵石和材料均已达成，可以尝试突破。</p>
            )}
          </div>

          <div className="action-row">
            <button
              type="button"
              onClick={handleCultivate}
              disabled={Boolean(cultivationAction)}
            >
              修炼一次
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
              onClick={handleBreakthrough}
              disabled={Boolean(cultivationAction)}
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

  const inventoryPanel = (
        <section className="inventory-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">随身</p>
              <h2>背包</h2>
            </div>
          </div>
          <div className="inventory-list">
            {player.inventory.length === 0 ? (
              <p className="empty-text">背包空空如也</p>
            ) : (
              player.inventory.map((entry) => {
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
              <p className="empty-text">外出历练或模拟对战以继续战斗</p>
            </>
          ) : (
            <p className="empty-text">尚未外出历练</p>
          )}

          <div className="action-row">
            <button type="button" onClick={handleExplore}>
              外出历练
            </button>
            <button type="button" className="secondary" onClick={handleSparring}>
              模拟对战
            </button>
          </div>
        </section>
  );

  const explorationPanel = (
        <section className="exploration-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">秘境</p>
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
            <p className="empty-text">尚未进入秘境</p>
          )}

          <div className="action-row">
            <button type="button" onClick={handleSecretExplore}>
              探索秘境
            </button>
          </div>
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

  const sectPanel = (
        <section className="sect-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">宗门</p>
              <h2>{currentSect?.name ?? "未入山门"}</h2>
            </div>
            <span>贡献 {player.sectContribution}</span>
          </div>

          {currentSect ? (
            <>
              <p className="sect-description">{currentSect.description}</p>
              <div className="action-row sect-actions">
                <button type="button" onClick={handleSectTask}>
                  宗门任务
                </button>
              </div>
              <div className="recipe-list">
                {currentSect.shop.map((reward) => {
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
            <div className="sect-list">
              {availableSects.map((sect) => (
                <article className="sect-item" key={sect.id}>
                  <div>
                    <strong>{sect.name}</strong>
                    <p>{sect.description}</p>
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleJoinSect(sect.id)}
                  >
                    拜入
                  </button>
                </article>
              ))}
              {availableSects.length < sectDefinitions.length && (
                <p className="empty-text">仍有宗门需更高境界方可拜入</p>
              )}
            </div>
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
          </div>
        </section>
  );

  // ===== 手机端：主界面中枢 + 一级功能子页面 =====
  const hpPercent = Math.round(
    (player.health.current / Math.max(player.health.max, 1)) * 100,
  );
  const manaPercent = Math.round(
    (player.mana.current / Math.max(player.mana.max, 1)) * 100,
  );

  const mobileTiles: MobileTile[] = [
    {
      view: "cultivate",
      glyph: "修",
      label: "修炼",
      status: `${cultivationPercent}% · ${realm.name}`,
      accent: "#e8c45d",
    },
    {
      view: "battle",
      glyph: "戰",
      label: "对战",
      status: !equippedWeapon
        ? "尚未持械"
        : availableArrows.length > 0
          ? `${availableArrows.length} 种箭矢`
          : spiritArrowsUsable.length > 0
            ? "灵力化箭"
            : "箭囊空空",
      accent: "#e85d5d",
    },
    {
      view: "explore",
      glyph: "探",
      label: "探索",
      status: explorationResult ? explorationResult.event.title : "尚未入秘境",
      accent: "#72c08c",
    },
    {
      view: "alchemy",
      glyph: "丹",
      label: "炼丹",
      status: alchemyResult
        ? alchemyResult.success
          ? "上炉成丹"
          : "上炉废丹"
        : `${alchemyRecipes.length} 种丹方`,
      accent: "#b78ae0",
    },
    {
      view: "craft",
      glyph: "器",
      label: "炼器",
      status: craftResult
        ? craftResult.success
          ? "器成出炉"
          : "器胚崩碎"
        : `${craftRecipes.length} 种器方`,
      accent: "#e0a458",
    },
    {
      view: "inventory",
      glyph: "藏",
      label: "背包",
      status:
        player.inventory.length === 0
          ? "空空如也"
          : `${player.inventory.length} 种物品`,
      accent: "#e8975d",
    },
    {
      view: "equipment",
      glyph: "器",
      label: "装备",
      status: equippedWeapon?.name ?? "未装备法器",
      accent: "#7fa8e0",
    },
    {
      view: "manual",
      glyph: "訣",
      label: "功法",
      status:
        learnedManuals.length === 0
          ? "尚未习功"
          : `${learnedManuals.length} 本功法`,
      accent: "#5dc0b0",
    },
    {
      view: "sect",
      glyph: "門",
      label: "宗门",
      status: currentSect?.name ?? "未入山门",
      accent: "#e08ab0",
    },
    {
      view: "save",
      glyph: "存",
      label: "存档",
      status: "本地存档",
      accent: "#a8b2c0",
    },
  ];

  // 手机端修炼页：单屏紧凑布局，不滚动
  const mobileCultivatePanel = (
    <section className="mobile-cultivate">
      <header className="mobile-cultivate-head">
        <div className="mobile-cultivate-realm">
          <p className="eyebrow">
            {realm.majorRealm} · {player.spiritualRoot.name}
            {rootGradeLabels[player.spiritualRoot.grade]}
          </p>
          <h2>{realm.name}</h2>
        </div>
        <div className="mobile-cultivate-progress-num">
          <strong>{cultivationPercent}%</strong>
          <span>
            {player.cultivation.current} / {player.cultivation.required} 修为
          </span>
        </div>
      </header>

      <div className="mobile-bar mobile-cultivate-bar">
        <div
          className="mobile-bar-fill mobile-bar-cultivation"
          style={{ width: `${cultivationPercent}%` }}
        />
      </div>

      <dl className="mobile-cultivate-stats">
        <div>
          <dt>修炼收益</dt>
          <dd>+{cultivationGain}</dd>
        </div>
        <div>
          <dt>突破概率</dt>
          <dd>{nextRealm ? formatPercent(breakthroughCheck.chance) : "—"}</dd>
        </div>
        <div>
          <dt>心境</dt>
          <dd>
            {player.attributes.mind} / {realm.breakthrough.minMind}
          </dd>
        </div>
        <div>
          <dt>参悟消耗</dt>
          <dd>
            修{mindTrainingCost.cultivation} · 石{mindTrainingCost.spiritStones}
          </dd>
        </div>
      </dl>

      <p
        className={`mobile-cultivate-check${
          breakthroughCheck.canBreakthrough ? " ready" : ""
        }`}
      >
        {breakthroughCheck.canBreakthrough
          ? "突破条件已满足，可尝试破境"
          : nextRealm
            ? (breakthroughCheck.missingReasons[0] ?? "暂无法突破")
            : "当前版本暂未开放更高境界"}
      </p>

      <div className="mobile-cultivate-actions">
        <button
          type="button"
          onClick={handleCultivate}
          disabled={Boolean(cultivationAction)}
        >
          修炼一次
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
          onClick={handleBreakthrough}
          disabled={Boolean(cultivationAction)}
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
    </section>
  );

  const mobilePageContent: Record<Exclude<MobileView, "home">, ReactNode> = {
    cultivate: mobileCultivatePanel,
    battle: battlePanel,
    explore: explorationPanel,
    alchemy: alchemyPanel,
    craft: craftPanel,
    inventory: inventoryPanel,
    equipment: equipmentPanel,
    manual: manualPanel,
    sect: sectPanel,
    save: savePanel,
  };

  if (isMobile) {
    return (
      <main className="app-shell mobile-shell">
        {cultivationAction && (
          <CultivationOverlay
            state={cultivationAction}
            onClose={closeCultivationAction}
          />
        )}
        <div className={`mobile-notice notice-${notice.tone}`}>
          {notice.text}
        </div>

        {mobileView === "home" ? (
          <section className="mobile-hub" aria-label="游戏主界面">
            <aside className="mobile-status-card">
              <p className="eyebrow">{realm.majorRealm}</p>
              <div className="mobile-status-heading">
                <h2>{player.name}</h2>
                <span>{realm.name}</span>
              </div>

              <div className="mobile-vital">
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

              <div className="mobile-vital">
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

              <div className="mobile-vital">
                <div className="mobile-vital-label">
                  <span>修为</span>
                  <span>
                    {player.cultivation.current} /{" "}
                    {player.cultivation.required}
                  </span>
                </div>
                <div className="mobile-bar">
                  <div
                    className="mobile-bar-fill mobile-bar-cultivation"
                    style={{ width: `${cultivationPercent}%` }}
                  />
                </div>
              </div>

              <dl className="mobile-vital-grid">
                <div>
                  <dt>灵石</dt>
                  <dd>{player.spiritStones}</dd>
                </div>
                <div>
                  <dt>寿元</dt>
                  <dd>
                    {formatAge(player.age)} / {player.lifespan}
                  </dd>
                </div>
                <div>
                  <dt>剩余</dt>
                  <dd>{remainingYears.toFixed(1)} 年</dd>
                </div>
                <div>
                  <dt>宗门</dt>
                  <dd>{currentSect?.name ?? "散修"}</dd>
                </div>
                <div>
                  <dt>性别</dt>
                  <dd>{player.gender === "female" ? "女" : "男"}</dd>
                </div>
                <div>
                  <dt>心境</dt>
                  <dd>{player.attributes.mind}</dd>
                </div>
              </dl>
            </aside>

            <nav className="mobile-tile-grid" aria-label="核心功能入口">
              {mobileTiles.map((tile) => (
                <button
                  key={tile.view}
                  type="button"
                  className="mobile-tile"
                  style={{ "--tile-accent": tile.accent } as CSSProperties}
                  onClick={() => setMobileView(tile.view)}
                >
                  <span className="mobile-tile-glyph" aria-hidden="true">
                    {tile.glyph}
                  </span>
                  <span className="mobile-tile-text">
                    <span className="mobile-tile-label">{tile.label}</span>
                    <span className="mobile-tile-status">{tile.status}</span>
                  </span>
                </button>
              ))}
            </nav>
          </section>
        ) : (
          <section className="mobile-page">
            <header className="mobile-page-header">
              <button
                type="button"
                className="mobile-back-button"
                onClick={() => setMobileView("home")}
              >
                ← 返回
              </button>
              <h2>{mobileViewTitles[mobileView]}</h2>
            </header>
            <div className="mobile-page-body">
              {mobilePageContent[mobileView]}
            </div>
          </section>
        )}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="游戏顶部栏">
        <div>
          <p className="eyebrow">凡人修仙</p>
          <h1>仙途</h1>
        </div>
        <div className={`notice notice-${notice.tone}`}>{notice.text}</div>
      </section>

      <section className="dashboard" aria-label="游戏主界面">
        {profilePanel}
        {mainPanel}
        {sidePanel}
        {inventoryPanel}
        {equipmentPanel}
        {manualPanel}
        {battlePanel}
        {explorationPanel}
        {alchemyPanel}
        {craftPanel}
        {sectPanel}
        {savePanel}
      </section>

      {cultivationAction && (
        <CultivationOverlay
          state={cultivationAction}
          onClose={closeCultivationAction}
        />
      )}
    </main>
  );
}
