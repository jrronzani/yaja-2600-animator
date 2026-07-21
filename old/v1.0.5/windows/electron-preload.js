const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("YaJaDesktop", {
  isDesktop: true,
  platform: process.platform,
  onMenuCommand(callback) {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, command) => callback(command);
    ipcRenderer.on("desktop-menu-command", listener);
    return () => ipcRenderer.removeListener("desktop-menu-command", listener);
  },
  openProject(options) {
    return ipcRenderer.invoke("desktop:open-project-file", options || {});
  },
  saveProject(options) {
    return ipcRenderer.invoke("desktop:save-project-file", options || {});
  },
  saveProjectAs(options) {
    return ipcRenderer.invoke("desktop:save-project-file-as", options || {});
  },
  openFile(options) {
    return ipcRenderer.invoke("desktop:open-file", options || {});
  },
  saveFileAs(options) {
    return ipcRenderer.invoke("desktop:save-file-as", options || {});
  }
});
