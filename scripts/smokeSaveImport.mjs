// 存档导入/导出冒烟：parseImportedSave 的消毒与 round-trip
//
// 回归背景：新增 JSON 导出/导入备份。导入走与读档同一套 normalizeSaveData→migratePlayer
// 消毒，非法/残缺/篡改一律安全回落。本测试锁死：合法存档 round-trip 保真、垃圾→null、
// 篡改字段回落到初值、库存/宗门/秘境局/战绩消毒。
//
// 注意：node 无 localStorage/document，故只测纯函数 createSaveData/parseImportedSave，
// 不调用 saveGame/loadGame/exportSaveToFile（那些留给手动与浏览器验证）。
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
  const save = await server.ssrLoadModule("/src/utils/saveLoad.ts");

  // ---------- 1. round-trip 保真 ----------
  {
    const player = createInitialPlayer("测试道人");
    const text = JSON.stringify(save.createSaveData(player));
    const parsed = save.parseImportedSave(text);
    assert(parsed !== null, "合法存档解析成功");
    assert(parsed?.player.name === "测试道人", "道号保真");
    assert(parsed?.player.age === player.age, "寿元保真");
    assert(parsed?.player.realmId === player.realmId, "境界保真");
    assert(parsed?.schemaVersion === 10, "schema 版本 = 10（渡劫 deathCause）");
  }

  // ---------- 2. 篡改字段回落初值 ----------
  {
    const raw = {
      schemaVersion: 7,
      savedAt: new Date().toISOString(),
      player: { name: "篡改者", age: "ninety" },
    };
    const parsed = save.parseImportedSave(JSON.stringify(raw));
    assert(parsed !== null, "含合法 player 的篡改档可解析");
    assert(parsed?.player.name === "篡改者", "合法道号存活");
    assert(parsed?.player.age === 16, "非数值寿元回落初值 16");
  }

  // ---------- 3. 垃圾输入 → null ----------
  {
    assert(save.parseImportedSave("not json") === null, "非 JSON → null");
    assert(save.parseImportedSave("{}") === null, "无 player → null");
    assert(save.parseImportedSave("[]") === null, "数组 → null");
  }

  // ---------- 4. 消毒：库存/宗门/秘境局/战绩 ----------
  {
    const raw = {
      schemaVersion: 7,
      savedAt: new Date().toISOString(),
      player: {
        name: "残缺者",
        inventory: [{ itemId: "wooden-arrow", quantity: -5 }],
        sectId: "nonexistent-sect",
        secretRealmRun: { garbage: true },
        // 故意缺 stats
      },
    };
    const parsed = save.parseImportedSave(JSON.stringify(raw));
    const p = parsed?.player;
    assert(p != null, "残缺档解析出 player");
    const wooden = p?.inventory.find((s) => s.itemId === "wooden-arrow");
    assert(wooden?.quantity === 1, "负库存夹至 1");
    assert(p?.sectId === null, "未知宗门 → null");
    assert(p?.secretRealmRun === undefined, "损坏秘境局 → undefined");
    assert(p?.stats.monstersKilled === 0, "缺失战绩归零");
  }
} finally {
  await server.close();
}

console.log(
  process.exitCode ? "\n!!! 存档导入冒烟：存在失败项" : "\n存档导入冒烟：全部通过",
);
