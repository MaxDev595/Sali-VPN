const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sali', {
  home: () => ipcRenderer.invoke('home'),
  redeem: (code) => ipcRenderer.invoke('redeem', code),
  connect: () => ipcRenderer.invoke('vpn:connect'),
  disconnect: () => ipcRenderer.invoke('vpn:disconnect'),
  vpnState: () => ipcRenderer.invoke('vpn:state'),
  onVpnState: (callback) => { ipcRenderer.on('vpn:state', (_event, payload) => callback(payload)); },
  openBot: (start) => ipcRenderer.invoke('open:bot', start),
  openSupport: () => ipcRenderer.invoke('open:support'),
  openDownload: () => ipcRenderer.invoke('open:download'),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  copy: (text) => ipcRenderer.invoke('clipboard:write', text),
  version: () => ipcRenderer.invoke('app:version'),
});
