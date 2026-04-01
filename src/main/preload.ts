import { contextBridge, ipcRenderer } from 'electron';
import { AppSettings, SettingsPatch } from './types';

export interface ElectronAPI {
  getState: () => Promise<AppSettings>;
  setState: (patch: SettingsPatch) => Promise<AppSettings>;
  onStateChanged: (cb: (state: AppSettings) => void) => void;
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

  onStateChanged: (cb: (state: AppSettings) => void): void => {
    ipcRenderer.on('state-changed', (_event, state: AppSettings) => cb(state));
  },

  closePopup: (): void => {
    ipcRenderer.send('close-popup');
  },

  quit: (): void => {
    ipcRenderer.send('quit');
  },
} satisfies ElectronAPI);
