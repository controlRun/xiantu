// 寿元耗尽（坐化）冒烟：isPlayerDead 判定边界 + 终态契约
//
// 回归背景：寿元此前只推进年龄、显示余量为 0，却无任何失败/结局机制。
// 本测试锁死：age ≥ lifespan 即坐化（等号成立）、差一日尚存、突破加寿后的
// 终态不误报（查「提交的最终状态」而非中间量），且 getRemainingYears 仍夹 0。
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
  const time = await server.ssrLoadModule("/src/systems/timeSystem.ts");

  const fresh = createInitialPlayer(); // age 16 / lifespan 80

  // ---------- 1. 新角色尚存 ----------
  assert(time.isPlayerDead(fresh) === false, "新角色（16/80）未坐化");

  // ---------- 2. 等号边界：恰耗尽即坐化 ----------
  {
    const aged = time.advanceTime(fresh, 64 * 360); // +64 年 → age 80
    assert(
      aged.age === 80 && time.isPlayerDead(aged) === true,
      `寿元恰耗尽（age ${aged.age}）→ 坐化`,
    );
  }

  // ---------- 3. 差一日尚存 ----------
  {
    const almost = time.advanceTime(fresh, 64 * 360 - 1);
    assert(
      almost.age < 80 && time.isPlayerDead(almost) === false,
      `差一日（age ${almost.age}）→ 尚存`,
    );
  }

  // ---------- 4. 终态契约：突破加寿后不误报 ----------
  {
    // 模拟 cultivationSystem 突破：增龄与加寿落在同一最终对象上
    const brokeThrough = { ...fresh, age: 79.9, lifespan: 80 + 100 };
    assert(
      time.isPlayerDead(brokeThrough) === false,
      "突破加寿后的终态（79.9/180）不误报坐化",
    );
  }

  // ---------- 5. 余量显示仍夹 0 ----------
  {
    const dead = time.advanceTime(fresh, 100 * 360);
    assert(
      time.getRemainingYears(dead) === 0,
      "坐化后 getRemainingYears 夹至 0",
    );
  }
} finally {
  await server.close();
}

console.log(
  process.exitCode ? "\n!!! 寿元冒烟：存在失败项" : "\n寿元冒烟：全部通过",
);
