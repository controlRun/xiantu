import { useMemo, useState } from "react";
import {
  getArrowDefinition,
  getTargetZone,
  targetZones,
} from "./data/arrows";
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
  canBattle,
  getAvailableArrowsForBattle,
  restPlayer,
  shootArrow,
  startArcheryBattle,
  startSparringBattle,
} from "./systems/battleSystem";
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
import { BattleScene } from "./components/battle/BattleScene";
import { BattleScreen } from "./components/battle/BattleScreen";

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

export function App() {
  const restoredSave = useMemo(() => loadGame(), []);
  const [player, setPlayer] = useState<Player>(
    () => restoredSave?.player ?? createInitialPlayer(),
  );
  const [notice, setNotice] = useState<Notice>(() =>
    restoredSave
      ? { tone: "success", text: `已读取 ${SAVE_SLOT_LABEL}` }
      : { tone: "neutral", text: "新角色已生成" },
  );
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [archeryDuel, setArcheryDuel] = useState<ArcheryDuelState | null>(null);
  const [selectedArrowId, setSelectedArrowId] = useState("wooden-arrow");
  const [selectedTargetId, setSelectedTargetId] =
    useState<TargetZoneId>("chest");
  const [alchemyResult, setAlchemyResult] = useState<AlchemyResult | null>(null);
  const [explorationResult, setExplorationResult] =
    useState<ExplorationResult | null>(null);
  const [sectResult, setSectResult] = useState<SectActionResult | null>(null);
  const [isInBattleMode, setIsInBattleMode] = useState(false);

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
  const playerCanBattle = canBattle(player);
  const cultivationPercent = Math.min(
    100,
    Math.round((player.cultivation.current / player.cultivation.required) * 100),
  );
  const selectedArrow =
    getArrowDefinition(selectedArrowId) ?? availableArrows[0];
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

  const handleCultivate = () => {
    const nextPlayer = cultivate(player);
    setPlayer(nextPlayer);
    setNotice({
      tone: "success",
      text: `灵气入体，本次修为 +${nextPlayer.cultivation.lastGain}`,
    });
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
    const result = trainMind(player);
    setPlayer(result.player);
    setNotice({
      tone: result.success ? "success" : "warning",
      text: result.message,
    });
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

    if (availableArrows.length === 0) {
      setNotice({
        tone: "warning",
        text: "箭囊已空，先从秘境或战利品中补充箭矢",
      });
      return;
    }

    const defaultArrow = availableArrows[availableArrows.length - 1];
    const duel = startArcheryBattle(player);
    setSelectedArrowId(defaultArrow.itemId);
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

    if (availableArrows.length === 0) {
      setNotice({
        tone: "warning",
        text: "箭囊已空，先从秘境或战利品中补充箭矢",
      });
      return;
    }

    const defaultArrow = availableArrows[availableArrows.length - 1];
    const duel = startSparringBattle(player);
    setSelectedArrowId(defaultArrow.itemId);
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
    const nextPlayer = restPlayer(player);
    setPlayer(nextPlayer);
    setNotice({ tone: "success", text: "调息完毕，气血与灵力已恢复" });
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
    const nextPlayer = createInitialPlayer();
    setPlayer(nextPlayer);
    setArcheryDuel(null);
    setBattleResult(null);
    setNotice({ tone: "warning", text: "旧存档已清除，新的仙途开始了" });
  };

  // Fullscreen battle mode
  if (isInBattleMode && archeryDuel) {
    return (
      <BattleScreen
        duel={archeryDuel}
        player={player}
        availableArrows={availableArrows}
        onShoot={(arrowId, zoneId) => {
          const result = shootArrow(player, archeryDuel, arrowId, zoneId);
          setPlayer(result.player);
          setArcheryDuel(result.duel);
          if (result.battleResult) {
            setBattleResult(result.battleResult);
          }
        }}
        onBattleEnd={handleBattleEnd}
        battleResult={battleResult}
      />
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
            <button type="button" onClick={handleCultivate}>
              修炼一次
            </button>
            <button type="button" className="secondary" onClick={handleTrainMind}>
              静心参悟
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleBreakthrough}
            >
              突破
            </button>
            <button type="button" className="secondary" onClick={handleExplore}>
              外出历练
            </button>
            <button type="button" className="secondary" onClick={handleSparring}>
              模拟对战
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleSecretExplore}
            >
              探索秘境
            </button>
            <button type="button" className="secondary" onClick={handleRest}>
              调息恢复
            </button>
          </div>
        </section>

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
          ) : availableArrows.length === 0 ? (
            <p className="empty-battle-hint">
              当前持{equippedWeapon.name}，但箭囊已空。请从秘境探索或战斗掉落中补充箭矢。
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
        </section>

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
        </section>

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
      </section>
    </main>
  );
}
