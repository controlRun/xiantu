// 探索一期冒烟测试：地区事件过滤 / 伤势掷骰 / 野外地游商 / 境界门封锁
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
  const events = await server.ssrLoadModule("/src/data/exploreEvents.ts");
  const exploration = await server.ssrLoadModule("/src/systems/explorationSystem.ts");
  const injury = await server.ssrLoadModule("/src/systems/injurySystem.ts");
  const shops = await server.ssrLoadModule("/src/data/shops.ts");
  const shopSys = await server.ssrLoadModule("/src/systems/shopSystem.ts");
  const items = await server.ssrLoadModule("/src/data/items.ts");
  const mapSys = await server.ssrLoadModule("/src/systems/mapSystem.ts");
  const locs = await server.ssrLoadModule("/src/data/locations.ts");

  // ---------- 1. 地区事件过滤 ----------
  {
    const regions = {
      青石山脚: ["wolf-fang"],
      青石山腰: ["mist-fox-tail"],
      乱石涧: ["serpent-scale", "iron-essence"],
      废弃古道: ["beast-core-low", "iron-essence"],
    };
    for (const [area, signature] of Object.entries(regions)) {
      const pool = events.getExploreEventsForRealmOrder(12, area);
      const regional = pool.filter((e) => e.areas?.includes(area));
      assert(regional.length >= 3, `${area}：地区限定事件 ≥3（实际 ${regional.length}）`);
      const lootIds = new Set(regional.flatMap((e) => e.lootTable.map((d) => d.itemId)));
      assert(
        signature.some((id) => lootIds.has(id)),
        `${area}：地区事件掉落含标志材料（${signature.join("/")}）`,
      );
      const cross = pool.filter((e) => e.areas && !e.areas.includes(area));
      assert(cross.length === 0, `${area}：不混入其他地区限定事件`);
    }
    // 兼容旧调用：不传 area 只出通用池
    const noArea = events.getExploreEventsForRealmOrder(12);
    assert(
      noArea.every((e) => !e.areas),
      "area 缺省时仅返回通用事件池（逐字节兼容旧行为）",
    );
    // 境界门：order 0 抽不到 insight 地区事件（minRealmOrder 1）
    const order0 = events.getExploreEventsForRealmOrder(0, "废弃古道");
    assert(
      !order0.some((e) => e.id === "ad-broken-stele"),
      "order 0 不出古道残碑悟道（order≥1 门）",
    );
  }

  // ---------- 2. 伤势掷骰 ----------
  {
    assert(injury.clampInjury(999 + 10) === 100, "clampInjury 封顶 100");
    assert(injury.clampInjury(-5) === 0, "clampInjury 下限 0");

    // 古道连探 300 次：injury 事件频发，断言伤势始终合法且确有增长
    let player = createInitialPlayer();
    player.realmId = "qi-refining-3";
    player.mana = { ...player.mana, current: player.mana.max };
    player.spiritStones = 10000;
    player.health = { ...player.health, current: player.health.max };
    let everInjured = false;
    let logsInjuryLine = false;
    let allLegal = true;
    for (let i = 0; i < 300; i++) {
      player = { ...player, mana: { ...player.mana, current: player.mana.max } };
      const result = exploration.exploreSecretRealm(player, "废弃古道");
      player = result.player;
      if (player.injury < 0 || player.injury > 100) allLegal = false;
      if (player.injury > 0) everInjured = true;
      if (result.logs.some((l) => l.startsWith("伤势 +"))) logsInjuryLine = true;
      if (player.health.current <= 5) {
        player = { ...player, health: { ...player.health, current: player.health.max } };
      }
    }
    assert(allLegal, "古道 300 次探索：每次结算后伤势均在 [0,100]");
    assert(everInjured, "古道 300 次探索内伤势确有累积");
    assert(logsInjuryLine, "战报出现「伤势 +N」日志行");
  }

  // ---------- 3. 野外地游商 ----------
  {
    const wildShops = [
      ["qingshi-foothills", 1.5],
      ["misty-forest", 1.6],
      ["luanshi-jian", 1.7],
      ["abandoned-road", 1.8],
    ];
    for (const [locId, markup] of wildShops) {
      const shop = shops.getShop(locId);
      assert(shop !== null && shop.markup === markup, `${locId}：游商库存存在且倍率 ${markup}`);
      const itemId = shop.itemIds[0];
      const item = items.getItemDefinition(itemId);
      const player = { ...createInitialPlayer(), spiritStones: 10000 };
      const result = shopSys.buyItem(player, locId, itemId);
      const expected = Math.ceil(item.value * markup);
      assert(result.ok === true, `${locId}：buyItem(${itemId}) 成功`);
      assert(
        player.spiritStones - result.player.spiritStones === expected,
        `${locId}：扣灵石 = ceil(${item.value}×${markup}) = ${expected}`,
      );
      // 城里更便宜：云鳞城同品价格 ≤ 游商
      const cityBuy = shopSys.getBuyPrice(item, shops.getShop("yunlin-city").markup);
      assert(cityBuy <= expected, `${locId}：云鳞城价（${cityBuy}）不高于游商（${expected}）`);
    }
  }

  // ---------- 4. 游商随境界门封锁 ----------
  {
    const jian = locs.getLocation("luanshi-jian");
    const low = createInitialPlayer(); // order 0
    const lowFeatures = mapSys.getLocationFeatures(low, jian);
    const merchantLow = lowFeatures.find((f) => f.feature === "merchant");
    assert(merchantLow && merchantLow.locked === true, "order 0 玩家：乱石涧游商锁定");
    assert(
      lowFeatures.every((f) => f.locked),
      "order 0 玩家：乱石涧全部功能随境界门锁定",
    );

    const high = { ...createInitialPlayer(), realmId: "qi-refining-9" }; // order 9
    const merchantHigh = mapSys
      .getLocationFeatures(high, jian)
      .find((f) => f.feature === "merchant");
    assert(merchantHigh && merchantHigh.locked === false, "order 9 玩家：乱石涧游商解锁");

    // 四个野外地对足境界玩家均挂游商入口
    for (const id of ["qingshi-foothills", "misty-forest", "luanshi-jian", "abandoned-road"]) {
      const has = mapSys
        .getLocationFeatures(high, locs.getLocation(id))
        .some((f) => f.feature === "merchant" && !f.locked);
      assert(has, `${id}：功能列表含解锁游商`);
    }
  }
} finally {
  await server.close();
}

console.log(
  process.exitCode ? "\n!!! 探索一期冒烟：存在失败项" : "\n探索一期冒烟：全部通过",
);
