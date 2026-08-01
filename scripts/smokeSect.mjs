// 宗门系统冒烟测试：职位阶梯 / 差异化加成缩放 / 晋升门 / 各系统接线 / 存档迁移
//
// 回归背景：宗门二期为五宗引入「职位（杂役→长老）+ 差异化被动加成」。
// 加成经 sectSystem.getSectPassiveBonuses 聚合，按职位线性缩放（杂役=0，长老=上限），
// 分别接入修炼/炼器/战斗伤害命中防御/远征遍历成本与伤势抵抗。本测试锁死：
// 缩放正确、晋升门槛、各系统确实吃到加成、sectRank 存档迁移不丢不越界。
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

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

try {
  const { createInitialPlayer } = await server.ssrLoadModule("/src/data/initialPlayer.ts");
  const sects = await server.ssrLoadModule("/src/data/sects.ts");
  const sect = await server.ssrLoadModule("/src/systems/sectSystem.ts");
  const realms = await server.ssrLoadModule("/src/data/realms.ts");
  const cultivation = await server.ssrLoadModule("/src/systems/cultivationSystem.ts");
  const craft = await server.ssrLoadModule("/src/systems/craftSystem.ts");
  const battle = await server.ssrLoadModule("/src/systems/battleSystem.ts");
  const monsters = await server.ssrLoadModule("/src/data/monsters.ts");
  const expedition = await server.ssrLoadModule("/src/systems/expeditionSystem.ts");
  const saveLoad = await server.ssrLoadModule("/src/utils/saveLoad.ts");

  /** 造玩家：指定宗门 / 职位 / 境界 order */
  const mkPlayer = ({ sectId = null, sectRank = 0, order = 0 } = {}) => {
    const base = createInitialPlayer();
    const realmId = order > 0 ? (realms.getRealmByOrder(order)?.id ?? base.realmId) : base.realmId;
    return {
      ...base,
      realmId,
      sectId,
      sectRank,
      health: { current: 2000, max: 2000 },
      mana: { current: 500, max: 500 },
    };
  };

  // ---------- 1. 职位阶梯 ----------
  {
    assert(sects.SECT_RANKS.length === 5, "职位阶梯共 5 级");
    assert(
      sects.SECT_RANKS.map((r) => r.name).join(",") ===
        "杂役弟子,外门弟子,内门弟子,核心弟子,长老",
      "职位名依次为 杂役→外门→内门→核心→长老",
    );
    let orderAsc = true;
    let contribAsc = true;
    for (let i = 1; i < sects.SECT_RANKS.length; i++) {
      if (sects.SECT_RANKS[i].minRealmOrder <= sects.SECT_RANKS[i - 1].minRealmOrder) orderAsc = false;
      if (sects.SECT_RANKS[i].minContribution <= sects.SECT_RANKS[i - 1].minContribution) contribAsc = false;
    }
    assert(orderAsc, "晋升所需境界 order 逐级递增");
    assert(contribAsc, "晋升所需贡献逐级递增");
  }

  // ---------- 2. 差异化加成缩放 ----------
  {
    const empty = sect.getSectPassiveBonuses(mkPlayer());
    assert(
      Object.values(empty).every((v) => v === 0),
      "无宗门：所有加成为 0",
    );

    // 青云（修炼）：杂役 0 / 内门(rank2) 0.1 / 长老 0.2
    assert(
      sect.getSectPassiveBonuses(mkPlayer({ sectId: "qingyun-men", sectRank: 0 })).cultivationBonus === 0,
      "青云杂役：修炼加成 0",
    );
    assert(
      near(sect.getSectPassiveBonuses(mkPlayer({ sectId: "qingyun-men", sectRank: 2 })).cultivationBonus, 0.1),
      "青云内门：修炼加成 +10%（线性缩放）",
    );
    assert(
      near(sect.getSectPassiveBonuses(mkPlayer({ sectId: "qingyun-men", sectRank: 4 })).cultivationBonus, 0.2),
      "青云长老：修炼加成 +20%（上限）",
    );

    assert(
      near(sect.getSectPassiveBonuses(mkPlayer({ sectId: "danxia-gu", sectRank: 4 })).alchemyBonus, 0.18),
      "丹霞长老：炼器加成 +18%",
    );
    const jinjian = sect.getSectPassiveBonuses(mkPlayer({ sectId: "jinjian-sect", sectRank: 4 }));
    assert(
      near(jinjian.damageBonus, 0.15) && near(jinjian.accuracyBonus, 0.05),
      "金剑长老：伤害 +15% 且命中 +5%",
    );
    const bishui = sect.getSectPassiveBonuses(mkPlayer({ sectId: "bishui-palace", sectRank: 4 }));
    assert(
      near(bishui.traversalCostReduction, 0.25) && near(bishui.injuryResist, 0.15),
      "碧水长老：秘境消耗 −25% 且伤势抵抗 15%",
    );
    const houtou = sect.getSectPassiveBonuses(mkPlayer({ sectId: "houtou-bao", sectRank: 4 }));
    assert(
      near(houtou.defenseBonus, 0.25) && near(houtou.injuryResist, 0.1),
      "厚土长老：防御 +25% 且伤势抵抗 10%",
    );
  }

  // ---------- 3. 晋升门 ----------
  {
    assert(
      sect.getPromotionCheck(mkPlayer()).canPromote === false,
      "无宗门：不可晋升",
    );

    // 杂役、境界贡献皆不足 → 不可晋升
    const junior = mkPlayer({ sectId: "qingyun-men", sectRank: 0, order: 0 });
    assert(
      sect.getPromotionCheck(junior).canPromote === false,
      "杂役境界贡献不足：不可晋升",
    );

    // 境界 order≥2 且贡献≥60 → 可晋升外门，晋升后 rank=1
    const ready = { ...junior, realmId: realms.getRealmByOrder(2).id, sectContribution: 80 };
    const check = sect.getPromotionCheck(ready);
    assert(check.canPromote === true, "满足双门槛：可晋升");
    assert(check.nextRank?.name === "外门弟子", "下一级为外门弟子");
    const promoted = sect.promoteSect(ready);
    assert(promoted.success === true, "晋升结算成功");
    assert(promoted.player.sectRank === 1, "晋升后职位 = 外门(rank1)");
    assert(promoted.player.sectContribution === 80, "晋升不消耗贡献（门槛制）");

    // 长老已至极位
    const elder = mkPlayer({ sectId: "qingyun-men", sectRank: 4, order: 12 });
    const elderCheck = sect.getPromotionCheck(elder);
    assert(
      elderCheck.canPromote === false && elderCheck.nextRank === null,
      "长老：已至极位，无下一级",
    );
  }

  // ---------- 4. 各系统吃到加成 ----------
  {
    // 修炼：青云长老 > 散修
    const baseGain = cultivation.getCultivationGain(mkPlayer());
    const qyGain = cultivation.getCultivationGain(mkPlayer({ sectId: "qingyun-men", sectRank: 4 }));
    assert(qyGain > baseGain, `青云长老修炼 ${qyGain} > 散修 ${baseGain}`);

    // 炼器：丹霞长老 > 散修（最小配方，仅取 baseSuccessRate）
    const recipe = { name: "试", baseSuccessRate: 0.5 };
    const baseRate = craft.getCraftSuccessRate(mkPlayer(), recipe);
    const dxRate = craft.getCraftSuccessRate(mkPlayer({ sectId: "danxia-gu", sectRank: 4 }), recipe);
    assert(dxRate > baseRate, `丹霞长老炼器成功率 ${dxRate.toFixed(2)} > 散修 ${baseRate.toFixed(2)}`);

    // 命中：金剑长老 > 散修（确定性）
    const baseHit = battle.getShotChance(mkPlayer(), "wooden-arrow", "chest");
    const jjHit = battle.getShotChance(mkPlayer({ sectId: "jinjian-sect", sectRank: 4 }), "wooden-arrow", "chest");
    assert(jjHit > baseHit, `金剑长老命中 ${jjHit.toFixed(2)} > 散修 ${baseHit.toFixed(2)}`);

    // 伤害：金剑长老均值 > 散修均值（含随机，取多次累计）
    const monster = monsters.getMonsterById("mist-fox");
    const sumDamage = (p) => {
      let total = 0;
      for (let i = 0; i < 300; i++) {
        total += battle.getPlayerShotDamage(p, monster, "wooden-arrow", "chest", 1).damage;
      }
      return total;
    };
    const baseDmg = sumDamage(mkPlayer());
    const jjDmg = sumDamage(mkPlayer({ sectId: "jinjian-sect", sectRank: 4 }));
    assert(jjDmg > baseDmg, `金剑长老伤害累计 ${jjDmg} > 散修 ${baseDmg}`);

    // 远征遍历成本：碧水长老掉血 < 散修（L1）
    const baseAfter = expedition.applyTraversalCost(mkPlayer(), 1);
    const bsAfter = expedition.applyTraversalCost(mkPlayer({ sectId: "bishui-palace", sectRank: 4 }), 1);
    assert(
      bsAfter.health.current > baseAfter.health.current,
      `碧水长老 L1 掉血更少（剩 ${bsAfter.health.current} > 散修 ${baseAfter.health.current}）`,
    );
  }

  // ---------- 5. 存档迁移 ----------
  {
    // 合法 sectRank 保留
    {
      store.clear();
      const player = mkPlayer({ sectId: "qingyun-men", sectRank: 3 });
      saveLoad.saveGame(player);
      const loaded = saveLoad.loadGame();
      assert(loaded.player.sectRank === 3, "迁移：合法 sectRank(3) 保留");
    }
    // 越界 sectRank → clamp 至 4
    {
      store.clear();
      const player = mkPlayer({ sectId: "qingyun-men", sectRank: 99 });
      saveLoad.saveGame(player);
      const loaded = saveLoad.loadGame();
      assert(loaded.player.sectRank === 4, "迁移：越界 sectRank(99) → clamp 4");
    }
    // 无宗门 → sectRank 恒 0
    {
      store.clear();
      const player = mkPlayer({ sectId: null, sectRank: 3 });
      saveLoad.saveGame(player);
      const loaded = saveLoad.loadGame();
      assert(loaded.player.sectRank === 0, "迁移：无宗门 sectRank → 0");
    }
    // 旧 v6 存档缺 sectRank → 默认 0
    {
      store.clear();
      const player = mkPlayer({ sectId: "qingyun-men", sectRank: 2 });
      saveLoad.saveGame(player);
      const raw = JSON.parse(store.get(SAVE_KEY));
      delete raw.player.sectRank;
      store.set(SAVE_KEY, JSON.stringify(raw));
      const loaded = saveLoad.loadGame();
      assert(loaded.player.sectRank === 0, "迁移：旧档缺 sectRank → 默认 0（不炸）");
    }
  }
} finally {
  await server.close();
}

console.log(
  process.exitCode ? "\n!!! 宗门系统冒烟：存在失败项" : "\n宗门系统冒烟：全部通过",
);
