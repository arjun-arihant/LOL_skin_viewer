const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lolAPI', {
    getSkins: () => ipcRenderer.invoke('get-skins'),
    getCachedSkins: () => ipcRenderer.invoke('get-cached-skins'),
    refreshSkins: () => ipcRenderer.invoke('refresh-skins'),
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    onLiveGameEvent: (callback) => ipcRenderer.on('live-game-event', (event, data) => callback(data)),
});
