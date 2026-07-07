import { useMemo, useState } from "react";
import { createInitialPlayer } from "./data/initialPlayer";
import type { Player } from "./types/game";
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

const statLabels: Record<keyof Player["attributes"], string> = {
  rootBone: "根骨",
  comprehension: "悟性",
  luck: "气运",
  mind: "心境",
  divineSense: "神识",
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

  const cultivationPercent = Math.min(
    100,
    Math.round(
      (player.cultivation.current / player.cultivation.required) * 100,
    ),
  );

  const handleCultivate = () => {
    setPlayer((current) => {
      const gain = 12 + current.attributes.rootBone * 2;
      const nextCultivation = Math.min(
        current.cultivation.required,
        current.cultivation.current + gain,
      );

      return {
        ...current,
        cultivation: {
          ...current.cultivation,
          current: nextCultivation,
        },
        updatedAt: new Date().toISOString(),
      };
    });
    setNotice({ tone: "success", text: "灵气入体，修为有所精进" });
  };

  const handleSave = () => {
    saveGame(player);
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
              <p className="eyebrow">散修</p>
              <h2>{player.name}</h2>
            </div>
            <span>{player.realm.name}</span>
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
              <h2>{player.cultivation.realmTitle}</h2>
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

          <div className="action-row">
            <button type="button" onClick={handleCultivate}>
              修炼一次
            </button>
            <button type="button" className="secondary" disabled>
              突破
            </button>
            <button type="button" className="secondary" disabled>
              外出历练
            </button>
          </div>
        </section>

        <section className="side-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">根基</p>
              <h2>资质</h2>
            </div>
          </div>
          <dl className="stat-list">
            {Object.entries(player.attributes).map(([key, value]) => (
              <div key={key}>
                <dt>{statLabels[key as keyof Player["attributes"]]}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
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
