const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // 文件操作
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  listDirectories: (dirPath) => ipcRenderer.invoke('list-directories', dirPath),
  readConfig: (projectPath) => ipcRenderer.invoke('read-config', projectPath),
  saveConfig: (projectPath, config) => ipcRenderer.invoke('save-config', projectPath, config),
  readProjectFile: (projectPath, fileName) => ipcRenderer.invoke('read-project-file', projectPath, fileName),
  createDirectory: (dirPath) => ipcRenderer.invoke('create-directory', dirPath),
  
  // 对话框
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  
  // 历史记录
  getHistoryPath: () => ipcRenderer.invoke('get-history-path'),
  
  // HTTP 请求（通过 Electron 主进程，不受 CORS 限制）
  httpRequest: (config) => ipcRenderer.invoke('http-request', config),
  httpRequestWithCancel: (config) => ipcRenderer.invoke('http-request-with-cancel', config),
  cancelHttpRequest: (id) => ipcRenderer.invoke('cancel-http-request', id),
});