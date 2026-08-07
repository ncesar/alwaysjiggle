export interface Schedule {
  id: string;
  enabled: boolean;
  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  startTime: string; // "HH:MM" 24h
  endTime: string;   // "HH:MM" 24h
}

export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string; // v-prefix stripped, e.g. "1.2.0"
  releaseUrl: string;
}

export interface AppSettings {
  enabled: boolean;
  mode: 'standard' | 'zen' | 'humanized';
  interval: number; // seconds
  launchOnLogin: boolean;
  neverOnBattery: boolean;
  neverOnLockScreen: boolean;
  schedules: Schedule[];
  pauseUntil: number | null; // ms timestamp; null = no timed pause
  scheduledOff?: boolean; // computed at send time; true when current time is outside all schedule windows
  updateInfo?: UpdateInfo | null; // computed at send time; null until the first successful check
}

export type SettingsPatch = Partial<AppSettings>;
