import APIExecutor from './APIExecutor';

class ChainManager {
  constructor(projectPath, config, profile, loadAPIFn) {
    this.projectPath = projectPath;
    this.config = config;
    this.profile = profile;
    this.executor = new APIExecutor(projectPath, config, profile);
    this.chainResults = {};
    this.loadAPIFn = loadAPIFn || null;
  }

  async execute(targetAPI, customData = {}) {
    this.chainResults = {};
    const chain = targetAPI.chain || [];

    console.log(`[ChainManager] ════════════════════════════════════════`);
    console.log(`[ChainManager]  开始执行依赖链`);
    console.log(`[ChainManager]  目标 API: ${targetAPI.name || targetAPI.id} (${targetAPI.id})`);
    console.log(`[ChainManager]  依赖数量: ${chain.length}`);
    console.log(`[ChainManager] ════════════════════════════════════════`);

    // 1. 按顺序执行依赖链
    for (let i = 0; i < chain.length; i++) {
      const chainItem = chain[i];
      // chainItem 结构应为: { id: 'xxx', ... } 或直接是 id 字符串 (向后兼容)
      const apiId = typeof chainItem === 'object' ? chainItem.id : chainItem;
      
      const depAPI = this.findAPIById(apiId);
      if (!depAPI) {
        console.error(`[ChainManager] ❌ 找不到依赖 API (ID: ${apiId})`);
        throw new Error(`找不到依赖 API (ID: ${apiId})`);
      }

      console.log(`[ChainManager] ────────────────────────────────────────`);
      console.log(`[ChainManager] ▶ [依赖 ${i + 1}/${chain.length}] ${depAPI.name} (${depAPI.id})`);
      console.log(`[ChainManager]   ${depAPI.method} ${depAPI.api_path}`);

      // 执行依赖 API
      const callStart = Date.now();
      const result = await this.executor.executeAPI(depAPI, {});
      const callEnd = Date.now();
      result._startTime = callStart;
      result._endTime = callEnd;
      
      // 记录结果
      this.chainResults[apiId] = result;

      console.log(`[ChainManager]   ↳ 完成 | HTTP ${result.status_code} | 耗时 ${result.elapsedTime} | 成功: ${result.success}`);

      if (!result.success) {
        console.error(`[ChainManager] ❌ 依赖链执行失败: ${depAPI.name} (ID: ${apiId})`);
        throw new Error(`依赖链执行失败: ${depAPI.name} (ID: ${apiId})`);
      }
    }

    console.log(`[ChainManager] ────────────────────────────────────────`);
    console.log(`[ChainManager] ✓ 所有依赖执行完毕，开始解析动态引用`);

    // 2. 解析目标 API 中的所有动态引用
    let resolvedTarget;
    try {
      resolvedTarget = this.resolveAPI(targetAPI);
    } catch (err) {
      console.error(`[ChainManager] ❌ resolveAPI 失败:`, err.message);
      console.error(`[ChainManager]   targetAPI:`, JSON.stringify({ id: targetAPI.id, name: targetAPI.name, method: targetAPI.method, api_path: targetAPI.api_path }));
      throw err;
    }

    console.log(`[ChainManager] ▶ [目标 API] ${targetAPI.name || targetAPI.id}`);
    console.log(`[ChainManager]   ${targetAPI.method} ${targetAPI.api_path}`);

    // 3. 执行目标 API
    const targetCallStart = Date.now();
    const targetResult = await this.executor.executeAPI(resolvedTarget, customData);
    const targetCallEnd = Date.now();
    targetResult._startTime = targetCallStart;
    targetResult._endTime = targetCallEnd;
    this.chainResults[targetAPI.id || targetAPI.name] = targetResult;

    console.log(`[ChainManager]   ↳ 完成 | HTTP ${targetResult.status_code} | 耗时 ${targetResult.elapsedTime} | 成功: ${targetResult.success}`);
    console.log(`[ChainManager] ════════════════════════════════════════`);

    return {
      targetResult,
      allResults: this.chainResults,
      dependencies: chain
    };
  }

  findAPIById(id) {
    if (this.loadAPIFn) {
      const fullData = this.loadAPIFn(id);
      if (fullData) return fullData;
    }
    if (!this.config?.apis) return null;
    return this.config.apis.find(api => api.id === id);
  }

  resolveAPI(api) {
    const clonedAPI = JSON.parse(JSON.stringify(api));
    clonedAPI.api_path = this.resolveValue(clonedAPI.api_path);
    clonedAPI.header = this.resolveDict(clonedAPI.header);
    clonedAPI.param = this.resolveDict(clonedAPI.param);
    
    if (clonedAPI.body) {
      if (typeof clonedAPI.body === 'string') {
        clonedAPI.body = this.resolveValue(clonedAPI.body);
      } else if (typeof clonedAPI.body === 'object') {
        if (clonedAPI.body.content !== undefined && 'type' in clonedAPI.body && 'contentType' in clonedAPI.body) {
          clonedAPI.body = this.resolveValue(clonedAPI.body.content);
        } else {
          clonedAPI.body = this.resolveDict(clonedAPI.body);
        }
      }
    }
    
    return clonedAPI;
  }

  resolveRef(refContent) {
    let apiId = refContent;
    let fieldPath = '';

    const atIdx = refContent.indexOf('@');
    if (atIdx >= 0) {
      apiId = refContent.substring(0, atIdx);
      const afterAt = refContent.substring(atIdx + 1);
      const dotIdx = afterAt.indexOf('.');
      if (dotIdx >= 0) {
        fieldPath = afterAt.substring(dotIdx + 1);
      }
    } else {
      const parts = refContent.split('.');
      apiId = parts[0];
      fieldPath = parts.slice(1).join('.');
    }

    const resultData = this.chainResults[apiId];
    if (resultData && resultData.data) {
      let resolved = resultData.data;
      if (fieldPath) {
        const keys = fieldPath.split('.');
        for (const key of keys) {
          if (typeof resolved === 'object' && resolved !== null) {
            const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
            if (arrayMatch) {
              resolved = resolved[arrayMatch[1]];
              if (Array.isArray(resolved)) {
                resolved = resolved[parseInt(arrayMatch[2])];
              }
            } else {
              resolved = resolved[key];
            }
          } else {
            console.error(`[ChainManager]   ❌ 引用解析失败: {{ref:${refContent}}} -> 路径 ${key} 不存在`);
            throw new Error(`引用变量解析失败: {{ref:${refContent}}}，路径 ${key} 不存在于 API ${apiId} 的响应中`);
          }
        }
      }
      if (resolved === undefined) {
        console.error(`[ChainManager]   ❌ 引用解析失败: {{ref:${refContent}}} -> 路径 ${fieldPath} 的值为 undefined`);
        throw new Error(`引用变量解析失败: {{ref:${refContent}}}，路径 ${fieldPath} 的值为 undefined`);
      }
      console.log(`[ChainManager]   ✓ 引用解析: {{ref:${refContent}}} -> ${JSON.stringify(resolved).substring(0, 100)}${JSON.stringify(resolved).length > 100 ? '...' : ''}`);
      return resolved;
    }
    console.error(`[ChainManager]   ❌ 引用解析失败: {{ref:${refContent}}} -> 找不到 API ${apiId} 的结果`);
    throw new Error(`引用变量解析失败: {{ref:${refContent}}}，找不到 API ${apiId} 的执行结果`);
  }

  resolveValue(value) {
    if (typeof value !== 'string') return value;

    // 替换所有 {{ref:...}} 引用为实际值
    if (/\{\{ref:([^}]+)\}\}/.test(value)) {
      const resolved = value.replace(/\{\{ref:([^}]+)\}\}/g, (match, refContent) => {
        const r = this.resolveRef(refContent);
        return typeof r === 'string' ? r : JSON.stringify(r);
      });
      return resolved;
    }

    // 解析 {{readFile:filename}}
    const fileMatch = value.match(/\{\{readFile:([^}]+)\}\}/);
    if (fileMatch) {
      return this.executor.readFile(fileMatch[1]);
    }

    // 解析 {{file:filename}}
    const uploadMatch = value.match(/\{\{file:([^}]+)\}\}/);
    if (uploadMatch) {
      return {
        type: 'file_upload',
        filename: uploadMatch[1]
      };
    }

    return value;
  }

  resolveDict(data) {
    if (!data || typeof data !== 'object') return data;
    
    const resolved = {};
    for (const key in data) {
      const item = data[key];
      if (typeof item === 'object' && item !== null && 'default' in item) {
        if (item.enabled !== false) {
          resolved[key] = {
            ...item,
            default: this.resolveValue(item.default)
          };
        }
      } else {
        resolved[key] = this.resolveValue(item);
      }
    }
    return resolved;
  }
}

export default ChainManager;