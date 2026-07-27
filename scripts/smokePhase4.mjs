// 四期数值平衡冒烟测试：战力派生 / 难度分档 / 区间表 / 各境界池梯度
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
  const { realms } = await server.ssrLoadModule("/src/data/realms.ts");
  const { getMonstersForRealmOrder, getSecretRealmBoss } =
    await server.ssrLoadModule("/src/data/monsters.ts");
  const { REALM_POWER_BANDS, getRealmPowerBand, getMonsterTypicalOrder } =
    await server.ssrLoadModule("/src/data/balance.ts");
  const power = await server.ssrLoadModule("/src/systems/powerSystem.ts");
  const inv = await server.ssrLoadModule("/src/systems/inventorySystem.ts");

  const realmList = [...realms].sort((a, b) => a.order - b.order);

  /** 典型玩家：中位资质 + 累计突破奖励 + 对应阶段的代表性箭矢 */
  const typical = (order) => {
    const base = createInitialPlayer();
    let hp = 100;
    let mp = 30;
    for (const realm of realmList) {
      if (realm.order === 0 || realm.order > order) continue;
      hp += realm.rewards.health;
      mp += realm.rewards.mana;
    }
    const items = [{ itemId: "iron-arrow", quantity: 30 }];
    if (order >= 4) items.push({ itemId: "serpent-scale-arrow", quantity: 10 });
    if (order >= 7) items.push({ itemId: "spirit-piercing-arrow", quantity: 6 });
    return {
      ...base,
      realmId: realmList[order].id,
      attributes: {
        rootBone: 6,
        comprehension: 6,
        luck: 6,
        mind: 7,
        divineSense: 5,
      },
      health: { current: hp, max: hp },
      mana: { current: mp, max: mp },
      inventory: inv.addItemStacks(base.inventory, items),
    };
  };

  // ---------- 1. 战力随境界单调不降 ----------
  {
    const powers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((order) =>
      power.getPlayerPower(typical(order)),
    );
    const monotonic = powers.every(
      (value, index) => index === 0 || value >= powers[index - 1],
    );
    assert(monotonic, `战力随境界单调不降（${powers.join(", ")}）`);
    assert(powers[12] > powers[0] * 3, "筑基后期战力远超凡人（>3 倍）");
  }

  // ---------- 2. 难度分档阈值（固定假怪，精确对拍公式） ----------
  {
    const dummy = { health: 100, attack: 10 };
    const easy = power.getMonsterDifficulty(dummy, 200);
    const even = power.getMonsterDifficulty(dummy, 150);
    const tough = power.getMonsterDifficulty(dummy, 120);
    const deadly = power.getMonsterDifficulty(dummy, 90);
    assert(
      easy.label === "easy" && easy.ratio === 0.66,
      `战力 200 → 轻松（ratio ${easy.ratio}）`,
    );
    assert(
      even.label === "even" && even.ratio === 0.87,
      `战力 150 → 势均力敌（ratio ${even.ratio}）`,
    );
    assert(
      tough.label === "tough" && tough.ratio === 1.09,
      `战力 120 → 吃力（ratio ${tough.ratio}）`,
    );
    assert(
      deadly.label === "deadly" && deadly.ratio === 1.46,
      `战力 90 → 凶险（ratio ${deadly.ratio}）`,
    );
  }

  // ---------- 3. 区间表完整性与边界收敛 ----------
  {
    assert(REALM_POWER_BANDS.length === 13, "区间表覆盖 order 0–12");
    assert(
      REALM_POWER_BANDS.every(
        (entry, index) =>
          entry.order === index && entry.band[0] < entry.band[1],
      ),
      "区间表 order 连续且下界 < 上界",
    );
    assert(getRealmPowerBand(-3).order === 0, "负境界收敛至凡人档");
    assert(getRealmPowerBand(99).order === 12, "超高境界收敛至筑基后期档");
  }

  // ---------- 4. 各境界同档池梯度：中位难度不越「凶险」 ----------
  {
    let allOk = true;
    for (const order of [0, 1, 3, 6, 9, 10, 12]) {
      const pool = getMonstersForRealmOrder(order);
      const median = power.getPoolDifficulty(
        pool,
        power.getPlayerPower(typical(order)),
      );
      if (!median || median.ratio > 1.4) {
        allOk = false;
        console.error(
          `  order ${order}: 中位 ratio ${median?.ratio}（${median?.text}）越过凶险线`,
        );
      }
    }
    assert(allOk, "order 0/1/3/6/9/10/12 同档池中位难度均在凶险线内");

    // 低档玩家摸高档池应当吃力/凶险（难度曲线向上）
    const lowPower = power.getPlayerPower(typical(3));
    const highPool = getMonstersForRealmOrder(8);
    const highMedian = power.getPoolDifficulty(highPool, lowPower);
    assert(
      highMedian && highMedian.ratio >= 1.0,
      `炼气三层战力摸炼气八层池 → 吃力起步（ratio ${highMedian?.ratio}）`,
    );
  }

  // ---------- 5. Boss 难度曲线：入门凶险、筑基吃力 ----------
  {
    const boss = getSecretRealmBoss();
    const atNine = power.getMonsterDifficulty(
      boss,
      power.getPlayerPower(typical(9)),
    );
    const atTen = power.getMonsterDifficulty(
      boss,
      power.getPlayerPower(typical(10)),
    );
    assert(atNine.ratio >= 1.4, `炼气九层首探秘境 → 凶险（ratio ${atNine.ratio}）`);
    assert(
      atTen.label === "tough",
      `筑基初期再战石傀 → 吃力（ratio ${atTen.ratio}）`,
    );
    assert(
      getMonsterTypicalOrder(boss) === 11,
      "Boss 代表境界按封顶 12 折算为中点 11",
    );
  }

  // ---------- 6. 最强箭威力：随解锁 progression 成长 ----------
  {
    const mortal = typical(0);
    assert(
      power.getBestArrowPower(mortal) === 18,
      "凡人最强箭为铁箭（power 18）",
    );
    const bare = {
      ...createInitialPlayer(),
      inventory: [],
    };
    assert(power.getBestArrowPower(bare) === 0, "空箭囊且未解锁灵力箭 → 0");
    const foundation = typical(10);
    assert(
      power.getBestArrowPower(foundation) === 48,
      "筑基初期最强箭为破虚箭（26 + 10×2.2 = 48）",
    );
  }
} finally {
  await server.close();
}
