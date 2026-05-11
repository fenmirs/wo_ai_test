import APIExecutor from './APIExecutor';

class ChainManager {
  constructor(projectPath, config, profile) {
    this.projectPath = projectPath;
    this.config = config;
    this.profile = profile;
    this.executor = new APIExecutor(projectPath, config, profile);
    this.chainResults = {};
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
      const result = await this.executor.executeAPI(depAPI, {});
      
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
    const resolvedTarget = this.resolveAPI(targetAPI);

    console.log(`[ChainManager] ▶ [目标 API] ${targetAPI.name || targetAPI.id}`);
    console.log(`[ChainManager]   ${targetAPI.method} ${targetAPI.api_path}`);

    // 3. 执行目标 API
    const targetResult = await this.executor.executeAPI(resolvedTarget, customData);
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
        clonedAPI.body = this.resolveDict(clonedAPI.body);
      }
    }
    
    return clonedAPI;
  }

  resolveValue(value) {
    if (typeof value !== 'string') return value;

    // 修复：使用 [1] 而不是 group(1)
    const refMatch = value.match(/\{\{ref:([^}]+)\}\}/);
    if (refMatch) {
      const refPath = refMatch[1];
      const parts = refPath.split('.');
      const apiId = parts[0];
      const fieldPath = parts.slice(1).join('.');

      const resultData = this.chainResults[apiId];
      
      if (resultData && resultData.data) {
        let resolved = resultData.data;
        if (fieldPath) {
          const keys = fieldPath.split('.');
          for (const key of keys) {
            if (typeof resolved === 'object' && resolved !== null) {
              resolved = resolved[key];
            } else {
              console.log(`[ChainManager]   ⚠ 引用解析失败: {{ref:${refPath}}} -> 路径 ${key} 不存在`);
              return null;
            }
          }
        }
        console.log(`[ChainManager]   ✓ 引用解析: {{ref:${refPath}}} -> ${JSON.stringify(resolved).substring(0, 100)}${JSON.stringify(resolved).length > 100 ? '...' : ''}`);
        return resolved;
      }
      console.log(`[ChainManager]   ⚠ 引用解析失败: {{ref:${refPath}}} -> 找不到 API ${apiId} 的结果`);
      return null;
    }

    // 解析 {{readFile:filename}}
    const fileMatch = value.match(/\{\{readFile:([^}]+)\}\}/);
    if (fileMatch) {
      // 暂时返回原始值，或者调用读取逻辑
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