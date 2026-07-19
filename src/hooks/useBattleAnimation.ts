import { useReducer } from "react";
import type {
  BattleAnimation,
  BattleAnimationAction,
  TargetZoneId,
} from "../types/game";

const initialState: BattleAnimation = {
  phase: "idle",
  aimPosition: { x: 50, y: 50 },
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
      return { ...state, phase: "flight", drawPower: 0 };

    case "RESOLVE":
      return {
        ...state,
        phase: "resolving",
        showDamage: true,
        lastHit: action.hit,
        lastDamage: action.damage,
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
