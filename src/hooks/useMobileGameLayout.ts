import { useEffect, useState } from "react";

const detectPhone = () =>
  window.matchMedia("(pointer: coarse)").matches &&
  Math.min(window.innerWidth, window.innerHeight) <= 600;

/** 当前是否竖屏（物理视口高 > 宽）。横屏提示弹窗据此出现/消失 */
const detectPortrait = () => window.innerHeight > window.innerWidth;

/**
 * 手机端布局适配：
 * - 小屏触控设备（短边 ≤ 600px）挂上 "game-mobile"：启用紧凑对战布局；
 * - 该类设备处于竖屏时再挂 "game-landscape-locked"：
 *   styles.css 会把整个应用旋转 90° 实现"自动横屏"。
 *   玩家物理旋转手机到横屏后，本类自动移除，切换为原生横屏布局；
 * - 桌面浏览器与平板不受影响（coarse 指针 + 尺寸双重门槛）。
 *
 * 旋转容器不信任 100vh/100vw（移动浏览器对动态地址栏的口径五花八门），
 * 而是由这里实时量出可见视口尺寸写入 CSS 变量，容器按物理屏幕中心定位——
 * 任何视口抖动都只会对称溢出，页面始终居中，不会偏向一侧留白。
 *
 * 返回 isMobile 供 App 切换"主界面中枢 + 子页面"的手机端布局；
 * 返回 isPortrait 供 App 在竖屏时弹横屏提示。
 */
export const useMobileGameLayout = () => {
  const [isMobile, setIsMobile] = useState(detectPhone);
  const [isPortrait, setIsPortrait] = useState(detectPortrait);

  useEffect(() => {
    const coarsePointer = window.matchMedia("(pointer: coarse)");

    const update = () => {
      const vv = window.visualViewport;
      const viewW = Math.round(vv?.width ?? window.innerWidth);
      const viewH = Math.round(vv?.height ?? window.innerHeight);

      const isPhone = coarsePointer.matches && Math.min(viewW, viewH) <= 600;
      const isPortrait = viewH > viewW;
      const locked = isPhone && isPortrait;

      setIsMobile(isPhone);
      setIsPortrait(isPortrait);
      document.body.classList.toggle("game-mobile", isPhone);
      document.body.classList.toggle("game-landscape-locked", locked);

      // 旋转后：内容宽 = 竖屏的高，内容高 = 竖屏的宽
      const rootStyle = document.documentElement.style;
      rootStyle.setProperty("--game-rot-w", `${viewH}px`);
      rootStyle.setProperty("--game-rot-h", `${viewW}px`);
      // 手机端外壳可用高度：伪横屏时取物理宽（旋转后即高），原生横屏时取视口高
      rootStyle.setProperty("--game-shell-h", `${locked ? viewW : viewH}px`);

      // 锁定瞬间归位滚动，避免 iOS 上 fixed body 带着旧滚动偏移
      if (locked) {
        window.scrollTo(0, 0);
      }
    };

    const vv = window.visualViewport;
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    vv?.addEventListener("resize", update);
    coarsePointer.addEventListener("change", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      vv?.removeEventListener("resize", update);
      coarsePointer.removeEventListener("change", update);
    };
  }, []);

  return { isMobile, isPortrait };
};
