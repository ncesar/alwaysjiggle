"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const store_1 = __importDefault(require("./store"));
const trayManager = __importStar(require("./tray"));
const jiggleEngine = __importStar(require("./jiggleEngine"));
const conditions = __importStar(require("./conditions"));
let timedPauseHandle = null;
function clearTimedPause() {
    if (timedPauseHandle !== null) {
        clearTimeout(timedPauseHandle);
        timedPauseHandle = null;
    }
    store_1.default.set('pauseUntil', null);
}
function scheduleTimedResume(untilMs) {
    clearTimedPause();
    store_1.default.set('pauseUntil', untilMs);
    const delay = Math.max(0, untilMs - Date.now());
    timedPauseHandle = setTimeout(() => {
        timedPauseHandle = null;
        store_1.default.set('pauseUntil', null);
        // Only resume if still enabled and not blocked by conditions
        if (store_1.default.get('enabled') && !conditions.isBlocked()) {
            jiggleEngine.resume();
        }
        trayManager.updateTrayIcon();
        pushStateToRenderer();
    }, delay);
}
// Single instance lock
if (!electron_1.app.requestSingleInstanceLock()) {
    electron_1.app.quit();
    process.exit(0);
}
// Keep alive when popup window closes (menu bar app — no quit on window close)
electron_1.app.on('window-all-closed', () => { });
electron_1.app.whenReady().then(() => {
    // Suppress Dock icon — must be called after ready on some macOS versions
    electron_1.app.dock?.hide();
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
        if (jiggleEngine.getState() === 'paused' && store_1.default.get('enabled')) {
            jiggleEngine.resume();
            trayManager.updateTrayIcon();
            pushStateToRenderer();
        }
    });
    // Create tray and popup window
    trayManager.init();
    // Apply persisted login item setting
    applyLoginSetting();
    // Resume jiggling if it was enabled when the app last ran.
    // If a timed pause is still in the future, re-arm the timer; otherwise clear stale value.
    const savedPauseUntil = store_1.default.get('pauseUntil');
    if (savedPauseUntil !== null) {
        if (savedPauseUntil > Date.now()) {
            scheduleTimedResume(savedPauseUntil);
        }
        else {
            store_1.default.set('pauseUntil', null);
        }
    }
    if (store_1.default.get('enabled') && !conditions.isBlocked() && store_1.default.get('pauseUntil') === null) {
        jiggleEngine.start();
    }
    // ── IPC Handlers ──────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('get-state', () => {
        return store_1.default.store;
    });
    electron_1.ipcMain.handle('set-state', (_event, patch) => {
        // Validate that only known keys are patched
        const knownKeys = [
            'enabled', 'mode', 'interval', 'launchOnLogin',
            'neverOnBattery', 'neverOnLockScreen', 'schedules',
        ];
        for (const key of Object.keys(patch)) {
            if (knownKeys.includes(key)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                store_1.default.set(key, patch[key]);
            }
        }
        // If the user manually flips enabled, cancel any active timed pause
        if ('enabled' in patch) {
            clearTimedPause();
        }
        const engineKeys = ['enabled', 'mode', 'interval'];
        const needsRestart = engineKeys.some(k => k in patch);
        if (needsRestart) {
            jiggleEngine.restart();
        }
        if ('launchOnLogin' in patch) {
            applyLoginSetting();
        }
        trayManager.updateTrayIcon();
        pushStateToRenderer();
        return store_1.default.store;
    });
    electron_1.ipcMain.handle('pause-until', (_event, untilMs) => {
        scheduleTimedResume(untilMs);
        jiggleEngine.pause();
        trayManager.updateTrayIcon();
        pushStateToRenderer();
        return store_1.default.store;
    });
    electron_1.ipcMain.on('close-popup', () => {
        trayManager.hidePopup();
    });
    electron_1.ipcMain.on('quit', () => {
        jiggleEngine.stop();
        electron_1.globalShortcut.unregisterAll();
        electron_1.app.quit();
    });
});
function pushStateToRenderer() {
    const win = trayManager.getPopupWindow();
    if (win && !win.isDestroyed() && win.isVisible()) {
        win.webContents.send('state-changed', store_1.default.store);
    }
}
function applyLoginSetting() {
    electron_1.app.setLoginItemSettings({
        openAtLogin: store_1.default.get('launchOnLogin'),
        openAsHidden: true,
    });
}
//# sourceMappingURL=index.js.map