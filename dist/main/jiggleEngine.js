"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAccessibilityPermission = checkAccessibilityPermission;
exports.start = start;
exports.stop = stop;
exports.pause = pause;
exports.resume = resume;
exports.restart = restart;
exports.getState = getState;
const electron_1 = require("electron");
const child_process_1 = require("child_process");
const store_1 = __importDefault(require("./store"));
const conditions_1 = require("./conditions");
const scheduler_1 = require("./scheduler");
let state = 'stopped';
let intervalHandle = null;
let zenBlockerId = null;
let caffeinateProcess = null;
// ── Swift helper binary ───────────────────────────────────────────────────────
// JXA's CoreGraphics ObjC bridge crashes (SIGSEGV) when spawned from Electron
// because the subprocess doesn't get a window server connection.
// A compiled Swift binary runs as its own process with full macOS API access.
const HELPER_BIN = `${__dirname}/../../helpers/jiggle-helper`;
function runHelper(cmd) {
    return (0, child_process_1.execFileSync)(HELPER_BIN, [cmd], { timeout: 3000 }).toString().trim();
}
// ── Standard jiggle ──────────────────────────────────────────────────────────
function checkAccessibilityPermission() {
    try {
        runHelper('mouse');
        return true;
    }
    catch {
        return false;
    }
}
function doStandardJiggle() {
    const result = runHelper('mouse');
    console.log('[jiggle] position:', result);
}
// ── Zen mode helpers ─────────────────────────────────────────────────────────
function startZen() {
    if (zenBlockerId !== null)
        return;
    zenBlockerId = electron_1.powerSaveBlocker.start('prevent-display-sleep');
    // Spawn caffeinate for belt-and-suspenders: -d (display), -i (idle)
    caffeinateProcess = (0, child_process_1.spawn)('caffeinate', ['-di'], {
        detached: false,
        stdio: 'ignore',
    });
}
function stopZen() {
    if (zenBlockerId !== null) {
        electron_1.powerSaveBlocker.stop(zenBlockerId);
        zenBlockerId = null;
    }
    if (caffeinateProcess !== null) {
        caffeinateProcess.kill();
        caffeinateProcess = null;
    }
}
// ── Tick ─────────────────────────────────────────────────────────────────────
function tick() {
    console.log('[tick] state=%s blocked=%s inSchedule=%s', state, (0, conditions_1.isBlocked)(), (0, scheduler_1.isWithinSchedule)());
    if (state !== 'running')
        return;
    if ((0, conditions_1.isBlocked)())
        return;
    if (!(0, scheduler_1.isWithinSchedule)())
        return;
    const mode = store_1.default.get('mode');
    console.log('[tick] firing jiggle, mode=%s', mode);
    if (mode === 'standard') {
        try {
            doStandardJiggle();
        }
        catch (err) {
            console.error('[jiggle] error:', err);
        }
    }
    else {
        // Zen: powerSaveBlocker + caffeinate prevent system sleep.
        // IOPMAssertionDeclareUserActivity resets HIDIdleTime so apps like
        // Slack/Teams don't show "away" — no cursor movement required.
        try {
            runHelper('zen');
        }
        catch {
            // Non-critical
        }
    }
}
// ── Public API ───────────────────────────────────────────────────────────────
function start() {
    if (state === 'running')
        return;
    const intervalSec = store_1.default.get('interval');
    const mode = store_1.default.get('mode');
    if (mode === 'zen')
        startZen();
    intervalHandle = setInterval(tick, intervalSec * 1000);
    state = 'running';
    // Fire once immediately (respects conditions + schedule)
    tick();
}
function stop() {
    if (intervalHandle !== null) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
    stopZen();
    state = 'stopped';
}
function pause() {
    if (state !== 'running')
        return;
    stopZen();
    state = 'paused';
}
function resume() {
    if (state !== 'paused')
        return;
    if (!store_1.default.get('enabled'))
        return;
    const mode = store_1.default.get('mode');
    if (mode === 'zen')
        startZen();
    state = 'running';
    tick(); // fire once immediately on resume
}
function restart() {
    stop();
    if (store_1.default.get('enabled')) {
        start();
    }
}
function getState() {
    return state;
}
//# sourceMappingURL=jiggleEngine.js.map