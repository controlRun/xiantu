// 战斗状态冒烟测试：中毒/眩晕/破甲 的附加、跳伤、衰减与敌方反击施放
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
  const battle = await server.ssrLoadModule("/src/systems/battleSystem.ts");
  const { getArrowDefinition } = await server.ssrLoadModule("/src/data/arrows.ts");
  const { getItemDefinition } = await server.ssrLoadModule("/src/data/items.ts");
  const { getMonsterById } = await server.ssrLoadModule("/src/data/monsters.ts");

  const loadout = { arrowIds: ["poison-arrow", "thunder-arrow", "armorbreak-arrow"], pillIds: [], retreatRule: "never" };
  // 高血量桩怪：血厚抗揍，专供状态观测（行为 beast 档）
  const tank = {
    id: "smoke-tank",
    name: "烟木桩",
    area: "青石山脚",
    minRealmOrder: 0,
    maxRealmOrder: 99,
    health: 600,
    attack: 8,
    defense: 0,
    spiritStoneReward: [1, 2],
    cultivationReward: [10, 10],
    behavior: "beast",
    lootTable: [],
  };

  // ---------- 1. 数据完整性 ----------
  {
    for (const id of ["poison-arrow", "thunder-arrow", "armorbreak-arrow"]) {
      const def = getArrowDefinition(id);
      assert(def?.onHitStatus && def.onHitStatus.duration > 0, `${id} 定义含 onHitStatus`);
      assert(getItemDefinition(id)?.type === "arrow", `${id} 物品表可查`);
    }
    const poison = getArrowDefinition("poison-arrow");
    assert(poison.onHitStatus.kind === "poison" && poison.onHitStatus.damagePerRound > 0, "碧毒箭：中毒数值合法");
    assert(getArrowDefinition("thunder-arrow").onHitStatus.kind === "stun", "震雷箭：眩晕合法");
    const armor = getArrowDefinition("armorbreak-arrow");
    assert(armor.onHitStatus.kind === "armorbreak" && armor.onHitStatus.damageTakenBonus > 0, "裂甲箭：破甲数值合法");
    for (const id of ["rock-scaled-serpent", "heart-devourer", "nether-ghoul", "ancient-demon-lord"]) {
      const m = getMonsterById(id);
      assert(
        m.onHitStatus && m.onHitStatus.spec && m.onHitStatus.chance > 0 && m.onHitStatus.chance <= 1,
        `${id} onHitStatus 合法`,
      );
    }
  }

  // ---------- 2. 敌方中毒：附加 + 每回合跳伤 + 3 回合后衰减 ----------
  {
    const player = createInitialPlayer();
    let duel = battle.startArcheryBattle(player, "青石山脚", loadout, tank);
    let current = player;
    const hit = battle.applyPlayerShot(current, duel, "poison-arrow", {
      damage: 10,
      critical: false,
      targetName: "胸腹",
      targetId: "chest",
    });
    current = hit.player;
    duel = hit.duel;
    assert((duel.enemyStatuses?.poison?.stacks ?? 0) === 1, "碧毒箭命中挂上 1 层中毒");
    const m1 = duel.monsterHealth;
    assert(m1 < tank.health - 10, "中毒当回合敌方即掉跳伤");

    const skip1 = battle.skipPlayerShot(current, duel, "测试空过");
    current = skip1.player;
    duel = skip1.duel;
    const m2 = duel.monsterHealth;
    assert(m2 === m1 - 4, "第二回合敌方毒发再跳 4 伤");

    const skip2 = battle.skipPlayerShot(current, duel, "测试空过");
    current = skip2.player;
    duel = skip2.duel;
    const m3 = duel.monsterHealth;
    assert(m3 === m2 - 4, "第三回合敌方毒发再跳 4 伤");
    assert((duel.enemyStatuses?.poison?.stacks ?? 0) === 0, "中毒持续 3 回合后衰减清除");
  }

  // ---------- 3. 眩晕：抑制敌方本回合反击 ----------
  {
    const player = createInitialPlayer();
    const duel = battle.startArcheryBattle(player, "青石山脚", loadout, tank);
    const res = battle.applyPlayerShot(player, duel, "thunder-arrow", {
      damage: 8,
      critical: false,
      targetName: "胸腹",
      targetId: "chest",
    });
    assert(res.duel.logs.some((l) => l.includes("晕眩")), "震雷箭命中眩晕生效");
    assert(res.duel.lastEnemyShot === undefined, "眩晕回合敌方无力反击");
    assert(res.player.health.current === player.health.current, "眩晕回合玩家未受伤");
  }

  // ---------- 4. 破甲：后续伤害提升 + 状态流转 ----------
  {
    const player = createInitialPlayer();
    // 公式对照：同箭/同部位/同蓄力，40 次抽样均值，破甲后显著更高
    let sum0 = 0;
    let sum1 = 0;
    for (let i = 0; i < 40; i++) {
      sum0 += battle.getPlayerShotDamage(player, tank, "iron-arrow", "chest", 1, 0).damage;
      sum1 += battle.getPlayerShotDamage(player, tank, "iron-arrow", "chest", 1, 1).damage;
    }
    assert(sum1 > sum0, "破甲层数提升我方命中伤害（40 次抽样）");

    let duel = battle.startArcheryBattle(player, "青石山脚", loadout, tank);
    const res = battle.applyPlayerShot(player, duel, "armorbreak-arrow", {
      damage: 6,
      critical: false,
      targetName: "胸腹",
      targetId: "chest",
    });
    assert((res.duel.enemyStatuses?.armorbreak?.stacks ?? 0) === 1, "裂甲箭命中挂上破甲");
    const shot = battle.shootArrow(res.player, res.duel, "iron-arrow", "chest", 1);
    assert(shot.pendingDamage !== null, "破甲状态下再射一箭产出 pendingDamage");
  }

  // ---------- 5. 敌方 onHitStatus：反击命中给玩家挂状态 ----------
  {
    const player = createInitialPlayer();
    player.health.current = 500;
    player.health.max = 500;
    const venomous = {
      ...tank,
      name: "毒烟兽",
      attack: 40,
      onHitStatus: { spec: { kind: "poison", duration: 3, damagePerRound: 4 }, chance: 1 },
    };
    let duel = battle.startArcheryBattle(player, "青石山脚", loadout, venomous);
    let current = player;
    let gotPoison = false;
    for (let i = 0; i < 12 && !gotPoison; i++) {
      const skip = battle.skipPlayerShot(current, duel, "测试空过");
      current = skip.player;
      duel = skip.duel;
      gotPoison = (duel.playerStatuses?.poison?.stacks ?? 0) > 0;
      if (skip.battleResult) break;
    }
    assert(gotPoison, "毒系怪反击命中后玩家挂上中毒");
  }

  // ---------- 6. 玩家中毒跳伤不下限 ----------
  {
    const player = createInitialPlayer();
    const weak = { ...tank, attack: 0 };
    let duel = battle.startArcheryBattle(player, "青石山脚", loadout, weak);
    duel = {
      ...duel,
      playerHealth: 5,
      playerStatuses: { poison: { stacks: 3, expireRound: duel.round + 20 } },
    };
    let current = player;
    const skip = battle.skipPlayerShot(current, duel, "测试空过");
    current = skip.player;
    duel = skip.duel;
    assert(duel.playerHealth === 1, "3 层中毒跳伤将玩家血下压至下限 1（不死）");
    assert(current.health.current === 1, "玩家对象血量同步下限 1");
  }
} finally {
  await server.close();
}
