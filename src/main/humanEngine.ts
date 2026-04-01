import { execFileSync } from 'child_process';
import { isBlocked } from './conditions';
import { isWithinSchedule } from './scheduler';

const HELPER_BIN = `${__dirname}/../../helpers/jiggle-helper`;
const IDLE_THRESHOLD_SEC = 12;

type HumanState = 'idle' | 'light' | 'burst' | 'break';

const DELAY_MS: Record<HumanState, [number, number]> = {
  idle:  [20_000, 60_000],
  light: [5_000,  25_000],
  burst: [1_500,  5_000],
  break: [90_000, 240_000],
};

const TRANSITIONS: Record<HumanState, Array<[HumanState, number]>> = {
  idle:  [['light', 3], ['idle', 2], ['break', 1]],
  light: [['light', 2], ['burst', 2], ['idle', 1]],
  burst: [['light', 2], ['idle', 2], ['burst', 1]],
  break: [['idle', 3], ['light', 1]],
};

let running = false;
let paused = false;
let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
let currentState: HumanState = 'light';
let burstRemaining = 0;

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function weightedPick(choices: Array<[HumanState, number]>): HumanState {
  const total = choices.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [value, weight] of choices) {
    r -= weight;
    if (r <= 0) return value;
  }
  return choices[choices.length - 1][0];
}

function getIdleSec(): number {
  try {
    const out = execFileSync(HELPER_BIN, ['idle-time'], { timeout: 2000 }).toString().trim();
    return parseFloat(out) || 0;
  } catch {
    return 0; // assume user is active — safe default
  }
}

function doMouseDrift(): void {
  const distance = rand(4, 15);
  const angle = Math.random() * 2 * Math.PI;
  const dx = Math.round(distance * Math.cos(angle));
  const dy = Math.round(distance * Math.sin(angle));
  execFileSync(HELPER_BIN, ['mouse-drift', String(dx), String(dy)], { timeout: 3000 });
}

function doScroll(): void {
  const amount = (Math.random() < 0.5 ? 1 : -1) * randInt(1, 3);
  execFileSync(HELPER_BIN, ['scroll', String(amount)], { timeout: 3000 });
}

function doSafeKey(): void {
  execFileSync(HELPER_BIN, ['key-safe'], { timeout: 3000 });
}

function runAction(state: HumanState): void {
  if (state === 'idle' || state === 'break') return;

  const roll = Math.random();
  if (state === 'light') {
    if (roll < 0.8) {
      doMouseDrift();
    } else {
      try { doScroll(); } catch { /* needs Accessibility — graceful skip */ }
    }
  } else { // burst
    if (roll < 0.6) {
      doMouseDrift();
    } else if (roll < 0.9) {
      try { doScroll(); } catch { /* needs Accessibility — graceful skip */ }
    } else {
      try { doSafeKey(); } catch { /* needs Accessibility — graceful skip */ }
    }
  }
}

function scheduleNext(): void {
  if (!running || paused) return;

  let next: HumanState;
  if (currentState === 'burst' && burstRemaining > 0) {
    burstRemaining--;
    next = 'burst';
  } else {
    next = weightedPick(TRANSITIONS[currentState]);
    if (next === 'burst') burstRemaining = randInt(2, 4);
  }
  currentState = next;

  const [min, max] = DELAY_MS[currentState];
  const delay = rand(min, max);
  console.log('[human] state=%s delay=%.1fs', currentState, delay / 1000);
  timeoutHandle = setTimeout(tick, delay);
}

function tick(): void {
  timeoutHandle = null;
  if (!running || paused) return;

  if (!isBlocked() && isWithinSchedule()) {
    const idleSec = getIdleSec();
    if (idleSec >= IDLE_THRESHOLD_SEC) {
      try { runAction(currentState); } catch (err) {
        console.error('[human] action error:', err);
      }
    } else {
      console.log('[human] user active (%.1fs idle), skipping', idleSec);
    }
  }

  scheduleNext();
}

export function start(): void {
  if (running) return;
  running = true;
  paused = false;
  currentState = 'light';
  burstRemaining = 0;
  scheduleNext();
}

export function stop(): void {
  running = false;
  paused = false;
  if (timeoutHandle !== null) { clearTimeout(timeoutHandle); timeoutHandle = null; }
}

export function pause(): void {
  if (!running) return;
  paused = true;
  if (timeoutHandle !== null) { clearTimeout(timeoutHandle); timeoutHandle = null; }
}

export function resume(): void {
  if (!running || !paused) return;
  paused = false;
  scheduleNext();
}
