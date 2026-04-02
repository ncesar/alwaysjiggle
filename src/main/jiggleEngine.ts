import { powerSaveBlocker } from 'electron';
import { execFileSync, spawn, ChildProcess } from 'child_process';
import store from './store';
import { isBlocked } from './conditions';
import { isWithinSchedule } from './scheduler';
import * as humanEngine from './humanEngine';

type EngineState = 'stopped' | 'running' | 'paused';

let state: EngineState = 'stopped';
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let zenBlockerId: number | null = null;
let caffeinateProcess: ChildProcess | null = null;

// ── Swift helper binary ───────────────────────────────────────────────────────
// JXA's CoreGraphics ObjC bridge crashes (SIGSEGV) when spawned from Electron
// because the subprocess doesn't get a window server connection.
// A compiled Swift binary runs as its own process with full macOS API access.

const HELPER_BIN = `${__dirname}/../../helpers/jiggle-helper`;

function runHelper(cmd: 'mouse' | 'zen'): string {
  return execFileSync(HELPER_BIN, [cmd], { timeout: 3000 }).toString().trim();
}

// ── Standard jiggle ──────────────────────────────────────────────────────────

export function checkAccessibilityPermission(): boolean {
  try {
    runHelper('mouse');
    return true;
  } catch {
    return false;
  }
}

function doStandardJiggle(): void {
  const result = runHelper('mouse');
  console.log('[jiggle] position:', result);
}

// ── Zen mode helpers ─────────────────────────────────────────────────────────

function startZen(): void {
  if (zenBlockerId !== null) return;
  zenBlockerId = powerSaveBlocker.start('prevent-display-sleep');

  // Spawn caffeinate for belt-and-suspenders: -d (display), -i (idle)
  caffeinateProcess = spawn('caffeinate', ['-di'], {
    detached: false,
    stdio: 'ignore',
  });
}

function stopZen(): void {
  if (zenBlockerId !== null) {
    powerSaveBlocker.stop(zenBlockerId);
    zenBlockerId = null;
  }
  if (caffeinateProcess !== null) {
    caffeinateProcess.kill();
    caffeinateProcess = null;
  }
}

// ── Tick ─────────────────────────────────────────────────────────────────────

function tick(): void {
  console.log('[tick] state=%s blocked=%s inSchedule=%s', state, isBlocked(), isWithinSchedule());
  if (state !== 'running') return;
  if (isBlocked()) return;
  if (!isWithinSchedule()) return;

  const mode = store.get('mode');
  console.log('[tick] firing jiggle, mode=%s', mode);

  if (mode === 'standard') {
    try {
      doStandardJiggle();
    } catch (err) {
      console.error('[jiggle] error:', err);
    }
  } else {
    // Zen: powerSaveBlocker + caffeinate prevent system sleep.
    // IOPMAssertionDeclareUserActivity resets HIDIdleTime so apps like
    // Slack/Teams don't show "away" — no cursor movement required.
    try {
      runHelper('zen');
    } catch {
      // Non-critical
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function start(): void {
  if (state === 'running') return;

  const mode = store.get('mode');
  if (mode === 'zen') startZen();

  if (mode === 'humanized') {
    humanEngine.start();
  } else {
    const intervalSec = store.get('interval');
    intervalHandle = setInterval(tick, intervalSec * 1000);
    tick(); // fire once immediately
  }

  state = 'running';
}

export function stop(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  stopZen();
  humanEngine.stop();
  state = 'stopped';
}

export function pause(): void {
  if (state !== 'running') return;
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  stopZen();
  humanEngine.pause();
  state = 'paused';
}

export function resume(): void {
  if (state !== 'paused') return;
  if (!store.get('enabled')) return;

  const mode = store.get('mode');
  if (mode === 'zen') startZen();

  if (mode === 'humanized') {
    humanEngine.resume();
  } else {
    const intervalSec = store.get('interval');
    intervalHandle = setInterval(tick, intervalSec * 1000);
    tick(); // fire once immediately on resume
  }

  state = 'running';
}

export function restart(): void {
  stop();
  if (store.get('enabled')) {
    start();
  }
}

export function getState(): EngineState {
  return state;
}
