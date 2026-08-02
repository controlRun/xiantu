import { useCallback, useEffect, useRef } from "react";

/**
 * 战斗界面定时器登记簿：所有 setTimeout 经 schedule() 登记，组件卸载时统一清空——
 * 杜绝「战斗已结束，残留定时器仍对死 reducer 派发敌回合/结算」的幽灵回合。
 *
 * 设计约定：
 * - 看门狗（阶段超时兜底）与自带 effect 清理的定时器（如战斗结束 2s 延迟）各管各的，
 *   不进登记簿；它们的生命周期已由各自 effect 的 return 清理覆盖。
 * - BattleScreen 在战斗结束时必然卸载（App 以 isInBattleMode && archeryDuel 早期 return），
 *   故「卸载即清」就是唯一且充分的出口，无需另设 duel.finished 监听。
 */
export const useBattleTimers = () => {
  const timersRef = useRef<Set<number>>(new Set());

  /** 登记一个定时器；回调触发时自动从登记簿除名，clearAll 不会重复清已触发的 */
  const schedule = useCallback((fn: () => void, delay: number): number => {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, delay);
    timersRef.current.add(id);
    return id;
  }, []);

  /** 取消单个已登记定时器（如抬手时取消自动放箭） */
  const cancel = useCallback((id: number | null) => {
    if (id === null) return;
    timersRef.current.delete(id);
    window.clearTimeout(id);
  }, []);

  /** 清空全部已登记定时器 */
  const clearAll = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current.clear();
  }, []);

  // clearAll 身份稳定（useCallback 空依赖），此 effect 仅在卸载时触发清理
  useEffect(() => clearAll, [clearAll]);

  return { schedule, cancel, clearAll };
};
