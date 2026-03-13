const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  startDevAll: (options) => ipcRenderer.invoke("start-dev-all", options),
  runDevBat: () => ipcRenderer.invoke("run-dev-bat"),
  stopProcess: (processId) => ipcRenderer.invoke("stop-process", processId),
  stopAllProcesses: () => ipcRenderer.invoke("stop-all-processes"),
  getProjects: () => ipcRenderer.invoke("get-projects"),
  toggleProject: (projectName) =>
    ipcRenderer.invoke("toggle-project", projectName),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  openVSCode: (projectPath) => ipcRenderer.invoke("open-vscode", projectPath),
  openCmdPrompt: (projectPath, script) =>
    ipcRenderer.invoke("open-cmd-prompt", projectPath, script),
  onProcessOutput: (callback) => {
    ipcRenderer.on("process-output", (event, data) => callback(data));
  },
  onProcessClosed: (callback) => {
    ipcRenderer.on("process-closed", (event, data) => callback(data));
  },
  onProcessError: (callback) => {
    ipcRenderer.on("process-error", (event, data) => callback(data));
  },
});
