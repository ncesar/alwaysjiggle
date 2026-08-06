import { isBlocked } from './conditions';
import { isWithinSchedule } from './scheduler';
import * as helper from './helper';

const IDLE_THRESHOLD_SEC = 12;
// A failing idle probe must not disable the mode forever (that was the original
// bug), but one transient timeout should not make us type over the user either.
const MAX_PROBE_FAILURES = 3;

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
let probeFailures = 0;

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

// Returns null when idle time can't be read, so the caller can tell
// "user is active" apart from "the probe failed" — conflating the two silently
// disabled every action for the whole session.
function getIdleSec(): number | null {
  try {
    const out = helper.run('idle-time', [], 2000);
    const parsed = parseFloat(out);
    return Number.isFinite(parsed) ? parsed : null;
  } catch (err) {
    console.error('[human] idle probe failed:', err);
    return null;
  }
}

function doMouseDrift(): void {
  const distance = rand(4, 15);
  const angle = Math.random() * 2 * Math.PI;
  const dx = Math.round(distance * Math.cos(angle));
  const dy = Math.round(distance * Math.sin(angle));
  helper.run('mouse-drift', [String(dx), String(dy)]);
}

function doScroll(): void {
  const amount = (Math.random() < 0.5 ? 1 : -1) * randInt(1, 3);
  helper.run('scroll', [String(amount)]);
}

function doSafeKey(): void {
  helper.run('key-safe');
}

function runAction(state: HumanState): void {
  if (state === 'idle' || state === 'break') return;

  const roll = Math.random();
  if (state === 'light') {
    if (roll < 0.8) {
      doMouseDrift();
    } else {
      try { doScroll(); } catch (err) { console.error('[human] scroll failed:', err); }
    }
  } else { // burst
    if (roll < 0.6) {
      doMouseDrift();
    } else if (roll < 0.9) {
      try { doScroll(); } catch (err) { console.error('[human] scroll failed:', err); }
    } else {
      try { doSafeKey(); } catch (err) { console.error('[human] key failed:', err); }
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
    probeFailures = idleSec === null ? probeFailures + 1 : 0;

    const shouldAct = idleSec === null
      ? probeFailures >= MAX_PROBE_FAILURES
      : idleSec >= IDLE_THRESHOLD_SEC;

    if (shouldAct) {
      try { runAction(currentState); } catch (err) {
        console.error('[human] action error:', err);
      }
    } else if (idleSec === null) {
      console.warn('[human] idle probe failed (%d/%d), skipping this tick',
        probeFailures, MAX_PROBE_FAILURES);
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
  probeFailures = 0;
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
