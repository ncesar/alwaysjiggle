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
exports.hidePopup = hidePopup;
exports.init = init;
exports.updateTrayIcon = updateTrayIcon;
exports.getPopupWindow = getPopupWindow;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const store_1 = __importDefault(require("./store"));
const conditions = __importStar(require("./conditions"));
const scheduler_1 = require("./scheduler");
let tray = null;
let popupWindow = null;
function getTrayTitle() {
    if (!store_1.default.get('enabled'))
        return '⏸ Paused';
    const pauseUntil = store_1.default.get('pauseUntil');
    if (pauseUntil !== null && pauseUntil > Date.now())
        return '⏸ Paused';
    const { onBattery } = conditions.getState();
    if (store_1.default.get('neverOnBattery') && onBattery)
        return '⚡ Battery pause';
    if (!(0, scheduler_1.isWithinSchedule)())
        return '🕒 Scheduled off';
    const mode = store_1.default.get('mode');
    if (mode === 'humanized')
        return '🧠 Jiggling(Human)';
    if (mode === 'zen')
        return '🟢 Jiggling(Zen)';
    return '🟢 Jiggling(Standard)';
}
function createPopupWindow() {
    popupWindow = new electron_1.BrowserWindow({
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
            preload: path_1.default.join(__dirname, 'preload.js'),
        },
    });
    // Load the renderer HTML — path is relative to the project root at runtime
    popupWindow.loadFile(path_1.default.join(__dirname, '..', '..', 'src', 'renderer', 'index.html'));
    popupWindow.on('closed', () => {
        popupWindow = null;
    });
}
function showPopup() {
    if (!popupWindow)
        createPopupWindow();
    if (!popupWindow)
        return;
    const trayBounds = tray.getBounds();
    const windowBounds = popupWindow.getBounds();
    // Position: centered horizontally under the tray icon
    const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
    const y = Math.round(trayBounds.y + trayBounds.height + 4);
    popupWindow.setPosition(x, y);
    popupWindow.show();
    popupWindow.focus();
    // Register Escape to close while popup is visible
    electron_1.globalShortcut.register('Escape', () => {
        hidePopup();
    });
}
function hidePopup() {
    electron_1.globalShortcut.unregister('Escape');
    if (popupWindow && !popupWindow.isDestroyed()) {
        popupWindow.hide();
    }
}
function init() {
    tray = new electron_1.Tray(electron_1.nativeImage.createEmpty());
    tray.setTitle(getTrayTitle());
    tray.setToolTip('AlwaysJiggle');
    createPopupWindow();
    tray.on('click', () => {
        if (!popupWindow || popupWindow.isDestroyed()) {
            createPopupWindow();
        }
        if (popupWindow.isVisible()) {
            hidePopup();
        }
        else {
            showPopup();
        }
    });
}
function updateTrayIcon() {
    if (!tray)
        return;
    tray.setTitle(getTrayTitle());
}
function getPopupWindow() {
    return popupWindow;
}
//# sourceMappingURL=tray.js.map