const { app, BrowserWindow, ipcMain, dialog, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
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
    await fs.writeFile(filePath, content, 'utf-8');
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

// 格式化文件大小
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}