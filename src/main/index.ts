import { app, ipcMain, globalShortcut } from 'electron';

app.setName('AlwaysJiggle');
import store from './store';
import * as trayManager from './tray';
import * as jiggleEngine from './jiggleEngine';
import * as conditions from './conditions';
import { SettingsPatch } from './types';

let timedPauseHandle: ReturnType<typeof setTimeout> | null = null;

function clearTimedPause(): void {
  if (timedPauseHandle !== null) {
    clearTimeout(timedPauseHandle);
    timedPauseHandle = null;
  }
  store.set('pauseUntil', null);
}

function scheduleTimedResume(untilMs: number): void {
  clearTimedPause();
  store.set('pauseUntil', untilMs);
  const delay = Math.max(0, untilMs - Date.now());
  timedPauseHandle = setTimeout(() => {
    timedPauseHandle = null;
    store.set('pauseUntil', null);
    // Only resume if still enabled and not blocked by conditions
    if (store.get('enabled') && !conditions.isBlocked()) {
      jiggleEngine.resume();
    }
    trayManager.updateTrayIcon();
    pushStateToRenderer();
  }, delay);
}

// Single instance lock
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Keep alive when popup window closes (menu bar app — no quit on window close)
app.on('window-all-closed', () => { /* intentional no-op */ });

app.whenReady().then(() => {
  // Suppress Dock icon — must be called after ready on some macOS versions
  app.dock?.hide();

  // Initialize condition monitor with engine callbacks
  conditions.init(
    // onBlock: pause immediately
    () => {
      if (jiggleEngine.getState() === 'running') {
        jiggleEngine.pause();
        trayManager.updateTrayIcon();
        pushStateToRenderer();
      }
    },
    // onUnblock: resume if we were paused (and still enabled)
    () => {
      if (jiggleEngine.getState() === 'paused' && store.get('enabled')) {
        jiggleEngine.resume();
        trayManager.updateTrayIcon();
        pushStateToRenderer();
      }
    }
  );

  // Create tray and popup window
  trayManager.init();

  // Apply persisted login item setting
  applyLoginSetting();

  // Resume jiggling if it was enabled when the app last ran.
  // If a timed pause is still in the future, re-arm the timer; otherwise clear stale value.
  const savedPauseUntil = store.get('pauseUntil');
  if (savedPauseUntil !== null) {
    if (savedPauseUntil > Date.now()) {
      scheduleTimedResume(savedPauseUntil);
    } else {
      store.set('pauseUntil', null);
    }
  }

  if (store.get('enabled') && !conditions.isBlocked() && store.get('pauseUntil') === null) {
    jiggleEngine.start();
  }

  // ── IPC Handlers ──────────────────────────────────────────────────────────

  ipcMain.handle('get-state', () => {
    return store.store;
  });

  ipcMain.handle('set-state', (_event, patch: SettingsPatch) => {
    // Validate that only known keys are patched
    const knownKeys: (keyof SettingsPatch)[] = [
      'enabled', 'mode', 'interval', 'launchOnLogin',
      'neverOnBattery', 'neverOnLockScreen', 'schedules',
    ];
    for (const key of Object.keys(patch) as (keyof SettingsPatch)[]) {
      if (knownKeys.includes(key)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        store.set(key, patch[key] as any);
      }
    }

    // If the user manually flips enabled, cancel any active timed pause
    if ('enabled' in patch) {
      clearTimedPause();
    }

    const engineKeys: (keyof SettingsPatch)[] = ['enabled', 'mode', 'interval'];
    const needsRestart = engineKeys.some(k => k in patch);
    if (needsRestart) {
      jiggleEngine.restart();
    }

    if ('launchOnLogin' in patch) {
      applyLoginSetting();
    }

    trayManager.updateTrayIcon();
    pushStateToRenderer();

    return store.store;
  });

  ipcMain.handle('pause-until', (_event, untilMs: number) => {
    scheduleTimedResume(untilMs);
    jiggleEngine.pause();
    trayManager.updateTrayIcon();
    pushStateToRenderer();
    return store.store;
  });

  ipcMain.on('close-popup', () => {
    trayManager.hidePopup();
  });

  ipcMain.on('quit', () => {
    jiggleEngine.stop();
    globalShortcut.unregisterAll();
    app.quit();
  });
});

function pushStateToRenderer(): void {
  const win = trayManager.getPopupWindow();
  if (win && !win.isDestroyed() && win.isVisible()) {
    win.webContents.send('state-changed', store.store);
  }
}

function applyLoginSetting(): void {
  app.setLoginItemSettings({
    openAtLogin: store.get('launchOnLogin'),
    openAsHidden: true,
  });
}
