// 二期成长闭环冒烟测试：伤势/分级惩罚/多维加成/新丹药/存档迁移
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
  const { getItemDefinition } = await server.ssrLoadModule("/src/data/items.ts");
  const battle = await server.ssrLoadModule("/src/systems/battleSystem.ts");
  const injurySys = await server.ssrLoadModule("/src/systems/injurySystem.ts");
  const pillSys = await server.ssrLoadModule("/src/systems/pillSystem.ts");
  const cultivation = await server.ssrLoadModule("/src/systems/cultivationSystem.ts");
  const equipment = await server.ssrLoadModule("/src/systems/equipmentSystem.ts");
  const inv = await server.ssrLoadModule("/src/systems/inventorySystem.ts");

  const qty = (player, id) => inv.getInventoryQuantity(player.inventory, id);

  /** 造一个指定境界、满状态的玩家 */
  const mkPlayer = (realmId, extra = {}) => {
    const base = createInitialPlayer();
    const realm = getRealmById(realmId);
    return {
      ...base,
      realmId,
      spiritStones: 100,
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

  /** 把对战逼到败北：血量压到 1，skipPlayerShot 触发反击后 finishDuel */
  const forceDefeat = (player, duelFn) => {
    let duel = duelFn(player);
    duel = { ...duel, playerHealth: 1 };
    const weakened = { ...player, health: { ...player.health, current: 1 } };
    const res = battle.skipPlayerShot(weakened, duel, "测试：力竭");
    return res.battleResult;
  };

  // ---------- 1. 分级惩罚：炼气前（order 0）无惩罚 ----------
  {
    const player = mkPlayer("mortal");
    const result = forceDefeat(player, (p) => battle.startArcheryBattle(p));
    const penalty = result?.penalty;
    assert(penalty !== undefined, "凡人败北结算携带 penalty 字段");
    assert(
      penalty.injury === 0 &&
        penalty.lostStones === 0 &&
        penalty.lostItems.length === 0 &&
        penalty.lostDays === 0,
      "order<3 败北无任何损失",
    );
  }

  // ---------- 2. 分级惩罚：炼气三层（order 3）伤势 + 材料 ----------
  {
    const player = mkPlayer("qi-refining-3");
    const result = forceDefeat(player, (p) => battle.startArcheryBattle(p));
    const penalty = result?.penalty;
    assert(
      penalty.injury >= 10 && penalty.injury <= 20,
      `order 3–9 伤势落入 [10,20]（实得 ${penalty.injury}）`,
    );
    assert(penalty.lostItems.length === 1, "order 3–9 损失 1 组物品");
    const lostDef = getItemDefinition(penalty.lostItems[0].itemId);
    assert(
      lostDef && (lostDef.type === "material" || lostDef.type === "arrow"),
      `损失品类仅限材料/箭矢（实为 ${lostDef?.type}）`,
    );
    assert(penalty.lostStones === 0 && penalty.lostDays === 0, "order 3–9 不扣灵石/寿元");
  }

  // ---------- 3. 分级惩罚：筑基（order 10）全惩罚 ----------
  {
    const player = mkPlayer("foundation-early");
    const ageBefore = player.age;
    const result = forceDefeat(player, (p) => battle.startArcheryBattle(p));
    const penalty = result?.penalty;
    assert(
      penalty.injury >= 20 && penalty.injury <= 30,
      `order≥10 伤势落入 [20,30]（实得 ${penalty.injury}）`,
    );
    assert(
      penalty.lostStones >= 5 && penalty.lostStones <= 10,
      `order≥10 灵石损失 5–10%（实失 ${penalty.lostStones}）`,
    );
    assert(penalty.lostDays === 2, "order≥10 寿元 +2 日");
    const daysElapsed = Math.round((result.player.age - ageBefore) * 360);
    assert(daysElapsed === 5, `败北共推进 5 日（疗伤 3 + 惩罚 2，实 ${daysElapsed}）`);
    assert(result.player.injury === penalty.injury, "伤势写入 player");
  }

  // ---------- 4. 主动撤退惩罚减半 ----------
  {
    let allOk = true;
    for (let i = 0; i < 8; i++) {
      const player = mkPlayer("foundation-early");
      const duel = battle.startArcheryBattle(player);
      const result = battle.retreatFromBattle(player, duel).battleResult;
      const penalty = result?.penalty;
      const ok =
        result.retreated === true &&
        penalty.injury >= 10 &&
        penalty.injury <= 15 &&
        penalty.lostDays === 1 &&
        penalty.lostStones <= 5;
      if (!ok) allOk = false;
    }
    assert(allOk, "撤退 8 次：伤势≤15、寿元 1 日、灵石≤5（全减半）");
  }

  // ---------- 5. 演武切磋全免 ----------
  {
    const player = mkPlayer("foundation-early");
    let duel = battle.startSparringBattle(player);
    duel = { ...duel, playerHealth: 1 };
    const res = battle.skipPlayerShot(
      { ...player, health: { ...player.health, current: 1 } },
      duel,
      "测试：切磋力竭",
    );
    assert(res.battleResult?.penalty === undefined, "演武败北无 penalty");
    assert(res.battleResult?.isSparring === true, "演武标志保留");
    assert(res.player.injury === 0, "演武败北不加伤势");
  }

  // ---------- 6. 伤势 50 的惩罚数值 ----------
  {
    const p = injurySys.getInjuryPenalty(50);
    assert(
      Math.abs(p.damageMul - 0.85) < 1e-9 &&
        Math.abs(p.hitPenalty + 0.1) < 1e-9 &&
        Math.abs(p.cultivationMul - 0.8) < 1e-9,
      "伤势 50 → 伤害 −15% / 命中 −10% / 修炼 −20%",
    );
    const desc = injurySys.describeInjuryPenalty(50).join(" ");
    assert(desc.includes("15") && desc.includes("10") && desc.includes("20"), "惩罚文案可读");
  }

  // ---------- 7. 伤势接入命中/伤害/修炼 ----------
  {
    // 同一玩家派生健康/带伤两态，避免属性随机差异污染对照
    const base = mkPlayer("qi-refining-3");
    const healthy = { ...base, injury: 0 };
    const wounded = { ...base, injury: 50 };
    // 头部命中修正为负，远离 0.95 上限钳制，差值应恰好为 0.10
    const hitDiff =
      battle.getShotChance(healthy, "wooden-arrow", "head") -
      battle.getShotChance(wounded, "wooden-arrow", "head");
    assert(Math.abs(hitDiff - 0.1) < 1e-9, `伤势 50 命中 −0.10（实差 ${hitDiff.toFixed(3)}）`);

    const monster = battle.startArcheryBattle(healthy).monster;
    const avg = (pl) => {
      let sum = 0;
      const n = 400;
      for (let i = 0; i < n; i++) {
        sum += battle.getPlayerShotDamage(pl, monster, "wooden-arrow", "chest", 1).damage;
      }
      return sum / n;
    };
    // damageMul 乘在防御扣减之前，低威力箭对比值会略低于 0.85
    const ratio = avg(wounded) / avg(healthy);
    assert(ratio > 0.6 && ratio < 0.9, `伤势 50 伤害均值降至 0.6–0.9（实 ${ratio.toFixed(2)}）`);

    const gainH = cultivation.getCultivationGain(healthy);
    const gainW = cultivation.getCultivationGain(wounded);
    assert(
      Math.abs(gainW - gainH * 0.8) <= 1,
      `伤势 50 修炼收益约 ×0.8（${gainH} → ${gainW}）`,
    );
  }

  // ---------- 8. 静养化瘀 −15 ----------
  {
    const player = mkPlayer("mortal", { injury: 30 });
    const rested = battle.restPlayer(player);
    assert(rested.injury === 15, "静养伤势 30 → 15");
    const light = battle.restPlayer(mkPlayer("mortal", { injury: 5 }));
    assert(light.injury === 0, "静养伤势 5 → 0（下限钳制）");
  }

  // ---------- 9. 化瘀丹 −40 / 回春丹 / 回灵丹（战斗外） ----------
  {
    const player = mkPlayer("mortal", {
      injury: 60,
      health: { current: 100, max: 500 },
      mana: { current: 10, max: 100 },
      inventory: [
        { itemId: "stasis-pill", quantity: 2 },
        { itemId: "healing-pill", quantity: 1 },
        { itemId: "mana-pill", quantity: 1 },
      ],
    });
    const r1 = pillSys.useOutOfBattlePill(player, "stasis-pill");
    assert(r1.success && r1.player.injury === 20, "化瘀丹 伤势 60 → 20");
    assert(qty(r1.player, "stasis-pill") === 1, "化瘀丹消耗一枚");
    assert(r1.message.includes("化解伤势 40"), "化瘀丹文案含化解量");

    const r2 = pillSys.useOutOfBattlePill(r1.player, "healing-pill");
    assert(r2.success && r2.player.health.current === 145, "回春丹 战外回血 45");

    const r3 = pillSys.useOutOfBattlePill(r2.player, "mana-pill");
    assert(r3.success && r3.player.mana.current === 35, "回灵丹 战外回灵 25");
  }

  // ---------- 10. 限次丹：锻体丹 +1 根骨 / 第 4 次拒绝 ----------
  {
    const player = mkPlayer("mortal", {
      inventory: [{ itemId: "body-forging-pill", quantity: 5 }],
    });
    const rootBefore = player.attributes.rootBone;
    const r1 = pillSys.useOutOfBattlePill(player, "body-forging-pill");
    assert(
      r1.success &&
        r1.player.attributes.rootBone === rootBefore + 1 &&
        r1.player.pillUseCounts["body-forging-pill"] === 1,
      "锻体丹 根骨 +1 且计数 1",
    );
    const maxed = { ...player, pillUseCounts: { "body-forging-pill": 3 } };
    const r4 = pillSys.useOutOfBattlePill(maxed, "body-forging-pill");
    assert(!r4.success && r4.message.includes("限服"), "锻体丹第 4 次被拒");
    assert(qty(r4.player, "body-forging-pill") === 5, "拒绝时不消耗物品");

    const mindPlayer = mkPlayer("mortal", {
      inventory: [{ itemId: "mind-cleansing-pill", quantity: 2 }],
      pillUseCounts: { "mind-cleansing-pill": 2 },
    });
    const rm = pillSys.useOutOfBattlePill(mindPlayer, "mind-cleansing-pill");
    assert(!rm.success, "洗心丹第 3 次被拒（限 2）");
  }

  // ---------- 11. 突破失败：+伤势 15；筑基失败「经脉受创」+ 60 日 ----------
  {
    const tryUntilFail = (realmId) => {
      for (let i = 0; i < 300; i++) {
        const realm = getRealmById(realmId);
        const player = {
          ...mkPlayer(realmId),
          attributes: { rootBone: 9, comprehension: 9, luck: 9, mind: 30, divineSense: 9 },
          spiritStones: 9999,
          cultivation: {
            current: realm.breakthrough.requiredCultivation,
            required: realm.breakthrough.requiredCultivation,
            lastGain: 0,
          },
          inventory: realm.breakthrough.requiredItems.map((c) => ({
            itemId: c.itemId,
            quantity: c.quantity,
          })),
        };
        const res = cultivation.attemptBreakthrough(player);
        // 成功则重开一局，直到抽到失败样本
        if (!res.success) {
          return { player, res };
        }
      }
      return null;
    };

    const low = tryUntilFail("mortal");
    assert(low !== null, "炼气突破能抽到失败样本");
    assert(low.res.player.injury === 15, "炼气突破失败 伤势 +15");
    assert(Math.round((low.res.player.age - low.player.age) * 360) === 30, "炼气突破失败调养 30 日");

    const high = tryUntilFail("foundation-early");
    assert(high !== null, "筑基突破能抽到失败样本");
    assert(high.res.message.includes("经脉受创"), "筑基突破失败文案「经脉受创」");
    assert(high.res.player.injury === 15, "筑基突破失败 伤势 +15");
    assert(Math.round((high.res.player.age - high.player.age) * 360) === 60, "筑基突破失败调养 60 日");
  }

  // ---------- 12. 装备多维加成：凝神玉佩 critBonus 汇总 ----------
  {
    const player = mkPlayer("mortal", {
      inventory: [{ itemId: "spirit-jade-pendant", quantity: 1 }],
    });
    const equipped = equipment.equipItem(player, "spirit-jade-pendant");
    assert(equipped.success, "玉佩可穿戴");
    const effects = equipment.getEquipmentEffects(equipped.player);
    assert(effects.critBonus === 0.03, `玉佩会心 0.03 汇总（实 ${effects.critBonus}）`);
    assert(effects.accuracyBonus === 0 && effects.injuryResist === 0, "未配置字段默认 0");
  }

  // ---------- 13. 灵根战斗暴击加成 ----------
  {
    const { createSpiritualRoot } = await server.ssrLoadModule("/src/data/spiritualRoots.ts");
    const valid = [0, 0.01, 0.02, 0.04, 0.05];
    let allOk = true;
    for (let i = 0; i < 30; i++) {
      const root = createSpiritualRoot();
      if (typeof root.battleCritBonus !== "number" || !valid.includes(root.battleCritBonus)) {
        allOk = false;
      }
    }
    assert(allOk, "灵根 battleCritBonus 按品阶落入枚举值");
  }

  // ---------- 14. v3 旧档迁移：injury/pillUseCounts 补默认 ----------
  {
    const v3Save = {
      schemaVersion: 3,
      savedAt: new Date().toISOString(),
      player: {
        id: "legacy-player",
        name: "旧档道人",
        gender: "male",
        realmId: "qi-refining-2",
        spiritualRoot: {
          elements: ["wood", "fire"],
          name: "木火灵根",
          grade: "earth",
          purity: 82,
          cultivationMultiplier: 1.35,
          breakthroughBonus: 0.08,
        },
        cultivation: { current: 30, required: 999, lastGain: 5 },
        age: 20,
        lifespan: 100,
        health: { current: 90, max: 120 },
        mana: { current: 20, max: 40 },
        spiritStones: 55,
        attributes: { rootBone: 6, comprehension: 5, luck: 4, mind: 7, divineSense: 5 },
        inventory: [{ itemId: "spirit-grass", quantity: 3 }],
        equipment: { weapon: "ironwood-sword", armor: null, accessory: null },
        learnedManualIds: [],
        sectId: null,
        sectContribution: 0,
        locationId: "qingshi-town",
        caveDwellingId: null,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    };
    const store = { "xiantu.save.v1": JSON.stringify(v3Save) };
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
    assert(loaded !== null, "v3 存档可读入");
    assert(loaded.player.injury === 0, "v3 → injury 默认 0");
    assert(
      typeof loaded.player.pillUseCounts === "object" &&
        Object.keys(loaded.player.pillUseCounts).length === 0,
      "v3 → pillUseCounts 默认 {}",
    );
    assert(loaded.player.name === "旧档道人" && loaded.player.realmId === "qi-refining-2", "v3 原有字段保留");
    assert(loaded.schemaVersion === 5, "读入后 schemaVersion 升至 5（三期）");
  }
} finally {
  await server.close();
}
