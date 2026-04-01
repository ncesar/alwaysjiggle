"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWithinSchedule = isWithinSchedule;
const store_1 = __importDefault(require("./store"));
function timeStringToMinutes(time) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}
function isScheduleActive(schedule, dayOfWeek, currentMinutes) {
    if (!schedule.enabled)
        return false;
    if (!schedule.days.includes(dayOfWeek))
        return false;
    const startMins = timeStringToMinutes(schedule.startTime);
    const endMins = timeStringToMinutes(schedule.endTime);
    if (endMins > startMins) {
        // Normal range: e.g., 09:00–17:00
        return currentMinutes >= startMins && currentMinutes < endMins;
    }
    else {
        // Midnight-spanning range: e.g., 22:00–02:00
        return currentMinutes >= startMins || currentMinutes < endMins;
    }
}
function isWithinSchedule() {
    const schedules = store_1.default.get('schedules');
    // No schedules configured → always allowed
    if (!schedules || schedules.length === 0)
        return true;
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return schedules.some(s => isScheduleActive(s, dayOfWeek, currentMinutes));
}
//# sourceMappingURL=scheduler.js.map