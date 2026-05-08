/**
 * 项目数据管理器
 * 负责在内存中管理项目数据，支持修改追踪和保存
 */

class ProjectManager {
  constructor() {
    this.projectData = null; // 完整的项目配置数据
    this.dirPath = null; // 项目目录路径
    this.projectId = null; // 项目ID
    this.projectName = null; // 项目名称
    this.configFile = null; // 配置文件名
    this.historyFile = null; // 历史记录文件名
    this.executionHistory = []; // 执行历史记录
    this.isDirty = false; // 是否有未保存的修改
    this.listeners = []; // 状态变化监听器
    this.autoSaveTimer = null; // 自动保存定时器
    this.dirProjects = []; // 目录下的项目列表
    this.recentProjects = []; // 最近项目列表
    this.maxRecentProjects = 10; // 最大最近项目数量
  }

  /**
    * 扫描目录下的项目
    */
  async scanDirectory(dirPath) {
    try {
      const { data, error } = await window.electron.scanDirectoryProjects(dirPath);
      if (error) throw new Error(error);
      this.dirProjects = data || [];
      return this.dirProjects;
    } catch (error) {
      console.error('扫描目录失败:', error);
      return [];
    }
  }

  /**
   * 获取目录项目列表
   */
  getDirProjects() {
    return this.dirProjects;
  }

  /**
    * 加载最近项目列表
    */
  async loadRecentProjects() {
    try {
      const { data } = await window.electron.readProjectList();
      this.recentProjects = data || [];
      return this.recentProjects;
    } catch (error) {
      console.error('加载最近项目列表失败:', error);
      return [];
    }
  }

  /**
    * 保存最近项目列表
    */
  async saveRecentProjects() {
    try {
      await window.electron.saveProjectList(this.recentProjects);
    } catch (error) {
      console.error('保存最近项目列表失败:', error);
    }
  }

  /**
   * 添加项目到最近列表
   */
  async addToRecentProjects(dirPath, projectId, projectName) {
    this.recentProjects = this.recentProjects.filter(p => !(p.dirPath === dirPath && p.projectId === projectId));
    this.recentProjects.unshift({
      dirPath: dirPath,
      projectId: projectId,
      name: projectName,
      lastOpened: new Date().toISOString()
    });
    if (this.recentProjects.length > this.maxRecentProjects) {
      this.recentProjects = this.recentProjects.slice(0, this.maxRecentProjects);
    }
    await this.saveRecentProjects();
  }

  /**
   * 获取最近项目列表
   */
  getRecentProjects() {
    return this.recentProjects;
  }

  /**
    * 创建新项目
    */
  async createProject(dirPath, projectName) {
    try {
      const result = await window.electron.createNewProject(dirPath, projectName);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      // 加载项目列表
      await this.scanDirectory(dirPath);
      
      return { success: true, project: result };
    } catch (error) {
      console.error('创建项目失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 加载项目配置
   */
  async loadProject(dirPath, projectId) {
    try {
      // 读取配置文件
      const configResult = await window.electron.readProjectConfig(dirPath, projectId);
      if (!configResult.success) {
        return { success: false, error: configResult.error };
      }
      const configData = configResult.data;
      
      // 读取历史记录
      let historyData = [];
      const historyResult = await window.electron.readProjectHistory(dirPath, projectId);
      if (historyResult.success) {
        historyData = historyResult.data || [];
      }

      this.projectData = JSON.parse(JSON.stringify(configData));
      this.dirPath = dirPath;
      this.projectId = projectId;
      this.projectName = configData.projectName || projectId;
      
      // 获取配置文件名
      const dirProject = this.dirProjects.find(p => p.id === projectId);
      if (dirProject) {
        this.configFile = dirProject.configFile;
        this.historyFile = dirProject.historyFile;
      } else {
        this.configFile = projectId + '_config.json';
        this.historyFile = projectId + '_history.json';
      }
      
      this.executionHistory = historyData || [];
      this.isDirty = false;
      
      // 数据迁移：为旧数据添加 id
      this._migrateData();
      
      // 添加到最近项目列表
      await this.addToRecentProjects(dirPath, projectId, this.projectName);
      
      this._notifyListeners();
      
      return { success: true };
    } catch (error) {
      console.error('加载项目失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 数据迁移：为旧数据格式添加 id 字段
   */
  _migrateData() {
    let migrated = false;
    
    // 1. 为 API 添加 id（如果不存在）
    if (this.projectData.apis) {
      this.projectData.apis.forEach(api => {
        if (!api.id) {
          api.id = this._generateId('api');
          migrated = true;
        }
        // 确保 chain 中的元素是 id（如果是旧数据，可能是名称）
        if (api.chain && Array.isArray(api.chain)) {
          api.chain = api.chain.map(chainRef => {
            // 如果 chainRef 是对象（新格式），直接返回 id
            if (typeof chainRef === 'object' && chainRef.id) {
              return chainRef.id;
            }
            // 如果是字符串，尝试查找对应的 API id
            if (typeof chainRef === 'string') {
              // 检查是否是 API id 格式
              if (chainRef.startsWith('api_')) {
                return chainRef;
              }
              // 否则可能是 API 名称，查找对应的 id
              const refApi = this.projectData.apis.find(a => a.name === chainRef);
              return refApi ? refApi.id : chainRef;
            }
            return chainRef;
          });
        }
      });
    }
    
    // 2. 将 groups 从字符串数组迁移为对象数组
    if (this.projectData.groups && typeof this.projectData.groups[0] === 'string') {
      const oldGroups = this.projectData.groups;
      const groupNameToId = {};
      
      this.projectData.groups = oldGroups.map(name => {
        const id = this._generateId('group');
        groupNameToId[name] = id;
        return { id, name, parentId: null };
      });
      
      // 更新 API 的 group 字段从字符串改为 id
      if (this.projectData.apis) {
        this.projectData.apis.forEach(api => {
          if (api.group && groupNameToId[api.group]) {
            api.group = groupNameToId[api.group];
          }
        });
      }
      
      migrated = true;
    }
    
    // 3. 确保 groups 存在
    if (!this.projectData.groups) {
      this.projectData.groups = [];
    }
    
    // 4. 为历史记录添加 apiId（如果不存在）
    if (this.executionHistory) {
      this.executionHistory.forEach(entry => {
        if (!entry.apiId && entry.apiName && this.projectData.apis) {
          const api = this.projectData.apis.find(a => a.name === entry.apiName);
          if (api) {
            entry.apiId = api.id;
            migrated = true;
          }
        }
      });
    }
    
    if (migrated) {
      console.log('项目数据已自动迁移到新格式');
      this.markDirty();
    }
  }

  /**
   * 生成唯一 ID
   */
  _generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
    * 保存项目配置
    */
  async saveProject() {
    if (!this.dirPath || !this.projectId || !this.projectData) {
      return { success: false, error: '没有项目数据可保存' };
    }

    try {
      this.projectData.projectName = this.projectName;
      
      const { success, error } = await window.electron.saveProjectConfig(
        this.dirPath,
        this.projectId,
        this.projectData
      );
      
      if (!success) {
        return { success: false, error };
      }
      
      // 保存历史记录
      await window.electron.saveProjectHistory(
        this.dirPath,
        this.projectId,
        this.executionHistory
      );
      
      this.isDirty = false;
      this._notifyListeners();
      return { success: true };
    } catch (error) {
      console.error('保存项目失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 加载历史记录
   */
  async loadHistory() {
    if (!this.dirPath || !this.projectId) return [];
    
    try {
      const { data } = await window.electron.readProjectHistory(this.dirPath, this.projectId);
      this.executionHistory = data || [];
    } catch (error) {
      console.error('加载历史记录失败:', error);
    }
    return this.executionHistory;
  }

  /**
   * 添加历史记录
   */
  addHistory(historyEntry) {
    this.executionHistory.unshift(historyEntry);
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(0, 100);
    }
  }

  /**
   * 获取历史记录
   */
  getHistory() {
    return this.executionHistory;
  }

  /**
   * 删除单条历史记录
   */
  deleteHistory(entryId) {
    this.executionHistory = this.executionHistory.filter(entry => entry.id !== entryId);
    this.markDirty();
  }

  /**
   * 清空历史记录
   */
  clearHistory() {
    this.executionHistory = [];
    this.markDirty();
  }

  /**
   * 启用自动保存
   * @param {number} interval - 保存间隔（毫秒），默认 5000ms
   */
  enableAutoSave(interval = 5000) {
    this.disableAutoSave();
    
    this.autoSaveTimer = setInterval(async () => {
      if (this.isDirty) {
        console.log('自动保存中...');
        const result = await this.saveProject();
        if (result.success) {
          console.log('自动保存成功');
        } else {
          console.error('自动保存失败:', result.error);
        }
      }
    }, interval);
  }

  /**
   * 禁用自动保存
   */
  disableAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * 获取项目选择的环境
   */
  getSelectedProfileName() {
    if (!this.dirPath || !this.projectId) return null;
    const key = `profile_${this.dirPath}_${this.projectId}`;
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  /**
   * 保存项目选择的环境
   */
  setSelectedProfileName(profileName) {
    if (!this.dirPath || !this.projectId) return;
    const key = `profile_${this.dirPath}_${this.projectId}`;
    try {
      if (profileName) {
        localStorage.setItem(key, profileName);
      } else {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.error('保存环境选择失败:', e);
    }
  }

  /**
   * 获取项目路径
   */
  getProjectPath() {
    return this.dirPath || '';
  }

  /**
   * 获取项目ID
   */
  getProjectId() {
    return this.projectId || '';
  }

  /**
   * 获取项目名称
   */
  getProjectName() {
    return this.projectName || '';
  }

  /**
   * 获取项目数据
   */
  getData() {
    return this.projectData;
  }

  /**
   * 获取是否脏状态
   */
  getIsDirty() {
    return this.isDirty;
  }

  /**
   * 更新环境配置
   */
  updateProfile(profileName, newProfile) {
    if (!this.projectData) return;
    
    const index = this.projectData.profile.findIndex(p => p.name === profileName);
    if (index !== -1) {
      this.projectData.profile[index] = { ...this.projectData.profile[index], ...newProfile };
      this.markDirty();
    }
  }

  removeProfileField(profileName, fieldName) {
    if (!this.projectData) return;
    
    const index = this.projectData.profile.findIndex(p => p.name === profileName);
    if (index !== -1) {
      delete this.projectData.profile[index][fieldName];
      this.markDirty();
    }
  }
  resetProfile(newProfile) {
    if (!this.projectData) return;
    this.projectData.profile = newProfile;
    this.markDirty();
  }

  /**
   * 添加环境配置
   */
  addProfile(profile) {
    if (!this.projectData) return;
    
    this.projectData.profile.push(profile);
    this.markDirty();
  }

  /**
   * 删除环境配置
   */
  deleteProfile(profileName) {
    if (!this.projectData) return;
    
    this.projectData.profile = this.projectData.profile.filter(p => p.name !== profileName);
    this.markDirty();
  }

  /**
   * 更新 API 配置
   */
  updateAPI(apiIdOrName, newAPI) {
    if (!this.projectData) return;
    
    const index = this.projectData.apis.findIndex(api => 
      api.id === apiIdOrName || api.name === apiIdOrName
    );
    
    if (index !== -1) {
      // 保持 id 不变
      const id = this.projectData.apis[index].id;
      this.projectData.apis[index] = { 
        ...this.projectData.apis[index], 
        ...newAPI,
        id: id  // 确保 id 不被覆盖
      };
      this.markDirty();
    }
  }

  /**
   * 添加 API 配置
   */
  addAPI(api) {
    if (!this.projectData) return;
    
    // 确保 API 有 id
    if (!api.id) {
      api.id = this._generateId('api');
    }
    
    this.projectData.apis.push(api);
    this.markDirty();
  }

  /**
   * 删除 API 配置
   */
  deleteAPI(apiId) {
    if (!this.projectData) return;
    
    this.projectData.apis = this.projectData.apis.filter(api => api.id !== apiId);
    
    // 清理依赖链中的引用
    this.projectData.apis.forEach(api => {
      if (api.chain && Array.isArray(api.chain)) {
        api.chain = api.chain.filter(chainRef => {
          // chainRef 可能是 id 或 name，都进行过滤
          return chainRef !== apiId;
        });
      }
    });
    
    this.markDirty();
  }

  /**
   * 添加分组
   * @param {string} groupName - 分组名称
   * @param {string|null} parentId - 父分组 ID，null 表示根分组
   */
  addGroup(groupName, parentId = null) {
    if (!this.projectData) return;
    
    if (!this.projectData.groups) {
      this.projectData.groups = [];
    }
    
    // 检查是否已存在（同父分组下名称不能重复）
    const exists = this.projectData.groups.find(g => 
      g.name === groupName && g.parentId === parentId
    );
    
    if (!exists) {
      const newGroup = {
        id: this._generateId('group'),
        name: groupName,
        parentId: parentId
      };
      this.projectData.groups.push(newGroup);
      this.markDirty();
    }
  }

  /**
   * 复制 API
   * @param {string} apiId - 要复制的 API ID
   * @returns {object|null} - 新复制的 API
   */
  copyAPI(apiId) {
    if (!this.projectData) return null;
    
    const sourceAPI = this.projectData.apis?.find(api => api.id === apiId);
    if (!sourceAPI) return null;
    
    // 创建副本，生成新 ID，修改名称
    const newAPI = JSON.parse(JSON.stringify(sourceAPI));
    newAPI.id = this._generateId('api');
    newAPI.name = `${sourceAPI.name}(复制)`;
    
    this.projectData.apis.push(newAPI);
    this.markDirty();
    
    return newAPI;
  }

  /**
   * 复制分组（递归复制所有子分组和 API）
   * @param {string} groupId - 要复制的分组 ID
   * @param {string|null} newParentId - 新分组的父 ID，null 表示根分组
   * @returns {string|null} - 新分组的 ID
   */
  copyGroup(groupId, newParentId = null) {
    if (!this.projectData) return null;
    
    // 查找源分组
    const sourceGroup = this.projectData.groups?.find(g => g.id === groupId);
    if (!sourceGroup) return null;
    
    // 创建分组 ID 映射表（旧 ID -> 新 ID）
    const groupIdMap = {};
    
    // 递归复制分组
    const copyGroupRecursive = (sourceGroupId, parentId) => {
      const group = this.projectData.groups.find(g => g.id === sourceGroupId);
      if (!group) return null;
      
      // 创建新分组
      const newGroupId = this._generateId('group');
      groupIdMap[sourceGroupId] = newGroupId;
      
      const newGroup = {
        id: newGroupId,
        name: group.id === groupId ? `${group.name}(复制)` : group.name,
        parentId: parentId
      };
      
      this.projectData.groups.push(newGroup);
      
      // 复制该分组下的 API
      this.projectData.apis?.forEach(api => {
        if (api.group === sourceGroupId) {
          const newAPI = JSON.parse(JSON.stringify(api));
          newAPI.id = this._generateId('api');
          newAPI.group = newGroupId;
          // 如果有 chain 引用，需要更新引用的 API ID
          if (newAPI.chain && Array.isArray(newAPI.chain)) {
            newAPI.chain = newAPI.chain.map(chainRef => {
              // 如果引用的是同一分组内复制的 API，需要更新为新 ID
              // 这里暂时保留原引用，因为跨分组的引用可能不需要修改
              return chainRef;
            });
          }
          this.projectData.apis.push(newAPI);
        }
      });
      
      // 递归复制子分组
      const children = this.projectData.groups.filter(g => g.parentId === sourceGroupId);
      children.forEach(child => {
        copyGroupRecursive(child.id, newGroupId);
      });
      
      return newGroupId;
    };
    
    const newGroupId = copyGroupRecursive(groupId, newParentId);
    
    if (newGroupId) {
      this.markDirty();
    }
    
    return newGroupId;
  }

  /**
   * 删除分组（递归删除子分组）
   */
  deleteGroup(groupId) {
    if (!this.projectData || !this.projectData.groups) return;
    
    // 获取所有需要删除的子分组
    const groupsToDelete = this._getChildGroupIds(groupId);
    groupsToDelete.push(groupId);
    
    // 从分组列表中移除
    this.projectData.groups = this.projectData.groups.filter(g => !groupsToDelete.includes(g.id));
    
    // 将属于这些分组的 API 移到默认分组（默认分组 id 为 'default'）
    this.projectData.apis?.forEach(api => {
      if (groupsToDelete.includes(api.group)) {
        api.group = 'default'; // 移到默认分组
      }
    });
    
    this.markDirty();
  }

  /**
   * 更新分组信息
   */
  updateGroup(groupId, updates) {
    if (!this.projectData || !this.projectData.groups) return;
    
    const index = this.projectData.groups.findIndex(g => g.id === groupId);
    if (index !== -1) {
      this.projectData.groups[index] = { 
        ...this.projectData.groups[index], 
        ...updates 
      };
      this.markDirty();
    }
  }

  /**
   * 获取所有子分组 ID（递归）
   */
  _getChildGroupIds(parentId) {
    if (!this.projectData?.groups) return [];
    
    const children = this.projectData.groups.filter(g => g.parentId === parentId);
    let allIds = children.map(g => g.id);
    
    children.forEach(child => {
      allIds = [...allIds, ...this._getChildGroupIds(child.id)];
    });
    
    return allIds;
  }

  /**
   * 获取分组树形结构
   */
  getGroupTree() {
    if (!this.projectData?.groups) {
      return [{ id: 'default', name: '默认', parentId: null, children: [] }];
    }
    
    const rootGroups = this.projectData.groups.filter(g => !g.parentId);
    const buildTree = (parentId) => {
      return this.projectData.groups
        .filter(g => g.parentId === parentId)
        .map(g => ({
          ...g,
          children: buildTree(g.id)
        }));
    };
    
    return rootGroups.map(g => ({
      ...g,
      children: buildTree(g.id)
    }));
  }

  /**
   * 获取扁平化的分组列表（包含层级信息）
   */
  getFlatGroupsWithLevel() {
    if (!this.projectData?.groups) {
      return [{ id: 'default', name: '默认', parentId: null, level: 0 }];
    }
    
    const result = [];
    const defaultGroup = { id: 'default', name: '默认', parentId: null, level: 0 };
    result.push(defaultGroup);
    
    const addGroupsRecursive = (parentId, level) => {
      this.projectData.groups
        .filter(g => g.parentId === parentId)
        .forEach(g => {
          result.push({ ...g, level });
          addGroupsRecursive(g.id, level + 1);
        });
    };
    
    addGroupsRecursive(null, 0);
    return result;
  }

  /**
   * 更新分组列表
   */
  updateGroups(groups) {
    if (!this.projectData) return;
    this.projectData.groups = groups;
    this.markDirty();
  }

  /**
   * 获取所有分组
   */
  getGroups() {
    if (!this.projectData) return ['默认'];
    
    const groups = new Set(['默认']);
    this.projectData.apis?.forEach(api => {
      if (api.group && api.group !== '默认') {
        groups.add(api.group);
      }
    });
    this.projectData.groups?.forEach(g => {
      groups.add(g.id);
    });
    return Array.from(groups);
  }

  /**
   * 标记数据为脏状态
   */
  markDirty() {
    if (!this.isDirty) {
      this.isDirty = true;
      this._notifyListeners();
    }
  }

  /**
   * 清空项目数据
   */
  clear() {
    this.projectData = null;
    this.dirPath = null;
    this.projectId = null;
    this.projectName = null;
    this.configFile = null;
    this.historyFile = null;
    this.executionHistory = [];
    this.isDirty = false;
    this.disableAutoSave();
    this._notifyListeners();
  }

  /**
   * 添加状态变化监听器
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * 移除状态变化监听器
   */
  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知所有监听器
   */
  _notifyListeners() {
    this.listeners.forEach(callback => {
      callback({
        projectData: this.projectData,
        isDirty: this.isDirty
      });
    });
  }
}

// 导出单例
export const projectManager = new ProjectManager();
export default ProjectManager;