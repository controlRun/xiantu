/**
 * 轻量音效：WebAudio 振荡器合成（零素材），配合移动端触感震动。
 * AudioContext 懒初始化：首次用户手势后创建并自动 resume（iOS/Web 均需用户激活才出声）。
 * 开关独立存 localStorage（key: xiantu.sound.v1），与存档互不干扰。
 */

export type SoundKind =
  | "playerHit"
  | "playerCrit"
  | "playerMiss"
  | "enemyHit"
  | "battleWin"
  | "battleLose"
  | "breakthroughWin"
  | "breakthroughFail"
  | "uiConfirm";

const SOUND_KEY = "xiantu.sound.v1";

let audioCtx: AudioContext | null = null;
let enabled = true;

try {
  enabled = localStorage.getItem(SOUND_KEY) !== "0";
} catch {
  // localStorage 不可用（隐私模式等）时默认开启
}

export const getSoundEnabled = () => enabled;

export const setSoundEnabled = (on: boolean) => {
  enabled = on;

  try {
    localStorage.setItem(SOUND_KEY, on ? "1" : "0");
  } catch {
    // 存储失败仅影响持久化，不影响本局行为
  }

  if (!audioCtx) {
    return;
  }

  if (on && audioCtx.state === "suspended") {
    void audioCtx.resume();
  } else if (!on && audioCtx.state === "running") {
    void audioCtx.suspend();
  }
};

/** 首次手势调用：创建并解封 AudioContext（suspended → resume） */
const unlockAudio = () => {
  if (!enabled || audioCtx) {
    return;
  }

  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!Ctor) {
      return;
    }

    audioCtx = new Ctor();

    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
  } catch {
    // 环境不支持音频，静默忽略
  }
};

const vibrate = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // 不支持震动，忽略
  }
};

const tone = (
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.16,
  endFreq?: number,
) => {
  // 允许在 suspended 状态下入队：unlockAudio 已触发 resume，
  // 振荡器在冻结的 currentTime 上起播，恢复后立即发声（首响不丢）
  if (!audioCtx || audioCtx.state === "closed") {
    return;
  }

  const t0 = audioCtx.currentTime + start;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);

  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, endFreq),
      t0 + duration,
    );
  }

  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
};

const CUES: Record<SoundKind, () => void> = {
  // 玩家命中：轻快的三角波上滑
  playerHit: () => {
    tone(520, 0, 0.09, "triangle", 0.14, 300);
    vibrate(18);
  },
  // 暴击：双音叠加 + 三段震动
  playerCrit: () => {
    tone(720, 0, 0.12, "square", 0.11, 240);
    tone(980, 0.05, 0.14, "triangle", 0.14, 420);
    vibrate([20, 30, 20]);
  },
  // 未中/被闪开：低沉短促
  playerMiss: () => {
    tone(340, 0, 0.08, "sine", 0.1, 220);
  },
  // 玩家受击：锯齿波下滑
  enemyHit: () => {
    tone(240, 0, 0.14, "sawtooth", 0.1, 90);
    vibrate(30);
  },
  // 战斗获胜：上行三连音
  battleWin: () => {
    tone(523, 0, 0.12);
    tone(659, 0.12, 0.12);
    tone(784, 0.24, 0.2);
  },
  // 战斗落败：下行滑音
  battleLose: () => {
    tone(300, 0, 0.2, "sawtooth", 0.12, 150);
    tone(220, 0.18, 0.28, "sawtooth", 0.12, 110);
  },
  // 突破成功：上行四音 + 长震动
  breakthroughWin: () => {
    tone(392, 0, 0.14);
    tone(523, 0.14, 0.14);
    tone(659, 0.28, 0.16);
    tone(784, 0.44, 0.26);
    vibrate([30, 40, 30, 40, 60]);
  },
  // 突破失败：沉闷下滑
  breakthroughFail: () => {
    tone(200, 0, 0.24, "sawtooth", 0.12, 120);
    tone(150, 0.22, 0.3, "sawtooth", 0.12, 90);
  },
  // 界面确认：清脆短音
  uiConfirm: () => {
    tone(660, 0, 0.06, "triangle", 0.1, 500);
  },
};

export const playCue = (kind: SoundKind) => {
  if (!enabled) {
    return;
  }

  unlockAudio();
  CUES[kind]();
};
