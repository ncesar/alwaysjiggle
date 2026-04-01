import { powerMonitor } from 'electron';
import store from './store';

let screenLocked = false;
let onBattery = false;
let onBlockCallback: (() => void) | null = null;
let onUnblockCallback: (() => void) | null = null;

function evaluate(): void {
  const blocked = isBlocked();
  if (blocked) {
    onBlockCallback?.();
  } else {
    onUnblockCallback?.();
  }
}

export function init(onBlock: () => void, onUnblock: () => void): void {
  onBlockCallback = onBlock;
  onUnblockCallback = onUnblock;

  // Initialize battery state
  onBattery = powerMonitor.onBatteryPower;

  powerMonitor.on('lock-screen', () => {
    screenLocked = true;
    evaluate();
  });

  powerMonitor.on('unlock-screen', () => {
    screenLocked = false;
    evaluate();
  });

  powerMonitor.on('on-battery', () => {
    onBattery = true;
    evaluate();
  });

  powerMonitor.on('on-ac', () => {
    onBattery = false;
    evaluate();
  });
}

export function isBlocked(): boolean {
  if (store.get('neverOnBattery') && onBattery) return true;
  if (store.get('neverOnLockScreen') && screenLocked) return true;
  return false;
}

export function getState(): { screenLocked: boolean; onBattery: boolean } {
  return { screenLocked, onBattery };
}
