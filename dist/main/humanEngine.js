"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.start = start;
exports.stop = stop;
exports.pause = pause;
exports.resume = resume;
const child_process_1 = require("child_process");
const conditions_1 = require("./conditions");
const scheduler_1 = require("./scheduler");
const HELPER_BIN = `${__dirname}/../../helpers/jiggle-helper`;
const IDLE_THRESHOLD_SEC = 12;
const DELAY_MS = {
    idle: [20000, 60000],
    light: [5000, 25000],
    burst: [1500, 5000],
    break: [90000, 240000],
};
const TRANSITIONS = {
    idle: [['light', 3], ['idle', 2], ['break', 1]],
    light: [['light', 2], ['burst', 2], ['idle', 1]],
    burst: [['light', 2], ['idle', 2], ['burst', 1]],
    break: [['idle', 3], ['light', 1]],
};
let running = false;
let paused = false;
let timeoutHandle = null;
let currentState = 'light';
let burstRemaining = 0;
function rand(min, max) {
    return min + Math.random() * (max - min);
}
function randInt(min, max) {
    return Math.floor(rand(min, max + 1));
}
function weightedPick(choices) {
    const total = choices.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [value, weight] of choices) {
        r -= weight;
        if (r <= 0)
            return value;
    }
    return choices[choices.length - 1][0];
}
function getIdleSec() {
    try {
        const out = (0, child_process_1.execFileSync)(HELPER_BIN, ['idle-time'], { timeout: 2000 }).toString().trim();
        return parseFloat(out) || 0;
    }
    catch {
        return 0; // assume user is active — safe default
    }
}
function doMouseDrift() {
    const distance = rand(4, 15);
    const angle = Math.random() * 2 * Math.PI;
    const dx = Math.round(distance * Math.cos(angle));
    const dy = Math.round(distance * Math.sin(angle));
    (0, child_process_1.execFileSync)(HELPER_BIN, ['mouse-drift', String(dx), String(dy)], { timeout: 3000 });
}
function doScroll() {
    const amount = (Math.random() < 0.5 ? 1 : -1) * randInt(1, 3);
    (0, child_process_1.execFileSync)(HELPER_BIN, ['scroll', String(amount)], { timeout: 3000 });
}
function doSafeKey() {
    (0, child_process_1.execFileSync)(HELPER_BIN, ['key-safe'], { timeout: 3000 });
}
function runAction(state) {
    if (state === 'idle' || state === 'break')
        return;
    const roll = Math.random();
    if (state === 'light') {
        if (roll < 0.8) {
            doMouseDrift();
        }
        else {
            try {
                doScroll();
            }
            catch { /* needs Accessibility — graceful skip */ }
        }
    }
    else { // burst
        if (roll < 0.6) {
            doMouseDrift();
        }
        else if (roll < 0.9) {
            try {
                doScroll();
            }
            catch { /* needs Accessibility — graceful skip */ }
        }
        else {
            try {
                doSafeKey();
            }
            catch { /* needs Accessibility — graceful skip */ }
        }
    }
}
function scheduleNext() {
    if (!running || paused)
        return;
    let next;
    if (currentState === 'burst' && burstRemaining > 0) {
        burstRemaining--;
        next = 'burst';
    }
    else {
        next = weightedPick(TRANSITIONS[currentState]);
        if (next === 'burst')
            burstRemaining = randInt(2, 4);
    }
    currentState = next;
    const [min, max] = DELAY_MS[currentState];
    const delay = rand(min, max);
    console.log('[human] state=%s delay=%.1fs', currentState, delay / 1000);
    timeoutHandle = setTimeout(tick, delay);
}
function tick() {
    timeoutHandle = null;
    if (!running || paused)
        return;
    if (!(0, conditions_1.isBlocked)() && (0, scheduler_1.isWithinSchedule)()) {
        const idleSec = getIdleSec();
        if (idleSec >= IDLE_THRESHOLD_SEC) {
            try {
                runAction(currentState);
            }
            catch (err) {
                console.error('[human] action error:', err);
            }
        }
        else {
            console.log('[human] user active (%.1fs idle), skipping', idleSec);
        }
    }
    scheduleNext();
}
function start() {
    if (running)
        return;
    running = true;
    paused = false;
    currentState = 'light';
    burstRemaining = 0;
    scheduleNext();
}
function stop() {
    running = false;
    paused = false;
    if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
    }
}
function pause() {
    if (!running)
        return;
    paused = true;
    if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
    }
}
function resume() {
    if (!running || !paused)
        return;
    paused = false;
    scheduleNext();
}
//# sourceMappingURL=humanEngine.js.map