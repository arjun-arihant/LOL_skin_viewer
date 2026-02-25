const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lolAPI', {
    getSkins: () => ipcRenderer.invoke('get-skins'),
    refreshSkins: () => ipcRenderer.invoke('refresh-skins'),
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
});
