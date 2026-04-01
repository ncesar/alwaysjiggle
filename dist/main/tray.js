"use strict";
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
let tray = null;
let popupWindow = null;
function getIconPath(active) {
    const name = active ? 'tray-active' : 'tray-inactive';
    return path_1.default.join(__dirname, '..', '..', 'build', `${name}.png`);
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
    const active = store_1.default.get('enabled');
    const img = electron_1.nativeImage.createFromPath(getIconPath(active));
    img.setTemplateImage(true);
    tray = new electron_1.Tray(img);
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
    const active = store_1.default.get('enabled');
    const img = electron_1.nativeImage.createFromPath(getIconPath(active));
    img.setTemplateImage(true);
    tray.setImage(img);
}
function getPopupWindow() {
    return popupWindow;
}
//# sourceMappingURL=tray.js.map