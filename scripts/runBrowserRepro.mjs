// 驱动本机 Edge 打开 vite 服务上的实机复现台，等待对战驱动脚本跑完并汇总
import puppeteer from "puppeteer-core";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL = process.argv[2] ?? "http://localhost:9850/scripts/browserRepro/index.html";
// --mobile：竖屏手机视口 + 触屏，踩 game-mobile / game-landscape-locked 旋转变换路径
const MOBILE = process.argv.includes("--mobile");

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: "new",
  args: ["--window-size=1280,800", "--autoplay-policy=no-user-gesture-required"],
});

try {
  const page = await browser.newPage();
  await page.setViewport(
    MOBILE
      ? { width: 390, height: 844, isMobile: true, hasTouch: true }
      : { width: 1280, height: 800 },
  );

  page.on("console", (msg) => {
    const type = msg.type();
    if (type === "error" || type === "warning") {
      console.log(`[page:${type}] ${msg.text().slice(0, 500)}`);
    }
  });
  page.on("pageerror", (err) => {
    console.log(`[pageerror] ${err?.stack ?? err}`);
  });

  console.log(`打开 ${URL} …`);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  // 等驱动脚本跑完（30 箭 × ≤14s ≈ 7 分钟封顶）
  const deadline = Date.now() + 450000;
  while (Date.now() < deadline) {
    const done = await page.evaluate(() => window.__done === true).catch(() => false);
    if (done) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  const { log, errors, done } = await page.evaluate(() => ({
    log: window.__log ?? [],
    errors: window.__errors ?? [],
    done: window.__done === true,
  }));

  console.log("\n===== 实机复现日志 =====");
  for (const line of log) console.log(line);
  if (errors.length > 0) {
    console.log(`\n===== 捕获错误 ${errors.length} 条 =====`);
    for (const line of errors.slice(0, 12)) {
      console.log(`- ${line.slice(0, 800)}`);
    }
  }
  if (!done) {
    console.log("\n!!! 驱动脚本未在时限内跑完");
    process.exitCode = 2;
  } else if (log.some((l) => l.includes("卡死"))) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
