// 渡劫飞升（境界不变）+ 灵界地图冒烟测试
// 门槛判定 / 渡劫成功（境界不变传灵界）/ 渡劫失败（身死道消）/ 缺料拦截 /
// 灵界数据注册 / 路网连通 / 渡厄丹人界可炼 / 突破灵界境界门槛 / 存档 schema v11 迁移
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

let realRandom = Math.random;
const stubRandom = (value) => {
  realRandom = Math.random;
  Math.random = () => value;
};
const restoreRandom = () => {
  Math.random = realRandom;
};

try {
  const { createInitialPlayer } = await server.ssrLoadModule("/src/data/initialPlayer.ts");
  const cult = await server.ssrLoadModule("/src/systems/cultivationSystem.ts");
  const time = await server.ssrLoadModule("/src/systems/timeSystem.ts");
  const locs = await server.ssrLoadModule("/src/data/locations.ts");
  const routes = await server.ssrLoadModule("/src/data/routes.ts");
  const items = await server.ssrLoadModule("/src/data/items.ts");
  const monsters = await server.ssrLoadModule("/src/data/monsters.ts");
  const recipes = await server.ssrLoadModule("/src/data/recipes.ts");
  const crafts = await server.ssrLoadModule("/src/data/craftRecipes.ts");
  const mines = await server.ssrLoadModule("/src/data/mines.ts");
  const shops = await server.ssrLoadModule("/src/data/shops.ts");
  const saveLoad = await server.ssrLoadModule("/src/utils/saveLoad.ts");
  const realms = await server.ssrLoadModule("/src/data/realms.ts");

  // 满条件 divine-early 玩家：修为 34500/34500、心境 50、灵石 20000、渡厄丹+化神丹+高妖核×4
  const makeDivineEarly = (over = {}) => {
    const base = createInitialPlayer();
    return {
      ...base,
      realmId: "divine-early",
      age: 320,
      lifespan: 520,
      cultivation: { current: 34500, required: 34500, lastGain: 0 },
      attributes: { ...base.attributes, mind: 50 },
      spiritStones: 20000,
      inventory: [
        ...base.inventory,
        { itemId: "du-e-dan", quantity: 1 },
        { itemId: "spirit-transformation-pill", quantity: 1 },
        { itemId: "beast-core-high", quantity: 4 },
      ],
      caveDwellingId: "yaoxin-cave",
      ...over,
    };
  };

  // ---------- 1. 门槛：化神期以下不可渡劫 ----------
  {
    const nascent = { ...createInitialPlayer(), realmId: "nascent-late" }; // order 18
    const check = cult.getTribulationCheck(nascent);
    assert(
      check.missingReasons.some((r) => r.includes("未至化神期")),
      "nascent-late：渡劫门槛含「未至化神期」",
    );
    const res = cult.attemptTribulation(nascent);
    assert(res.success === false, "nascent-late：attemptTribulation success=false");
    assert(res.player.realmId === "nascent-late", "nascent-late：境界不变");

    const divineUnder = makeDivineEarly({
      cultivation: { current: 1000, required: 34500, lastGain: 0 },
    });
    assert(
      cult.getTribulationCheck(divineUnder).canBreakthrough === false,
      "divine-early 修为未满：canBreakthrough=false",
    );
  }

  // ---------- 2. 渡劫成功：境界不变、传送灵界并切地图 ----------
  {
    const player = makeDivineEarly();
    stubRandom(0); // passed = true
    const res = cult.attemptTribulation(player);
    restoreRandom();
    assert(res.success === true, "渡劫成功：success=true");
    assert(res.player.realmId === "divine-early", "渡劫成功：境界不变（仍化神初期）");
    assert(
      res.player.hasEnteredSpiritWorld === true,
      "渡劫成功：hasEnteredSpiritWorld=true（切灵界地图）",
    );
    assert(
      res.player.locationId === "sp-yunhai-town",
      "渡劫成功：传送灵界起始点 sp-yunhai-town",
    );
    assert(
      res.player.cultivation.current === 34500 &&
        res.player.cultivation.required === 34500,
      "渡劫成功：修为不重置（仍 34500）",
    );
    assert(
      res.player.lifespan === player.lifespan,
      "渡劫成功：寿元不变",
    );
    assert(
      res.player.health.max === player.health.max &&
        res.player.mana.max === player.mana.max,
      "渡劫成功：气血/灵力上限不变",
    );
    assert(
      res.player.caveDwellingId === "sp-lingquan-cave",
      "渡劫成功：原洞府迁至灵界灵泉洞府",
    );
    // 未建洞府者留空可新建
    const noCave = makeDivineEarly({ caveDwellingId: null });
    stubRandom(0);
    const resNoCave = cult.attemptTribulation(noCave);
    restoreRandom();
    assert(
      resNoCave.player.caveDwellingId === null,
      "渡劫成功：未建洞府留空（可新建）",
    );
    // 材料/灵石扣除
    assert(
      res.player.spiritStones === player.spiritStones - 8000,
      "渡劫成功：扣除灵石 8000",
    );
    const duE = res.player.inventory.find((it) => it.itemId === "du-e-dan");
    assert(!duE || duE.quantity === 0, "渡劫成功：消耗渡厄丹");
  }

  // ---------- 3. 渡劫失败：身死道消（硬核死亡） ----------
  {
    const player = makeDivineEarly();
    stubRandom(1); // passed = false
    const res = cult.attemptTribulation(player);
    restoreRandom();
    assert(res.success === false, "渡劫失败：success=false");
    assert(
      res.player.lifespan === res.player.age,
      "渡劫失败：lifespan 压至当前年龄",
    );
    assert(
      res.player.deathCause === "tribulation",
      "渡劫失败：deathCause=tribulation",
    );
    assert(
      time.isPlayerDead(res.player) === true,
      "渡劫失败：isPlayerDead 即刻为真",
    );
    assert(
      res.player.spiritStones === player.spiritStones - 8000,
      "渡劫失败：材料灵石仍扣",
    );
  }

  // ---------- 4. 缺料拦截：缺渡厄丹不可渡劫 ----------
  {
    // 手动拼一个缺渡厄丹但其余齐的库存
    const player = makeDivineEarly();
    const withoutDan = {
      ...player,
      inventory: [
        ...player.inventory.filter(
          (it) => it.itemId !== "du-e-dan" && it.itemId !== "spirit-transformation-pill" && it.itemId !== "beast-core-high",
        ),
        { itemId: "spirit-transformation-pill", quantity: 1 },
        { itemId: "beast-core-high", quantity: 4 },
      ],
    };
    const check = cult.getTribulationCheck(withoutDan);
    assert(check.canBreakthrough === false, "缺渡厄丹：canBreakthrough=false");
    const res = cult.attemptTribulation(withoutDan);
    assert(res.success === false, "缺渡厄丹：attemptTribulation 拒行");
    assert(res.player.realmId === "divine-early", "缺渡厄丹：境界不变");
  }

  // ---------- 5. 灵界地点数据 ----------
  {
    assert(
      locs.SPIRIT_LOCATIONS.length >= 10,
      `灵界地点 >= 10（实际 ${locs.SPIRIT_LOCATIONS.length}）`,
    );
    const ids = locs.SPIRIT_LOCATIONS.map((loc) => loc.id);
    assert(
      new Set(ids).size === ids.length,
      "灵界地点 id 唯一",
    );
    const mortalIds = new Set(
      locs.WORLD_LOCATIONS.map((loc) => loc.id),
    );
    assert(
      ids.every((id) => !mortalIds.has(id)),
      "灵界地点与凡间无交集",
    );
    const yaojing = locs.getLocation("sp-shanggu-yaojing");
    assert(
      yaojing && yaojing.type === "secret-realm",
      "sp-shanggu-yaojing：type=secret-realm",
    );
    assert(
      yaojing.bossMonsterId === "spirit-ancient-beast",
      "sp-shanggu-yaojing：bossMonsterId=spirit-ancient-beast",
    );
    assert(
      yaojing.minRealmOrder === 25,
      "sp-shanggu-yaojing：minRealmOrder=25（合体初期解锁）",
    );
    assert(
      locs.getWorldId(locs.getLocation("sp-yunhai-town")) === "spirit",
      "getWorldId：云海镇 → spirit",
    );
  }

  // ---------- 6. 灵界路网连通（云海镇 BFS 可达） ----------
  {
    const chain = routes.findRouteChain(
      "sp-yunhai-town",
      "sp-xianjing-mine",
      "spirit",
    );
    assert(
      Array.isArray(chain) && chain.length >= 2,
      `findRouteChain(云海镇→仙晶矿, spirit) 非空（len=${chain?.length}）`,
    );
    const d = routes.travelPathD(chain, "spirit");
    assert(typeof d === "string" && d.length > 0, "travelPathD(spirit) 有路径 d");
  }

  // ---------- 7. 灵界内容注册 + 渡厄丹人界可炼 ----------
  {
    assert(items.getItemDefinition("du-e-dan") !== undefined, "getItemDefinition(渡厄丹) 存在");
    assert(
      monsters.getMonsterById("spirit-ancient-beast")?.isBoss === true,
      "getMonsterById(上古妖神).isBoss === true",
    );
    const duERecipe = recipes.getAlchemyRecipe("recipe-du-e-dan");
    assert(duERecipe !== undefined, "getAlchemyRecipe(recipe-du-e-dan) 存在");
    const badMaterials = ["spirit-crystal", "immortal-herb", "thunder-essence"];
    assert(
      duERecipe &&
        duERecipe.ingredients.every((ing) => !badMaterials.includes(ing.itemId)),
      "recipe-du-e-dan 材料改人界可炼（无仙晶/天芝/雷髓）",
    );
    assert(
      crafts.getCraftRecipe("craft-spirit-crystal-sword") !== undefined,
      "getCraftRecipe(craft-spirit-crystal-sword) 存在",
    );
    assert(
      mines.getMineTable("spirit-crystal-mine") !== null,
      "getMineTable(spirit-crystal-mine) 存在",
    );
    const lingxu = shops.getShop("sp-lingxu-city");
    assert(lingxu !== null, "getShop(sp-lingxu-city) 存在");
    assert(
      lingxu && !lingxu.itemIds.includes("du-e-dan"),
      "sp-lingxu-city 商店不含渡厄丹（炼丹独有）",
    );
    assert(
      monsters.getLocationBoss(locs.getLocation("sp-shanggu-yaojing")).id ===
        "spirit-ancient-beast",
      "getLocationBoss(上古妖境) → 上古妖神",
    );
  }

  // ---------- 8. 存档迁移（schema v11）：deathCause + hasEnteredSpiritWorld ----------
  {
    // 渡劫死亡档带 deathCause:"tribulation" → 保留；hasEnteredSpiritWorld 缺省 false
    store.clear();
    const dead = createInitialPlayer();
    dead.deathCause = "tribulation";
    saveLoad.saveGame(dead);
    const loadedDead = saveLoad.loadGame();
    assert(
      loadedDead.player.deathCause === "tribulation",
      "迁移：deathCause=tribulation 保留",
    );
    assert(
      loadedDead.schemaVersion === 11,
      "迁移：schemaVersion=11",
    );
    assert(
      loadedDead.player.hasEnteredSpiritWorld === false,
      "迁移：无 hasEnteredSpiritWorld → false",
    );

    // 灵界档（已渡劫）→ hasEnteredSpiritWorld=true 保留
    store.clear();
    const inSpirit = createInitialPlayer();
    inSpirit.hasEnteredSpiritWorld = true;
    saveLoad.saveGame(inSpirit);
    const loadedSpirit = saveLoad.loadGame();
    assert(
      loadedSpirit.player.hasEnteredSpiritWorld === true,
      "迁移：hasEnteredSpiritWorld=true 保留（灵界档读回仍在灵界）",
    );

    // 缺字段 → undefined
    store.clear();
    const fresh = createInitialPlayer();
    saveLoad.saveGame(fresh);
    const loadedFresh = saveLoad.loadGame();
    assert(
      loadedFresh.player.deathCause === undefined,
      "迁移：无 deathCause → undefined",
    );

    // lifespan 死亡档（坐化）也保留类型
    store.clear();
    const aged = createInitialPlayer();
    aged.deathCause = "lifespan";
    saveLoad.saveGame(aged);
    const loadedAged = saveLoad.loadGame();
    assert(
      loadedAged.player.deathCause === "lifespan",
      "迁移：deathCause=lifespan 保留",
    );
  }

  // ---------- 9. 突破灵界独有境界（炼虚起）须已在灵界 ----------
  {
    const divineLate = { ...createInitialPlayer(), realmId: "divine-late" };
    const check = cult.getBreakthroughCheck(divineLate);
    assert(
      check.missingReasons.some((r) => r.includes("须渡劫飞升灵界")),
      "divine-late 未渡劫：突破门槛含「须渡劫飞升灵界」",
    );
    const res = cult.attemptBreakthrough(divineLate);
    assert(res.success === false, "divine-late 未渡劫：attemptBreakthrough 拒行");
    assert(res.player.realmId === "divine-late", "divine-late 未渡劫：境界不变");

    // 已入灵界 + 满条件 → 可晋炼虚初期
    const ready = {
      ...createInitialPlayer(),
      realmId: "divine-late",
      hasEnteredSpiritWorld: true,
      cultivation: { current: 52000, required: 52000, lastGain: 0 },
      attributes: { ...createInitialPlayer().attributes, mind: 52 },
      spiritStones: 20000,
    };
    stubRandom(0);
    const resReady = cult.attemptBreakthrough(ready);
    restoreRandom();
    assert(resReady.success === true, "divine-late 已入灵界：突破炼虚成功");
    assert(
      resReady.player.realmId === "lianxu-early",
      "突破成功：晋入炼虚初期",
    );
  }
} finally {
  restoreRandom();
  await server.close();
}

console.log(
  process.exitCode ? "\n!!! 渡劫冒烟：存在失败项" : "\n渡劫冒烟：全部通过",
);
