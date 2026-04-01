import { Tray, BrowserWindow, nativeImage, app, globalShortcut } from 'electron';
import path from 'path';
import store from './store';

let tray: Tray | null = null;
let popupWindow: BrowserWindow | null = null;

function getIconPath(active: boolean): string {
  const name = active ? 'tray-active' : 'tray-inactive';
  return path.join(__dirname, '..', '..', 'build', `${name}.png`);
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
  const active = store.get('enabled');
  const img = nativeImage.createFromPath(getIconPath(active));
  img.setTemplateImage(true);

  tray = new Tray(img);
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
  const active = store.get('enabled');
  const img = nativeImage.createFromPath(getIconPath(active));
  img.setTemplateImage(true);
  tray.setImage(img);
}

export function getPopupWindow(): BrowserWindow | null {
  return popupWindow;
}
