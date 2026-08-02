import { getRealmById } from "../data/realms";
import { getSectById } from "../data/sects";
import { getSectRankDefinition } from "../systems/sectSystem";
import { formatAge, getGameDay } from "../systems/timeSystem";
import type { Player, PlayerGender } from "../types/game";

interface DeathEndingScreenProps {
  player: Player;
  onReincarnate: () => void;
}

const genderLabel = (gender: PlayerGender) => (gender === "female" ? "女" : "男");

/**
 * 寿元耗尽 · 坐化结局：此生走到尽头，展示生平摘要，
 * 「转世重修」重开新角色、清档再叩仙途（硬结局，无继承）。
 */
export const DeathEndingScreen = ({ player, onReincarnate }: DeathEndingScreenProps) => {
  const sect = getSectById(player.sectId);
  const sectLine = sect
    ? `${sect.name} · ${getSectRankDefinition(player.sectRank).name}`
    : "散修";

  return (
    <main className="start-screen death-ending">
      <section className="start-card death-card">
        <div className="start-brand">
          <p className="eyebrow">寿元耗尽</p>
          <h1>坐化</h1>
          <p className="start-tagline">大限已至，此身归于尘土</p>
        </div>

        <div className="start-body">
          <dl className="start-save-grid death-summary">
            <div>
              <dt>道号</dt>
              <dd>
                {player.name}（{genderLabel(player.gender)}）
              </dd>
            </div>
            <div>
              <dt>境界</dt>
              <dd>{getRealmById(player.realmId).name}</dd>
            </div>
            <div>
              <dt>享年</dt>
              <dd>
                {formatAge(player.age)} / {player.lifespan} 岁
              </dd>
            </div>
            <div>
              <dt>修行</dt>
              <dd>{getGameDay(player)} 日</dd>
            </div>
            <div>
              <dt>宗门</dt>
              <dd>{sectLine}</dd>
            </div>
            <div>
              <dt>斩兽</dt>
              <dd>
                {player.stats.monstersKilled}（Boss {player.stats.bossesKilled}）
              </dd>
            </div>
            <div>
              <dt>遗财</dt>
              <dd>{player.spiritStones} 灵石</dd>
            </div>
          </dl>

          <div className="start-actions">
            <button type="button" onClick={onReincarnate}>
              转世重修
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};
