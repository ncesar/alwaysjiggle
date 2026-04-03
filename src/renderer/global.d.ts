import type { AppSettings, SettingsPatch } from '../main/types';

interface ElectronAPI {
  getVersion: () => Promise<string>;
  getState: () => Promise<AppSettings>;
  setState: (patch: SettingsPatch) => Promise<AppSettings>;
  pauseUntil: (untilMs: number) => Promise<AppSettings>;
  onStateChanged: (cb: (state: AppSettings) => void) => void;
  resizeWindow: (height: number) => void;
  openUrl: (url: string) => void;
  closePopup: () => void;
  quit: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
