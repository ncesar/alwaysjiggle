"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    getState: () => electron_1.ipcRenderer.invoke('get-state'),
    setState: (patch) => electron_1.ipcRenderer.invoke('set-state', patch),
    onStateChanged: (cb) => {
        electron_1.ipcRenderer.on('state-changed', (_event, state) => cb(state));
    },
    closePopup: () => {
        electron_1.ipcRenderer.send('close-popup');
    },
    quit: () => {
        electron_1.ipcRenderer.send('quit');
    },
});
//# sourceMappingURL=preload.js.map