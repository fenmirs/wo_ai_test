const { app, BrowserWindow, ipcMain, dialog, net, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const axios = require('axios');
const https = require('https');

// 存储活跃的 HTTP 请求，用于取消
const activeRequests = new Map();

// 检查是否在开发模式
const isDev = process.argv.includes('--dev') || process.env.ELECTRON_DEV === 'true';

// 开发模式下启用热加载
if (isDev) {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, '../node_modules/.bin/electron.cmd'),
      hardResetMethod: 'exit'
    });
    console.log('[Electron] 热加载已启用');
  } catch (err) {
    console.warn('[Electron] 热加载初始化失败:', err.message);
  }
}

// 获取应用根目录
function getAppRoot() {
  if (app.isPackaged) {
    return path.dirname(app.getPath('exe'));
  }
  return __dirname;
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#0f172a',
    show: false,
    autoHideMenuBar: true
  });

  const buildPath = path.join(__dirname, '../build/index.html');
  const buildExists = fs.existsSync(buildPath);
  
  if (isDev) {
    console.log('[Electron] 加载开发服务器 http://localhost:3000');
    mainWindow.loadURL('http://localhost:3000');
    if (process.env.OPEN_DEVTOOLS === 'true') {
      mainWindow.webContents.openDevTools();
    }
  } else {
    console.log('[Electron] 加载打包文件:', buildPath);
    let htmlContent = fs.readFileSync(buildPath, 'utf-8');
    htmlContent = htmlContent.replace(/\/static\//g, 'static/');
    const tempHtmlPath = path.join(__dirname, '../build/index-fixed.html');
    fs.writeFileSync(tempHtmlPath, htmlContent);
    mainWindow.loadFile(tempHtmlPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 忽略 SSL 证书错误（支持自签名证书）
  mainWindow.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // 忽略所有 SSL 证书错误（支持自签名证书）
  // 同时处理 webContents 和 net.request 的证书错误
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
  });

  // 全局忽略证书验证（对 net.request 生效）
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    callback(0); // 0 = 证书有效
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC 通信 - 文件系统操作
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, data: content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-directories', async (event, dirPath) => {
  try {
    let resolvedPath = dirPath;
    if (!path.isAbsolute(dirPath)) {
      resolvedPath = path.join(getAppRoot(), dirPath);
    }
    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
    const result = [];
    
    for (const entry of entries) {
      if (!entry.name.startsWith('.') && entry.isDirectory()) {
        const configPath = path.join(resolvedPath, entry.name, 'config.json');
        try {
          fs.accessSync(configPath);
          result.push({
            name: entry.name,
            path: path.join(resolvedPath, entry.name)
          });
        } catch {
          // 忽略没有 config.json 的目录
        }
      }
    }
    
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-config', async (event, projectPath) => {
  try {
    // 处理相对路径
    let resolvedPath = projectPath;
    if (!path.isAbsolute(projectPath)) {
      resolvedPath = path.join(getAppRoot(), projectPath);
    }
    const configPath = path.join(resolvedPath, 'config.json');
    console.log('[Electron] 读取配置:', configPath);
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    return { success: true, data: config };
  } catch (error) {
    console.error('[Electron] 读取配置失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-config', async (event, projectPath, config) => {
  try {
    let resolvedPath = projectPath;
    if (!path.isAbsolute(projectPath)) {
      resolvedPath = path.join(getAppRoot(), projectPath);
    }
    const configPath = path.join(resolvedPath, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 生成随机项目ID
function generateProjectId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return timestamp + random;
}

// 扫描目录下的所有项目配置
function scanProjectsInDirectory(dirPath) {
  const projects = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('_config.json')) {
        const projectId = entry.name.replace('_config.json', '');
        const configPath = path.join(dirPath, entry.name);
        try {
          const content = fs.readFileSync(configPath, 'utf-8');
          const config = JSON.parse(content);
          projects.push({
            id: projectId,
            name: config.projectName || projectId,
            path: dirPath,
            configFile: entry.name,
            historyFile: projectId + '_history.json'
          });
        } catch {
          // 跳过无效的配置文件
        }
      }
    }
  } catch {
    // 目录不存在
  }
  return projects;
}

ipcMain.handle('read-project-list', async () => {
  return { success: true, data: [] };
});

ipcMain.handle('save-project-list', async (event, projectList) => {
  return { success: true };
});

ipcMain.handle('read-directory-project-list', async (event, dirPath) => {
  try {
    const projectJsonPath = path.join(dirPath, 'project.json');
    if (fs.existsSync(projectJsonPath)) {
      const content = fs.readFileSync(projectJsonPath, 'utf-8');
      const data = JSON.parse(content);
      return { success: true, data: data.projects || [] };
    }
    return { success: true, data: [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 创建新项目
ipcMain.handle('create-new-project', async (event, dirPath, projectName) => {
  try {
    const projectId = generateProjectId();
    const configFile = projectId + '_config.json';
    const historyFile = projectId + '_history.json';
    
    const configData = {
      projectName: projectName,
      profile: [
        {
          activate: true,
          name: 'dev',
          domain: 'localhost',
          'api-prj': ':8080/api'
        }
      ],
      groups: [],
      apis: []
    };
    
    const historyData = [];
    
    // 写入配置文件
    const configPath = path.join(dirPath, configFile);
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf-8');
    
    // 写入历史记录文件
    const historyPath = path.join(dirPath, historyFile);
    fs.writeFileSync(historyPath, JSON.stringify(historyData, null, 2), 'utf-8');
    
    return {
      success: true,
      projectId: projectId,
      projectName: projectName,
      configFile: configFile,
      historyFile: historyFile
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 读取项目配置
ipcMain.handle('read-project-config', async (event, dirPath, projectId) => {
  try {
    const configFile = projectId + '_config.json';
    const configPath = path.join(dirPath, configFile);
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    return { success: true, data: config };
  } catch (error) {
    console.error('[Electron] 读取项目配置失败:', error);
    return { success: false, error: error.message };
  }
});

// 保存项目配置
ipcMain.handle('save-project-config', async (event, dirPath, projectId, config) => {
  try {
    const configFile = projectId + '_config.json';
    const configPath = path.join(dirPath, configFile);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 读取历史记录
ipcMain.handle('read-project-history', async (event, dirPath, projectId) => {
  try {
    const historyFile = projectId + '_history.json';
    const historyPath = path.join(dirPath, historyFile);
    if (fs.existsSync(historyPath)) {
      const content = fs.readFileSync(historyPath, 'utf-8');
      return { success: true, data: JSON.parse(content) };
    }
    return { success: true, data: [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 保存历史记录
ipcMain.handle('save-project-history', async (event, dirPath, projectId, history) => {
  try {
    const historyFile = projectId + '_history.json';
    const historyPath = path.join(dirPath, historyFile);
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 扫描目录下的项目
ipcMain.handle('scan-directory-projects', async (event, dirPath) => {
  try {
    const projects = scanProjectsInDirectory(dirPath);
    
    // 检查是否存在 project.json
    const projectJsonPath = path.join(dirPath, 'project.json');
    if (!fs.existsSync(projectJsonPath)) {
      // 创建 project.json
      const projectListData = {
        projects: projects,
        lastOpened: null
      };
      fs.writeFileSync(projectJsonPath, JSON.stringify(projectListData, null, 2), 'utf-8');
    } else {
      // 更新 project.json 中的项目列表
      const content = fs.readFileSync(projectJsonPath, 'utf-8');
      const projectListData = JSON.parse(content);
      projectListData.projects = projects;
      fs.writeFileSync(projectJsonPath, JSON.stringify(projectListData, null, 2), 'utf-8');
    }
    
    return { success: true, data: projects };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-project-file', async (event, projectPath, fileName) => {
  try {
    let resolvedPath = projectPath;
    if (!path.isAbsolute(projectPath)) {
      resolvedPath = path.join(getAppRoot(), projectPath);
    }
    const filePath = path.join(resolvedPath, fileName);
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, data: content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC 通信 - 对话框
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

// 保存文件对话框
ipcMain.handle('save-file', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: options.defaultPath,
    filters: options.filters
  });
  
  if (!result.canceled && result.filePath) {
    return { success: true, filePath: result.filePath };
  }
  return { success: false };
});

// IPC 通信 - 创建目录
ipcMain.handle('create-directory', async (event, dirPath) => {
  try {
    let resolvedPath = dirPath;
    if (!path.isAbsolute(dirPath)) {
      resolvedPath = path.join(getAppRoot(), dirPath);
    }
    
    if (!fs.existsSync(resolvedPath)) {
      fs.mkdirSync(resolvedPath, { recursive: true });
    }
    return { success: true, path: resolvedPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC 通信 - 历史记录
ipcMain.handle('get-history-path', async () => {
  return { success: true, path: path.join(__dirname, '../.history.json') };
});

// IPC 通信 - HTTP 请求（Electron 主进程，不受 CORS 限制）
ipcMain.handle('http-request', async (event, requestConfig) => {
  const { method, url, headers, data, timeout } = requestConfig;
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    try {
      const request = net.request({
        method: method || 'GET',
        url: url,
        redirect: 'follow'
      });

      // 设置请求头
      if (headers) {
        Object.keys(headers).forEach(key => {
          if (key.toLowerCase() !== 'host') {
            request.setHeader(key, headers[key]);
          }
        });
      }

      // 设置超时
      const timeoutId = setTimeout(() => {
        request.abort();
        resolve({
          success: false,
          error: '请求超时',
          errorType: 'timeout',
          elapsedTime: ((Date.now() - startTime) / 1000).toFixed(2) + 's'
        });
      }, timeout || 30000);

      let responseData = '';
      let responseHeaders = {};
      let statusCode = null;
      let statusMessage = '';

      request.on('response', (response) => {
        statusCode = response.statusCode;
        statusMessage = response.statusMessage || '';
        responseHeaders = response.headers || {};

        response.on('data', (chunk) => {
          responseData += chunk.toString();
        });

        response.on('end', () => {
          clearTimeout(timeoutId);
          const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2) + 's';
          
          let parsedData = responseData;
          try {
            parsedData = JSON.parse(responseData);
          } catch {
            // 不是 JSON 格式，保持原字符串
          }

          resolve({
            success: statusCode < 400,
            status_code: statusCode,
            status_text: statusMessage,
            headers: responseHeaders,
            data: parsedData,
            elapsedTime,
            responseSize: formatSize(responseData.length)
          });
        });

        response.on('error', (error) => {
          clearTimeout(timeoutId);
          resolve({
            success: false,
            error: error.message,
            errorType: 'network',
            elapsedTime: ((Date.now() - startTime) / 1000).toFixed(2) + 's'
          });
        });
      });

      request.on('error', (error) => {
        clearTimeout(timeoutId);
        
        let errorType = 'network';
        let errorMessage = error.message;
        
        // 根据错误代码提供更友好的错误信息
        if (error.code === 'ECONNREFUSED') {
          errorType = 'connection_refused';
          errorMessage = '连接被拒绝，请检查服务器是否启动';
        } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_NONAME') {
          errorType = 'dns_error';
          errorMessage = '无法解析域名，请检查地址是否正确';
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
          errorType = 'timeout';
          errorMessage = '连接超时，请检查网络或服务器状态';
        } else if (error.code === 'ECONNRESET') {
          errorType = 'connection_reset';
          errorMessage = '连接被重置，请检查服务器是否正常运行';
        } else if (error.code === 'EHOSTUNREACH' || error.code === 'ENETUNREACH') {
          errorType = 'network_unreachable';
          errorMessage = '网络不可达，请检查网络连接';
        } else if (error.message.includes('getaddrinfo')) {
          errorType = 'dns_error';
          errorMessage = '无法解析域名，请检查地址是否正确';
        } else if (error.message.includes('socket')) {
          errorType = 'socket_error';
          errorMessage = `网络错误: ${error.message}`;
        }
        
        resolve({
          success: false,
          error: errorMessage,
          errorType: errorType,
          errorDetail: error.code ? `${error.code}: ${error.message}` : error.message,
          elapsedTime: ((Date.now() - startTime) / 1000).toFixed(2) + 's'
        });
      });

      // 发送请求体
      if (data) {
        if (typeof data === 'object') {
          request.write(JSON.stringify(data));
        } else {
          request.write(data);
        }
      }
      
      request.end();

    } catch (error) {
      resolve({
        success: false,
        error: error.message,
        errorType: 'unknown',
        elapsedTime: ((Date.now() - startTime) / 1000).toFixed(2) + 's'
      });
    }
  });
});

// 解析浏览器错误格式
function parseBrowserError(message) {
  const errorMap = {
    'ERR_CONNECTION_REFUSED': { type: 'connection_refused', msg: '连接被拒绝，请检查服务器是否启动' },
    'ERR_NAME_NOT_RESOLVED': { type: 'dns_error', msg: '域名无法解析，请检查地址是否正确' },
    'ERR_ADDRESS_UNREACHABLE': { type: 'unreachable', msg: '地址不可达，请检查网络和地址' },
    'ERR_TIMED_OUT': { type: 'timeout', msg: '连接超时，请检查网络或服务器状态' },
    'ERR_CONNECTION_RESET': { type: 'connection_reset', msg: '连接被重置，请检查服务器是否正常运行' },
    'ERR_CONNECTION_TIMED_OUT': { type: 'timeout', msg: '连接超时，请检查网络或服务器状态' },
    'ERR_NETWORK_CHANGED': { type: 'network', msg: '网络连接已更改，请重试' },
    'ERR_INTERNET_DISCONNECTED': { type: 'disconnected', msg: '网络已断开，请检查网络连接' },
    'ERR_PROXY_CONNECTION_FAILED': { type: 'proxy', msg: '代理连接失败，请检查代理设置' },
    'ERR_SSL_PROTOCOL_ERROR': { type: 'ssl', msg: 'SSL 协议错误，请检查 HTTPS 配置' },
    'ERR_TLS_VERSION_UNSUPPORTED': { type: 'ssl', msg: 'TLS 版本不支持，请检查服务器 SSL 配置' },
    'ERR_CERT_COMMON_NAME_INVALID': { type: 'ssl', msg: '证书域名无效，请检查域名配置' },
    'ERR_CERT_AUTHORITY_INVALID': { type: 'ssl', msg: '证书颁发机构无效，请检查证书配置' },
    'ERR_CERT_DATE_INVALID': { type: 'ssl', msg: '证书日期无效，请检查系统时间' },
    'ERR_UNDETERMINED': { type: 'unknown', msg: '网络错误，请检查网络连接' },
  };
  
  for (const [key, value] of Object.entries(errorMap)) {
    if (message.includes(key)) {
      return value;
    }
  }
  return null;
}

// 格式化错误消息
function formatErrorMessage(error) {
  // 优先使用错误代码
  if (error.code) {
    const codeMap = {
      'ECONNREFUSED': '连接被拒绝，请检查服务器是否启动',
      'ENOTFOUND': '域名无法解析，请检查地址是否正确',
      'EAI_NONAME': '域名无法解析，请检查地址是否正确',
      'ETIMEDOUT': '连接超时，请检查网络或服务器状态',
      'ESOCKETTIMEDOUT': '连接超时，请检查网络或服务器状态',
      'ECONNRESET': '连接被重置，请检查服务器是否正常运行',
      'EHOSTUNREACH': '主机不可达，请检查网络连接',
      'ENETUNREACH': '网络不可达，请检查网络连接',
      'EADDRNOTAVAIL': '地址不可用，请检查网络配置',
    };
    if (codeMap[error.code]) {
      return { type: 'network', message: codeMap[error.code] };
    }
  }
  
  // 解析浏览器错误格式
  const browserError = parseBrowserError(error.message);
  if (browserError) {
    return { type: browserError.type, message: browserError.msg };
  }
  
  // 返回原始消息
  return { type: 'unknown', message: error.message };
}

// IPC 通信 - 可取消的 HTTP 请求（使用 axios，支持忽略自签名证书）
ipcMain.handle('http-request-with-cancel', async (event, { id, requestConfig }) => {
  const { method, url, headers, data, timeout } = requestConfig;

  return new Promise((resolve) => {
    const startTime = Date.now();
    const source = axios.CancelToken.source();
    activeRequests.set(id, { cancel: () => source.cancel('用户取消请求') });

    const timeoutId = setTimeout(() => {
      source.cancel('请求超时');
      activeRequests.delete(id);
      resolve({
        success: false,
        error: '请求超时',
        errorType: 'timeout',
        elapsedTime: ((Date.now() - startTime) / 1000).toFixed(2) + 's'
      });
    }, timeout || 30000);

    // 创建忽略证书验证的 HTTPS agent
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    const config = {
      method: method || 'GET',
      url: url,
      headers: headers || {},
      data: data,
      timeout: timeout || 30000,
      cancelToken: source.token,
      httpsAgent: url.startsWith('https:') ? httpsAgent : undefined,
      // 不验证 SSL 证书
      validateStatus: () => true
    };

    axios(config)
      .then(response => {
        clearTimeout(timeoutId);
        activeRequests.delete(id);
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2) + 's';

        resolve({
          success: response.status < 400,
          status_code: response.status,
          status_text: response.statusText || '',
          headers: response.headers || {},
          data: response.data,
          elapsedTime,
          responseSize: formatSize(typeof response.data === 'string' ? response.data.length : JSON.stringify(response.data).length)
        });
      })
      .catch(error => {
        clearTimeout(timeoutId);
        activeRequests.delete(id);

        if (axios.isCancel(error)) {
          resolve({
            success: false,
            error: error.message,
            errorType: 'cancelled',
            elapsedTime: ((Date.now() - startTime) / 1000).toFixed(2) + 's'
          });
          return;
        }

        // 服务器返回错误状态码（如401）时，error.response 包含响应数据
        if (error.response) {
          const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2) + 's';
          resolve({
            success: false,
            status_code: error.response.status,
            status_text: error.response.statusText || '',
            headers: error.response.headers || {},
            data: error.response.data,
            error: `服务器错误 (${error.response.status})`,
            errorType: 'server_error',
            elapsedTime,
            responseSize: formatSize(typeof error.response.data === 'string' ? error.response.data.length : JSON.stringify(error.response.data).length)
          });
          return;
        }

        const { type, message } = formatErrorMessage(error);
        resolve({
          success: false,
          error: message,
          errorType: type,
          elapsedTime: ((Date.now() - startTime) / 1000).toFixed(2) + 's'
        });
      });
  });
});

// IPC 通信 - 取消 HTTP 请求
ipcMain.handle('cancel-http-request', async (event, id) => {
  const request = activeRequests.get(id);
  if (request) {
    if (typeof request.cancel === 'function') {
      request.cancel();
    }
    activeRequests.delete(id);
    return { success: true };
  }
  return { success: false, error: '请求不存在' };
});

// 格式化文件大小
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}