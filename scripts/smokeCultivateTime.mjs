// 闭关时间条冒烟：cultivate(months) 折算 / 寿元封顶 / 夹值 / formatMonths
//
// 回归背景：修炼由「一次 7 日」改为滑块选择闭关时长（1 个月 ~ 20 年）。
// 锁死：线性折算 floor(gain7×days/7)、境界瓶颈封顶、寿元 cap（出关不尽寿）、
// 非法 months 夹值回落、时长格式。
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
  const { getRealmById } = await server.ssrLoadModule("/src/data/realms.ts");
  const cultivation = await server.ssrLoadModule("/src/systems/cultivationSystem.ts");
  const timeSys = await server.ssrLoadModule("/src/systems/timeSystem.ts");

  /** 造一个指定境界、修为归零的玩家（高境界便于测未封顶折算） */
  const mkPlayer = (realmId, extra = {}) => {
    const base = createInitialPlayer();
    const realm = getRealmById(realmId);
    return {
      ...base,
      realmId,
      cultivation: {
        current: 0,
        required: realm.breakthrough.requiredCultivation,
        lastGain: 0,
      },
      ...extra,
    };
  };

  // ---------- 1. formatMonths ----------
  {
    assert(timeSys.formatMonths(1) === "1个月", "formatMonths(1) = 1个月");
    assert(timeSys.formatMonths(8) === "8个月", "formatMonths(8) = 8个月");
    assert(timeSys.formatMonths(12) === "1年", "formatMonths(12) = 1年");
    assert(timeSys.formatMonths(42) === "3年6个月", "formatMonths(42) = 3年6个月");
    assert(timeSys.formatMonths(240) === "20年", "formatMonths(240) = 20年");
  }

  // ---------- 2. 寿元封顶 getCultivateMonthsCap ----------
  {
    // 初始角色：龄 16 寿 80，剩余 64 年 → 撞版本硬上限 240 月
    assert(
      cultivation.getCultivateMonthsCap(createInitialPlayer()) === 240,
      "初始角色（剩余64年）上限 = 240 月（20年）",
    );
    // 剩余恰 5 年 → 60−1 = 59 月（留 1 月余量防坐化）
    const five = { ...createInitialPlayer(), age: 75 };
    assert(
      cultivation.getCultivateMonthsCap(five) === 59,
      "剩余恰 5 年 → 上限 59 月（留余量）",
    );
    // 剩余 0.1 年（36 日）→ ceil(1.2)−1 = 1 月
    const near = { ...createInitialPlayer(), age: 79.9 };
    assert(
      cultivation.getCultivateMonthsCap(near) === 1,
      "剩余 0.1 年 → 上限 1 月",
    );
    // 剩余 0.05 年（18 日，不足最短闭关）→ 0，前端禁用
    const done = { ...createInitialPlayer(), age: 79.95 };
    assert(
      cultivation.getCultivateMonthsCap(done) === 0,
      "剩余不足约 1 月 → 上限 0（禁闭关）",
    );
  }

  // ---------- 3. 线性折算与瓶颈封顶 ----------
  {
    const p = mkPlayer("foundation-late"); // 需 4800，初始资质撞不到顶
    const gain7 = cultivation.getCultivationGain(p);
    const preview1 = cultivation.getCultivateGainForMonths(p, 1);
    assert(preview1.days === 30, "1 个月 = 30 日");
    assert(
      preview1.raw === Math.max(1, Math.floor((gain7 / 7) * 30)),
      "预览毛收益 = floor(gain7×30/7)",
    );
    assert(!preview1.capped, "高境界 1 个月未触瓶颈");

    const after1 = cultivation.cultivate(p, 1);
    assert(
      after1.cultivation.lastGain === preview1.gain,
      "实修收益与预览同源一致",
    );
    assert(
      Math.abs(after1.age - (p.age + 30 / timeSys.DAYS_PER_YEAR)) < 0.001,
      "闭关 1 个月增龄 30/360 年",
    );
    assert(
      after1.stats.lastCultivateDay === timeSys.getGameDay(after1),
      "闭关写入 lastCultivateDay（推进后游戏日）",
    );

    // 6 个月：按公式断，不断整倍（floor 有误差）
    const preview6 = cultivation.getCultivateGainForMonths(p, 6);
    assert(
      preview6.raw === Math.max(1, Math.floor((gain7 / 7) * 180)),
      "6 个月毛收益 = floor(gain7×180/7)",
    );

    // 瓶颈封顶：低境界缺口有限，20 年远超 → gain = required−current 且 capped
    const low = mkPlayer("qi-refining-1");
    const headroom = getRealmById("qi-refining-1").breakthrough.requiredCultivation;
    const previewCap = cultivation.getCultivateGainForMonths(low, 240);
    assert(previewCap.capped, "低境界 20 年触瓶颈 capped");
    assert(previewCap.gain === headroom, "封顶收益 = 境界缺口");
    const afterCap = cultivation.cultivate(low, 240);
    assert(
      afterCap.cultivation.current === headroom &&
        afterCap.cultivation.lastGain === headroom,
      "封顶实修：修为恰至瓶颈",
    );
    assert(
      Math.abs(afterCap.age - (low.age + 20)) < 0.001,
      "闭关 20 年增龄恰 20",
    );
  }

  // ---------- 4. 夹值：越界与非法 months ----------
  {
    const p = mkPlayer("foundation-late");
    const cap = cultivation.getCultivateMonthsCap(p);
    const over = cultivation.cultivate(p, 999);
    assert(
      Math.abs(over.age - (p.age + (cap * 30) / timeSys.DAYS_PER_YEAR)) < 0.001,
      "months=999 被夹至寿元/版本上限",
    );
    const nan1 = cultivation.cultivate(p, Number.NaN);
    assert(
      Math.abs(nan1.age - (p.age + 30 / timeSys.DAYS_PER_YEAR)) < 0.001,
      "months=NaN 回落 1 个月（不产生 NaN 增龄）",
    );
    const nan2 = cultivation.cultivate(p, undefined);
    assert(
      Math.abs(nan2.age - (p.age + 30 / timeSys.DAYS_PER_YEAR)) < 0.001,
      "months=undefined 回落 1 个月",
    );
    const zero = cultivation.cultivate(p, 0);
    assert(
      Math.abs(zero.age - (p.age + 30 / timeSys.DAYS_PER_YEAR)) < 0.001,
      "months=0 夹至下限 1 个月",
    );
  }
} finally {
  await server.close();
}

console.log(
  process.exitCode ? "\n!!! 闭关时间条冒烟：存在失败项" : "\n闭关时间条冒烟：全部通过",
);
