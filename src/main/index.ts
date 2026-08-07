import { app, ipcMain, globalShortcut, shell, powerMonitor, systemPreferences } from 'electron';

app.setName('AlwaysJiggle');
import store from './store';
import * as trayManager from './tray';
import * as jiggleEngine from './jiggleEngine';
import * as conditions from './conditions';
import { isWithinSchedule } from './scheduler';
import { SettingsPatch } from './types';
import pkg from '../../package.json';

let timedPauseHandle: ReturnType<typeof setTimeout> | null = null;
let lastInSchedule = false; // initialised inside whenReady once the store is ready

interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;  // v-prefix stripped, e.g. "1.3"
  releaseUrl: string;
}
let cachedUpdateInfo: UpdateInfo | null = null;

async function checkForUpdate(): Promise<void> {
  try {
    const res = await fetch(
      'https://api.github.com/repos/ncesar/AlwaysJiggle/releases/latest',
      { headers: { 'User-Agent': 'AlwaysJiggle-updater' } }
    );
    if (!res.ok) return;
    const data = await res.json() as { tag_name: string; html_url: string };
    const latest  = data.tag_name.replace(/^v/i, '');
    const current = pkg.version.replace(/^v/i, '');
    cachedUpdateInfo = { hasUpdate: latest !== current, latestVersion: latest, releaseUrl: data.html_url };
  } catch {
    // offline or API error — leave cache null, show nothing
  }
}

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
    // onUnblock: resume if we were paused, still enabled, not in a timed pause, and schedule allows it
    () => {
      if (jiggleEngine.getState() === 'paused' && store.get('enabled') && store.get('pauseUntil') === null) {
        if (isWithinSchedule()) {
          jiggleEngine.resume();
        }
        trayManager.updateTrayIcon();
        pushStateToRenderer();
      }
    }
  );

  // Create tray and popup window
  trayManager.init();

  // Push fresh computed state whenever the popup becomes visible,
  // in case it missed updates while hidden (e.g. Mac was locked).
  trayManager.getPopupWindow()?.on('show', () => pushStateToRenderer());

  const health = jiggleEngine.getHealth();
  console.log('[startup] helper=%s accessibility=%s',
    health.helper,
    health.accessibilityGranted ? 'granted' : 'NOT GRANTED');

  // Ask macOS for Accessibility rather than leaving the user to find the pane
  // and press "+". Adding an app by hand records a different TCC entry than the
  // one the system creates when an app requests access through this API, and a
  // hand-added entry does not reliably cover the helper subprocess.
  //
  // macOS shows this dialog at most once per code identity and silently no-ops
  // afterwards, so calling it on every denied launch cannot nag the user.
  if (!health.accessibilityGranted) {
    systemPreferences.isTrustedAccessibilityClient(true);
  }

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

  // Sync engine state to the current schedule window.
  // Called on the 30s poll, on system resume (sleep/wake), and on unlock.
  lastInSchedule = isWithinSchedule();
  function syncSchedule(): void {
    const inSchedule = isWithinSchedule();
    if (inSchedule !== lastInSchedule) {
      lastInSchedule = inSchedule;
      if (!inSchedule && jiggleEngine.getState() === 'running') {
        jiggleEngine.pause();
      } else if (inSchedule
                 && jiggleEngine.getState() === 'paused'
                 && store.get('enabled')
                 && store.get('pauseUntil') === null
                 && !conditions.isBlocked()) {
        jiggleEngine.resume();
      }
      pushStateToRenderer();
    }
    // Outside the transition guard: helper health and Accessibility can change
    // at any time (a macOS update silently drops the grant), and none of the
    // other updateTrayIcon() call sites correlate with that. Without this the
    // ⚠️ state could sit unnoticed for hours. One cached probe per 30s.
    trayManager.updateTrayIcon();
    if (!jiggleEngine.getHealth().accessibilityGranted) watchForAccessGrant();
  }

  setInterval(syncSchedule, 30_000);

  // The 30s poll is too coarse for the one moment it matters most: the user
  // grants Accessibility in System Settings and switches back to a tray still
  // reading ⚠️. Half a minute of that looks like the grant did not work, and
  // the usual reaction is to toggle settings until something changes.
  //
  // Poll quickly, but only while the grant is missing — once it lands the timer
  // stops, so a working install never pays for this. syncSchedule restarts it
  // if the grant is ever revoked (an app update or macOS update can drop it).
  let accessWatch: ReturnType<typeof setInterval> | null = null;
  function watchForAccessGrant(): void {
    if (accessWatch !== null) return;
    accessWatch = setInterval(() => {
      const granted = jiggleEngine.getHealth().accessibilityGranted;
      trayManager.updateTrayIcon();
      pushStateToRenderer();
      if (granted && accessWatch !== null) {
        clearInterval(accessWatch);
        accessWatch = null;
      }
    }, 2_000);
  }
  if (!health.accessibilityGranted) watchForAccessGrant();

  // setInterval is paused during system sleep, so the 30s poll never fires
  // while the machine is suspended. Re-evaluate the schedule immediately on wake.
  powerMonitor.on('resume', syncSchedule);

  // ── IPC Handlers ──────────────────────────────────────────────────────────

  ipcMain.handle('get-version', () => pkg.version);
  ipcMain.handle('get-health', () => jiggleEngine.getHealth());
  ipcMain.handle('get-update-info', async () => {
    if (cachedUpdateInfo === null) await checkForUpdate();
    return cachedUpdateInfo;
  });

  ipcMain.handle('get-state', () => {
    return getComputedState();
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

    if ('schedules' in patch) {
      syncSchedule();
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

  ipcMain.on('open-url', (_event, url: string) => {
    shell.openExternal(url);
  });

  ipcMain.on('open-accessibility-settings', () => {
    shell.openExternal('x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Accessibility');
  });

  ipcMain.on('resize-window', (_event, height: number) => {
    trayManager.resizePopup(height);
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

function getComputedState() {
  return { ...store.store, scheduledOff: !isWithinSchedule() };
}

function pushStateToRenderer(): void {
  const win = trayManager.getPopupWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send('state-changed', getComputedState());
  }
}

function applyLoginSetting(): void {
  if (!app.isPackaged) {
    // Dev mode: unregister any stale login item pointing to the raw Electron binary
    app.setLoginItemSettings({ openAtLogin: false });
    return;
  }
  app.setLoginItemSettings({
    openAtLogin: store.get('launchOnLogin'),
    openAsHidden: true,
  });
}
