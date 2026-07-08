import { useMemo, useState } from "react";
import { getItemDefinition } from "./data/items";
import { createInitialPlayer } from "./data/initialPlayer";
import { getNextRealm, getRealmById } from "./data/realms";
import { alchemyRecipes } from "./data/recipes";
import {
  craftAlchemyRecipe,
  formatCostList,
  getAlchemyCheck,
} from "./systems/alchemySystem";
import { restPlayer, startBattle } from "./systems/battleSystem";
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
import type { AlchemyResult, BattleResult, Player } from "./types/game";
import {
  clearSave,
  loadGame,
  saveGame,
  SAVE_SLOT_LABEL,
} from "./utils/saveLoad";

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
  const [alchemyResult, setAlchemyResult] = useState<AlchemyResult | null>(null);

  const realm = getRealmById(player.realmId);
  const nextRealm = getNextRealm(player.realmId);
  const breakthroughCheck = getBreakthroughCheck(player);
  const cultivationGain = getCultivationGain(player);
  const mindTrainingCost = getMindTrainingCost(player);
  const breakthroughCosts = describeBreakthroughCosts(player);
  const cultivationPercent = Math.min(
    100,
    Math.round((player.cultivation.current / player.cultivation.required) * 100),
  );

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

  const handleExplore = () => {
    if (player.health.current <= 1) {
      setNotice({ tone: "warning", text: "气血太低，先调息恢复" });
      return;
    }

    const result = startBattle(player);
    setPlayer(result.player);
    setBattleResult(result);
    setNotice({
      tone: result.victory ? "success" : "warning",
      text: result.message,
    });
  };

  const handleRest = () => {
    const nextPlayer = restPlayer(player);
    setPlayer(nextPlayer);
    setNotice({ tone: "success", text: "调息完毕，气血与灵力已恢复" });
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
    setNotice({
      tone: "success",
      text: `已读取 ${formatDateTime(save.savedAt)} 的存档`,
    });
  };

  const handleReset = () => {
    clearSave();
    const nextPlayer = createInitialPlayer();
    setPlayer(nextPlayer);
    setNotice({ tone: "warning", text: "旧存档已清除，新的仙途开始了" });
  };

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
                {player.age} / {player.lifespan}
              </dd>
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

          {breakthroughCheck.missingReasons.length > 0 && (
            <ul className="requirement-list" aria-label="突破缺失条件">
              {breakthroughCheck.missingReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}

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
              disabled={!breakthroughCheck.canBreakthrough}
              onClick={handleBreakthrough}
            >
              突破
            </button>
            <button type="button" className="secondary" onClick={handleExplore}>
              外出历练
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
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="battle-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">山野</p>
              <h2>历练战报</h2>
            </div>
            {battleResult && (
              <span>{battleResult.victory ? "胜" : "退"}</span>
            )}
          </div>

          {battleResult ? (
            <>
              <dl className="condition-grid battle-summary">
                <div>
                  <dt>敌人</dt>
                  <dd>{battleResult.monster.name}</dd>
                </div>
                <div>
                  <dt>地点</dt>
                  <dd>{battleResult.monster.area}</dd>
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
              <ol className="battle-log">
                {battleResult.logs.map((log, index) => (
                  <li key={`${log}-${index}`}>{log}</li>
                ))}
              </ol>
            </>
          ) : (
            <p className="empty-text">尚未外出历练</p>
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
