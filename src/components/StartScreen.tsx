import { useState } from "react";
import { getRealmById } from "../data/realms";
import type { PlayerGender, SaveData } from "../types/game";

interface StartScreenProps {
  save: SaveData | null;
  onLoad: () => void;
  onCreate: (name: string, gender: PlayerGender) => void;
}

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const genderLabel = (gender: PlayerGender) => (gender === "female" ? "女" : "男");

/**
 * 开局界面：
 * - 有存档 → 展示存档信息，可「读取存档」或「创建新存档」（覆盖旧档）；
 * - 无存档 → 直接进入创建流程，须填写道号、选择性别后方可踏入仙途。
 */
export const StartScreen = ({ save, onLoad, onCreate }: StartScreenProps) => {
  const [mode, setMode] = useState<"menu" | "create">(save ? "menu" : "create");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<PlayerGender>("male");

  const trimmedName = name.trim();
  const canCreate = trimmedName.length > 0;

  const handleCreate = () => {
    if (!canCreate) return;
    onCreate(trimmedName, gender);
  };

  return (
    <main className="start-screen">
      <section className="start-card">
        <div className="start-brand">
          <p className="eyebrow">凡人修仙</p>
          <h1>仙途</h1>
          <p className="start-tagline">一介凡人，叩问长生</p>
        </div>

        {mode === "menu" && save ? (
          <div className="start-body">
            <div className="start-save-info">
              <p className="start-save-title">发现本地存档</p>
              <dl className="start-save-grid">
                <div>
                  <dt>道号</dt>
                  <dd>
                    {save.player.name}（{genderLabel(save.player.gender)}）
                  </dd>
                </div>
                <div>
                  <dt>境界</dt>
                  <dd>{getRealmById(save.player.realmId).name}</dd>
                </div>
                <div>
                  <dt>寿元</dt>
                  <dd>
                    {save.player.age} / {save.player.lifespan}
                  </dd>
                </div>
                <div>
                  <dt>存档时间</dt>
                  <dd>{formatDateTime(save.savedAt)}</dd>
                </div>
              </dl>
            </div>

            <div className="start-actions">
              <button type="button" onClick={onLoad}>
                读取存档
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setMode("create")}
              >
                创建新存档
              </button>
            </div>
          </div>
        ) : (
          <div className="start-body">
            {save && (
              <p className="start-warning">创建新角色将覆盖当前存档，无法恢复。</p>
            )}
            {!save && (
              <p className="start-hint">尚无存档，请先创建角色，开启你的仙途。</p>
            )}

            <div className="start-form">
              <label className="start-field">
                <span>道号</span>
                <input
                  className="start-input"
                  type="text"
                  value={name}
                  maxLength={12}
                  placeholder="请输入角色名称"
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleCreate();
                  }}
                />
              </label>

              <div className="start-field">
                <span>性别</span>
                <div className="gender-group">
                  <button
                    type="button"
                    className={`gender-button ${gender === "male" ? "active" : ""}`}
                    onClick={() => setGender("male")}
                  >
                    男
                  </button>
                  <button
                    type="button"
                    className={`gender-button ${gender === "female" ? "active" : ""}`}
                    onClick={() => setGender("female")}
                  >
                    女
                  </button>
                </div>
              </div>

              <div className="start-actions">
                <button type="button" disabled={!canCreate} onClick={handleCreate}>
                  创建存档，踏入仙途
                </button>
                {save && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setMode("menu")}
                  >
                    返回
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
};
