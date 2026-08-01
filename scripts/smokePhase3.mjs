// 三期目标与解锁冒烟测试：境界门 / 目标派生 / 秘境 Boss / 炼器门 / 存档迁移
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
  const { getRealmById } = await server.ssrLoadModule("/src/data/realms.ts");
  const { getLocation } = await server.ssrLoadModule("/src/data/locations.ts");
  const { getCraftRecipe } = await server.ssrLoadModule("/src/data/craftRecipes.ts");
  const { getMonstersForRealmOrder, getSecretRealmBoss } =
    await server.ssrLoadModule("/src/data/monsters.ts");
  const battle = await server.ssrLoadModule("/src/systems/battleSystem.ts");
  const cultivation = await server.ssrLoadModule("/src/systems/cultivationSystem.ts");
  const mapSys = await server.ssrLoadModule("/src/systems/mapSystem.ts");
  const goalSys = await server.ssrLoadModule("/src/systems/goalSystem.ts");
  const craftSys = await server.ssrLoadModule("/src/systems/craftSystem.ts");
  const inv = await server.ssrLoadModule("/src/systems/inventorySystem.ts");
  const timeSys = await server.ssrLoadModule("/src/systems/timeSystem.ts");

  const qty = (player, id) => inv.getInventoryQuantity(player.inventory, id);

  /** 造一个指定境界的玩家 */
  const mkPlayer = (realmId, extra = {}) => {
    const base = createInitialPlayer();
    const realm = getRealmById(realmId);
    return {
      ...base,
      realmId,
      spiritStones: 200,
      health: { current: 500, max: 500 },
      mana: { current: 100, max: 100 },
      cultivation: {
        current: 0,
        required: realm.breakthrough.requiredCultivation,
        lastGain: 0,
      },
      ...extra,
    };
  };

  const goalById = (player, id) =>
    goalSys.evaluateGoals(player).find((entry) => entry.goal.id === id);

  // ---------- 1. 境界门：凡人看迷雾林全锁 ----------
  {
    const mortal = mkPlayer("mortal");
    const forest = getLocation("misty-forest");
    assert(
      mapSys.isLocationRealmLocked(mortal, forest),
      "凡人视角迷雾林被境界门封锁",
    );
    const features = mapSys.getLocationFeatures(mortal, forest);
    assert(features.length > 0, "迷雾林仍有功能条目（锁而不隐）");
    assert(
      features.every((feature) => feature.locked),
      "凡人视角迷雾林全部功能锁定",
    );
    assert(
      features[0].reason?.includes("炼气二层"),
      `封锁原因点明所需境界（实为「${features[0].reason}」）`,
    );
  }

  // ---------- 2. 境界门：炼气二层解锁迷雾林 ----------
  {
    const cultivator = mkPlayer("qi-refining-2");
    const forest = getLocation("misty-forest");
    assert(
      !mapSys.isLocationRealmLocked(cultivator, forest),
      "炼气二层不再被迷雾林封锁",
    );
    const features = mapSys.getLocationFeatures(cultivator, forest);
    assert(
      features.some((feature) => feature.feature === "wild" && !feature.locked),
      "炼气二层迷雾林历练功能可用",
    );
  }

  // ---------- 3. 境界门：秘境 Boss 功能 ----------
  {
    const master = mkPlayer("qi-refining-9");
    const secret = getLocation("yaoxin-secret-realm");
    assert(secret?.type === "secret-realm", "妖芯秘境登记为 secret-realm 类型");
    const features = mapSys.getLocationFeatures(master, secret);
    assert(
      features.some((feature) => feature.feature === "boss" && !feature.locked),
      "炼气九层可见并可用秘境挑战入口",
    );
    const lowly = mkPlayer("qi-refining-8");
    const lockedFeatures = mapSys.getLocationFeatures(lowly, secret);
    assert(
      lockedFeatures.every((feature) => feature.locked),
      "炼气八层秘境功能全锁（门槛 order 9）",
    );
  }

  // ---------- 4. 目标派生：今日打坐 ----------
  {
    const player = mkPlayer("qi-refining-1");
    const before = goalById(player, "goal-cultivate-today");
    assert(before && !before.done, "打坐前「今日打坐」未完成");
    const after = cultivation.cultivate(player);
    assert(
      after.stats.lastCultivateDay === timeSys.getGameDay(after),
      "打坐写入 lastCultivateDay（取推进后游戏日）",
    );
    const afterGoal = goalById(after, "goal-cultivate-today");
    assert(afterGoal?.done, "打坐后「今日打坐」即时完成");
  }

  // ---------- 5. 目标派生：收集 / 宗门 / 洞府 / Boss / 境界 ----------
  {
    let player = mkPlayer("mortal");
    player = {
      ...player,
      inventory: inv.addItemStacks(player.inventory, [
        { itemId: "spirit-grass", quantity: 10 },
      ]),
    };
    assert(goalById(player, "goal-collect-spirit-grass")?.done, "灵息草 ×10 达成");

    player = { ...player, sectId: "jinjian-sect" };
    assert(goalById(player, "goal-join-sect")?.done, "拜入宗门目标达成");

    player = { ...player, caveDwellingId: "ziwu-mountain" };
    assert(goalById(player, "goal-build-cave")?.done, "建立洞府目标达成");

    player = {
      ...player,
      stats: { ...player.stats, bossesKilled: 1 },
    };
    assert(goalById(player, "goal-boss-kill")?.done, "秘境斩傀目标达成");

    const foundation = mkPlayer("foundation-early");
    assert(goalById(foundation, "goal-reach-foundation")?.done, "筑基（order 10）目标达成");
  }

  // ---------- 6. 地图目标摘要 ----------
  {
    const player = mkPlayer("mortal");
    const summary = goalSys.getNextGoalSummary(player);
    assert(
      typeof summary === "string" && summary.includes("/"),
      `新档有短期目标摘要（实为「${summary}」）`,
    );
  }

  // ---------- 7. Boss 每日限一次 ----------
  {
    const player = mkPlayer("qi-refining-9");
    const open = battle.getBossChallengeCheck(player);
    assert(open.canChallenge, "未挑战时 Boss 可挑战");
    assert(open.boss.id === "secret-realm-golem", "守关者固定为秘境石傀");

    const attempted = battle.markBossAttempt(player);
    const closed = battle.getBossChallengeCheck(attempted);
    assert(!closed.canChallenge, "挑战后当日不可再战");
    assert(
      closed.reason?.includes("今日"),
      `每日限制文案提示明日再来（实为「${closed.reason}」）`,
    );

    const nextDay = timeSys.advanceTime(attempted, 1);
    assert(
      battle.getBossChallengeCheck(nextDay).canChallenge,
      "跨游戏日后挑战次数刷新",
    );
  }

  // ---------- 8. Boss 战形态与随机池排除 ----------
  {
    const player = mkPlayer("qi-refining-9");
    const duel = battle.startBossBattle(player);
    assert(duel.monster.id === "secret-realm-golem", "Boss 战固定迎战石傀");
    assert(duel.maxRounds === 14, "Boss 战回合上限放宽至 14");
    assert(!duel.endless, "Boss 战非无尽模式");

    const boss = getSecretRealmBoss();
    assert(boss.isBoss === true, "石傀标记 isBoss");
    const pool = getMonstersForRealmOrder(9);
    assert(
      pool.every((monster) => !monster.isBoss),
      "境界怪物池排除 Boss",
    );
  }

  // ---------- 9. 击杀统计与 Boss 掉落 ----------
  {
    let player = mkPlayer("qi-refining-9");
    player = {
      ...player,
      inventory: inv.addItemStacks(player.inventory, [
        { itemId: "iron-arrow", quantity: 60 },
      ]),
    };
    let duel = battle.startBossBattle(player);
    duel = { ...duel, monsterHealth: 1 }; // 一击必杀，避开随机命中

    // shootArrow 只挂起伤害（UI 管线），applyPlayerShot 才真正结算
    let result = null;
    for (let index = 0; index < 30 && !duel.finished; index += 1) {
      const shot = battle.shootArrow(player, duel, "iron-arrow", "chest");
      player = shot.player;
      duel = shot.duel;
      if (shot.battleResult) {
        result = shot.battleResult;
      } else if (shot.pendingDamage) {
        const applied = battle.applyPlayerShot(
          player,
          duel,
          "iron-arrow",
          shot.pendingDamage,
        );
        player = applied.player;
        duel = applied.duel;
        if (applied.battleResult) result = applied.battleResult;
      }
    }

    assert(result?.victory === true, "Boss 战取得胜利");
    assert(
      result?.player.stats.monstersKilled === 1,
      "胜利累计 monstersKilled",
    );
    assert(
      result?.player.stats.bossesKilled === 1,
      "Boss 胜利累计 bossesKilled",
    );
    assert(
      result ? qty(result.player, "foundation-pill") >= 1 : false,
      "首杀必掉筑基丹",
    );
  }

  // ---------- 10. 炼器境界门 ----------
  {
    const recipe = getCraftRecipe("craft-serpent-scale-arrow");
    assert(recipe?.minRealmOrder === 4, "玄鳞箭配方标注炼气四层解锁");

    const lowCheck = craftSys.getCraftCheck(mkPlayer("qi-refining-3"), recipe);
    assert(
      !lowCheck.canCraft &&
        lowCheck.missingReasons.some((reason) => reason.includes("境界不足")),
      "炼气三层被玄鳞箭境界门拦下",
    );

    const highCheck = craftSys.getCraftCheck(mkPlayer("qi-refining-4"), recipe);
    assert(
      !highCheck.missingReasons.some((reason) => reason.includes("境界不足")),
      "炼气四层不再受境界门限制（余下仅材料门槛）",
    );

    const pierce = getCraftRecipe("craft-spirit-piercing-arrow");
    assert(pierce?.minRealmOrder === 7, "破灵箭配方标注炼气七层解锁");
  }

  // ---------- 11. v4 旧档迁移：stats 补默认 ----------
  {
    const v4Save = {
      schemaVersion: 4,
      savedAt: new Date().toISOString(),
      player: {
        id: "legacy-player",
        name: "旧档道人",
        gender: "male",
        realmId: "qi-refining-5",
        spiritualRoot: {
          elements: ["wood", "fire"],
          name: "木火灵根",
          grade: "earth",
          purity: 55,
          cultivationMultiplier: 1.1,
          breakthroughBonus: 0.05,
        },
        cultivation: { current: 100, required: 400, lastGain: 10 },
        age: 18,
        lifespan: 100,
        health: { current: 120, max: 120 },
        mana: { current: 60, max: 60 },
        spiritStones: 66,
        attributes: {
          rootBone: 20,
          comprehension: 18,
          luck: 12,
          mind: 15,
          divineSense: 14,
        },
        inventory: [{ itemId: "wooden-arrow", quantity: 12 }],
        equipment: { weapon: "ironwood-sword", armor: null, accessory: null },
        learnedManualIds: [],
        sectId: null,
        sectContribution: 0,
        locationId: "qingshi-town",
        caveDwellingId: null,
        injury: 8,
        pillUseCounts: {},
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    };
    const store = { "xiantu.save.v1": JSON.stringify(v4Save) };
    globalThis.localStorage = {
      getItem: (key) => store[key] ?? null,
      setItem: (key, value) => {
        store[key] = value;
      },
      removeItem: (key) => {
        delete store[key];
      },
    };

    const saveLoad = await server.ssrLoadModule("/src/utils/saveLoad.ts");
    const loaded = saveLoad.loadGame();
    assert(loaded !== null, "v4 存档可读入");
    assert(
      loaded.player.stats.monstersKilled === 0 &&
        loaded.player.stats.bossesKilled === 0 &&
        loaded.player.stats.lastCultivateDay === 0 &&
        loaded.player.stats.lastBossDay === 0,
      "v4 → stats 默认全 0",
    );
    assert(
      loaded.player.name === "旧档道人" &&
        loaded.player.realmId === "qi-refining-5" &&
        loaded.player.injury === 8,
      "v4 原有字段（含二期伤势）保留",
    );
    assert(loaded.schemaVersion === 7, "读入后 schemaVersion 升至 7（宗门职位）");
  }
} finally {
  await server.close();
}
