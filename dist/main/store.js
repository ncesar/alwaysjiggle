"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_store_1 = __importDefault(require("electron-store"));
const store = new electron_store_1.default({
    schema: {
        enabled: {
            type: 'boolean',
            default: false,
        },
        mode: {
            type: 'string',
            enum: ['standard', 'zen', 'humanized'],
            default: 'standard',
        },
        interval: {
            type: 'number',
            default: 60,
        },
        launchOnLogin: {
            type: 'boolean',
            default: false,
        },
        neverOnBattery: {
            type: 'boolean',
            default: true,
        },
        neverOnLockScreen: {
            type: 'boolean',
            default: true,
        },
        schedules: {
            type: 'array',
            default: [],
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    enabled: { type: 'boolean' },
                    days: { type: 'array', items: { type: 'number' } },
                    startTime: { type: 'string' },
                    endTime: { type: 'string' },
                },
            },
        },
    },
});
exports.default = store;
//# sourceMappingURL=store.js.map