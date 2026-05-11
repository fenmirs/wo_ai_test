class APIDocGenerator {
  static generate(apiData, resolvedPath, executionResult = null, config = null) {
    const lines = [];
    const refApis = this._collectRefApis(apiData, config);

    // lines.push(`# ${apiData.name}`);
    // lines.push('');

    refApis.forEach((refApi, index) => {
      refApi.index = index + 1;
      lines.push(`## ${refApi.index}.${refApi.name}(${refApi.shortId})`);
      lines.push('');
      lines.push(`- **方法**: \`${refApi.method}\``);
      lines.push(`- **完整路径**: \`${refApi.resolvedPath}\``);
      const refResult = this._findApiResult(refApi.id, executionResult);
      if (refResult && refResult.data !== undefined) {
        lines.push('');
        lines.push('**响应示例**:');
        lines.push('```json');
        lines.push(JSON.stringify(refResult.data, null, 2));
        lines.push('```');
      }
      lines.push('');
    });

    let secNum = refApis.length + 1;
    lines.push(`## ${secNum}.${apiData.name}`);
    lines.push('');
    lines.push(`- **方法**: \`${apiData.method}\``);
    lines.push(`- **完整路径**: \`${resolvedPath}\``);
    lines.push('');

    const enabledHeaders = apiData.header.filter(h => h.enabled && h.key);
    if (enabledHeaders.length > 0) {
      lines.push('### Headers');
      lines.push('');
      lines.push('| Key | Value | 备注 |');
      lines.push('|-----|-------|------|');
      enabledHeaders.forEach(h => {
        const displayValue = this._resolveRefValue(h.default || '', refApis);
        lines.push(`| \`${h.key}\` | ${displayValue} | ${h.description || ''} |`);
      });
      lines.push('');
    }

    const enabledParams = apiData.param.filter(p => p.enabled && p.key);
    if (enabledParams.length > 0) {
      lines.push('### Query Parameters');
      lines.push('');
      lines.push('| Key | 类型 | 默认值 | 备注 |');
      lines.push('|-----|------|--------|------|');
      enabledParams.forEach(p => {
        const displayValue = this._resolveRefValue(p.default || '', refApis);
        lines.push(`| \`${p.key}\` | ${p.type || 'string'} | ${displayValue} | ${p.description || ''} |`);
      });
      lines.push('');
    }

    if (apiData.body && apiData.body.type !== 'none') {
      lines.push(`### Body (${apiData.body.type})`);
      lines.push('');

      if (apiData.body.type === 'raw') {
        const lang = apiData.body.contentType === 'json' ? 'json'
          : apiData.body.contentType === 'xml' ? 'xml'
          : apiData.body.contentType === 'html' ? 'html' : 'text';
        const content = this._resolveRefValue(apiData.body.content || '', refApis);
        lines.push(`\`\`\`${lang}`);
        lines.push(content);
        lines.push('```');
        lines.push('');
      } else if (apiData.body.type === 'form-data' || apiData.body.type === 'x-www-form-urlencoded') {
        const items = apiData.body.type === 'form-data' ? apiData.body.formData : apiData.body.xwwwFormUrlencoded;
        const enabledItems = items ? items.filter(i => i.enabled && i.key) : [];
        if (enabledItems.length > 0) {
          lines.push('| Key | 类型 | 默认值 | 备注 |');
          lines.push('|-----|------|--------|------|');
          enabledItems.forEach(i => {
            const displayValue = this._resolveRefValue(i.default || '', refApis);
            lines.push(`| \`${i.key}\` | ${i.type || 'string'} | ${displayValue} | ${i.description || ''} |`);
          });
          lines.push('');
        }
      }
    }

    if (executionResult && executionResult.targetResult && executionResult.targetResult.data !== undefined) {
      const tr = executionResult.targetResult;
      secNum++;
      if (tr.success) {
        lines.push(`## ${secNum}.正确响应`);
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(tr.data, null, 2));
        lines.push('```');
        lines.push('');
      } else {
        lines.push(`## ${secNum}.错误响应`);
        lines.push('');
        if (tr.status_code) {
          lines.push(`- **状态码**: ${tr.status_code}`);
        }
        if (tr.error) {
          lines.push(`- **错误信息**: ${tr.error}`);
        }
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(tr.data, null, 2));
        lines.push('```');
        lines.push('');
      }
    }

    secNum++;
    lines.push(`## ${secNum}.常见错误码`);
    lines.push('');
    lines.push('| 状态码 | 说明 |');
    lines.push('|--------|------|');
    lines.push('| 200 | 请求成功 |');
    lines.push('| 400 | 请求参数错误 |');
    lines.push('| 401 | 未授权 |');
    lines.push('| 403 | 无权限 |');
    lines.push('| 404 | 资源不存在 |');
    lines.push('| 500 | 服务器内部错误 |');
    lines.push('');

    return lines.join('\n');
  }

  static _collectRefApis(apiData, config) {
    if (!config?.apis) return [];
    const refApiIds = new Set();
    const refRegex = /\{\{ref:([^}]+)\}\}/g;

    const scanValue = (value) => {
      if (typeof value !== 'string') return;
      refRegex.lastIndex = 0;
      let match;
      while ((match = refRegex.exec(value)) !== null) {
        refApiIds.add(match[1].split('.')[0]);
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
        index: 0,
      };
    }).filter(Boolean);
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
