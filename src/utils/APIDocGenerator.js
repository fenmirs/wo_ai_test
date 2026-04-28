/**
 * API 文档生成器
 * 生成 Markdown 格式的 API 文档
 */
class APIDocGenerator {
  /**
   * 生成 API 文档（Markdown 格式）
   * @param {Object} apiData - API 数据（formData）
   * @param {string} resolvedPath - 完整 URL
   * @param {Object} executionResult - 执行结果（可选）
   * @returns {string} Markdown 文档
   */
  static generate(apiData, resolvedPath, executionResult = null) {
    const lines = [];

    // 标题
    lines.push(`# ${apiData.name}`);
    lines.push('');

    // 基本信息
    lines.push('## 基本信息');
    lines.push('');
    lines.push(`- **方法**: \`${apiData.method}\``);
    lines.push(`- **路径**: \`${apiData.api_path}\``);
    lines.push(`- **分组**: ${apiData.group || '默认'}`);
    if (apiData.chain && apiData.chain.length > 0) {
      lines.push(`- **依赖**: ${apiData.chain.join(' → ')}`);
    }
    lines.push('');

    // 请求
    lines.push('## 请求');
    lines.push('');

    // 完整 URL
    if (resolvedPath) {
      lines.push('### 完整 URL');
      lines.push('```');
      lines.push(resolvedPath);
      lines.push('```');
      lines.push('');
    }

    // Headers
    const enabledHeaders = apiData.header.filter(h => h.enabled && h.key);
    if (enabledHeaders.length > 0) {
      lines.push('### Headers');
      lines.push('');
      lines.push('| Key | Value | Description |');
      lines.push('|-----|-------|-------------|');
      enabledHeaders.forEach(h => {
        lines.push(`| \`${h.key}\` | \`${h.default || ''}\` | ${h.description || ''} |`);
      });
      lines.push('');
    }

    // Query Parameters
    const enabledParams = apiData.param.filter(p => p.enabled && p.key);
    if (enabledParams.length > 0) {
      lines.push('### Query Parameters');
      lines.push('');
      lines.push('| Key | Type | Default | Description |');
      lines.push('|-----|------|---------|-------------|');
      enabledParams.forEach(p => {
        lines.push(`| \`${p.key}\` | ${p.type || 'string'} | \`${p.default || ''}\` | ${p.description || ''} |`);
      });
      lines.push('');
    }

    // Body
    if (apiData.body && apiData.body.type !== 'none') {
      lines.push('### Body');
      lines.push('');
      lines.push(`**类型**: \`${apiData.body.type}\``);
      lines.push('');

      if (apiData.body.type === 'raw') {
        const lang = apiData.body.contentType === 'json' ? 'json' : apiData.body.contentType === 'xml' ? 'xml' : 'text';
        lines.push('**内容**:');
        lines.push(`\`\`\`${lang}`);
        lines.push(apiData.body.content || '');
        lines.push('```');
        lines.push('');
      } else if (apiData.body.type === 'form-data' || apiData.body.type === 'x-www-form-urlencoded') {
        const items = apiData.body.type === 'form-data' ? apiData.body.formData : apiData.body.xwwwFormUrlencoded;
        const enabledItems = items ? items.filter(i => i.enabled && i.key) : [];
        if (enabledItems.length > 0) {
          lines.push('| Key | Type | Default | Description |');
          lines.push('|-----|------|---------|-------------|');
          enabledItems.forEach(i => {
            lines.push(`| \`${i.key}\` | ${i.type || 'string'} | \`${i.default || ''}\` | ${i.description || ''} |`);
          });
          lines.push('');
        }
      }
    }

    // 断言
    if (apiData.assertions) {
      const enabledAssertions = apiData.assertions.filter(a => a.enabled && a.expression && a.expression.trim());
      if (enabledAssertions.length > 0) {
        lines.push('## 断言');
        lines.push('');
        enabledAssertions.forEach(a => {
          lines.push(`- \`${a.expression}\``);
        });
        lines.push('');
      }
    }

    // 响应（如果有执行结果）
    if (executionResult && executionResult.targetResult) {
      lines.push('## 响应');
      lines.push('');
      lines.push(`### 状态码: ${executionResult.targetResult.status_code || 'N/A'}`);
      lines.push('');

      if (executionResult.targetResult.data !== undefined) {
        lines.push('### 响应体');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(executionResult.targetResult.data, null, 2));
        lines.push('```');
        lines.push('');
      }

      // 响应头
      if (executionResult.targetResult.headers && Object.keys(executionResult.targetResult.headers).length > 0) {
        lines.push('### 响应 Headers');
        lines.push('');
        lines.push('| Key | Value |');
        lines.push('|-----|-------|');
        Object.entries(executionResult.targetResult.headers).forEach(([key, value]) => {
          const displayValue = Array.isArray(value) ? value.join(', ') : value;
          lines.push(`| \`${key}\` | \`${displayValue}\` |`);
        });
        lines.push('');
      }

    }
    // 常见错误码
    lines.push('## 常见错误码');
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

  /**
   * 下载文档（浏览器环境）
   * @param {string} markdown - Markdown 内容
   * @param {string} fileName - 文件名
   */
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
