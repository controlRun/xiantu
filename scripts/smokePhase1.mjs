// 一期战斗深度冒烟测试：通过 vite ssrLoadModule 直跑系统层逻辑
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

  const qty = (player, id) => inv.getInventoryQuantity(player.inventory, id);

  // ---------- 1. 演武无消耗 ----------
  {
    const player = createInitialPlayer();
    const loadout = { arrowIds: ["wooden-arrow", "iron-arrow"], pillIds: [], retreatRule: "never" };
    let duel = battle.startSparringBattle(player, loadout);
    let current = player;
    const arrowsBefore = qty(player, "wooden-arrow");
    const manaBefore = player.mana.current;
    for (let i = 0; i < 10; i++) {
      const shot = battle.shootArrow(current, duel, "wooden-arrow", "chest", 1);
      current = shot.player;
      duel = shot.duel;
      if (shot.pendingDamage) {
        const applied = battle.applyPlayerShot(current, duel, "wooden-arrow", shot.pendingDamage);
        current = applied.player;
        duel = applied.duel;
      }
    }
    assert(qty(current, "wooden-arrow") === arrowsBefore, "演武 10 箭后箭囊不变");
    assert(current.mana.current === manaBefore, "演武后灵力不变");
    assert(duel.endless === true && duel.finished === false, "演武仍为无尽且未结束");
    assert(duel.loadout?.arrowIds.length === 2, "loadout 挂在 duel 上");
  }

  // ---------- 2. 腿部 debuff 叠加封顶 + 衰减 ----------
  {
    const player = createInitialPlayer();
    const loadout = { arrowIds: ["wooden-arrow"], pillIds: [], retreatRule: "never" };
    let duel = battle.startArcheryBattle(player, undefined, loadout);
    let current = player;
    for (let i = 0; i < 4; i++) {
      const pending = { damage: 5, critical: false, targetName: "腿部", targetId: "leg" };
      const res = battle.applyPlayerShot(current, duel, "wooden-arrow", pending);
      current = res.player;
      duel = res.duel;
      if (res.battleResult) break;
    }
    // 第 1 次叠加到 1，第 2 次到 2，第 3 次到 3（封顶），第 4 次仍 3
    const legStacks = duel.enemyDebuffs?.leg ?? 0;
    assert(legStacks <= 3 && legStacks >= 1, `腿伤层数封顶生效（当前 ${legStacks}）`);
  }

  // ---------- 3. 撤退策略自动判定 ----------
  {
    const player = createInitialPlayer();
    const loadout = { arrowIds: ["wooden-arrow"], pillIds: [], retreatRule: "hp30" };
    let duel = battle.startArcheryBattle(player, undefined, loadout);
    duel = { ...duel, playerHealth: 80 };
    assert(battle.shouldAutoRetreat(player, duel) === null, "hp30 策略：80% 血不撤");
    duel = { ...duel, playerHealth: 25 };
    assert(typeof battle.shouldAutoRetreat(player, duel) === "string", "hp30 策略：25% 血触发撤退");
    duel = { ...duel, playerHealth: 80, loadout: { ...loadout, retreatRule: "round6" }, round: 6 };
    assert(typeof battle.shouldAutoRetreat(player, duel) === "string", "round6 策略：第 6 回合触发");
    duel = { ...duel, endless: true };
    assert(battle.shouldAutoRetreat(player, duel) === null, "演武不触发自动撤退");
  }

  // ---------- 4. 战中服丹 ----------
  {
    const player = {
      ...createInitialPlayer(),
      inventory: [
        { itemId: "wooden-arrow", quantity: 10 },
        { itemId: "healing-pill", quantity: 2 },
      ],
    };
    const loadout = { arrowIds: ["wooden-arrow"], pillIds: ["healing-pill"], retreatRule: "never" };
    let duel = battle.startArcheryBattle(player, undefined, loadout);
    duel = { ...duel, playerHealth: 30 };
    const res = battle.useBattlePill(player, duel, "healing-pill");
    assert(qty(res.player, "healing-pill") === 1, "服丹消耗一枚");
    // 回 45 后被敌方反击再扣一些，但应显著高于 30-反击；只验证确实回过血：日志含"回春丹"
    assert(res.duel.logs.some((l) => l.includes("回春丹")), "战报记录服丹");
    assert(res.duel.round === 2, "服丹计一回合");
    assert(res.player.mana !== undefined, "玩家状态同步返回");
  }

  // ---------- 5. 无头自动战（探索 ambush 路径）吃到行为档 ----------
  {
    // 单场可能一回合秒杀，跨 20 场统计部位分布
    let hasNonChest = false;
    for (let i = 0; i < 20; i++) {
      const result = battle.startBattle(createInitialPlayer(), "青石山脚");
      assert(i > 0 || typeof result.victory === "boolean", "无头战返回结算");
      if (result.logs.some((l) => l.includes("手臂") || l.includes("腿部") || l.includes("头部"))) {
        hasNonChest = true;
      }
    }
    assert(hasNonChest, "无头战出现非胸腹部位（20 场抽样）");
  }

  // ---------- 6. 行为档数据 ----------
  {
    const { getMonstersForRealmOrder } = await server.ssrLoadModule("/src/data/monsters.ts");
    const { getMonsterBehavior } = await server.ssrLoadModule("/src/data/monsterBehaviors.ts");
    const wolves = getMonstersForRealmOrder(0);
    assert(wolves.every((m) => getMonsterBehavior(m).id === "beast"), "山脚狼群为野兽档");
    const evilPool = getMonstersForRealmOrder(8);
    assert(evilPool.some((m) => getMonsterBehavior(m).id === "evil"), "高境界池含邪修档");
    const guardPool = getMonstersForRealmOrder(4);
    assert(guardPool.some((m) => getMonsterBehavior(m).id === "guard"), "中境界池含守卫档");
  }

  // ---------- 7. 撤退置位 retreated ----------
  {
    const player = createInitialPlayer();
    const duel = battle.startArcheryBattle(player, undefined, { arrowIds: ["wooden-arrow"], pillIds: [], retreatRule: "never" });
    const res = battle.retreatFromBattle(player, duel);
    assert(res.battleResult?.retreated === true, "主动撤退结算含 retreated");
  }

  // ---------- 8. debuff 持续 3 回合后衰减 ----------
  {
    const player = createInitialPlayer();
    let duel = battle.startArcheryBattle(player, undefined, { arrowIds: ["wooden-arrow"], pillIds: [], retreatRule: "never" });
    let current = player;
    // 第 1 回合命中手臂 → expireRound = 3
    const hit = battle.applyPlayerShot(current, duel, "wooden-arrow", { damage: 3, critical: false, targetName: "手臂", targetId: "arm" });
    current = hit.player;
    duel = hit.duel;
    assert((duel.enemyDebuffs?.arm ?? 0) === 1, "手臂 debuff 挂上 1 层");
    // 用 skipPlayerShot 空过第 2、3 回合（debuff 仍在），第 4 回合应已衰减
    for (let i = 0; i < 2; i++) {
      const skip = battle.skipPlayerShot(current, duel, "测试空过");
      current = skip.player;
      duel = skip.duel;
      if (skip.battleResult) break;
    }
    const armAfter = duel.enemyDebuffs?.arm ?? 0;
    // 第 3 回合末 decay(round=4) 触发清理
    assert(armAfter === 0, `手臂 debuff 在持续 3 回合后衰减（剩 ${armAfter}）`);
  }
} finally {
  await server.close();
}
