import { contextBridge, ipcRenderer } from 'electron';
import { AppSettings, SettingsPatch } from './types';

export interface ElectronAPI {
  getVersion: () => Promise<string>;
  getHealth: () => Promise<{ helper: 'ok' | 'missing' | 'error'; accessibilityGranted: boolean }>;
  getState: () => Promise<AppSettings>;
  setState: (patch: SettingsPatch) => Promise<AppSettings>;
  pauseUntil: (untilMs: number) => Promise<AppSettings>;
  onStateChanged: (cb: (state: AppSettings) => void) => void;
  resizeWindow: (height: number) => void;
  openUrl: (url: string) => void;
  openAccessibilitySettings: () => void;
  closePopup: () => void;
  quit: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: (): Promise<string> =>
    ipcRenderer.invoke('get-version'),

  getHealth: (): Promise<{ helper: 'ok' | 'missing' | 'error'; accessibilityGranted: boolean }> =>
    ipcRenderer.invoke('get-health'),

  getState: (): Promise<AppSettings> =>
    ipcRenderer.invoke('get-state'),

  setState: (patch: SettingsPatch): Promise<AppSettings> =>
    ipcRenderer.invoke('set-state', patch),

  pauseUntil: (untilMs: number): Promise<AppSettings> =>
    ipcRenderer.invoke('pause-until', untilMs),

  onStateChanged: (cb: (state: AppSettings) => void): void => {
    ipcRenderer.on('state-changed', (_event, state: AppSettings) => cb(state));
  },

  resizeWindow: (height: number): void => {
    ipcRenderer.send('resize-window', height);
  },

  openUrl: (url: string): void => {
    ipcRenderer.send('open-url', url);
  },

  openAccessibilitySettings: (): void => {
    ipcRenderer.send('open-accessibility-settings');
  },

  closePopup: (): void => {
    ipcRenderer.send('close-popup');
  },

  quit: (): void => {
    ipcRenderer.send('quit');
  },
} satisfies ElectronAPI);
