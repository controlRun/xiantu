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

  // ---------- 8. 好感 / 赠礼 / 世事反馈 / 托付 / 迁移 ----------
  {
    // recordTalk：首谈 +1，当日复谈不叠
    {
      const zhou = npcsMod.getNpcById("npc-zhou-shopkeep");
      const p1 = npc.claimNpcGift(mkPlayer(), zhou).player;
      const t1 = npc.recordTalk(p1, zhou, null);
      assert(t1.favorGained === 1, "recordTalk 首谈好感 +1");
      const t2 = npc.recordTalk(t1.player, zhou, null);
      assert(t2.favorGained === 0, "recordTalk 当日复谈不叠好感");
    }

    // selectNpcLines：世事反馈优先于日常，讲过不复读
    {
      const shi = npcsMod.getNpcById("npc-shi-houtu");
      const gifted = npc.claimNpcGift(mkPlayer(), shi).player;
      const hunter = {
        ...gifted,
        stats: { ...gifted.stats, monstersKilled: 20 },
      };
      const sel = npc.selectNpcLines(hunter, shi);
      assert(sel.reactionId === "shi-kills", "selectNpcLines 命中世事反馈");
      assert(sel.lines.length > 0, "反馈台词非空");
      const talked = npc.recordTalk(hunter, shi, sel.reactionId);
      const rel = talked.player.npcRelations[shi.id];
      assert(rel.reactionShown.includes("shi-kills"), "recordTalk 记反馈已讲");
      const sel2 = npc.selectNpcLines(talked.player, shi);
      assert(sel2.reactionId !== "shi-kills", "已讲反馈不复读");
    }

    // giftToNpc：扣物加好感，偏好翻倍
    {
      const zhou = npcsMod.getNpcById("npc-zhou-shopkeep");
      const giver = mkPlayer();
      const before = inventory.getInventoryQuantity(giver.inventory, "spirit-grass");
      const g1 = npc.giftToNpc(giver, zhou, "spirit-grass");
      assert(g1.ok === true, "赠礼成功");
      assert(g1.favorGained === 1, "普通材料好感 +1");
      assert(
        inventory.getInventoryQuantity(g1.player.inventory, "spirit-grass") ===
          before - 1,
        "赠礼扣 1 件",
      );
      const g2 = npc.giftToNpc(giver, zhou, "qi-gathering-pill");
      assert(g2.liked === true && g2.favorGained === 4, "偏好物品好感翻倍 +4");
      assert(g2.player.npcRelations[zhou.id].favor === 4, "好感入关系状态");
    }

    // claimTierReward：跨档回礼一次
    {
      const zhou = npcsMod.getNpcById("npc-zhou-shopkeep");
      const withFavor = {
        ...mkPlayer(),
        npcRelations: {
          ...mkPlayer().npcRelations,
          [zhou.id]: {
            favor: 60,
            lastTalkDay: 0,
            reactionShown: [],
            claimedTiers: [],
            errand: null,
          },
        },
      };
      const r1 = npc.claimTierReward(withFavor, zhou);
      assert(r1.granted === true, "知己回礼发放");
      assert(
        r1.player.spiritStones === withFavor.spiritStones + 30,
        "知己回礼灵石 +30",
      );
      const r2 = npc.claimTierReward(r1.player, zhou);
      assert(r2.granted === false, "同阶回礼不重复");
    }

    // acceptNpcErrand / completeNpcErrand 全链路
    {
      const shi = npcsMod.getNpcById("npc-shi-houtu");
      const errand = shi.errands[0];
      assert(errand.requires[0].itemId === "beast-core-low", "托付需交付低阶妖核");

      const low = npc.acceptNpcErrand(mkPlayer(), shi, errand.id);
      assert(low.ok === false, "好感不足拒绝托付");

      const base = mkPlayer();
      const withFavor = {
        ...base,
        npcRelations: {
          ...base.npcRelations,
          [shi.id]: {
            favor: 20,
            lastTalkDay: 0,
            reactionShown: [],
            claimedTiers: [],
            errand: null,
          },
        },
      };
      const acc = npc.acceptNpcErrand(withFavor, shi, errand.id);
      assert(acc.ok === true, "好感达标接受托付");
      assert(
        acc.player.npcRelations[shi.id].errand.errandId === errand.id,
        "托付写入在途",
      );

      const noItems = npc.completeNpcErrand(acc.player, shi);
      assert(noItems.ok === false, "物资未备齐拒绝交付");

      const stocked = {
        ...acc.player,
        inventory: [
          ...acc.player.inventory,
          { itemId: "beast-core-low", quantity: 3 },
        ],
      };
      const done = npc.completeNpcErrand(stocked, shi);
      assert(done.ok === true, "交付成功");
      assert(done.player.npcRelations[shi.id].errand === null, "交付后托付清空");
      assert(
        done.player.npcRelations[shi.id].favor === 20 + errand.rewards.favor,
        "交付加好感",
      );
      assert(
        inventory.getInventoryQuantity(done.player.inventory, "iron-arrow") >= 10,
        "交付奖励铁箭入囊",
      );
    }

    // 存档迁移：缺字段 → {}，白名单过滤
    {
      store.clear();
      saveLoad.saveGame(mkPlayer());
      const raw = JSON.parse(store.get(SAVE_KEY));
      delete raw.player.npcRelations;
      store.set(SAVE_KEY, JSON.stringify(raw));
      const loaded = saveLoad.loadGame();
      assert(
        typeof loaded.player.npcRelations === "object" &&
          loaded.player.npcRelations !== null &&
          Object.keys(loaded.player.npcRelations).length === 0,
        "迁移：旧档缺 npcRelations → {}",
      );
    }
    {
      store.clear();
      saveLoad.saveGame(mkPlayer());
      const raw = JSON.parse(store.get(SAVE_KEY));
      raw.player.npcRelations = {
        "npc-zhou-shopkeep": {
          favor: 3,
          lastTalkDay: 5,
          reactionShown: ["x"],
          claimedTiers: [],
          errand: null,
        },
        "npc-ghost-fake": {
          favor: 9,
          lastTalkDay: 0,
          reactionShown: [],
          claimedTiers: [],
          errand: null,
        },
        bad: "oops",
      };
      store.set(SAVE_KEY, JSON.stringify(raw));
      const loaded = saveLoad.loadGame();
      const rel = loaded.player.npcRelations;
      assert(rel["npc-zhou-shopkeep"]?.favor === 3, "迁移：合法 key 保留好感");
      assert(rel["npc-ghost-fake"] === undefined, "迁移：白名单过滤非法 key");
      assert(Object.keys(rel).length === 1, "迁移：仅保留合法条目");
    }
  }
} finally {
  await server.close();
}

console.log(
  process.exitCode ? "\n!!! NPC 系统冒烟：存在失败项" : "\nNPC 系统冒烟：全部通过",
);
