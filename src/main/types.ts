export interface Schedule {
  id: string;
  enabled: boolean;
  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  startTime: string; // "HH:MM" 24h
  endTime: string;   // "HH:MM" 24h
}

export interface AppSettings {
  enabled: boolean;
  mode: 'standard' | 'zen';
  interval: number; // seconds
  launchOnLogin: boolean;
  neverOnBattery: boolean;
  neverOnLockScreen: boolean;
  schedules: Schedule[];
}

export type SettingsPatch = Partial<AppSettings>;
