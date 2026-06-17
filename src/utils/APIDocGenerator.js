class APIDocGenerator {
  static defaultOptions() {
    return {
      includeBasicInfo: true,
      includeHeaders: true,
      includeQueryParams: true,
      includeRequestBody: true,
      includeRequestSchema: true,
      includeRequestExample: true,
      includeResponseExample: true,
      includeAssertions: true,
      includeChainDeps: true,
      includeScenarioDescription: true,
      includeErrorCodes: true,
    };
  }

  static loadOptions() {
    try {
      const saved = localStorage.getItem('docGenOptions');
      if (saved) {
        return { ...this.defaultOptions(), ...JSON.parse(saved) };
      }
    } catch (e) { /* ignore */ }
    return { ...this.defaultOptions() };
  }

  static saveOptions(options) {
    try {
      localStorage.setItem('docGenOptions', JSON.stringify(options));
    } catch (e) { /* ignore */ }
  }

  static generate(apiData, resolvedPath, executionResult = null, config = null, profile = null, options = null) {
    const opts = options || this.defaultOptions();
    const lines = [];
    let secNum = 0;
    const refApis = opts.includeChainDeps ? this._collectRefApis(apiData, config, profile) : [];

    // --- 依赖 API 文档 ---
    refApis.forEach((refApi, index) => {
      refApi.index = index + 1;
      secNum++;
      this._addHeading(lines, `${secNum}. ${refApi.name}(${refApi.shortId})`, 2);
      if (opts.includeBasicInfo) {
        this._addBasicInfo(lines, refApi.method, refApi.resolvedPath, refApi.description);
      }
      this._renderRequestDetail(lines, refApi, refApis, opts);
      if (opts.includeResponseExample) {
        const refResult = this._findApiResult(refApi.id, executionResult);
        if (refResult && refResult.data !== undefined) {
          this._addResponseExample(lines, refResult, executionResult);
        }
      }
    });

    // --- 目标 API ---
    secNum++;
    this._addHeading(lines, `${secNum}. ${apiData.name}`, 2);
    if (opts.includeBasicInfo) {
      this._addBasicInfo(lines, apiData.method, resolvedPath, apiData.description);
    }

    if (opts.includeScenarioDescription && apiData.description) {
      lines.push('');
      lines.push(`> ${apiData.description}`);
    }

    this._renderRequestDetail(lines, apiData, refApis, opts);

    if (opts.includeRequestExample) {
      this._addRequestExample(lines, apiData, resolvedPath, refApis);
    }

    if (opts.includeResponseExample && executionResult && executionResult.targetResult) {
      const tr = executionResult.targetResult;
      secNum++;
      const heading = tr.success ? '正确响应' : '错误响应';
      this._addHeading(lines, heading, 2);
      this._addResponseDetail(lines, tr);
      this._addResponseExample(lines, tr, executionResult);
    }

    if (opts.includeAssertions && apiData.assertions) {
      const enabled = apiData.assertions.filter(a => a.enabled && a.expression.trim());
      if (enabled.length > 0) {
        secNum++;
        this._addHeading(lines, '断言', 2);
        lines.push('');
        enabled.forEach(a => {
          lines.push(`- \`${a.expression}\``);
        });
        if (executionResult?.targetResult?.assertionResult) {
          const ar = executionResult.targetResult.assertionResult;
          lines.push('');
          lines.push(`- **断言结果**: ${ar.summary || ''}`);
          (ar.results || []).forEach(r => {
            const icon = r.passed ? '✓' : '✗';
            lines.push(`  - ${icon} \`${r.expression}\` → 实际值: \`${r.actual}\``);
          });
        }
      }
    }

    if (opts.includeErrorCodes) {
      secNum++;
      this._addHeading(lines, '常见错误码', 2);
      lines.push('');
      lines.push('| 状态码 | 说明 |');
      lines.push('|--------|------|');
      lines.push('| 200 | 请求成功 |');
      lines.push('| 400 | 请求参数错误 |');
      lines.push('| 401 | 未授权 |');
      lines.push('| 403 | 无权限 |');
      lines.push('| 404 | 资源不存在 |');
      lines.push('| 500 | 服务器内部错误 |');
    }

    return lines.join('\n');
  }

  static _addHeading(lines, text, level) {
    lines.push('');
    lines.push(`${'#'.repeat(level)} ${text}`);
    lines.push('');
  }

  static _addBasicInfo(lines, method, resolvedPath, description) {
    lines.push(`- **方法**: \`${method}\``);
    lines.push(`- **完整路径**: \`${resolvedPath}\``);
    if (description) {
      lines.push(`- **描述**: ${description}`);
    }
  }

  static _renderRequestDetail(lines, data, refApis, opts) {
    if (opts.includeHeaders) {
      const enabledHeaders = data.header.filter(h => h.enabled && h.key);
      if (enabledHeaders.length > 0) {
        lines.push('');
        lines.push('### Headers');
        lines.push('');
        lines.push('| Key | Value | 备注 |');
        lines.push('|-----|-------|------|');
        enabledHeaders.forEach(h => {
          const displayValue = this._resolveRefValue(h.default || '', refApis);
          lines.push(`| \`${h.key}\` | ${displayValue} | ${h.description || ''} |`);
        });
      }
    }

    if (opts.includeQueryParams) {
      const enabledParams = data.param.filter(p => p.enabled && p.key);
      if (enabledParams.length > 0) {
        lines.push('');
        lines.push('### Query Parameters');
        lines.push('');
        lines.push('| Key | 类型 | 默认值 | 备注 |');
        lines.push('|-----|------|--------|------|');
        enabledParams.forEach(p => {
          const displayValue = this._resolveRefValue(p.default || '', refApis);
          lines.push(`| \`${p.key}\` | ${p.type || 'string'} | ${displayValue} | ${p.description || ''} |`);
        });
      }
    }

    if (opts.includeRequestBody && data.body && data.body.type !== 'none') {
      lines.push('');
      lines.push(`### Body (${data.body.type})`);

      if (opts.includeRequestSchema && (data.body.type === 'raw' || data.body.type === 'json')) {
        const schema = data.body.schema || data.body.contents?.[data.body.activeContentType]?.schema;
        if (schema && schema.children && schema.children.length > 0) {
          lines.push('');
          lines.push('#### 字段结构');
          lines.push('');
          lines.push('| 字段路径 | 类型 | 必需 | 描述 |');
          lines.push('|----------|------|------|------|');
          this._renderSchemaRows(lines, schema, '', refApis);
        } else {
          this._renderRawBody(lines, data, refApis);
        }
      } else if (data.body.type === 'raw' || data.body.type === 'json') {
        this._renderRawBody(lines, data, refApis);
      } else if (data.body.type === 'form-data' || data.body.type === 'x-www-form-urlencoded') {
        const items = data.body.type === 'form-data' ? data.body.formData : data.body.xwwwFormUrlencoded;
        const enabledItems = items ? items.filter(i => i.enabled && i.key) : [];
        if (enabledItems.length > 0) {
          lines.push('');
          lines.push('| Key | 类型 | 默认值 | 备注 |');
          lines.push('|-----|------|--------|------|');
          enabledItems.forEach(i => {
            const displayValue = this._resolveRefValue(i.default || '', refApis);
            lines.push(`| \`${i.key}\` | ${i.type || 'string'} | ${displayValue} | ${i.description || ''} |`);
          });
        }
      }
    }
  }

  static _renderSchemaRows(lines, schema, parentPath, refApis) {
    const currentPath = this._buildFieldPath(schema.key, parentPath);
    const isRequired = !schema.type?.includes('null') && schema.type !== 'null';
    let displayType = schema.type || 'unknown';
    if (schema.enumType) displayType = schema.enumType;
    lines.push(`| \`${currentPath}\` | ${displayType} | ${isRequired ? '是' : '否'} | ${schema.description || ''} |`);

    if (schema.children && schema.children.length > 0) {
      schema.children.forEach(child => {
        if (child.key !== null && child.key !== undefined) {
          this._renderSchemaRows(lines, child, currentPath, refApis);
        }
      });
    }
  }

  static _buildFieldPath(key, parentPath) {
    if (key === null || key === undefined) return parentPath;
    const keyStr = typeof key === 'number' ? `[${key}]` : String(key);
    return parentPath ? `${parentPath}.${keyStr}` : keyStr;
  }

  static _renderRawBody(lines, data, refApis) {
    lines.push('');
    const lang = data.body.type === 'json' || data.body.contentType === 'json' ? 'json'
      : data.body.contentType === 'xml' ? 'xml'
      : data.body.contentType === 'html' ? 'html' : 'text';
    const content = this._resolveRefValue(data.body.content || '', refApis);
    lines.push(`\`\`\`${lang}`);
    lines.push(content);
    lines.push('```');
  }

  static _addRequestExample(lines, apiData, resolvedPath, refApis) {
    const method = apiData.method;
    const url = resolvedPath;
    const headers = apiData.header.filter(h => h.enabled && h.key);
    const params = apiData.param.filter(p => p.enabled && p.key);
    const body = apiData.body;
    const bodyContent = body?.type === 'raw' ? (body.content || '') : null;

    // Build query string
    const queryParts = params.map(p => {
      const k = encodeURIComponent(p.key);
      const v = p.default ? encodeURIComponent(p.default) : '';
      return `${k}=${v}`;
    });
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    const fullUrl = `${url}${queryString}`;

    lines.push('');
    lines.push('### 请求示例');

    // cURL
    lines.push('');
    lines.push('#### cURL');
    lines.push('');
    let curlCmd = `curl -X ${method} '${fullUrl}'`;
    headers.forEach(h => {
      curlCmd += ` \\\n  -H '${h.key}: ${h.default || ''}'`;
    });
    if (body && body.type !== 'none') {
      if (body.type === 'raw' && bodyContent) {
        const ct = headers.find(h => h.key.toLowerCase() === 'content-type');
        if (!ct) {
          const defaultCt = body.contentType === 'json' ? 'application/json'
            : body.contentType === 'xml' ? 'text/xml'
            : body.contentType === 'html' ? 'text/html'
            : 'text/plain';
          curlCmd += ` \\\n  -H 'Content-Type: ${defaultCt}'`;
        }
        curlCmd += ` \\\n  -d '${bodyContent.replace(/'/g, "\\'")}'`;
      } else if (body.type === 'form-data' || body.type === 'x-www-form-urlencoded') {
        const items = body.type === 'form-data' ? body.formData : body.xwwwFormUrlencoded;
        (items || []).filter(i => i.enabled && i.key).forEach(i => {
          curlCmd += ` \\\n  --${body.type === 'form-data' ? 'form' : 'data'} '${i.key}=${i.default || ''}'`;
        });
      }
    }
    lines.push('```bash');
    lines.push(curlCmd);
    lines.push('```');

    // JavaScript fetch
    lines.push('');
    lines.push('#### JavaScript (fetch)');
    lines.push('');
    const fetchHeaders = {};
    headers.forEach(h => { fetchHeaders[h.key] = h.default || ''; });
    if (body && body.type !== 'none' && !Object.keys(fetchHeaders).some(k => k.toLowerCase() === 'content-type')) {
      const defaultCt = body.contentType === 'json' ? 'application/json'
        : body.contentType === 'xml' ? 'text/xml'
        : body.contentType === 'html' ? 'text/html'
        : 'text/plain';
      fetchHeaders['Content-Type'] = defaultCt;
    }
    const fetchBody = body && body.type === 'raw' && bodyContent ? bodyContent
      : body && (body.type === 'form-data' || body.type === 'x-www-form-urlencoded') ? null
      : null;

    let fetchCode = `fetch('${fullUrl}', {\n  method: '${method}',`;
    const headerEntries = Object.entries(fetchHeaders);
    if (headerEntries.length > 0) {
      fetchCode += `\n  headers: {\n${headerEntries.map(([k, v]) => `    '${k}': '${v}'`).join(',\n')}\n  },`;
    }
    if (body && body.type !== 'none') {
      if (fetchBody !== null) {
        try {
          JSON.parse(fetchBody);
          fetchCode += `\n  body: JSON.stringify(${JSON.stringify(JSON.parse(fetchBody), null, 4).split('\n').map((l, i) => i === 0 ? l : `  ${l}`).join('\n').trim()}),`;
        } catch {
          fetchCode += `\n  body: \`${fetchBody.replace(/`/g, '\\`')}\`,`;
        }
      } else if (body.type === 'form-data' || body.type === 'x-www-form-urlencoded') {
        const items = body.type === 'form-data' ? body.formData : body.xwwwFormUrlencoded;
        const fd = (items || []).filter(i => i.enabled && i.key);
        if (fd.length > 0) {
          fetchCode += `\n  body: new URLSearchParams({\n${fd.map(i => `    '${i.key}': '${i.default || ''}'`).join(',\n')}\n  }),`;
        }
      }
    }
    fetchCode += '\n});';
    lines.push('```javascript');
    lines.push(fetchCode);
    lines.push('```');

    // Python requests
    lines.push('');
    lines.push('#### Python (requests)');
    lines.push('');
    let pyCode = `import requests\n\n`;
    if (params.length > 0) {
      pyCode += `params = {\n${params.map(p => `    '${p.key}': '${p.default || ''}'`).join(',\n')}\n}\n`;
    }
    if (Object.keys(fetchHeaders).length > 0) {
      pyCode += `headers = {\n${Object.entries(fetchHeaders).map(([k, v]) => `    '${k}': '${v}'`).join(',\n')}\n}\n`;
    }
    pyCode += `\nresponse = requests.${method.toLowerCase()}('${url}'`;
    const pyArgs = [];
    if (params.length > 0) pyArgs.push('params=params');
    if (Object.keys(fetchHeaders).length > 0) pyArgs.push('headers=headers');
    if (body && body.type !== 'none') {
      if (body.type === 'raw' && bodyContent) {
        try {
          JSON.parse(bodyContent);
          pyArgs.push(`json=${JSON.stringify(JSON.parse(bodyContent))}`);
        } catch {
          pyArgs.push(`data='''${bodyContent}'''`);
        }
      } else if (body.type === 'form-data' || body.type === 'x-www-form-urlencoded') {
        const items = body.type === 'form-data' ? body.formData : body.xwwwFormUrlencoded;
        const fd = (items || []).filter(i => i.enabled && i.key);
        if (fd.length > 0) {
          const dataStr = fd.map(i => `'${i.key}': '${i.default || ''}'`).join(',\n        ');
          pyArgs.push(`data={\n        ${dataStr}\n    }`);
        }
      }
    }
    if (pyArgs.length > 0) {
      pyCode += `,\n    ${pyArgs.join(',\n    ')}`;
    }
    pyCode += `)\n\nprint(response.status_code)\nprint(response.text)`;
    lines.push('```python');
    lines.push(pyCode);
    lines.push('```');
  }

  static _addResponseDetail(lines, result) {
    if (result.status_code) {
      lines.push(`- **状态码**: ${result.status_code}`);
    }
    if (result.elapsedTime) {
      lines.push(`- **耗时**: ${result.elapsedTime}`);
    }
    if (result.responseSize) {
      lines.push(`- **大小**: ${result.responseSize}`);
    }
    if (result.error) {
      lines.push(`- **错误信息**: ${result.error}`);
    }
    if (result.headers && Object.keys(result.headers).length > 0) {
      lines.push('');
      lines.push('**响应 Headers**');
      lines.push('');
      lines.push('| Key | Value |');
      lines.push('|-----|-------|');
      Object.entries(result.headers).forEach(([key, value]) => {
        const v = Array.isArray(value) ? value.join(', ') : String(value);
        lines.push(`| \`${key}\` | ${v} |`);
      });
    }
  }

  static _addResponseExample(lines, result, executionResult) {
    if (result.data !== undefined) {
      lines.push('');
      lines.push('**响应示例**');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(result.data, null, 2));
      lines.push('```');
    }

    if (result.assertionResult) {
      lines.push('');
      lines.push(`**断言结果**: ${result.assertionResult.summary || ''}`);
      (result.assertionResult.results || []).forEach(r => {
        const icon = r.passed ? '✓' : '✗';
        lines.push(`- ${icon} \`${r.expression}\` → 实际值: \`${r.actual}\``);
      });
    }
  }

  static _collectRefApis(apiData, config, profile) {
    if (!config?.apis) return [];
    const refApiIds = new Set();
    const refRegex = /\{\{ref:([^}]+)\}\}/g;

    const scanValue = (value) => {
      if (typeof value !== 'string') return;
      refRegex.lastIndex = 0;
      let match;
      while ((match = refRegex.exec(value)) !== null) {
        const refContent = match[1];
        const atIdx = refContent.indexOf('@');
        refApiIds.add(atIdx >= 0 ? refContent.substring(0, atIdx) : refContent.split('.')[0]);
      }
    };

    (apiData.header || []).forEach(h => {
      if (h.enabled) scanValue(h.default);
    });
    (apiData.param || []).forEach(p => {
      if (p.enabled) scanValue(p.default);
    });
    if (apiData.body) {
      if (apiData.body.type === 'form-data') {
        (apiData.body.formData || []).forEach(i => {
          if (i.enabled) scanValue(i.default);
        });
      } else if (apiData.body.type === 'x-www-form-urlencoded') {
        (apiData.body.xwwwFormUrlencoded || []).forEach(i => {
          if (i.enabled) scanValue(i.default);
        });
      } else if (apiData.body.type === 'raw') {
        scanValue(apiData.body.content);
      }
    }

    return [...refApiIds].map(id => {
      const api = config.apis.find(a => a.id === id);
      if (!api) return null;
      return {
        id: api.id,
        name: api.name || id,
        shortId: id.length > 8 ? id.slice(-6) : id,
        method: api.method,
        api_path: api.api_path,
        description: api.description || '',
        resolvedPath: this._resolveAPIPath(api.api_path, profile),
        header: this._parseToArray(api.header),
        param: this._parseToArray(api.param),
        body: this._normalizeBody(api.body),
        index: 0,
      };
    }).filter(Boolean);
  }

  static _resolveAPIPath(apiPath, profile) {
    if (!apiPath || !profile) return apiPath || '';
    let path = apiPath;
    Object.keys(profile).forEach(key => {
      if (key !== 'name' && key !== 'activate') {
        path = path.replace(`{${key}}`, profile[key]);
      }
    });
    if (!path.startsWith('http://') && !path.startsWith('https://')) {
      path = 'http://' + path;
    }
    return path;
  }

  static _parseToArray(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'object') {
      return Object.entries(data).map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          return { key, ...value };
        }
        return { key, default: value, type: 'string', description: '', enabled: true };
      });
    }
    return [];
  }

  static _normalizeBody(body) {
    if (!body || !body.type) {
      return { type: 'none', formData: [], xwwwFormUrlencoded: [], contentType: 'text', content: '', schema: null, activeContentType: 'text', contents: {} };
    }
    const normalized = {
      type: body.type,
      contentType: body.contentType || (body.type === 'json' ? 'json' : 'text'),
      content: body.content || '',
      schema: body.schema || null,
      activeContentType: body.activeContentType || body.contentType || 'text',
      contents: body.contents || {},
    };
    if (body.formData && typeof body.formData === 'object' && !Array.isArray(body.formData)) {
      normalized.formData = Object.entries(body.formData).map(([key, val]) => {
        if (typeof val === 'object' && val !== null) {
          return { key, ...val };
        }
        return { key, default: val, type: 'string', description: '', enabled: true };
      });
    } else {
      normalized.formData = body.formData || [];
    }
    if (body.xwwwFormUrlencoded && typeof body.xwwwFormUrlencoded === 'object' && !Array.isArray(body.xwwwFormUrlencoded)) {
      normalized.xwwwFormUrlencoded = Object.entries(body.xwwwFormUrlencoded).map(([key, val]) => {
        if (typeof val === 'object' && val !== null) {
          return { key, ...val };
        }
        return { key, default: val, type: 'string', description: '', enabled: true };
      });
    } else {
      normalized.xwwwFormUrlencoded = body.xwwwFormUrlencoded || [];
    }
    return normalized;
  }

  static _resolveRefValue(value, refApis) {
    if (typeof value !== 'string') return value;
    return value.replace(/\{\{ref:([^}]+)\}\}/g, (match, refPath) => {
      const parts = refPath.split('.');
      const apiId = parts[0];
      const fieldPath = parts.slice(1).join('.');
      const refApi = refApis.find(a => a.id === apiId);
      if (refApi) {
        return `\`${refApi.index}.${refApi.name}(${refApi.shortId})\`返回值中的${fieldPath}`;
      }
      return match;
    });
  }

  static _findApiResult(apiId, executionResult) {
    if (!executionResult?.allResults) return null;
    return executionResult.allResults[apiId] || null;
  }

  static download(markdown, fileName) {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export default APIDocGenerator;
