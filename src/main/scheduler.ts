import store from './store';
import { Schedule } from './types';

function timeStringToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function isScheduleActive(schedule: Schedule, dayOfWeek: number, currentMinutes: number): boolean {
  if (!schedule.enabled) return false;
  if (!schedule.days.includes(dayOfWeek)) return false;

  const startMins = timeStringToMinutes(schedule.startTime);
  const endMins   = timeStringToMinutes(schedule.endTime);

  if (endMins > startMins) {
    // Normal range: e.g., 09:00–17:00
    return currentMinutes >= startMins && currentMinutes < endMins;
  } else {
    // Midnight-spanning range: e.g., 22:00–02:00
    return currentMinutes >= startMins || currentMinutes < endMins;
  }
}

export function isWithinSchedule(): boolean {
  const schedules = store.get('schedules');

  // No schedules configured → always allowed
  if (!schedules || schedules.length === 0) return true;

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return schedules.some(s => isScheduleActive(s, dayOfWeek, currentMinutes));
}
