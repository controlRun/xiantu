/**
 * 实机对战复现台（真浏览器）：
 * - 挂载真实 BattleScreen，处理器与 App.tsx 完全同构——
 *   内联闭包按渲染期捕获 player/archeryDuel（刻意不用 ref 兜底，
 *   专测闭包过期/状态竞争这类 jsdom 台测不出的问题）
 * - 驱动脚本以真实 PointerEvent 走完整瞄准→拉弓→满蓄自动释放链路，
 *   弹道由 solveLaunchDirection 反解，箭箭几何必中
 * - 任何 window error / unhandledrejection / console.error 全部留档
 */
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BattleScreen } from "/src/components/battle/BattleScreen.tsx";
import * as battle from "/src/systems/battleSystem.ts";
import * as inv from "/src/systems/inventorySystem.ts";
import { createInitialPlayer } from "/src/data/initialPlayer.ts";
import {
  solveLaunchDirection,
  launchSpeed,
} from "/src/utils/arrowPhysics.ts";
import {
  BOW_ORIGIN,
  ENEMY_X,
  ENEMY_BODY_Y,
} from "/src/components/battle/battleLayout.ts";

declare global {
  interface Window {
    __state: {
      player: ReturnType<typeof createInitialPlayer>;
      duel: ReturnType<typeof battle.startArcheryBattle>;
      battleResult: unknown;
      endedWith: string;
    };
    __restart: () => void;
    __errors: string[];
    __log: string[];
    __done: boolean;
  }
}

window.__errors = [];
window.__log = [];
window.__done = false;

window.addEventListener("error", (e) => {
  window.__errors.push(`window.error: ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`);
});
window.addEventListener("unhandledrejection", (e) => {
  window.__errors.push(`unhandledrejection: ${e.reason?.stack ?? e.reason}`);
});
const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  window.__errors.push(
    `console.error: ${args.map((a) => (a instanceof Error ? a.stack : String(a))).join(" ")}`,
  );
  originalConsoleError(...args);
};

/**
 * 压测档位（?mode=）：
 * - wild：默认野外历练（鼠标 + 触屏必中连射）
 * - weak：开场 12 血，专踩「战败惩罚 + finishDuel 败北分支」
 * - retreat：35 血 + 撤退策略 hp30（挨一箭即破 30% 线），专踩「命中后回瞄准态触发自动撤退」
 * - sparring：演武切磋（endless），每 6 箭点退出按钮，专踩「手动退出」
 * - pills：携回春/回灵丹，每 4 动服丹一次，专踩「战中服丹反击」
 * - spirit：炼气三层 + 空箭囊，纯灵力箭（凝气/聚灵），灵力耗尽后踩「认输撤退」
 * - boss：秘境石傀（高血高防），血厚打不完 → 专踩「回合上限（第 9 回合）强制结算」
 */
const MODE = new URLSearchParams(location.search).get("mode") ?? "wild";

const seedPlayer = () => {
  const player = createInitialPlayer();
  player.inventory = inv.addItemStacks(player.inventory, [
    // spirit 档位空箭囊入场，逼出纯灵力箭与弹尽粮绝路径
    ...(MODE === "spirit" ? [] : [{ itemId: "iron-arrow", quantity: 999 }]),
    ...(MODE === "pills"
      ? [
          { itemId: "healing-pill", quantity: 9 },
          { itemId: "mana-pill", quantity: 9 },
        ]
      : []),
  ]);
  if (MODE === "weak") player.health = { ...player.health, current: 12 };
  if (MODE === "retreat") player.health = { ...player.health, current: 35 };
  if (MODE === "spirit") {
    player.realmId = "qi-refining-3"; // order 3：凝气箭 + 聚灵箭解锁
    player.mana = { ...player.mana, current: player.mana.max };
  }
  // boss 石傀攻势极重：赐近无敌血量，保证活到回合上限强制结算那一支
  if (MODE === "boss") player.health = { ...player.health, current: 99999 };
  return player;
};

let battleIndex = 0;

/** 与 App.tsx 逐字同构的对战宿主：处理器闭包捕获本次渲染的 player/archeryDuel */
function Harness({ seed }: { seed: { player: ReturnType<typeof seedPlayer> } }) {
  const [player, setPlayer] = useState(seed.player);
  const [archeryDuel, setArcheryDuel] = useState(() => {
    battleIndex += 1;
    if (MODE === "sparring") {
      return battle.startSparringBattle(seed.player, {
        arrowIds: ["iron-arrow"],
        pillIds: [],
        retreatRule: "never",
      });
    }
    if (MODE === "boss") {
      return battle.startBossBattle(seed.player, {
        arrowIds: ["iron-arrow"],
        pillIds: [],
        retreatRule: "never",
      });
    }
    return battle.startArcheryBattle(seed.player, undefined, {
      // 与整备页一致：灵力箭档位 id 同样进 loadout.arrowIds
      arrowIds: MODE === "spirit" ? ["spirit-qi", "spirit-gather"] : ["iron-arrow"],
      pillIds: MODE === "pills" ? ["healing-pill", "mana-pill"] : [],
      retreatRule: MODE === "retreat" ? "hp30" : "never",
    });
  });
  const [battleResult, setBattleResult] = useState<
    battle.ArcheryShotResult["battleResult"]
  >(null);
  const [endedWith, setEndedWith] = useState<string>("unset");

  window.__state = { player, duel: archeryDuel, battleResult, endedWith };

  return (
    <BattleScreen
      duel={archeryDuel}
      player={player}
      availableArrows={battle.getBattlePhysicalArrows(player, archeryDuel)}
      spiritArrows={battle.getBattleSpiritArrows(player, archeryDuel)}
      onShoot={(arrowId, zoneId, drawPower) => {
        const result = battle.shootArrow(player, archeryDuel, arrowId, zoneId, drawPower);
        setPlayer(result.player);
        setArcheryDuel(result.duel);
        if (result.battleResult) setBattleResult(result.battleResult);
        return result;
      }}
      onApplyShot={(arrowId, pendingDamage) => {
        const result = battle.applyPlayerShot(player, archeryDuel, arrowId, pendingDamage);
        setPlayer(result.player);
        setArcheryDuel(result.duel);
        if (result.battleResult) setBattleResult(result.battleResult);
        return result;
      }}
      onSkipShot={(missReason) => {
        const result = battle.skipPlayerShot(player, archeryDuel, missReason);
        setPlayer(result.player);
        setArcheryDuel(result.duel);
        if (result.battleResult) setBattleResult(result.battleResult);
        return result;
      }}
      onUsePill={(pillItemId) => {
        const result = battle.useBattlePill(player, archeryDuel, pillItemId);
        setPlayer(result.player);
        setArcheryDuel(result.duel);
        if (result.battleResult) setBattleResult(result.battleResult);
        return result;
      }}
      onAutoRetreat={(reason) => {
        // App.tsx 的 handleAutoRetreat 直接卸载 BattleScreen（setArcheryDuel(null) +
        // isInBattleMode=false）。复现台无法卸载自身，以「置 finished 局 + endedWith」等效，
        // 驱动脚本据此换场——关键是不漏 retreatFromBattle 返回的 finished 局。
        const result = battle.retreatFromBattle(player, {
          ...archeryDuel,
          logs: [...archeryDuel.logs, reason],
        });
        setPlayer(result.player);
        setArcheryDuel(result.duel);
        setBattleResult(result.battleResult);
        setEndedWith("auto-retreat");
      }}
      onBattleEnd={(result) => {
        setEndedWith(result ? "result" : "manual");
        if (result?.player) setPlayer(result.player);
      }}
      battleResult={battleResult}
    />
  );
}

function Root() {
  const [runId, setRunId] = useState(0);
  const [seed, setSeed] = useState(() => ({ player: seedPlayer() }));
  useEffect(() => {
    window.__restart = () => {
      setSeed((prev) => {
        const grown = window.__state?.player ?? prev.player;
        // 换场时按档位复置血量，保证 weak/retreat 档位每场都能踩到目标分支
        const player =
          MODE === "weak"
            ? { ...grown, health: { ...grown.health, current: 12 } }
            : MODE === "retreat"
              ? { ...grown, health: { ...grown.health, current: 35 } }
              : MODE === "spirit"
                ? { ...grown, mana: { ...grown.mana, current: grown.mana.max } }
                : MODE === "boss"
                  ? { ...grown, health: { ...grown.health, current: 99999 } }
                  : grown;
        return { player };
      });
      setRunId((n) => n + 1);
    };
  }, []);
  return <Harness key={runId} seed={seed} />;
}

createRoot(document.getElementById("root")!).render(<Root />);

// ---------- 驱动脚本（React 之外的纯页面逻辑） ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const svgEl = () => document.querySelector("svg.battle-field-svg") as SVGSVGElement | null;

/** SVG 用户坐标 → 视口坐标（真机 getScreenCTM） */
const toClient = (x: number, y: number) => {
  const svg = svgEl()!;
  const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()!);
  return { x: p.x, y: p.y };
};

const fire = (type: string, props: Record<string, unknown>) => {
  const svg = svgEl();
  if (!svg) throw new Error("svg 未挂载");
  svg.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, ...props }));
};

/** 相位推断（DOM 观测）：瞄准 / 拉弓 / 飞行 / 结算或敌方回合 */
const inferPhase = () => {
  const hasTrajectory = !!document.querySelector(".trajectory-preview");
  const arrows = [...document.querySelectorAll(".arrow-projectile")];
  const flying = arrows.filter((a) => {
    const t = (a as SVGElement).style.transform ?? "";
    const m = /translate\(([-\d.]+)px/.exec(t);
    return m;
  });
  return `trajectory=${hasTrajectory} arrows=${flying.length}`;
};

const aimPoint = (power: number) => {
  const solution = solveLaunchDirection(
    BOW_ORIGIN.x,
    BOW_ORIGIN.y,
    ENEMY_X,
    ENEMY_BODY_Y,
    launchSpeed(power),
  );
  if (!solution) return { x: ENEMY_X, y: ENEMY_BODY_Y };
  return {
    x: BOW_ORIGIN.x + solution.dirX * 100,
    y: BOW_ORIGIN.y + solution.dirY * 100,
  };
};

const TOUCH_AIM_SCALE = 2.6;
const TOUCH_FULL_DRAG = 210;

/** 触屏必中拖拽向量：弹弓镜像映射 + 蓄力档位的不动点迭代 */
const solveTouchPull = () => {
  let power = 1;
  let pull = { x: -180, y: 60 };
  for (let i = 0; i < 8; i += 1) {
    const aim = aimPoint(power);
    pull = {
      x: (BOW_ORIGIN.x - aim.x) / TOUCH_AIM_SCALE,
      y: (BOW_ORIGIN.y - aim.y) / TOUCH_AIM_SCALE,
    };
    power = Math.min(1, Math.max(0.08, Math.hypot(pull.x, pull.y) / TOUCH_FULL_DRAG));
  }
  return { pull, power };
};

/** 鼠标：指哪打哪 + 满蓄自动释放 */
const mouseShot = async () => {
  const c = toClient(aimPoint(1).x, aimPoint(1).y);
  fire("pointermove", { pointerType: "mouse", pointerId: 1, clientX: c.x, clientY: c.y });
  await sleep(50);
  fire("pointerdown", { pointerType: "mouse", pointerId: 1, clientX: c.x, clientY: c.y });
  await sleep(1800); // 满蓄自动释放（DRAW_DURATION 1500 + 100 余裕）
};

/** 触屏：弹弓式拖拽蓄力，松手放箭 */
const touchShot = async () => {
  const anchor = { x: 120, y: 340 };
  const { pull } = solveTouchPull();
  const a = toClient(anchor.x, anchor.y);
  fire("pointerdown", {
    pointerType: "touch",
    pointerId: 7,
    clientX: a.x,
    clientY: a.y,
  });
  await sleep(60);
  for (let i = 1; i <= 6; i += 1) {
    const p = toClient(anchor.x + (pull.x * i) / 6, anchor.y + (pull.y * i) / 6);
    fire("pointermove", {
      pointerType: "touch",
      pointerId: 7,
      clientX: p.x,
      clientY: p.y,
    });
    await sleep(40);
  }
  await sleep(80);
  const last = toClient(anchor.x + pull.x, anchor.y + pull.y);
  fire("pointerup", {
    pointerType: "touch",
    pointerId: 7,
    clientX: last.x,
    clientY: last.y,
  });
  await sleep(100);
};

const waitTrajectory = async (timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (document.querySelector(".trajectory-preview")) return true;
    await sleep(80);
  }
  return false;
};

const run = async () => {
  let stuck = false;

  // 等 React 首渲完成（window.__state 由 Harness 渲染期写入）
  while (!window.__state) await sleep(50);

  for (let shot = 1; shot <= 30 && !stuck; shot += 1) {
    // 上一场已结束 → 换场（携带成长后的玩家）
    if (window.__state.duel.finished || window.__state.endedWith !== "unset") {
      window.__restart();
      await sleep(300);
    }

    const ready = await waitTrajectory(15000);
    if (!ready) {
      window.__log.push(
        `!!! 第 ${shot} 箭：等待瞄准就绪超时（${inferPhase()}）→ 卡死`,
      );
      stuck = true;
      break;
    }

    const before = window.__state.duel;
    const snap = {
      round: before.round,
      mh: before.monsterHealth,
      ph: before.playerHealth,
      battle: battleIndex,
    };

    const isTouch = shot % 5 === 0; // 每 5 箭一记触屏拖拽，其余鼠标满蓄

    // 档位专属动作：pills 每 4 动服丹一次；sparring 每 6 动点退出按钮
    let action: "mouse" | "touch" | "pill" | "exit" = isTouch ? "touch" : "mouse";
    if (MODE === "pills" && shot % 4 === 0) {
      const pillBtn = [...document.querySelectorAll<HTMLButtonElement>(".pill-button")].find(
        (b) => !b.disabled,
      );
      if (pillBtn) action = "pill";
    }
    if (MODE === "sparring" && shot % 6 === 0) {
      if (document.querySelector<HTMLButtonElement>(".battle-exit-button")) action = "exit";
    }

    if (action === "pill") {
      const pillBtn = [...document.querySelectorAll<HTMLButtonElement>(".pill-button")].find(
        (b) => !b.disabled,
      )!;
      pillBtn.click();
      await sleep(200);
    } else if (action === "exit") {
      document.querySelector<HTMLButtonElement>(".battle-exit-button")!.click();
      await sleep(200);
    } else {
      await (action === "touch" ? touchShot() : mouseShot());
    }

    // 轮询推进（最长 12s）；非演武局若弹出「认输撤退」（弹尽粮绝）则替玩家点掉
    const deadline = Date.now() + 12000;
    let progressed = false;
    let surrendered = false;
    while (Date.now() < deadline) {
      const after = window.__state.duel;
      if (
        after.round !== snap.round ||
        after.monsterHealth !== snap.mh ||
        after.playerHealth !== snap.ph ||
        after.finished ||
        window.__state.endedWith !== "unset"
      ) {
        progressed = true;
        break;
      }
      if (!after.endless && !surrendered) {
        const exitBtn = document.querySelector<HTMLButtonElement>(".battle-exit-button");
        if (exitBtn) {
          exitBtn.click();
          surrendered = true;
        }
      }
      await sleep(100);
    }

    const after = window.__state.duel;
    const actionLabel = { mouse: "鼠标", touch: "触屏", pill: "服丹", exit: "退出" }[action];
    const line = `第 ${shot} 动[${actionLabel}]（第 ${snap.battle} 场）: 回合 ${snap.round}→${after.round} | 敌血 ${snap.mh}→${after.monsterHealth} | 我血 ${snap.ph}→${after.playerHealth} | ${progressed ? "推进 ✓" : "!!! 卡死"} | ${after.logs.slice(-1)[0] ?? ""}`;
    window.__log.push(line);
    console.log(line);

    if (!progressed) {
      stuck = true;
      window.__log.push(
        `!!! 现场：${inferPhase()} | 错误 ${window.__errors.length} 条`,
      );
    }

    await sleep(300);
  }

  window.__log.push(
    `---------- 汇总：${battleIndex} 场对战 | 错误 ${window.__errors.length} 条 | ${stuck ? "已复现卡死" : "全程推进"}`,
  );
  window.__done = true;
};

run();
