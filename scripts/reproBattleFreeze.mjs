// 对战卡死复现台：jsdom 实装 BattleScreen，走真实 rAF 弹道与指针事件链。
// 每射一箭后检查回合/血量是否推进，捕获一切异常（rAF 回调 / React 渲染）。
import { JSDOM } from "jsdom";

const dom = new JSDOM(
  "<!doctype html><html><body><div id='root'></div></body></html>",
  { pretendToBeVisual: true, url: "http://localhost/" },
);
const { window } = dom;

// ---------- 全局桥接 ----------
global.window = window;
global.document = window.document;
Object.defineProperty(global, "navigator", {
  value: window.navigator,
  configurable: true,
  writable: true,
});
for (const key of [
  "HTMLElement",
  "Element",
  "SVGElement",
  "Node",
  "Event",
  "CustomEvent",
  "DOMPoint",
  "DOMMatrix",
  "getComputedStyle",
  "MutationObserver",
]) {
  if (window[key] !== undefined) global[key] = window[key];
}

const capturedErrors = [];
const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  capturedErrors.push(args.map(String).join(" "));
  originalConsoleError(...args);
};
process.on("uncaughtException", (err) => {
  capturedErrors.push(`uncaughtException: ${err?.stack ?? err}`);
  originalConsoleError("UNCAUGHT EXCEPTION:", err);
});

// rAF 回调包裹：任何异常都记录在案（战斗管线的异常几乎都出在 rAF 回调里）
const originalRaf = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = (cb) =>
  originalRaf((t) => {
    try {
      cb(t);
    } catch (err) {
      capturedErrors.push(`rAF error: ${err?.stack ?? err}`);
      originalConsoleError("!!! rAF CALLBACK THREW:", err);
    }
  });
global.requestAnimationFrame = window.requestAnimationFrame;
global.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);

window.matchMedia =
  window.matchMedia ??
  (() => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
window.Element.prototype.setPointerCapture = function () {};
window.Element.prototype.releasePointerCapture = function () {};
// jsdom 无 DOMPoint：以恒等变换兜底（配合 getScreenCTM 桩，client 坐标 = SVG 坐标）
class IdentityPoint {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  matrixTransform() {
    return { x: this.x, y: this.y };
  }
}
if (!window.DOMPoint) window.DOMPoint = IdentityPoint;
if (!global.DOMPoint) global.DOMPoint = IdentityPoint;
window.SVGSVGElement.prototype.getScreenCTM = function () {
  return { inverse: () => ({}) };
};

// ---------- 加载真实模块 ----------
const { createServer } = await import("vite");
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { createElement: h, useState, useRef, useEffect } = React;

const bs = await server.ssrLoadModule("/src/components/battle/BattleScreen.tsx");
const battle = await server.ssrLoadModule("/src/systems/battleSystem.ts");
const inv = await server.ssrLoadModule("/src/systems/inventorySystem.ts");
const { createInitialPlayer } = await server.ssrLoadModule("/src/data/initialPlayer.ts");
const physics = await server.ssrLoadModule("/src/utils/arrowPhysics.ts");
const layout = await server.ssrLoadModule("/src/components/battle/battleLayout.ts");

/**
 * 必中瞄准点：与敌方回合同法反解弹道（solveLaunchDirection 低仰角解），
 * 取弓口沿发射方向 100px 处为瞄准点。鼠标指哪打哪 → 弹道必过敌身 → 几何必中，
 * 让复现台箭箭命中，专打"命中后结算"这条管线。
 */
const solveAimPoint = () => {
  const solution = physics.solveLaunchDirection(
    layout.BOW_ORIGIN.x,
    layout.BOW_ORIGIN.y,
    layout.ENEMY_X,
    layout.ENEMY_BODY_Y,
    physics.launchSpeed(1),
  );
  if (!solution) {
    return { x: layout.ENEMY_X, y: layout.ENEMY_BODY_Y };
  }
  return {
    x: layout.BOW_ORIGIN.x + solution.dirX * 100,
    y: layout.BOW_ORIGIN.y + solution.dirY * 100,
  };
};

// ---------- 迷你 App：与 App.tsx 同形的处理器 ----------
const api = { player: null, duel: null, battleResult: null, endedWith: "unset" };

function Harness({ seed }) {
  const [player, setPlayer] = useState(seed.player);
  const [duel, setDuel] = useState(seed.duel);
  const [battleResult, setBattleResult] = useState(null);
  const playerRef = useRef(player);
  playerRef.current = player;
  const duelRef = useRef(duel);
  duelRef.current = duel;

  useEffect(() => {
    api.player = player;
    api.duel = duel;
    api.battleResult = battleResult;
  });

  const run = (label, fn) => {
    const result = fn(playerRef.current, duelRef.current);
    console.log(
      `  [${label}] ${result.message} | 敌血 ${result.duel.monsterHealth} | 我血 ${result.duel.playerHealth} | 回合 ${result.duel.round} | finished=${result.duel.finished}`,
    );
    setPlayer(result.player);
    setDuel(result.duel);
    if (result.battleResult) setBattleResult(result.battleResult);
    return result;
  };

  return h(bs.BattleScreen, {
    duel,
    player,
    availableArrows: battle.getBattlePhysicalArrows(player, duel),
    spiritArrows: battle.getBattleSpiritArrows(player, duel),
    onShoot: (arrowId, zoneId, drawPower) =>
      run("shoot", (p, d) => battle.shootArrow(p, d, arrowId, zoneId, drawPower)),
    onApplyShot: (arrowId, pendingDamage) =>
      run("apply", (p, d) => battle.applyPlayerShot(p, d, arrowId, pendingDamage)),
    onSkipShot: (reason) =>
      run("skip", (p, d) => battle.skipPlayerShot(p, d, reason)),
    onUsePill: (pillItemId) =>
      run("pill", (p, d) => battle.useBattlePill(p, d, pillItemId)),
    onAutoRetreat: (reason) => {
      const result = battle.retreatFromBattle(playerRef.current, {
        ...duelRef.current,
        logs: [...duelRef.current.logs, reason],
      });
      setPlayer(result.player);
      setBattleResult(result.battleResult);
    },
    onBattleEnd: (result) => {
      api.endedWith = result ?? "manual-exit";
    },
    battleResult,
  });
}

// ---------- 事件工具 ----------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const svg = () => document.querySelector("svg");

const fire = (type, props = {}) => {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(event, key, { value });
  }
  svg().dispatchEvent(event);
};

// ---------- 主流程 ----------
const root = createRoot(document.getElementById("root"));
const seedPlayer = createInitialPlayer();
seedPlayer.inventory = inv.addItemStacks(seedPlayer.inventory, [
  { itemId: "iron-arrow", quantity: 999 },
]);

let battleIndex = 0;
let stuck = false;

const startBattle = () => {
  battleIndex += 1;
  api.endedWith = "unset";
  const duel = battle.startArcheryBattle(
    api.player ?? seedPlayer,
    undefined,
    { arrowIds: ["iron-arrow"], pillIds: [], retreatRule: "never" },
  );
  // 与 main.tsx 一致：StrictMode 开发态双调用，摇出副作用不纯的隐患
  root.render(
    h(
      React.StrictMode,
      null,
      h(Harness, {
        key: battleIndex,
        seed: { player: api.player ?? seedPlayer, duel },
      }),
    ),
  );
  console.log(`\n===== 第 ${battleIndex} 场：${duel.monster.name}（HP ${duel.monster.health}） =====`);
};

const shootOnce = async (label, fireFn) => {
  const before = api.duel;
  const roundBefore = before.round;
  const mhBefore = before.monsterHealth;
  const phBefore = before.playerHealth;

  await fireFn();
  // 轮询推进（最长 9s）：一有变化立刻返回，模拟真人玩家见缝插针的连射手速
  const deadline = Date.now() + 9000;
  let after = api.duel;
  while (Date.now() < deadline) {
    after = api.duel;
    if (
      after.round !== roundBefore ||
      after.monsterHealth !== mhBefore ||
      after.playerHealth !== phBefore ||
      after.finished ||
      api.endedWith !== "unset"
    ) {
      break;
    }
    await sleep(100);
  }
  // 留出敌方回合复位时间再判定（回合推进但相位可能还在 enemyTurn）
  await sleep(400);
  after = api.duel;
  const progressed =
    after.round !== roundBefore ||
    after.monsterHealth !== mhBefore ||
    after.playerHealth !== phBefore ||
    after.finished ||
    api.endedWith !== "unset";

  console.log(
    `${label}: 回合 ${roundBefore}→${after.round} | 敌血 ${mhBefore}→${after.monsterHealth} | 我血 ${phBefore}→${after.playerHealth} | finished=${after.finished} | ${progressed ? "推进 ✓" : "!!! 卡死"}\n最近战报: ${after.logs.slice(-2).join(" / ")}`,
  );

  if (!progressed) {
    stuck = true;
    console.error("!!! 复现卡死：一箭之后回合/血量/结束态全无变化");
  }
  return progressed;
};

const mouseShot = () =>
  shootOnce("[鼠标·必中]", async () => {
    const aim = solveAimPoint();
    // 指哪打哪：先把准星移到必中瞄准点，再按下等满蓄自动释放
    fire("pointermove", {
      pointerType: "mouse",
      pointerId: 1,
      clientX: aim.x,
      clientY: aim.y,
    });
    await sleep(30);
    fire("pointerdown", { pointerType: "mouse", pointerId: 1 });
    await sleep(1700); // 等满蓄自动释放（DRAW_DURATION 1500 + 100）
  });

const touchShot = () =>
  shootOnce("[触屏·拖拽]", async () => {
    fire("pointerdown", { pointerType: "touch", pointerId: 7, clientX: 120, clientY: 320 });
    await sleep(60);
    for (let i = 1; i <= 6; i += 1) {
      fire("pointermove", {
        pointerType: "touch",
        pointerId: 7,
        clientX: 120 - i * 20,
        clientY: 320 + i * 9,
      });
      await sleep(30);
    }
    await sleep(80);
    fire("pointerup", { pointerType: "touch", pointerId: 7 });
  });

// 与真人一致：看见准星（轨迹预览出现 = 瞄准相位就绪）才放下一箭
const waitForReady = async (timeoutMs = 12000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (document.querySelector(".trajectory-preview")) return true;
    await sleep(80);
  }
  return false;
};

try {
  for (let shot = 0; shot < 36 && !stuck; shot += 1) {
    if (!api.duel || api.duel.finished || api.endedWith !== "unset") {
      startBattle();
      await sleep(400); // 挂载 + START_AIMING
    }
    const ready = await waitForReady();
    if (!ready) {
      stuck = true;
      console.error(
        `!!! 复现卡死：等待瞄准就绪超时（当前回合 ${api.duel?.round}，finished=${api.duel?.finished}）`,
      );
      break;
    }
    const ok = shot % 4 === 3 ? await touchShot() : await mouseShot();
    if (!ok) break;
    await sleep(300);
  }

  console.log(
    `\n---------- 汇总：${battleIndex} 场对战 | 捕获异常 ${capturedErrors.length} 条 | ${stuck ? "已复现卡死" : "未复现卡死"}`,
  );
  if (capturedErrors.length > 0) {
    console.log("异常清单（前 10 条）:");
    for (const line of capturedErrors.slice(0, 10)) {
      console.log(`  - ${line.slice(0, 400)}`);
    }
  }
  process.exitCode = stuck ? 1 : 0;
} finally {
  root.unmount();
  await server.close();
}
