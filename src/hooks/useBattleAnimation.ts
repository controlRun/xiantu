import { useReducer } from "react";
import type {
  BattleAnimation,
  BattleAnimationAction,
  TargetZoneId,
} from "../types/game";
import { ENEMY_BODY_Y, ENEMY_X } from "../components/battle/battleLayout";

const initialState: BattleAnimation = {
  phase: "idle",
  // 准星初始瞄准敌方胸腹（SVG 坐标）
  aimPosition: { x: ENEMY_X, y: ENEMY_BODY_Y },
  currentZone: "chest",
  drawPower: 0,
  showDamage: false,
  lastDamage: 0,
  lastCritical: false,
  lastHit: false,
};

const battleAnimationReducer = (
  state: BattleAnimation,
  action: BattleAnimationAction,
): BattleAnimation => {
  switch (action.type) {
    case "START_AIMING":
      return { ...state, phase: "aiming", drawPower: 0, showDamage: false };

    case "UPDATE_AIM":
      return {
        ...state,
        aimPosition: action.position,
        currentZone: action.zone,
      };

    case "START_DRAWING":
      return { ...state, phase: "drawing", drawPower: 0 };

    case "UPDATE_DRAW_POWER":
      return { ...state, drawPower: action.power };

    case "START_FLIGHT":
      // Set the hit result before starting flight so arrow animation can use it
      // 蓄力以松手瞬间为准；未携带 drawPower 时保留当前值，绝不归零
      // （归零会让初速跌回 300，箭矢出手即坠）
      return {
        ...state,
        phase: "flight",
        drawPower: action.drawPower ?? state.drawPower,
        lastHit: action.hit ?? state.lastHit,
        lastDamage: action.damage ?? state.lastDamage,
        lastCritical: action.critical ?? state.lastCritical,
      };

    case "RESOLVE":
      return {
        ...state,
        phase: "resolving",
        showDamage: action.hit === true,
        lastHit: action.hit,
        lastDamage: action.hit === true ? action.damage : 0,
        lastCritical: action.critical,
      };

    case "ENEMY_TURN":
      return { ...state, phase: "enemyTurn", showDamage: false };

    case "RESET_TO_AIMING":
      return {
        ...state,
        phase: "aiming",
        drawPower: 0,
        showDamage: false,
        lastHit: false,
        lastDamage: 0,
        lastCritical: false,
      };

    case "FINISH":
      return { ...state, phase: "finished" };

    default:
      return state;
  }
};

export const useBattleAnimation = () => {
  const [state, dispatch] = useReducer(
    battleAnimationReducer,
    initialState,
  );

  return { state, dispatch };
};

export type { TargetZoneId };
