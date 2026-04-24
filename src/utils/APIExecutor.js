import axios from 'axios';

class APIExecutor {
  constructor(projectPath, config, profile) {
    this.projectPath = projectPath;
    this.config = config;
    this.profile = profile;
    this.apiResults = {};
    this.cancelSource = null;
    this.requestId = null;
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  cancel() {
    if (this.requestId && window.electron && window.electron.cancelHttpRequest) {
      window.electron.cancelHttpRequest(this.requestId);
    }
    
    this.requestId = null;
    
    if (this.cancelSource) {
      this.cancelSource.cancel('用户取消请求');
      this.cancelSource = null;
    }
    
    if (this._cancelResolver) {
      const resolver = this._cancelResolver;
      this._cancelResolver = null;
      resolver({ success: false, error: '请求已取消', allResults: {}, cancelled: true });
    }
  }

  // 解析特殊标记
  resolveValue(value, apiResults) {
    if (typeof value !== 'string') {
      return value;
    }

    // 解析 {{ref:API名称.字段路径}}
    const refMatch = value.match(/\{\{ref:([^}]+)\}\}/);
    if (refMatch) {
      const refPath = refMatch.group(1);
      const parts = refPath.split('.');
      const apiName = parts[0];
      const fieldPath = parts.slice(1).join('.');

      if (apiResults[apiName]) {
        let result = apiResults[apiName].data;
        if (fieldPath) {
          const keys = fieldPath.split('.');
          for (const key of keys) {
            if (typeof result === 'object' && result !== null) {
              result = result[key];
            } else {
              return null;
            }
          }
        }
        return result;
      }
      return null;
    }

    // 解析 {{readFile:文件名}} - 读取文件内容为字符串
    const fileMatch = value.match(/\{\{readFile:([^}]+)\}\}/);
    if (fileMatch) {
      const filename = fileMatch.group(1);
      return this.readFile(filename);
    }

    // 解析 {{file:filename}} - 返回文件信息用于上传
    const uploadMatch = value.match(/\{\{file:([^}]+)\}\}/);
    if (uploadMatch) {
      const filename = uploadMatch.group(1);
      return {
        type: 'file_upload',
        filename: filename
      };
    }

    return value;
  }

  // 读取文件
  async readFile(filename) {
    // 检查是否在 Electron 环境中
    if (!window.electron) {
      console.log(`开发模式：模拟读取文件 ${filename}`);
      
      // 返回模拟的文件内容
      if (filename === 'NC2Lims.xml') {
        return `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <order>
    <orderId>TEST001</orderId>
    <product>测试产品</product>
    <quantity>10</quantity>
  </order>
</root>`;
      }
      
      return `模拟文件内容: ${filename}`;
    }

    try {
      const { data } = await window.electron.readProjectFile(this.projectPath, filename);
      return data;
    } catch (error) {
      console.error(`读取文件 ${filename} 失败:`, error);
      throw new Error(`读取文件 ${filename} 失败: ${error.message}`);
    }
  }

  // 解析字典中的特殊标记
  resolveDict(data, apiResults) {
    const resolved = {};
    for (const key in data) {
      const item = data[key];
      
      // 处理新的参数格式 { default, description, type, enabled }
      if (typeof item === 'object' && item !== null && 'default' in item) {
        if (item.enabled !== false && item.default) {
          resolved[key] = this.resolveValue(item.default, apiResults);
        }
      } else {
        resolved[key] = this.resolveValue(item, apiResults);
      }
    }
    return resolved;
  }

  // 使用 JSONPath 从数据中提取值
  extractByJSONPath(data, path) {
    if (!path.startsWith('$')) {
      return null;
    }

    const parts = path.substring(2).split('.');
    let current = data;

    for (const part of parts) {
      if (typeof current === 'object' && current !== null) {
        current = current[part];
      } else {
        return null;
      }
    }

    return current;
  }

    // 评估断言表达式，返回详细信息
  evaluateAssertion(responseData, assertion) {
    try {
      const operators = {
        '==': (a, b) => a === b,
        '!=': (a, b) => a !== b,
        '>': (a, b) => a > b,
        '<': (a, b) => a < b,
        '>=': (a, b) => a >= b,
        '<=': (a, b) => a <= b
      };

      // 支持多个断言，用分号或换行分隔
      const assertions = assertion.split(/[;\n]/).map(a => a.trim()).filter(a => a);
      const results = [];

      for (const assert of assertions) {
        let passed = false;
        let actual = null;
        let expected = null;
        let expression = assert;
        let operator = null;

        for (const op of Object.keys(operators).sort((a, b) => b.length - a.length)) {
          if (assert.includes(` ${op} `)) {
            const [path, expectedStr] = assert.split(` ${op} `);
            actual = this.extractByJSONPath(responseData, path.trim());
            expected = this.parseExpectedValue(expectedStr.trim());
            operator = op;
            passed = operators[op](actual, expected);
            expression = `${path.trim()} ${op} ${expectedStr.trim()}`;
            break;
          }
        }

        // 如果没有操作符，检查字段是否存在且为真
        if (operator === null) {
          actual = this.extractByJSONPath(responseData, assert);
          passed = Boolean(actual);
          expected = 'truthy';
          expression = assert;
        }

        // 格式化值的显示
        const formatValue = (val) => {
          if (val === undefined) return 'undefined';
          if (val === null) return 'null';
          if (typeof val === 'object') {
            if (Array.isArray(val)) {
              return `Array[${val.length}]`;
            }
            return `Object{...}`;
          }
          return String(val);
        };

        results.push({
          expression,
          actual: formatValue(actual),
          passed,
          operator
        });
      }

      const allPassed = results.every(r => r.passed);
      return {
        passed: allPassed,
        results,
        summary: `${results.filter(r => r.passed).length}/${results.length} 通过`
      };
    } catch (error) {
      console.error('断言评估失败:', error);
      return {
        passed: false,
        results: [{
          expression: assertion,
          actual: 'error',
          expected: 'N/A',
          passed: false,
          error: error.message
        }],
        summary: '评估失败'
      };
    }
  }

  // 解析期望值
  parseExpectedValue(value) {
    const trimmed = value.trim();
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;
    if (trimmed.toLowerCase() === 'null') return null;
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
    if (trimmed.includes('.')) return parseFloat(trimmed);
    const num = parseInt(trimmed, 10);
    if (!isNaN(num)) return num;
    return trimmed;
  }

  // 计算响应数据大小
  calculateSize(data) {
    if (data === null || data === undefined) return '0 B';
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    const bytes = new Blob([str]).size;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // 解析 API 路径
  resolveAPIPath(apiPath) {
    let path = apiPath;
    
    // 替换配置文件中的变量
    Object.keys(this.profile).forEach(key => {
      if (key !== 'name' && key !== 'activate') {
        path = path.replace(`{${key}}`, this.profile[key]);
      }
    });

    // 返回完整 URL
    if (!path.startsWith('http://') && !path.startsWith('https://')) {
      path = 'http://' + path;
    }

    return path;
  }

  // 通过 Electron 主进程发送请求（不受 CORS 限制）
  async httpRequestViaElectron(requestConfig) {
    if (!window.electron) {
      throw new Error('Electron 环境不可用');
    }
    
    const result = await window.electron.httpRequestWithCancel({ id: this.requestId, requestConfig });
    return result;
  }

  // 执行单个 API 调用
  async executeAPI(api, customData = {}) {
    const startTime = Date.now();
    
    try {
      // 合并自定义数据
      const mergedAPI = { ...api, ...customData };

      // 解析 API 路径
      const apiPath = this.resolveAPIPath(mergedAPI.api_path);
      const method = mergedAPI.method.toUpperCase();

      // 解析 Header
      let header = mergedAPI.header || {};
      header = this.resolveDict(header, this.apiResults);

      // 解析 URL 参数
      let params = mergedAPI.param || {};
      params = this.resolveDict(params, this.apiResults);

      // 解析 Body
      let body = mergedAPI.body;
      if (body !== undefined) {
        body = this.resolveValue(body, this.apiResults);
        if (typeof body === 'object' && body !== null) {
          body = this.resolveDict(body, this.apiResults);
        }
      }

      // 检查是否包含文件上传
      let hasFileUpload = false;
      if (typeof body === 'object' && body !== null) {
        for (const value of Object.values(body)) {
          if (typeof value === 'object' && value.type === 'file_upload') {
            hasFileUpload = true;
            break;
          }
        }
      }

      // 根据 Content-Type 决定使用 json、data 还是 files 参数
      const contentType = header['Content-Type'] || '';
      const useJSON = contentType.toLowerCase().includes('application/json');
      const useFiles = hasFileUpload || contentType.toLowerCase().includes('multipart/form-data');

      // 如果使用 files，需要移除 Content-Type
      if (useFiles) {
        delete header['Content-Type'];
      }

      // 准备请求参数
      let requestConfig = {
        method,
        url: apiPath,
        headers: header,
        params: params,
        timeout: 30000
      };

      // 处理 Body/Files
      if (body !== undefined && body !== null) {
        if (useFiles && typeof body === 'object') {
          // 文件上传暂时使用 axios（需要 FormData）
          const formData = new FormData();
          for (const [key, value] of Object.entries(body)) {
            if (typeof value === 'object' && value.type === 'file_upload') {
              try {
                const fileData = await this.readFile(value.filename);
                const blob = new Blob([fileData], { type: 'application/octet-stream' });
                formData.append(key, blob, value.filename);
              } catch (error) {
                console.error(`准备上传文件 ${value.filename} 失败:`, error);
              }
            } else {
              formData.append(key, value);
            }
          }
          requestConfig.data = formData;
        } else if (useJSON) {
          requestConfig.data = body;
          requestConfig.headers['Content-Type'] = 'application/json';
        } else {
          requestConfig.data = body;
        }
      }

      let response;

      // 优先使用 Electron 主进程发送请求（不受 CORS 限制）
      const hasElectron = !!(window.electron && window.electron.httpRequest);
      console.log('[API Executor] Electron 可用:', hasElectron, '| 请求URL:', apiPath);
      
      if (hasElectron) {
        console.log('[API Executor] 使用 Electron HTTP 请求（无 CORS 限制）');
        this.requestId = this.generateRequestId();
        response = await this.httpRequestViaElectron(requestConfig);
      } else {
        // 开发模式使用 axios
        console.log('[API Executor] 使用 axios 请求（浏览器模式，可能受 CORS 限制）');
        console.warn('[API Executor] 警告: 未检测到 Electron 环境，请确保在 Electron 中运行');
        
        // 添加 URL 参数到路径
        if (params && Object.keys(params).length > 0) {
          const searchParams = new URLSearchParams(params);
          const separator = apiPath.includes('?') ? '&' : '?';
          requestConfig.url = apiPath + separator + searchParams.toString();
        }
        delete requestConfig.params;
        
        // 创建取消源
        this.cancelSource = axios.CancelToken.source();
        requestConfig.cancelToken = this.cancelSource.token;
        
        response = await axios(requestConfig);
      }

      // 解析响应
      let responseData;
      let responseHeaders = {};
      let statusCode = null;
      let statusText = '';
      let elapsedTime = '';
      let responseSize = '';
      let errorMessage = '';
      let errorType = 'unknown';

      // Electron 响应格式
      if (response.success !== undefined) {
        if (response.success === false) {
          // Electron 返回错误
          errorMessage = response.error || '请求失败';
          errorType = response.errorType || 'network';
          statusCode = response.status_code;
          statusText = response.status_text || errorType.toUpperCase();
        } else {
          // 成功响应
          responseData = response.data;
          responseHeaders = response.headers || {};
          statusCode = response.status_code;
          statusText = response.status_text || '';
        }
        elapsedTime = response.elapsedTime || '0s';
        responseSize = response.responseSize || '0 B';
      } else {
        // axios 响应格式
        responseData = response.data;
        responseHeaders = response.headers || {};
        statusCode = response.status;
        statusText = response.statusText || '';
        elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2) + 's';
        responseSize = this.calculateSize(responseData);
      }

      // 判断 HTTP 请求是否成功
      const httpSuccess = response.success !== undefined ? response.success : (statusCode < 400);

      // 断言评估结果
      let assertionResult = null;
      if (api.successAssert) {
        assertionResult = this.evaluateAssertion(responseData, api.successAssert);
      }

      // 最终成功状态：HTTP 成功 且 断言通过（如果有断言）
      const success = httpSuccess && (!assertionResult || assertionResult.passed);

      const result = {
        status_code: statusCode,
        status_text: statusText,
        httpSuccess,  // HTTP 请求是否成功
        success,      // 最终成功状态（HTTP + 断言）
        data: responseData,
        headers: responseHeaders,
        elapsedTime,
        responseSize,
        assertionResult,  // 断言详细信息
        error: errorMessage,
        errorType: errorType
      };

      return result;
    } catch (error) {
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2) + 's';

      // 处理 axios 错误
      let errorMessage = error.message;
      let errorType = 'unknown';
      
      if (error.response) {
        errorType = 'server_error';
        errorMessage = `服务器错误 (${error.response.status} ${error.response.statusText})`;
      } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorType = 'timeout';
        errorMessage = '请求超时';
      } else if (error.code === 'ERR_NETWORK' || error.code === 'ERR_INTERNET_DISCONNECTED') {
        errorType = 'network';
        errorMessage = '网络错误: ' + error.message;
      } else if (error.code === 'ECONNREFUSED') {
        errorType = 'network';
        errorMessage = '连接被拒绝，请检查服务器是否启动';
      } else if (error.code === 'ENOTFOUND') {
        errorType = 'dns_error';
        errorMessage = '无法解析域名';
      }

      return {
        status_code: error.response?.status || null,
        status_text: errorType.toUpperCase().replace('_', ' '),
        success: false,
        error: errorMessage,
        errorType,
        data: error.response?.data || null,
        headers: error.response?.headers || {},
        elapsedTime,
        responseSize: null
      };
    }
  }

  // 执行调用链
  async executeChain(api, customData = {}) {
    const chain = api.chain || [];
    this.apiResults = {};

    // 并行执行所有依赖 API
    if (chain.length > 0) {
      const promises = chain.map(async (depAPIName) => {
        const depAPI = this.findAPIByName(depAPIName);
        if (!depAPI) {
          throw new Error(`找不到依赖 API '${depAPIName}'`);
        }

        const result = await this.executeAPI(depAPI);
        this.apiResults[depAPIName] = result;
        
        return { name: depAPIName, result };
      });

      // 等待所有依赖执行完成
      const results = await Promise.all(promises);

      // 检查是否有依赖失败
      const failedDependencies = results.filter(r => !r.result.success);
      if (failedDependencies.length > 0) {
        const failedNames = failedDependencies.map(r => r.name).join(', ');
        throw new Error(`依赖链执行失败: ${failedNames}`);
      }
    }

    // 执行目标 API
    const result = await this.executeAPI(api, customData);
    this.apiResults[api.name] = result;

    return {
      targetResult: result,
      allResults: this.apiResults,
      dependencies: chain
    };
  }

  // 根据名称查找 API
  findAPIByName(name) {
    return this.config.apis.find(api => api.name === name);
  }
}

export default APIExecutor;