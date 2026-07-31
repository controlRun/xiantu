// 探索二期冒烟测试：秘境节点远征
// 节点掷骰 / 遍历成本 / 节点结算 / 战斗归并四分支 / 存档迁移 / 共享每日门 / 境界门封锁
import { createServer } from "vite";

// saveLoad 经 localStorage 读写：注入内存桩以在 node 下跑完整 save→load 迁移回路
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
};

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
  const expedition = await server.ssrLoadModule("/src/systems/expeditionSystem.ts");
  const nodes = await server.ssrLoadModule("/src/data/expeditionNodes.ts");
  const monsters = await server.ssrLoadModule("/src/data/monsters.ts");
  const battle = await server.ssrLoadModule("/src/systems/battleSystem.ts");
  const mapSys = await server.ssrLoadModule("/src/systems/mapSystem.ts");
  const locs = await server.ssrLoadModule("/src/data/locations.ts");
  const saveLoad = await server.ssrLoadModule("/src/utils/saveLoad.ts");

  const VALID_TYPES = ["combat", "gather", "chest", "ward", "encounter"];

  // ---------- 1. 节点掷骰 ----------
  {
    for (const depth of [1, 2, 3, 4]) {
      const layer = expedition.rollLayerNodes(depth);
      assert(layer.length === 3, `L${depth}：每层掷 3 节点`);
      assert(
        layer.every((n) => VALID_TYPES.includes(n.type)),
        `L${depth}：节点类型均合法`,
      );
      assert(
        new Set(layer.map((n) => n.type)).size === 3,
        `L${depth}：3 节点异型（不重复）`,
      );
      const combat = layer.find((n) => n.type === "combat");
      if (combat) {
        assert(
          typeof combat.monsterId === "string" && monsters.getMonsterById(combat.monsterId),
          `L${depth}：战斗节点固定怪有效（${combat.monsterId}）`,
        );
      }
    }

    // 权重漂移：战斗 L1>L4、奇遇 L4>L1（粗粒度，6000 样本）
    const count = (depth) => {
      const tally = Object.fromEntries(VALID_TYPES.map((t) => [t, 0]));
      for (let i = 0; i < 2000; i++) {
        for (const n of expedition.rollLayerNodes(depth)) {
          tally[n.type]++;
        }
      }
      return tally;
    };
    const c1 = count(1);
    const c4 = count(4);
    assert(c1.combat > c4.combat, `战斗节点占比 L1(${c1.combat}) > L4(${c4.combat})`);
    assert(c4.encounter > c1.encounter, `奇遇节点占比 L4(${c4.encounter}) > L1(${c1.encounter})`);
  }

  // ---------- 2. 遍历成本 ----------
  {
    const base = createInitialPlayer(); // health 100/100, mana 30/30
    const d1 = expedition.applyTraversalCost(base, 1);
    assert(d1.health.current === 95, `L1 遍历：气血 100→95（-5%）`);
    assert(d1.mana.current === 29, `L1 遍历：灵力 30→29（-5% 取整）`);
    assert(d1.age > base.age, `L1 遍历：寿元流逝（age 增）`);

    const low = { ...base, health: { ...base.health, current: 3 } };
    const d4 = expedition.applyTraversalCost(low, 4);
    assert(d4.health.current === 1, `L4 遍历：气血保底 1（3 - 15% → 1）`);
  }

  // ---------- 3. 非战斗节点结算 ----------
  {
    const mkRun = (type) => ({
      locationId: nodes.EXPEDITION_LOCATION_ID,
      depth: 1,
      nodes: [
        { id: "d1-n0", type, resolved: false },
        { id: "d1-n1", type: "chest", resolved: false },
        { id: "d1-n2", type: "combat", resolved: false, monsterId: "mist-fox" },
      ],
      loot: [],
    });

    // 采集：修为必增、节点 resolved
    {
      const player = { ...createInitialPlayer(), mana: { current: 30, max: 30 } };
      const before = player.cultivation.current;
      const res = expedition.resolveExpeditionNode(player, mkRun("gather"), "d1-n0");
      const node = res.run.nodes.find((n) => n.id === "d1-n0");
      assert(node.resolved === true, "采集：节点标 resolved");
      assert(res.player.cultivation.current >= before, "采集：修为入账");
      assert(res.logs.length >= 1, "采集：有日志");
    }

    // 宝箱：灵石增
    {
      const player = createInitialPlayer();
      const res = expedition.resolveExpeditionNode(player, mkRun("chest"), "d1-n0");
      assert(res.player.spiritStones > player.spiritStones, "宝箱：灵石增");
    }

    // 禁制·解禁：灵力 -6；强闯：伤势 +
    {
      const player = { ...createInitialPlayer(), mana: { current: 30, max: 30 } };
      const normal = expedition.resolveExpeditionNode(player, mkRun("ward"), "d1-n0", false);
      assert(normal.player.mana.current === 24, "禁制解禁：灵力 30→24（-6）");
      assert(normal.player.injury === 0, "禁制解禁：不增伤势");

      const force = expedition.resolveExpeditionNode(player, mkRun("ward"), "d1-n0", true);
      assert(force.player.injury > 0, "禁制强闯：伤势增");
    }

    // 奇遇：修为增
    {
      const player = createInitialPlayer();
      const res = expedition.resolveExpeditionNode(player, mkRun("encounter"), "d1-n0");
      assert(res.player.cultivation.current > player.cultivation.current, "奇遇：修为增");
    }

    // 战斗节点不在此结算
    {
      const player = createInitialPlayer();
      const res = expedition.resolveExpeditionNode(player, mkRun("combat"), "d1-n2");
      assert(res.message.includes("对战"), "战斗节点：拒绝非战斗结算");
    }
  }

  // ---------- 4. 战斗归并四分支 ----------
  {
    const mkRun = () => ({
      locationId: nodes.EXPEDITION_LOCATION_ID,
      depth: 1,
      nodes: [
        { id: "d1-n0", type: "combat", resolved: false, monsterId: "mist-fox" },
        { id: "d1-n1", type: "gather", resolved: false },
        { id: "d1-n2", type: "chest", resolved: false },
      ],
      loot: [{ itemId: "spirit-grass", quantity: 5 }],
    });
    const mkResult = (over) => ({
      player: createInitialPlayer(),
      monster: monsters.getMonsterById("mist-fox"),
      victory: false,
      reward: { spiritStones: 0, cultivation: 0, items: [] },
      logs: ["战报"],
      message: "msg",
      ...over,
    });

    // 战斗胜：局留、战斗节点 resolved、loot 留
    {
      const player = createInitialPlayer();
      const s = expedition.settleExpeditionBattle(player, mkRun(), mkResult({ victory: true }));
      assert(s.outcome === "continue", "战斗胜：outcome=continue");
      assert(s.run !== null, "战斗胜：局留");
      assert(s.run.nodes.find((n) => n.id === "d1-n0").resolved === true, "战斗胜：战斗节点 resolved");
      assert(s.run.loot.length === 1, "战斗胜：run.loot 保留");
    }

    const grassQty = (p) =>
      p.inventory.find((it) => it.itemId === "spirit-grass")?.quantity ?? 0;

    // Boss 胜：通关、loot 入库、局清
    {
      const player = createInitialPlayer();
      const before = grassQty(player);
      const boss = monsters.getSecretRealmBoss();
      const s = expedition.settleExpeditionBattle(
        player,
        { ...mkRun(), depth: 5, nodes: [] },
        mkResult({ victory: true, monster: boss }),
      );
      assert(s.outcome === "complete", "Boss 胜：outcome=complete");
      assert(s.run === null, "Boss 胜：局清");
      assert(grassQty(s.player) === before + 5, "Boss 胜：run.loot 入库（+5）");
      assert(s.player.secretRealmRun === undefined, "Boss 胜：secretRealmRun 清除");
    }

    // 撤退：loot 入库、局清
    {
      const player = createInitialPlayer();
      const before = grassQty(player);
      const s = expedition.settleExpeditionBattle(
        player,
        mkRun(),
        mkResult({ victory: false, retreated: true }),
      );
      assert(s.outcome === "retreated", "撤退：outcome=retreated");
      assert(s.run === null, "撤退：局清");
      assert(grassQty(s.player) === before + 5, "撤退：run.loot 入库（+5）");
    }

    // 战败：丢 run.loot、局清、系统不叠加伤势
    {
      const player = { ...createInitialPlayer(), injury: 7 };
      const invBefore = JSON.stringify(player.inventory);
      const grassBefore = grassQty(player);
      const s = expedition.settleExpeditionBattle(player, mkRun(), mkResult({ victory: false }));
      assert(s.outcome === "defeated", "战败：outcome=defeated");
      assert(s.run === null, "战败：局清");
      assert(grassQty(s.player) === grassBefore, "战败：run.loot 丢弃（灵草未入库）");
      assert(s.player.injury === 7, "战败：系统不额外加伤势（沿用引擎值）");
      assert(JSON.stringify(s.player.inventory) === invBefore, "战败：库存不被本系统改动");
    }
  }

  // ---------- 5. 存档迁移回路（localStorage 桩） ----------
  {
    // 合法 run 保留
    {
      store.clear();
      const player = createInitialPlayer();
      player.secretRealmRun = {
        locationId: nodes.EXPEDITION_LOCATION_ID,
        depth: 2,
        nodes: [{ id: "d2-n0", type: "gather", resolved: true }],
        loot: [{ itemId: "spirit-grass", quantity: 3 }],
      };
      saveLoad.saveGame(player);
      const loaded = saveLoad.loadGame();
      const run = loaded.player.secretRealmRun;
      assert(run && run.depth === 2, "迁移：合法 run depth 保留");
      assert(run.nodes[0].type === "gather" && run.nodes[0].resolved === true, "迁移：节点保留");
      assert(run.loot[0].quantity === 3, "迁移：loot 保留");
    }

    // 非法 run（depth 越界）→ undefined
    {
      store.clear();
      const player = createInitialPlayer();
      player.secretRealmRun = { locationId: "x", depth: 99, nodes: [], loot: [] };
      saveLoad.saveGame(player);
      const loaded = saveLoad.loadGame();
      assert(loaded.player.secretRealmRun === undefined, "迁移：非法 run → undefined");
    }

    // 旧档无此字段 → undefined（v5 兼容）
    {
      store.clear();
      const player = createInitialPlayer();
      saveLoad.saveGame(player);
      const loaded = saveLoad.loadGame();
      assert(loaded.player.secretRealmRun === undefined, "迁移：旧档无字段 → undefined");
    }
  }

  // ---------- 6. 共享每日门 ----------
  {
    const fresh = createInitialPlayer();
    assert(
      battle.getBossChallengeCheck(fresh).canChallenge === true,
      "新存档：守关者可挑战",
    );
    const attempted = battle.markBossAttempt(fresh);
    assert(
      battle.getBossChallengeCheck(attempted).canChallenge === false,
      "markBossAttempt 后：当日不可再挑战（远征 L5 与直挑共用）",
    );
  }

  // ---------- 7. 固定怪注入 ----------
  {
    for (const ids of Object.values(nodes.DEPTH_MONSTER_IDS)) {
      for (const id of ids) {
        assert(monsters.getMonsterById(id) !== undefined, `候选怪存在：${id}`);
      }
    }
    const player = createInitialPlayer();
    const fixed = monsters.getMonsterById("heart-devourer");
    const duel = battle.startArcheryBattle(player, undefined, undefined, fixed);
    assert(duel.monster.id === "heart-devourer", "startArcheryBattle：fixedMonster 绕过随机");
  }

  // ---------- 8. 境界门封锁 ----------
  {
    const loc = locs.getLocation("yaoxin-secret-realm");
    const low = createInitialPlayer(); // order 0
    const lowFeatures = mapSys.getLocationFeatures(low, loc);
    const expedLow = lowFeatures.find((f) => f.feature === "expedition");
    assert(expedLow && expedLow.locked === true, "order 0：远征随境界门锁定");
    assert(
      lowFeatures.some((f) => f.feature === "boss"),
      "order 0：直挑入口仍在（两者并存）",
    );

    const high = { ...createInitialPlayer(), realmId: "qi-refining-9" }; // order 9
    const expedHigh = mapSys.getLocationFeatures(high, loc).find((f) => f.feature === "expedition");
    assert(expedHigh && expedHigh.locked === false, "order 9：远征解锁");

    // getExpeditionCheck：order 不足拒开局，足境可开
    assert(expedition.getExpeditionCheck(low).canStart === false, "getExpeditionCheck：order 0 拒开局");
    assert(expedition.getExpeditionCheck(high).canStart === true, "getExpeditionCheck：order 9 可开局");

    // 开局后不可重开（一局在途）
    const started = expedition.startExpedition(high);
    assert(started.secretRealmRun !== undefined, "startExpedition：建局");
    assert(
      expedition.getExpeditionCheck(started).canStart === false,
      "在途局：不可重开",
    );
  }
} finally {
  await server.close();
}

console.log(
  process.exitCode ? "\n!!! 远征冒烟：存在失败项" : "\n远征冒烟：全部通过",
);
