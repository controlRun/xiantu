// 对战箭矢路由冒烟测试：实物箭「破灵箭」(spirit-piercing-arrow) 与灵力箭 (spirit-*) 的分流
//
// 回归背景：isSpiritArrowId 曾按 "spirit-" 前缀粗判，破灵箭 id 恰好以 spirit- 开头，
// 被误判为灵力箭 → getSpiritArrowTier 落空 → getCombatArrow 返回 undefined →
// shootArrow 以「没有这种箭矢」拒发（不扣箭、无伤害、无敌方回合），
// 战斗卡死在命中演出之后。本测试锁死该分流，防止命名碰撞复发。
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
  const spiritArrows = await server.ssrLoadModule("/src/data/spiritArrows.ts");
  const battle = await server.ssrLoadModule("/src/systems/battleSystem.ts");
  const inv = await server.ssrLoadModule("/src/systems/inventorySystem.ts");

  const qty = (player, id) => inv.getInventoryQuantity(player.inventory, id);

  /** 初始玩家（持铁木剑，兼容破灵箭）补上一筒破灵箭，复刻真实可选路径 */
  const mkPlayer = () => {
    const base = createInitialPlayer();
    return {
      ...base,
      health: { current: 500, max: 500 },
      mana: { current: 100, max: 100 },
      inventory: inv.addItemStacks(base.inventory, [
        { itemId: "spirit-piercing-arrow", quantity: 10 },
      ]),
    };
  };

  // ---------- 1. isSpiritArrowId：前缀碰撞不再误判 ----------
  {
    assert(
      spiritArrows.isSpiritArrowId("spirit-piercing-arrow") === false,
      "破灵箭 (spirit-piercing-arrow) 判为实物箭（false）",
    );
    for (const id of ["spirit-qi", "spirit-gather", "spirit-light", "spirit-void"]) {
      assert(spiritArrows.isSpiritArrowId(id) === true, `灵力箭 ${id} 判为 true`);
    }
    for (const id of ["wooden-arrow", "iron-arrow", "serpent-scale-arrow"]) {
      assert(spiritArrows.isSpiritArrowId(id) === false, `实物箭 ${id} 判为 false`);
    }
  }

  // ---------- 2. getCombatArrow：破灵箭走实物理线路 ----------
  {
    const player = mkPlayer();
    const pierce = battle.getCombatArrow(player, "spirit-piercing-arrow");
    assert(pierce !== undefined, "破灵箭能解析出战斗箭（非 undefined）");
    assert(
      pierce?.power === 30 && pierce?.spirit === false,
      `破灵箭威力 30、实物箭标志（实得 power=${pierce?.power} spirit=${pierce?.spirit}）`,
    );
    const spirit = battle.getCombatArrow(player, "spirit-qi");
    assert(spirit?.spirit === true, "凝气箭仍走灵力箭路线（spirit=true）");
    assert(
      battle.getCombatArrow(player, "no-such-arrow") === undefined,
      "未知箭矢仍返回 undefined",
    );
  }

  // ---------- 3. 命中率采用破灵箭自身准度（0.62，非木箭兜底 0.88） ----------
  {
    const player = mkPlayer();
    const pierceHit = battle.getShotChance(player, "spirit-piercing-arrow", "chest");
    const woodenHit = battle.getShotChance(player, "wooden-arrow", "chest");
    assert(
      pierceHit < woodenHit,
      `破灵箭命中 (${pierceHit.toFixed(2)}) 低于木箭 (${woodenHit.toFixed(2)})（未退回木箭兜底）`,
    );
  }

  // ---------- 4. 战前整备：破灵箭可被选入参战 ----------
  {
    const player = mkPlayer();
    const available = battle.getAvailableArrowsForBattle(player);
    assert(
      available.some((arrow) => arrow.itemId === "spirit-piercing-arrow"),
      "破灵箭出现在可用箭列表（UI 可选）",
    );
  }

  // ---------- 5. shootArrow：消耗一支 + 产出待生效伤害 ----------
  {
    const player = mkPlayer();
    const duel = battle.startArcheryBattle(player);
    const before = qty(player, "spirit-piercing-arrow");
    const shot = battle.shootArrow(player, duel, "spirit-piercing-arrow", "chest", 1);
    assert(
      shot.pendingDamage && shot.pendingDamage.damage > 0,
      `破灵箭产出待生效伤害（damage=${shot.pendingDamage?.damage}）`,
    );
    assert(
      qty(shot.player, "spirit-piercing-arrow") === before - 1,
      "破灵箭消耗一支",
    );
  }

  // ---------- 6. 命中结算全链路：applyPlayerShot 推进回合，不卡死 ----------
  {
    let allAdvanced = true;
    for (let i = 0; i < 20; i++) {
      const player = mkPlayer();
      let duel = battle.startArcheryBattle(player);
      const roundBefore = duel.round;
      const shot = battle.shootArrow(player, duel, "spirit-piercing-arrow", "chest", 1);
      if (!shot.pendingDamage) {
        allAdvanced = false;
        break;
      }
      const applied = battle.applyPlayerShot(
        shot.player,
        shot.duel,
        "spirit-piercing-arrow",
        shot.pendingDamage,
      );
      // 推进 = 回合 +1 或本局终结；两者皆无即「卡死」
      const advanced =
        applied.duel.round === roundBefore + 1 || applied.duel.finished;
      if (!advanced) {
        allAdvanced = false;
        console.error(
          `  第 ${i} 次：回合 ${roundBefore}→${applied.duel.round} finished=${applied.duel.finished}（未推进）`,
        );
      }
    }
    assert(allAdvanced, "破灵箭命中结算 20 次：每次都推进回合或终结（无卡死）");
  }

  // ---------- 7. 灵力箭管线未受波及：凝气箭耗灵 + 产出伤害 ----------
  {
    const player = mkPlayer(); // mana 100/100，凡人 realm order 0 —— 凝气箭需 order≥1
    const cultivator = { ...player, realmId: "qi-refining-1" };
    const duel = battle.startArcheryBattle(cultivator);
    const manaBefore = cultivator.mana.current;
    const shot = battle.shootArrow(cultivator, duel, "spirit-qi", "chest", 1);
    assert(
      shot.pendingDamage && shot.pendingDamage.damage > 0,
      `凝气箭产出待生效伤害（damage=${shot.pendingDamage?.damage}）`,
    );
    assert(
      shot.player.mana.current < manaBefore,
      `凝气箭消耗灵力（${manaBefore}→${shot.player.mana.current}）`,
    );
    assert(
      qty(shot.player, "spirit-piercing-arrow") === qty(cultivator, "spirit-piercing-arrow"),
      "凝气箭不动箭囊（破灵箭数量不变）",
    );
  }
} finally {
  await server.close();
}

console.log(
  process.exitCode ? "\n!!! 箭矢路由冒烟：存在失败项" : "\n箭矢路由冒烟：全部通过",
);
