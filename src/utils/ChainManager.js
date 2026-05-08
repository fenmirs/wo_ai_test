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

    // 1. 按顺序执行依赖链
    for (const chainItem of chain) {
      // chainItem 结构应为: { id: 'xxx', ... } 或直接是 id 字符串 (向后兼容)
      const apiId = typeof chainItem === 'object' ? chainItem.id : chainItem;
      
      const depAPI = this.findAPIById(apiId);
      if (!depAPI) {
        throw new Error(`找不到依赖 API (ID: ${apiId})`);
      }

      // 执行依赖 API
      const result = await this.executor.executeAPI(depAPI, {});
      
      // 记录结果
      this.chainResults[apiId] = result;

      if (!result.success) {
        throw new Error(`依赖链执行失败: ${depAPI.name} (ID: ${apiId})`);
      }
    }

    // 2. 解析目标 API 中的所有动态引用
    const resolvedTarget = this.resolveAPI(targetAPI);

    // 3. 执行目标 API
    const targetResult = await this.executor.executeAPI(resolvedTarget, customData);
    this.chainResults[targetAPI.id || targetAPI.name] = targetResult;

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
        let value = resultData.data;
        if (fieldPath) {
          const keys = fieldPath.split('.');
          for (const key of keys) {
            if (typeof value === 'object' && value !== null) {
              value = value[key];
            } else {
              return null;
            }
          }
        }
        return value;
      }
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