import { contextBridge, ipcRenderer } from 'electron';
import { AppSettings, SettingsPatch } from './types';

export interface ElectronAPI {
  getState: () => Promise<AppSettings>;
  setState: (patch: SettingsPatch) => Promise<AppSettings>;
  pauseUntil: (untilMs: number) => Promise<AppSettings>;
  onStateChanged: (cb: (state: AppSettings) => void) => void;
  resizeWindow: (height: number) => void;
  closePopup: () => void;
  quit: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
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

  closePopup: (): void => {
    ipcRenderer.send('close-popup');
  },

  quit: (): void => {
    ipcRenderer.send('quit');
  },
} satisfies ElectronAPI);
