// 暴击率一致性冒烟：展示（BattleHUD）与结算（getPlayerShotDamage）共用 getShotCriticalChance
//
// 回归背景：BattleScreen 曾手写暴击率，漏掉装备会心（critBonus）与灵根战斗暴击
//（battleCritBonus），导致显示暴击 < 实际暴击。本测试锁死：唯一权威公式纳入四项
//（部位基础 + 气运 + 装备会心 + 灵根战斗暴击）、夹取 [0.03, 0.45]、且结算暴击与该公式一致。
import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

const assert = (cond, label) => {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${label}`);
  }
};

const approx = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

try {
  const { createInitialPlayer } = await server.ssrLoadModule("/src/data/initialPlayer.ts");
  const battle = await server.ssrLoadModule("/src/systems/battleSystem.ts");
  const { getMonsterById } = await server.ssrLoadModule("/src/data/monsters.ts");

  // 构造属性/灵根/装备全可控的玩家
  const mkPlayer = ({ luck = 0, rootCrit = 0, accessory = null } = {}) => {
    const base = createInitialPlayer();
    return {
      ...base,
      attributes: { ...base.attributes, luck },
      spiritualRoot: { ...base.spirituralRoot, battleCritBonus: rootCrit },
      equipment: { ...base.equipment, accessory },
    };
  };

  // ---------- 1. 裸玩家：部位基础 + 气运 ----------
  {
    const player = mkPlayer({ luck: 10 }); // chest 基础 0.1
    const result = battle.getShotCriticalChance(player, "chest");
    assert(
      approx(result, 0.1 + 10 * 0.004),
      `裸玩家 chest = 0.14（得 ${result.toFixed(4)}）`,
    );
  }

  // ---------- 2. 装备 + 灵根纳入（锁修复：旧显示公式漏掉这两项） ----------
  {
    const player = mkPlayer({ luck: 10, rootCrit: 0.05, accessory: "spirit-jade-pendant" });
    const result = battle.getShotCriticalChance(player, "head"); // head 基础 0.25
    // 0.25 + 0.04(气运) + 0.03(凝神玉佩) + 0.05(灵根) = 0.37
    assert(approx(result, 0.37), `装备+灵根 head = 0.37（得 ${result.toFixed(4)}）`);
    // 旧手写公式只有 0.25 + 0.04 = 0.29 —— 必须显著高于它
    assert(result > 0.29 + 0.05, "明显高于旧显示公式 0.29（修复生效）");
  }

  // ---------- 3. 夹取上下界 ----------
  {
    const highLuck = mkPlayer({ luck: 200 });
    assert(
      battle.getShotCriticalChance(highLuck, "head") === 0.45,
      "气运溢出 → 夹至上限 0.45",
    );
    const bare = mkPlayer({ luck: 0 });
    const zones = ["head", "chest", "arm", "leg"];
    assert(
      zones.every((z) => {
        const v = battle.getShotCriticalChance(bare, z);
        return v >= 0.03 && v <= 0.45;
      }),
      "各部位暴击率均落在 [0.03, 0.45]",
    );
  }

  // ---------- 4. 结算暴击与权威公式一致（Math.random 受控） ----------
  {
    const monster = getMonsterById("mist-fox");
    assert(Boolean(monster), "取到测试怪物 mist-fox");
    const realRandom = Math.random;
    try {
      const player = mkPlayer({ luck: 0 }); // chest 暴击率 0.1
      Math.random = () => 0.0001; // 必中暴击（0.0001 ≤ 任意 ≥0.03 的概率）
      const critHit = battle.getPlayerShotDamage(player, monster, "wooden-arrow", "chest", 1);
      assert(critHit.critical === true, "Math.random 极低 → 结算判定暴击");

      Math.random = () => 0.999; // 必不暴击（0.999 > 0.1）
      const critMiss = battle.getPlayerShotDamage(player, monster, "wooden-arrow", "chest", 1);
      assert(critMiss.critical === false, "Math.random 极高 → 结算判定非暴击");
    } finally {
      Math.random = realRandom;
    }
  }
} finally {
  await server.close();
}

console.log(
  process.exitCode ? "\n!!! 暴击率冒烟：存在失败项" : "\n暴击率冒烟：全部通过",
);
