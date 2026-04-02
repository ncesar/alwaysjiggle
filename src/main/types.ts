export interface Schedule {
  id: string;
  enabled: boolean;
  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  startTime: string; // "HH:MM" 24h
  endTime: string;   // "HH:MM" 24h
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
}

export type SettingsPatch = Partial<AppSettings>;
