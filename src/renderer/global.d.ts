import type { AppSettings, SettingsPatch } from '../main/types';

interface ElectronAPI {
  getVersion: () => Promise<string>;
  getHealth: () => Promise<{ helper: 'ok' | 'missing' | 'error'; accessibilityGranted: boolean }>;
  getUpdateInfo: () => Promise<{ hasUpdate: boolean; latestVersion: string; releaseUrl: string } | null>;
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

export {};
