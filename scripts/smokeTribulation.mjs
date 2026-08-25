// 渡劫飞升 + 灵界地图冒烟测试
// 门槛判定 / 渡劫成功（晋大乘传灵界）/ 渡劫失败（身死道消）/ 缺料拦截 /
// 灵界数据注册 / 路网连通 / 商店不含渡厄丹 / 存档 deathCause 迁移
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

  // 满条件 divine-late 玩家：修为/心境/灵石/渡厄丹+化神丹+高妖核×4
  const makeDivineLate = (over = {}) => {
    const base = createInitialPlayer();
    return {
      ...base,
      realmId: "divine-late",
      age: 320,
      lifespan: 520,
      cultivation: { current: 52000, required: 52000, lastGain: 0 },
      attributes: { ...base.attributes, mind: 58 },
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

    const divineUnder = makeDivineLate({
      cultivation: { current: 1000, required: 52000, lastGain: 0 },
    });
    assert(
      cult.getTribulationCheck(divineUnder).canBreakthrough === false,
      "divine-late 修为未满：canBreakthrough=false",
    );
  }

  // ---------- 2. 渡劫成功：晋大乘传灵界 ----------
  {
    const player = makeDivineLate();
    stubRandom(0); // passed = true
    const res = cult.attemptTribulation(player);
    restoreRandom();
    assert(res.success === true, "渡劫成功：success=true");
    assert(res.player.realmId === "mahayana-early", "渡劫成功：realmId=mahayana-early");
    assert(
      realms.getRealmById("mahayana-early").order === 22,
      "渡劫成功：大乘初期 order=22",
    );
    assert(
      res.player.locationId === "sp-yunhai-town",
      "渡劫成功：传送灵界起始点 sp-yunhai-town",
    );
    assert(
      res.player.cultivation.current === 0 &&
        res.player.cultivation.required === 64000,
      "渡劫成功：修为归零 / 所需 64000",
    );
    assert(
      res.player.lifespan === player.lifespan + 500,
      "渡劫成功：寿元 +500",
    );
    assert(
      res.player.health.max === player.health.max + 420 &&
        res.player.mana.max === player.mana.max + 520,
      "渡劫成功：气血/灵力上限增长",
    );
    assert(
      res.player.caveDwellingId === "sp-lingquan-cave",
      "渡劫成功：原洞府迁至灵界灵泉洞府",
    );
    // 未建洞府者留空可新建
    const noCave = makeDivineLate({ caveDwellingId: null });
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
    const player = makeDivineLate();
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
    const noDan = makeDivineLate({
      inventory: createInitialPlayer().inventory.filter(
        (it) => it.itemId !== "du-e-dan",
      ),
    });
    // 手动拼一个缺渡厄丹但其余齐的库存
    const player = makeDivineLate();
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
    assert(res.player.realmId === "divine-late", "缺渡厄丹：境界不变");
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

  // ---------- 7. 灵界内容注册 ----------
  {
    assert(items.getItemDefinition("du-e-dan") !== undefined, "getItemDefinition(渡厄丹) 存在");
    assert(
      monsters.getMonsterById("spirit-ancient-beast")?.isBoss === true,
      "getMonsterById(上古妖神).isBoss === true",
    );
    assert(
      recipes.getAlchemyRecipe("recipe-du-e-dan") !== undefined,
      "getAlchemyRecipe(recipe-du-e-dan) 存在",
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

  // ---------- 8. 存档 deathCause 迁移（schema v10） ----------
  {
    // v9 档带 deathCause:"tribulation" → 保留
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
      loadedDead.schemaVersion === 10,
      "迁移：schemaVersion=10",
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
} finally {
  restoreRandom();
  await server.close();
}

console.log(
  process.exitCode ? "\n!!! 渡劫冒烟：存在失败项" : "\n渡劫冒烟：全部通过",
);
