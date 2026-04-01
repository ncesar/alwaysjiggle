"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = init;
exports.isBlocked = isBlocked;
exports.getState = getState;
const electron_1 = require("electron");
const store_1 = __importDefault(require("./store"));
let screenLocked = false;
let onBattery = false;
let onBlockCallback = null;
let onUnblockCallback = null;
function evaluate() {
    const blocked = isBlocked();
    if (blocked) {
        onBlockCallback?.();
    }
    else {
        onUnblockCallback?.();
    }
}
function init(onBlock, onUnblock) {
    onBlockCallback = onBlock;
    onUnblockCallback = onUnblock;
    // Initialize battery state
    onBattery = electron_1.powerMonitor.onBatteryPower;
    electron_1.powerMonitor.on('lock-screen', () => {
        screenLocked = true;
        evaluate();
    });
    electron_1.powerMonitor.on('unlock-screen', () => {
        screenLocked = false;
        evaluate();
    });
    electron_1.powerMonitor.on('on-battery', () => {
        onBattery = true;
        evaluate();
    });
    electron_1.powerMonitor.on('on-ac', () => {
        onBattery = false;
        evaluate();
    });
}
function isBlocked() {
    if (store_1.default.get('neverOnBattery') && onBattery)
        return true;
    if (store_1.default.get('neverOnLockScreen') && screenLocked)
        return true;
    return false;
}
function getState() {
    return { screenLocked, onBattery };
}
//# sourceMappingURL=conditions.js.map