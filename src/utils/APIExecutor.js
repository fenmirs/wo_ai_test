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

    // 解析 {{ref:API名称或ID.字段路径}}
    const refMatch = value.match(/\{\{ref:([^}]+)\}\}/);
    if (refMatch) {
      const refPath = refMatch[1];
      const parts = refPath.split('.');
      const apiRef = parts[0]; // 可能是 id 或 name
      const fieldPath = parts.slice(1).join('.');

      // 优先从 apiResults 中查找（key 可能是 id 或 name）
      let resultData = apiResults[apiRef];
      
      // 如果直接查找失败，尝试遍历查找
      if (!resultData) {
        const api = this.findAPIByIdOrName(apiRef);
        if (api) {
          const resultKey = api.id || api.name;
          resultData = apiResults[resultKey];
        }
      }
      
      if (resultData) {
        let result = resultData.data;
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
      const filename = fileMatch[1];
      return this.readFile(filename);
    }

    // 解析 {{file:filename}} - 返回文件信息用于上传
    const uploadMatch = value.match(/\{\{file:([^}]+)\}\}/);
    if (uploadMatch) {
      const filename = uploadMatch[1];
      return {
        type: 'file_upload',
        filename: filename
      };
    }

    return value;
  }

  // 读取文件
  async readFile(filename) {
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
        if (typeof body === 'object' && body !== null && body.content !== undefined && 'type' in body && 'contentType' in body) {
          body = this.resolveValue(body.content, this.apiResults);
        } else {
          body = this.resolveValue(body, this.apiResults);
        }
        if (typeof body === 'object' && body !== null) {
          body = this.resolveDict(body, this.apiResults);
        }
      }

      console.log(`[APIExecutor] ════════════════════════════════════════`);
      console.log(`[APIExecutor]  >> ${method} ${apiPath}`);
      console.log(`[APIExecutor]  名称: ${api.name || '-'}`);
      if (params && Object.keys(params).length > 0) {
        console.log(`[APIExecutor]  Params:`, JSON.stringify(params, null, 2));
      }
      if (header && Object.keys(header).length > 0) {
        console.log(`[APIExecutor]  Headers:`, JSON.stringify(header, null, 2));
      }
      if (body !== undefined && body !== null && body !== '') {
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
        console.log(`[APIExecutor]  Body:`, bodyStr.length > 2000 ? bodyStr.substring(0, 2000) + '...' : bodyStr);
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

      // 使用 Electron 主进程发送请求（不受 CORS 限制）
      this.requestId = this.generateRequestId();
      response = await this.httpRequestViaElectron(requestConfig);

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
        // 无论成功失败，都读取响应数据（HTTP 错误也可能有响应体）
        if (response.data !== undefined) {
          responseData = response.data;
        }

        // 无论成功失败，都读取响应头
        responseHeaders = response.headers || {};

        if (response.success === false) {
          // Electron 返回错误
          errorMessage = response.error || '请求失败';
          errorType = response.errorType || 'network';
          statusCode = response.status_code;
          statusText = response.status_text || errorType.toUpperCase();
        } else {
          // 成功响应
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

      console.log(`[APIExecutor]  ────────────────────────────────────────`);
      console.log(`[APIExecutor]  << [${statusCode}${statusText ? ' ' + statusText : ''}] 耗时 ${elapsedTime} | 大小 ${responseSize}`);
      if (responseHeaders && Object.keys(responseHeaders).length > 0) {
        console.log(`[APIExecutor]  响应头:`, JSON.stringify(responseHeaders, null, 2));
      }
      console.log(`[APIExecutor]  断言: ${assertionResult ? (assertionResult.passed ? '通过' : '失败') : '无'} | 最终结果: ${success ? '成功' : '失败'}`);
      if (responseData !== undefined) {
        const dataStr = typeof responseData === 'object' ? JSON.stringify(responseData, null, 2) : String(responseData);
        console.log(`[APIExecutor]  响应体:`, dataStr.length > 3000 ? dataStr.substring(0, 3000) + '...' : dataStr);
      }
      console.log(`[APIExecutor] ════════════════════════════════════════`);

      const cleanRequest = {
        url: requestConfig.url,
        method: requestConfig.method,
        headers: { ...requestConfig.headers },
        params: { ...requestConfig.params },
        body: requestConfig.data instanceof FormData ? '[FormData]' : requestConfig.data,
        bodyType: requestConfig.data instanceof FormData ? 'form-data' : (typeof requestConfig.data === 'string' ? 'raw' : (requestConfig.data ? 'json' : 'none'))
      };

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
        errorType: errorType,
        requestConfig: cleanRequest
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

      console.log(`[APIExecutor]  ❌ 请求异常 | 耗时 ${elapsedTime}`);
      console.log(`[APIExecutor]  请求配置: ${requestConfig.method} ${requestConfig.url}`);
      if (requestConfig.params && Object.keys(requestConfig.params).length > 0) {
        console.log(`[APIExecutor]  Query Params:`, JSON.stringify(requestConfig.params));
      }
      console.log(`[APIExecutor]  错误类型: ${errorType}`);
      console.log(`[APIExecutor]  错误信息: ${errorMessage}`);
      if (error.response?.data) {
        const errBody = typeof error.response.data === 'object' ? JSON.stringify(error.response.data, null, 2) : error.response.data;
        console.log(`[APIExecutor]  错误响应体:`, String(errBody).substring(0, 2000));
      }
      console.log(`[APIExecutor] ════════════════════════════════════════`);

      return {
        status_code: error.response?.status || null,
        status_text: errorType.toUpperCase().replace('_', ' '),
        success: false,
        error: errorMessage,
        errorType,
        data: error.response?.data || null,
        headers: error.response?.headers || {},
        elapsedTime,
        responseSize: null,
        requestConfig: null
      };
    }
  }

  // 执行调用链
  async executeChain(api, customData = {}) {
    const chain = api.chain || [];
    this.apiResults = {};

    // 并行执行所有依赖 API
    if (chain.length > 0) {
      const promises = chain.map(async (chainRef) => {
        // chainRef 可能是 id 或 name（向后兼容）
        const depAPI = this.findAPIByIdOrName(chainRef);
        if (!depAPI) {
          throw new Error(`找不到依赖 API '${chainRef}'`);
        }

        const result = await this.executeAPI(depAPI);
        // 使用 id 存储结果，如果 id 不存在则使用 name
        const resultKey = depAPI.id || depAPI.name;
        this.apiResults[resultKey] = result;
        
        return { id: depAPI.id, name: depAPI.name, result };
      });

      // 等待所有依赖执行完成
      const results = await Promise.all(promises);

      // 检查是否有依赖失败
      const failedDependencies = results.filter(r => !r.result.success);
      if (failedDependencies.length > 0) {
        const failedNames = failedDependencies.map(r => r.name || r.id).join(', ');
        throw new Error(`依赖链执行失败: ${failedNames}`);
      }
    }

    // 执行目标 API
    const result = await this.executeAPI(api, customData);
    const targetKey = api.id || api.name;
    this.apiResults[targetKey] = result;

    return {
      targetResult: result,
      allResults: this.apiResults,
      dependencies: chain
    };
  }

  // 根据 id 或名称查找 API
  findAPIByIdOrName(idOrName) {
    if (!this.config?.apis) return null;
    return this.config.apis.find(api => 
      api.id === idOrName || api.name === idOrName
    );
  }
}

export default APIExecutor;