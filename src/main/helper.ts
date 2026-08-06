import { app } from 'electron';
import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// The Swift helper is shipped as an unpacked resource (electron-builder
// `extraResources`), never inside app.asar — a binary inside the archive has no
// real path on disk and cannot be executed.
export const HELPER_BIN = app.isPackaged
  ? path.join(process.resourcesPath, 'helpers', 'jiggle-helper')
  : path.join(__dirname, '..', '..', 'helpers', 'jiggle-helper');

export type HelperCommand =
  | 'mouse' | 'zen' | 'idle-time' | 'mouse-drift' | 'scroll' | 'key-safe' | 'check-access';

export type HelperStatus = 'ok' | 'missing' | 'error';

export function run(cmd: HelperCommand, args: string[] = [], timeout = 3000): string {
  return execFileSync(HELPER_BIN, [cmd, ...args], { timeout }).toString().trim();
}

export interface HelperHealth {
  status: HelperStatus;
  canPostEvents: boolean;
}

// One spawn answers both questions. `check-access` is the right probe because it
// is read-only, needs no permission, has no side effects, exercises the binary,
// AND returns the permission answer.
//
// Not `zen`/`mouse`: they post real HID events, so probing would simulate
// activity every time the popup opens, bypassing the enabled/paused/battery/
// schedule gates. Not `idle-time`: it is humanized-only and fails when
// IOHIDSystem is unavailable, which would report the whole helper as broken
// while standard and zen are working fine.
function measure(): HelperHealth {
  if (!fs.existsSync(HELPER_BIN)) {
    console.error('[helper] binary missing at', HELPER_BIN);
    return { status: 'missing', canPostEvents: false };
  }
  try {
    return { status: 'ok', canPostEvents: run('check-access', [], 2000) === 'granted' };
  } catch (err) {
    console.error('[helper] binary present but failed to run:', err);
    return { status: 'error', canPostEvents: false };
  }
}

// execFileSync blocks the main thread, and the renderer asks for health on every
// state push — a single schedule edit is several pushes in a row. A short TTL
// collapses those into one spawn while staying fresh enough that reopening the
// popup after granting permission shows the truth.
const HEALTH_TTL_MS = 1000;
let cached: HelperHealth | null = null;
let cachedAt = 0;

export function checkHealth(): HelperHealth {
  const now = Date.now();
  if (cached === null || now - cachedAt >= HEALTH_TTL_MS) {
    cached = measure();
    cachedAt = now;
  }
  return cached;
}
