import type { AppSettings, SettingsPatch } from '../main/types';

interface ElectronAPI {
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

export {};
