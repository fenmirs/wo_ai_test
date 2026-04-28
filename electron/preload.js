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

  // 项目列表
  readProjectList: () => ipcRenderer.invoke('read-project-list'),
  saveProjectList: (projectList) => ipcRenderer.invoke('save-project-list', projectList),
  readDirectoryProjectList: (dirPath) => ipcRenderer.invoke('read-directory-project-list', dirPath),
  scanDirectoryProjects: (dirPath) => ipcRenderer.invoke('scan-directory-projects', dirPath),
  createNewProject: (dirPath, projectName) => ipcRenderer.invoke('create-new-project', dirPath, projectName),
  readProjectConfig: (dirPath, projectId) => ipcRenderer.invoke('read-project-config', dirPath, projectId),
  saveProjectConfig: (dirPath, projectId, config) => ipcRenderer.invoke('save-project-config', dirPath, projectId, config),
  readProjectHistory: (dirPath, projectId) => ipcRenderer.invoke('read-project-history', dirPath, projectId),
  saveProjectHistory: (dirPath, projectId, history) => ipcRenderer.invoke('save-project-history', dirPath, projectId, history),
  
  // 对话框
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  saveFile: (options) => ipcRenderer.invoke('save-file', options),
  
  // 历史记录
  getHistoryPath: () => ipcRenderer.invoke('get-history-path'),
  
  // HTTP 请求（通过 Electron 主进程，不受 CORS 限制）
  httpRequest: (config) => ipcRenderer.invoke('http-request', config),
  httpRequestWithCancel: (config) => ipcRenderer.invoke('http-request-with-cancel', config),
  cancelHttpRequest: (id) => ipcRenderer.invoke('cancel-http-request', id),
});