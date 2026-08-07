import { Tray, BrowserWindow, nativeImage, app, globalShortcut } from 'electron';
import path from 'path';
import store from './store';
import * as conditions from './conditions';
import { isWithinSchedule } from './scheduler';
import * as helper from './helper';

let tray: Tray | null = null;
let popupWindow: BrowserWindow | null = null;

function getTrayTitle(): string {
  // Checked first, ahead of ⏸: a fresh install defaults to enabled=false, so a
  // new user missing Accessibility would otherwise see ⏸ and no hint that the
  // app cannot work at all. The tray is the only always-visible surface, and it
  // reading calm while nothing works is the failure this whole change targets.
  // (Cached — see helper.checkHealth.)
  const health = helper.checkHealth();
  if (health.status !== 'ok' || !health.canPostEvents) return '⚠️';

  if (!store.get('enabled')) return '⏸';

  const pauseUntil = store.get('pauseUntil');
  if (pauseUntil !== null && pauseUntil > Date.now()) return '⏸';

  const { onBattery } = conditions.getState();
  if (store.get('neverOnBattery') && onBattery) return '⚡';

  if (!isWithinSchedule()) return '🕒';

  const mode = store.get('mode');
  if (mode === 'humanized') return '🧠';
  if (mode === 'zen') return '🔵';
  return '🟢';
}


function createPopupWindow(): void {
  popupWindow = new BrowserWindow({
    width: 320,
    height: 560,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the renderer HTML — path is relative to the project root at runtime
  popupWindow.loadFile(path.join(__dirname, '..', '..', 'src', 'renderer', 'index.html'));

  popupWindow.on('blur', () => hidePopup());

  popupWindow.on('closed', () => {
    popupWindow = null;
  });
}

function showPopup(): void {
  if (!popupWindow) createPopupWindow();
  if (!popupWindow) return;

  const trayBounds = tray!.getBounds();
  const windowBounds = popupWindow.getBounds();

  // Position: centered horizontally under the tray icon
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  const y = Math.round(trayBounds.y + trayBounds.height + 4);

  popupWindow.setPosition(x, y);
  popupWindow.show();
  popupWindow.focus();

  // Register Escape to close while popup is visible
  globalShortcut.register('Escape', () => {
    hidePopup();
  });
}

export function hidePopup(): void {
  globalShortcut.unregister('Escape');
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.hide();
  }
}

export function init(): void {
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle(getTrayTitle());
  tray.setToolTip('AlwaysJiggle');

  createPopupWindow();

  tray.on('click', () => {
    if (!popupWindow || popupWindow.isDestroyed()) {
      createPopupWindow();
    }
    if (popupWindow!.isVisible()) {
      hidePopup();
    } else {
      showPopup();
    }
  });
}

export function updateTrayIcon(): void {
  if (!tray) return;
  tray.setTitle(getTrayTitle());
}

export function getPopupWindow(): BrowserWindow | null {
  return popupWindow;
}

export function resizePopup(height: number): void {
  if (!popupWindow || popupWindow.isDestroyed()) return;
  const clamped = Math.min(Math.max(height, 300), 900);
  popupWindow.setSize(320, clamped);
}
