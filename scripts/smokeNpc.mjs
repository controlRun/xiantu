// NPC 系统冒烟测试：数据表完整性 / 馈赠发放幂等 / 日常台词随源 / 目标联动 / 存档迁移
//
// 背景：世界新增 8 位具名 NPC（青石镇 2 / 云鳞城 1 / 五宗各 1），
// 首次交谈给一次性馈赠（灵石/物品/箴言），已领记录入 player.npcGiftClaimedIds。
// 本测试锁死：数据表合法、馈赠幂等、rng 可注入、v8 存档字段迁移不丢不脏。
import { createServer } from "vite";

// saveLoad 经 localStorage 读写：注入内存桩以在 node 下跑完整 save→load 迁移回路
const store = new Map();
const SAVE_KEY = "xiantu.save.v1";
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
  const npcsMod = await server.ssrLoadModule("/src/data/npcs.ts");
  const npc = await server.ssrLoadModule("/src/systems/npcSystem.ts");
  const locations = await server.ssrLoadModule("/src/data/locations.ts");
  const items = await server.ssrLoadModule("/src/data/items.ts");
  const inventory = await server.ssrLoadModule("/src/systems/inventorySystem.ts");
  const goal = await server.ssrLoadModule("/src/systems/goalSystem.ts");
  const saveLoad = await server.ssrLoadModule("/src/utils/saveLoad.ts");

  const mkPlayer = () => createInitialPlayer();

  // ---------- 1. 数据表完整性 ----------
  {
    const list = npcsMod.npcs;
    assert(list.length === 8, `NPC 共 8 位（实际 ${list.length}）`);

    const ids = list.map((n) => n.id);
    assert(new Set(ids).size === ids.length, "NPC id 无重复");

    assert(
      list.every((n) => locations.getLocation(n.locationId) != null),
      "所有 locationId 均属世界地点",
    );
    assert(
      list.every((n) => typeof n.portrait === "string" && [...n.portrait].length === 1),
      "头像均为单字",
    );
    assert(
      list.every((n) => n.name.trim().length > 0 && n.title.trim().length > 0),
      "姓名与身份标签非空",
    );
    assert(
      list.every((n) => !n.gift?.itemId || items.getItemDefinition(n.gift.itemId) != null),
      "馈赠物品 id 均可在物品表解析",
    );
    assert(
      list.every((n) => n.dailyLines.length >= 2 && n.dailyLines.every((group) => group.length > 0)),
      "每人日常台词至少 2 组且各组非空",
    );
    assert(
      list.every((n) => !n.gift || n.firstLines.length > 0),
      "有馈赠者必有首次台词",
    );
  }

  // ---------- 2. 分布落位 ----------
  {
    const count = (locationId) =>
      npcsMod.getNpcsByLocationId(locationId).length;
    assert(count("qingshi-town") === 2, "青石镇 2 位 NPC");
    assert(count("yunlin-city") === 1, "云鳞城 1 位 NPC");
    for (const sectLoc of [
      "jinjian-sect",
      "qingyun-men",
      "houtou-bao",
      "danxia-gu",
      "bishui-palace",
    ]) {
      assert(count(sectLoc) === 1, `${sectLoc} 1 位 NPC`);
    }
    assert(count("misty-forest") === 0, "野外地点无 NPC");
  }

  // ---------- 3. 馈赠发放：首领成功 / 二领幂等 ----------
  {
    const zhou = npcsMod.getNpcById("npc-zhou-shopkeep");
    assert(zhou != null, "周掌柜可查得");

    const before = mkPlayer();
    const first = npc.claimNpcGift(before, zhou);
    assert(first.granted === true, "周掌柜首领：granted=true");
    assert(
      first.player.spiritStones === before.spiritStones + 20,
      "首领灵石 +20",
    );
    assert(
      first.player.npcGiftClaimedIds.includes(zhou.id),
      "首领后已领记录含该 NPC",
    );
    assert(first.message.includes("灵石 x20"), "首领 message 提及灵石");

    const second = npc.claimNpcGift(first.player, zhou);
    assert(second.granted === false, "二领：granted=false（幂等）");
    assert(
      second.player.spiritStones === first.player.spiritStones,
      "二领不再发放灵石",
    );
    assert(
      second.player.npcGiftClaimedIds.length === first.player.npcGiftClaimedIds.length,
      "二领不重复追加记录",
    );

    // 物品馈赠入囊
    const shen = npcsMod.getNpcById("npc-shen-merchant");
    const got = npc.claimNpcGift(mkPlayer(), shen);
    assert(
      inventory.getInventoryQuantity(got.player.inventory, "healing-pill") >= 2,
      "沈大掌柜馈赠：回春丹 x2 入囊",
    );
  }

  // ---------- 4. 纯箴言馈赠 ----------
  {
    const liu = npcsMod.getNpcById("npc-liu-storyteller");
    const result = npc.claimNpcGift(mkPlayer(), liu);
    assert(result.granted === true, "说书人首领成功");
    assert(result.message.includes(liu.gift.maxim), "箴言入 message");
    assert(
      result.player.spiritStones === mkPlayer().spiritStones &&
        result.player.inventory.length === mkPlayer().inventory.length,
      "纯箴言不加灵石物品",
    );
  }

  // ---------- 5. 日常台词 rng 可注入 ----------
  {
    const zhou = npcsMod.getNpcById("npc-zhou-shopkeep");
    const firstGroup = npcsMod.getNpcDailyLines(zhou, () => 0);
    const lastGroup = npcsMod.getNpcDailyLines(zhou, () => 0.999);
    assert(
      firstGroup === zhou.dailyLines[0],
      "rng=0 取首组台词",
    );
    assert(
      lastGroup === zhou.dailyLines[zhou.dailyLines.length - 1],
      "rng=0.999 取末组台词",
    );
    assert(npcsMod.getNpcDailyLines(zhou).length > 0, "默认 rng 亦取到台词");
  }

  // ---------- 6. 目标联动 ----------
  {
    const zhou = npcsMod.getNpcById("npc-zhou-shopkeep");
    const liu = npcsMod.getNpcById("npc-liu-storyteller");
    const goalEntry = () =>
      goal.evaluateGoals(mkPlayer()).find((e) => e.goal.id === "goal-npc-gift");
    assert(goalEntry() != null, "「结缘之礼」目标在册");
    assert(goalEntry().total === 3, "目标分母为 3");

    const p0 = mkPlayer();
    const p1 = npc.claimNpcGift(p0, zhou).player;
    const p2 = npc.claimNpcGift(p1, liu).player;
    const progressOf = (p) =>
      goal.evaluateGoals(p).find((e) => e.goal.id === "goal-npc-gift");
    assert(progressOf(p0).progress === 0, "未领馈赠：进度 0/3");
    assert(progressOf(p2).progress === 2 && !progressOf(p2).done, "领 2 份：进度 2/3 未完成");
  }

  // ---------- 7. 存档迁移 ----------
  {
    // 合法 claimed 保留
    {
      store.clear();
      const player = npc.claimNpcGift(
        mkPlayer(),
        npcsMod.getNpcById("npc-zhou-shopkeep"),
      ).player;
      saveLoad.saveGame(player);
      const loaded = saveLoad.loadGame();
      assert(
        loaded.player.npcGiftClaimedIds.includes("npc-zhou-shopkeep"),
        "迁移：合法 claimed 保留",
      );
    }
    // 旧档缺字段 → []
    {
      store.clear();
      saveLoad.saveGame(mkPlayer());
      const raw = JSON.parse(store.get(SAVE_KEY));
      delete raw.player.npcGiftClaimedIds;
      store.set(SAVE_KEY, JSON.stringify(raw));
      const loaded = saveLoad.loadGame();
      assert(
        Array.isArray(loaded.player.npcGiftClaimedIds) &&
          loaded.player.npcGiftClaimedIds.length === 0,
        "迁移：旧档缺字段 → []（不炸）",
      );
    }
    // 非法 id 与非数组 → 过滤为空
    {
      store.clear();
      saveLoad.saveGame(mkPlayer());
      const raw = JSON.parse(store.get(SAVE_KEY));
      raw.player.npcGiftClaimedIds = ["npc-zhou-shopkeep", "npc-ghost-fake", 42, null];
      store.set(SAVE_KEY, JSON.stringify(raw));
      const loaded = saveLoad.loadGame();
      assert(
        loaded.player.npcGiftClaimedIds.length === 1 &&
          loaded.player.npcGiftClaimedIds[0] === "npc-zhou-shopkeep",
        "迁移：白名单过滤非法 id/类型",
      );
    }
    {
      store.clear();
      saveLoad.saveGame(mkPlayer());
      const raw = JSON.parse(store.get(SAVE_KEY));
      raw.player.npcGiftClaimedIds = "npc-zhou-shopkeep";
      store.set(SAVE_KEY, JSON.stringify(raw));
      const loaded = saveLoad.loadGame();
      assert(
        loaded.player.npcGiftClaimedIds.length === 0,
        "迁移：非数组输入 → []",
      );
    }
  }
} finally {
  await server.close();
}

console.log(
  process.exitCode ? "\n!!! NPC 系统冒烟：存在失败项" : "\nNPC 系统冒烟：全部通过",
);
