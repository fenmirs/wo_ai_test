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
  deleteProject: (dirPath, projectId) => ipcRenderer.invoke('delete-project', dirPath, projectId),
  
  // Per-API 文件操作（新版 v2 格式）
  readAPIConfig: (dirPath, projectId, apiId) => ipcRenderer.invoke('read-api-config', dirPath, projectId, apiId),
  writeAPIConfig: (dirPath, projectId, apiId, data) => ipcRenderer.invoke('write-api-config', dirPath, projectId, apiId, data),
  readAPIHistory: (dirPath, projectId, apiId) => ipcRenderer.invoke('read-api-history', dirPath, projectId, apiId),
  readAllAPIHistory: (dirPath, projectId) => ipcRenderer.invoke('read-all-api-history', dirPath, projectId),
  writeAPIHistory: (dirPath, projectId, apiId, data) => ipcRenderer.invoke('write-api-history', dirPath, projectId, apiId, data),
  deleteAPIFile: (dirPath, projectId, apiId) => ipcRenderer.invoke('delete-api-file', dirPath, projectId, apiId),
  moveAPIFileToTrashed: (dirPath, projectId, apiId) => ipcRenderer.invoke('move-api-file-to-trashed', dirPath, projectId, apiId),
  listAPIFiles: (dirPath, projectId) => ipcRenderer.invoke('list-api-files', dirPath, projectId),
  
  // Trash 文件操作（新版 v3 结构）
  moveAPIToTrash: (dirPath, projectId, apiId) => ipcRenderer.invoke('move-api-to-trash', dirPath, projectId, apiId),
  restoreAPIFromTrash: (dirPath, projectId, apiId) => ipcRenderer.invoke('restore-api-from-trash', dirPath, projectId, apiId),
  permanentDeleteTrashAPI: (dirPath, projectId, apiId) => ipcRenderer.invoke('permanent-delete-trash-api', dirPath, projectId, apiId),
  listTrashAPIFiles: (dirPath, projectId) => ipcRenderer.invoke('list-trash-api-files', dirPath, projectId),
  readTrashAPIConfig: (dirPath, projectId, apiId) => ipcRenderer.invoke('read-trash-api-config', dirPath, projectId, apiId),
  emptyTrashDirectory: (dirPath, projectId) => ipcRenderer.invoke('empty-trash-directory', dirPath, projectId),
  moveGroupToTrash: (dirPath, projectId, apiIds) => ipcRenderer.invoke('move-group-to-trash', dirPath, projectId, apiIds),
  
  // 对话框
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  saveFile: (options) => ipcRenderer.invoke('save-file', options),
  
  // HTTP 请求（通过 Electron 主进程，不受 CORS 限制）
  httpRequestWithCancel: (config) => ipcRenderer.invoke('http-request-with-cancel', config),
  cancelHttpRequest: (id) => ipcRenderer.invoke('cancel-http-request', id),

  // 开发者工具
  toggleDevtools: () => ipcRenderer.send('toggle-devtools'),

  // 在文件管理器中显示
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
});