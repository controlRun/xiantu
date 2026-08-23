// 丹毒系统冒烟测试：服丹累积/清除、修炼与突破惩罚、存档迁移
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
  const { useOutOfBattlePill } = await server.ssrLoadModule("/src/systems/pillSystem.ts");
  const { getPillToxicityPenalty, describePillToxicityPenalty, MAX_PILL_TOXICITY } = await server.ssrLoadModule("/src/systems/pillToxicitySystem.ts");
  const { getCultivationGain, getBreakthroughChance, useQiGatheringPill } = await server.ssrLoadModule("/src/systems/cultivationSystem.ts");
  const { useBattlePill, restPlayer, startArcheryBattle } = await server.ssrLoadModule("/src/systems/battleSystem.ts");
  const save = await server.ssrLoadModule("/src/utils/saveLoad.ts");

  // ---------- 1. 服丹累积与清除 ----------
  {
    const p = { ...createInitialPlayer(), inventory: [{ itemId: "healing-pill", quantity: 3 }] };
    const r1 = useOutOfBattlePill(p, "healing-pill");
    assert(r1.success && r1.player.pillToxicity === 5, "回春丹服用丹毒 +5");
    assert(r1.message.includes("丹毒 +5"), "服丹文案含丹毒累积");

    const p2 = { ...createInitialPlayer(), inventory: [{ itemId: "mind-cleansing-pill", quantity: 3 }], pillToxicity: 50 };
    const baseMind = p2.attributes.mind;
    const r2 = useOutOfBattlePill(p2, "mind-cleansing-pill");
    assert(r2.success && r2.player.pillToxicity === 10, "洗心丹化去丹毒 40（50→10）");
    assert(r2.player.attributes.mind === baseMind + 1, "洗心丹心境 +1");
    assert(r2.player.pillUseCounts["mind-cleansing-pill"] === 1, "洗心丹限次计数 1");
    const r2b = useOutOfBattlePill(r2.player, "mind-cleansing-pill");
    assert(r2b.success && r2b.player.pillUseCounts["mind-cleansing-pill"] === 2, "洗心丹二次服用成功（限次 2）");
    const r2c = useOutOfBattlePill(r2b.player, "mind-cleansing-pill");
    assert(r2c.success === false, "洗心丹三次服用被限");
  }

  // ---------- 2. 惩罚模型数值 ----------
  {
    const pen50 = getPillToxicityPenalty(50);
    assert(pen50.cultivationMul === 0.8, "丹毒 50 → 修炼倍率 0.8");
    assert(Math.abs(pen50.breakthroughPenalty - 0.075) < 1e-9, "丹毒 50 → 突破 −7.5%");
    assert(
      describePillToxicityPenalty(50).join("|") === "修炼效率 −20%|突破成功率 −8%",
      "面板文案：修炼 −20% / 突破 −8%",
    );
    assert(MAX_PILL_TOXICITY === 100, "丹毒上限 100");
  }

  // ---------- 3. 修炼与突破随丹毒下降 ----------
  {
    // 固定杂灵根 + 低属性：保证基准成功率在 0.95 封顶之下，惩罚可被观测
    const weakRoot = {
      elements: ["water"],
      grade: "mixed",
      purity: 38,
      cultivationMultiplier: 0.82,
      breakthroughBonus: -0.03,
      name: "杂水灵根",
      battleCritBonus: 0,
    };
    const base = {
      ...createInitialPlayer(),
      spiritualRoot: weakRoot,
      attributes: { ...createInitialPlayer().attributes, rootBone: 1, comprehension: 1, luck: 1, mind: 1 },
    };
    const g0 = getCultivationGain(base);
    const g50 = getCultivationGain({ ...base, pillToxicity: 50 });
    const g100 = getCultivationGain({ ...base, pillToxicity: 100 });
    assert(g0 > g50 && g50 > g100, "闭关修为收益随丹毒下降");
    const c0 = getBreakthroughChance(base);
    const c50 = getBreakthroughChance({ ...base, pillToxicity: 50 });
    const c100 = getBreakthroughChance({ ...base, pillToxicity: 100 });
    assert(c0 > c50 && c50 > c100, "突破成功率随丹毒下降");
  }

  // ---------- 4. 聚气丹 / 战中服丹 / 静养 ----------
  {
    const qi = { ...createInitialPlayer(), inventory: [{ itemId: "qi-gathering-pill", quantity: 1 }] };
    const qr = useQiGatheringPill(qi);
    assert(qr.success && qr.player.pillToxicity === 8, "聚气丹丹毒 +8");

    const bp = {
      ...createInitialPlayer(),
      inventory: [
        { itemId: "wooden-arrow", quantity: 5 },
        { itemId: "healing-pill", quantity: 1 },
      ],
    };
    let duel = startArcheryBattle(bp, "青石山脚", {
      arrowIds: ["wooden-arrow"],
      pillIds: ["healing-pill"],
      retreatRule: "never",
    });
    duel = { ...duel, playerHealth: 20 };
    const br = useBattlePill(bp, duel, "healing-pill");
    assert(br.player.pillToxicity === 5, "战中服回春丹丹毒 +5");

    const rp = { ...createInitialPlayer(), pillToxicity: 30 };
    const rr = restPlayer(rp);
    assert(rr.pillToxicity === 20, "静养化丹毒 10");
  }

  // ---------- 5. 存档迁移：旧档缺字段归 0，新档保留 ----------
  {
    const player = createInitialPlayer();
    player.pillToxicity = 25;
    const text = JSON.stringify(save.createSaveData(player));
    const parsed = save.parseImportedSave(text);
    assert(parsed?.player.pillToxicity === 25, "round-trip 保留丹毒值");

    const stripped = { ...player };
    delete stripped.pillToxicity;
    const parsed2 = save.parseImportedSave(JSON.stringify(save.createSaveData(stripped)));
    assert(parsed2?.player.pillToxicity === 0, "旧档缺 pillToxicity → 0");
  }
} finally {
  await server.close();
}
