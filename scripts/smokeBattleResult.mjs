// 战斗结算字段冒烟：箭耗 arrowsUsed / 总伤 totalDamage / 寿元 daysSpent
//
// 回归背景：结算面板需要「消耗（箭矢/寿元）、战绩（总伤害）」，
// 这些数据原先只在 battleSystem 内部流转、从不上报 BattleResult。
// 本测试锁死：shootArrow 按箭种累计箭耗、applyPlayerShot 累计总伤、
// finishDuel 在胜/撤两条路径都回填三个字段，演武（endless）不耗箭。
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

try {
  const { createInitialPlayer } = await server.ssrLoadModule("/src/data/initialPlayer.ts");
  const battle = await server.ssrLoadModule("/src/systems/battleSystem.ts");
  const inv = await server.ssrLoadModule("/src/systems/inventorySystem.ts");

  const qty = (p, id) => inv.getInventoryQuantity(p.inventory, id);

  const mkPlayer = () => {
    const base = createInitialPlayer();
    return {
      ...base,
      health: { current: 500, max: 500 },
      mana: { current: 100, max: 100 },
      inventory: inv.addItemStacks(base.inventory, [
        { itemId: "wooden-arrow", quantity: 20 },
      ]),
    };
  };

  // ---------- 1. shootArrow 按箭种累计箭耗 + 扣箭囊 ----------
  {
    const player = mkPlayer();
    let duel = battle.startArcheryBattle(player);
    const before = qty(player, "wooden-arrow");

    const shot1 = battle.shootArrow(player, duel, "wooden-arrow", "chest", 1);
    assert(
      shot1.duel.arrowsUsed?.length === 1 &&
        shot1.duel.arrowsUsed[0].itemId === "wooden-arrow" &&
        shot1.duel.arrowsUsed[0].quantity === 1,
      "第 1 箭：arrowsUsed 记木箭 x1",
    );
    assert(
      qty(shot1.player, "wooden-arrow") === before - 1,
      "第 1 箭：箭囊 -1",
    );

    const shot2 = battle.shootArrow(shot1.player, shot1.duel, "wooden-arrow", "chest", 1);
    assert(
      shot2.duel.arrowsUsed[0].quantity === 2,
      "第 2 箭：同箭种合并为 x2",
    );
  }

  // ---------- 2. applyPlayerShot 累计总伤 + 胜局回填三字段 ----------
  {
    const player = mkPlayer();
    let duel = battle.startArcheryBattle(player);
    duel = { ...duel, monsterHealth: 1 }; // 一击必杀，直达 finishDuel 胜局

    const shot = battle.shootArrow(player, duel, "wooden-arrow", "chest", 1);
    const applied = battle.applyPlayerShot(
      shot.player,
      shot.duel,
      "wooden-arrow",
      shot.pendingDamage,
    );

    assert(applied.battleResult?.victory === true, "一击制胜");
    assert(
      applied.battleResult?.totalDamage === shot.pendingDamage.damage,
      `总伤 = 本箭伤害（${applied.battleResult?.totalDamage}）`,
    );
    assert(
      applied.battleResult?.arrowsUsed?.[0]?.quantity === 1,
      "胜局结算带出 arrowsUsed",
    );
    assert(
      applied.battleResult?.daysSpent === 3,
      "胜局寿元 = 3 日",
    );
  }

  // ---------- 3. 主动撤退：victory=false + retreated + daysSpent ----------
  {
    const player = mkPlayer();
    const duel = battle.startArcheryBattle(player);
    const retreated = battle.retreatFromBattle(player, duel);

    assert(
      retreated.battleResult?.victory === false &&
        retreated.battleResult?.retreated === true,
      "撤退：败而不溃（retreated）",
    );
    assert(
      typeof retreated.battleResult?.daysSpent === "number" &&
        retreated.battleResult.daysSpent >= 3,
      `撤退寿元 ≥ 3 日（${retreated.battleResult?.daysSpent}）`,
    );
  }

  // ---------- 4. 演武（endless）：不耗箭、总伤照计 ----------
  {
    const player = mkPlayer();
    let duel = battle.startSparringBattle(player);
    const before = qty(player, "wooden-arrow");

    const shot = battle.shootArrow(player, duel, "wooden-arrow", "chest", 1);
    assert(
      shot.duel.arrowsUsed === undefined,
      "演武：不记箭耗（arrowsUsed 缺省）",
    );
    assert(
      qty(shot.player, "wooden-arrow") === before,
      "演武：箭囊不减",
    );

    const applied = battle.applyPlayerShot(
      shot.player,
      shot.duel,
      "wooden-arrow",
      shot.pendingDamage,
    );
    assert(
      (applied.duel.totalDamage ?? 0) === shot.pendingDamage.damage,
      "演武：总伤照常累计",
    );
  }
} finally {
  await server.close();
}

console.log(
  process.exitCode ? "\n!!! 结算字段冒烟：存在失败项" : "\n结算字段冒烟：全部通过",
);
