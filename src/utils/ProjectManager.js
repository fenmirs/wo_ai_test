/**
 * 项目数据管理器 (v2)
 * - config.json 只存索引，完整 API 数据在 apis/{apiId}_config.json
 * - 历史记录在 apis/{apiId}_history.json
 * - 支持逻辑删除
 * - 版本号兼容
 */

function generateId(prefix) {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 7);
  return `${prefix}_${ts}${rand}`;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

class ProjectManager {
  constructor() {
    this.projectData = null;
    this.dirPath = null;
    this.projectId = null;
    this.projectName = null;
    this.isDirty = false;
    this.listeners = [];
    this.autoSaveTimer = null;
    this.dirProjects = [];
    this.recentProjects = [];
    this.maxRecentProjects = 10;
    this._apiDataCache = {};
    this._apiHistoryCache = {};
  }

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

  getDirProjects() {
    return this.dirProjects;
  }

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

  async saveRecentProjects() {
    try {
      await window.electron.saveProjectList(this.recentProjects);
    } catch (error) {
      console.error('保存最近项目列表失败:', error);
    }
  }

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

  getRecentProjects() {
    return this.recentProjects;
  }

  async createProject(dirPath, projectName) {
    try {
      const result = await window.electron.createNewProject(dirPath, projectName);
      if (!result.success) {
        return { success: false, error: result.error };
      }
      await this.scanDirectory(dirPath);
      return { success: true, project: result };
    } catch (error) {
      console.error('创建项目失败:', error);
      return { success: false, error: error.message };
    }
  }

  async loadProject(dirPath, projectId) {
    try {
      this._apiDataCache = {};
      this._apiHistoryCache = {};

      const configResult = await window.electron.readProjectConfig(dirPath, projectId);
      if (!configResult.success) {
        return { success: false, error: configResult.error };
      }
      const configData = configResult.data;

      if (!configData.version || configData.version < 2) {
        this._migrateToV2(configData, dirPath, projectId);
      }

      this.projectData = deepClone(configData);
      this.dirPath = dirPath;
      this.projectId = projectId;
      this.projectName = configData.projectName || projectId;
      this.isDirty = false;

      await this.addToRecentProjects(dirPath, projectId, this.projectName);
      this._notifyListeners();

      return { success: true };
    } catch (error) {
      console.error('加载项目失败:', error);
      return { success: false, error: error.message };
    }
  }

  async _migrateToV2(configData, dirPath, projectId) {
    console.log('[ProjectManager] 迁移到 v2 格式...');
    const apisDir = dirPath;

    if (configData.apis) {
      for (const api of configData.apis) {
        if (!api.id) {
          api.id = generateId('api');
        }
        if (api.chain && Array.isArray(api.chain)) {
          api.chain = api.chain.map(chainRef => {
            if (typeof chainRef === 'object' && chainRef.id) return chainRef.id;
            if (typeof chainRef === 'string') {
              if (chainRef.startsWith('api_')) return chainRef;
              const refApi = configData.apis.find(a => a.name === chainRef);
              return refApi ? refApi.id : chainRef;
            }
            return chainRef;
          });
        }
        const apiConfig = deepClone(api);
        const indexEntry = {
          id: api.id,
          name: api.name || '',
          group: api.group || null,
          deleted: false
        };

        try {
          await window.electron.writeAPIConfig(apisDir, projectId, api.id, apiConfig);
        } catch (e) {
          console.error(`写入 API 配置文件失败 ${api.id}:`, e);
        }

        Object.keys(api).forEach(k => {
          if (!['id', 'name', 'group'].includes(k)) {
            delete api[k];
          }
        });
        api.deleted = false;
        Object.assign(api, indexEntry);
      }
    }

    if (configData.groups && typeof configData.groups[0] === 'string') {
      const oldGroups = configData.groups;
      configData.groups = oldGroups.map(name => ({
        id: generateId('group'),
        name: name,
        parentId: null
      }));
      if (configData.apis) {
        const nameToId = {};
        oldGroups.forEach((name, i) => {
          nameToId[name] = configData.groups[i].id;
        });
        configData.apis.forEach(api => {
          if (api.group && nameToId[api.group]) {
            api.group = nameToId[api.group];
          }
        });
      }
    }

    if (!configData.groups) configData.groups = [];
    configData.version = 2;
    configData.projectName = configData.projectName || projectId;

    try {
      await window.electron.saveProjectConfig(dirPath, projectId, configData);
    } catch (e) {
      console.error('保存迁移后的配置失败:', e);
    }
  }

  async loadAPIConfig(apiId) {
    if (!this.dirPath || !this.projectId || !apiId) return null;
    if (this._apiDataCache[apiId]) return deepClone(this._apiDataCache[apiId]);

    try {
      const result = await window.electron.readAPIConfig(this.dirPath, this.projectId, apiId);
      if (result.success) {
        this._apiDataCache[apiId] = result.data;
        return deepClone(result.data);
      }
      return null;
    } catch (error) {
      console.error(`加载 API 配置失败 ${apiId}:`, error);
      return null;
    }
  }

  async saveAPIConfig(apiId, data) {
    if (!this.dirPath || !this.projectId || !apiId) return { success: false, error: '无项目数据' };

    try {
      const result = await window.electron.writeAPIConfig(this.dirPath, this.projectId, apiId, data);
      if (result.success) {
        this._apiDataCache[apiId] = deepClone(data);
      }
      return result;
    } catch (error) {
      console.error(`保存 API 配置失败 ${apiId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async loadAPIHistory(apiId) {
    if (!this.dirPath || !this.projectId || !apiId) return [];
    if (this._apiHistoryCache[apiId]) return deepClone(this._apiHistoryCache[apiId]);

    try {
      const result = await window.electron.readAPIHistory(this.dirPath, this.projectId, apiId);
      const history = result.success ? (result.data || []) : [];
      this._apiHistoryCache[apiId] = history;
      return deepClone(history);
    } catch (error) {
      console.error(`加载 API 历史失败 ${apiId}:`, error);
      return [];
    }
  }

  async saveAPIHistory(apiId, history) {
    if (!this.dirPath || !this.projectId || !apiId) return { success: false, error: '无项目数据' };

    try {
      const result = await window.electron.writeAPIHistory(this.dirPath, this.projectId, apiId, history);
      if (result.success) {
        this._apiHistoryCache[apiId] = deepClone(history);
      }
      return result;
    } catch (error) {
      console.error(`保存 API 历史失败 ${apiId}:`, error);
      return { success: false, error: error.message };
    }
  }

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
      if (!success) return { success: false, error };

      this.isDirty = false;
      this._notifyListeners();
      return { success: true };
    } catch (error) {
      console.error('保存项目失败:', error);
      return { success: false, error: error.message };
    }
  }

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

  disableAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  getSelectedProfileName() {
    if (!this.dirPath || !this.projectId) return null;
    const key = `profile_${this.dirPath}_${this.projectId}`;
    try {
      return localStorage.getItem(key);
    } catch (e) { return null; }
  }

  setSelectedProfileName(profileName) {
    if (!this.dirPath || !this.projectId) return;
    const key = `profile_${this.dirPath}_${this.projectId}`;
    try {
      if (profileName) localStorage.setItem(key, profileName);
      else localStorage.removeItem(key);
    } catch (e) { console.error('保存环境选择失败:', e); }
  }

  getProjectPath() { return this.dirPath || ''; }
  getProjectId() { return this.projectId || ''; }
  getProjectName() { return this.projectName || ''; }

  getData() { return this.projectData; }
  getIsDirty() { return this.isDirty; }

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

  addProfile(profile) {
    if (!this.projectData) return;
    this.projectData.profile.push(profile);
    this.markDirty();
  }

  deleteProfile(profileName) {
    if (!this.projectData) return;
    this.projectData.profile = this.projectData.profile.filter(p => p.name !== profileName);
    this.markDirty();
  }

  async loadAPIData(apiId) {
    return await this.loadAPIConfig(apiId);
  }

  async updateAPI(apiId, newData) {
    if (!this.projectData) return;
    const index = this.projectData.apis.findIndex(api => api.id === apiId);
    if (index === -1) return;

    const oldEntry = this.projectData.apis[index];
    const updatedEntry = {
      id: oldEntry.id,
      name: newData.name !== undefined ? newData.name : oldEntry.name,
      group: newData.group !== undefined ? newData.group : oldEntry.group,
      deleted: oldEntry.deleted || false
    };
    this.projectData.apis[index] = updatedEntry;

    this._apiDataCache[apiId] = deepClone(newData);
    try {
      await window.electron.writeAPIConfig(this.dirPath, this.projectId, apiId, newData);
    } catch (e) {
      console.error(`保存 API 数据失败 ${apiId}:`, e);
    }

    this.markDirty();
  }

  async addAPI(api) {
    if (!this.projectData) return;
    if (!api.id) api.id = generateId('api');

    const indexEntry = {
      id: api.id,
      name: api.name || '',
      group: api.group || null,
      deleted: false
    };

    this.projectData.apis.push(indexEntry);
    this._apiDataCache[api.id] = deepClone(api);

    try {
      await window.electron.writeAPIConfig(this.dirPath, this.projectId, api.id, api);
    } catch (e) {
      console.error(`保存新 API 数据失败 ${api.id}:`, e);
    }

    this.markDirty();
  }

  async softDeleteAPI(apiId) {
    if (!this.projectData) return;
    const api = this.projectData.apis.find(a => a.id === apiId);
    if (api) {
      api.deleted = true;
      this.markDirty();
    }
  }

  async restoreAPI(apiId) {
    if (!this.projectData) return;
    const api = this.projectData.apis.find(a => a.id === apiId);
    if (api) {
      api.deleted = false;
      this.markDirty();
    }
  }

  async deleteAPI(apiId) {
    if (!this.projectData) return;

    this.projectData.apis = this.projectData.apis.filter(api => api.id !== apiId);
    delete this._apiDataCache[apiId];
    delete this._apiHistoryCache[apiId];

    try {
      await window.electron.deleteAPIFile(this.dirPath, this.projectId, apiId);
    } catch (e) {
      console.error(`删除 API 文件失败 ${apiId}:`, e);
    }

    for (const api of this.projectData.apis) {
      const cached = this._apiDataCache[api.id];
      if (cached && cached.scenarios) {
        for (const scnKey of Object.keys(cached.scenarios)) {
          const scn = cached.scenarios[scnKey];
          if (scn.refChain) {
            scn.refChain = scn.refChain.filter(ref => !ref.refPath.startsWith(apiId + '@'));
          }
        }
      }
    }

    this.markDirty();
  }

  addGroup(groupName, parentId = null) {
    if (!this.projectData) return;
    if (!this.projectData.groups) this.projectData.groups = [];

    const exists = this.projectData.groups.find(g => g.name === groupName && g.parentId === parentId);
    if (!exists) {
      this.projectData.groups.push({
        id: generateId('group'),
        name: groupName,
        parentId: parentId
      });
      this.markDirty();
    }
  }

  async copyAPI(apiId) {
    if (!this.projectData) return null;
    const sourceAPI = this._apiDataCache[apiId];
    if (!sourceAPI) return null;

    const newAPI = deepClone(sourceAPI);
    newAPI.id = generateId('api');
    newAPI.name = `${sourceAPI.name}(复制)`;

    await this.addAPI(newAPI);
    return newAPI;
  }

  copyGroup(groupId, newParentId = null) {
    if (!this.projectData) return null;
    const sourceGroup = this.projectData.groups?.find(g => g.id === groupId);
    if (!sourceGroup) return null;

    const groupIdMap = {};

    const copyGroupRecursive = (sourceGroupId, parentId) => {
      const group = this.projectData.groups.find(g => g.id === sourceGroupId);
      if (!group) return null;

      const newGroupId = generateId('group');
      groupIdMap[sourceGroupId] = newGroupId;

      this.projectData.groups.push({
        id: newGroupId,
        name: group.id === groupId ? `${group.name}(复制)` : group.name,
        parentId: parentId
      });

      this.projectData.apis?.forEach(api => {
        if (api.group === sourceGroupId) {
          const newAPI = deepClone(api);
          newAPI.id = generateId('api');
          newAPI.group = newGroupId;
          this.projectData.apis.push(newAPI);
        }
      });

      const children = this.projectData.groups.filter(g => g.parentId === sourceGroupId);
      children.forEach(child => copyGroupRecursive(child.id, newGroupId));

      return newGroupId;
    };

    const newGroupId = copyGroupRecursive(groupId, newParentId);
    if (newGroupId) this.markDirty();
    return newGroupId;
  }

  deleteGroup(groupId) {
    if (!this.projectData || !this.projectData.groups) return;
    const groupsToDelete = this._getChildGroupIds(groupId);
    groupsToDelete.push(groupId);
    this.projectData.groups = this.projectData.groups.filter(g => !groupsToDelete.includes(g.id));
    this.projectData.apis?.forEach(api => {
      if (groupsToDelete.includes(api.group)) api.group = 'default';
    });
    this.markDirty();
  }

  updateGroup(groupId, updates) {
    if (!this.projectData || !this.projectData.groups) return;
    const index = this.projectData.groups.findIndex(g => g.id === groupId);
    if (index !== -1) {
      this.projectData.groups[index] = { ...this.projectData.groups[index], ...updates };
      this.markDirty();
    }
  }

  _getChildGroupIds(parentId) {
    if (!this.projectData?.groups) return [];
    const children = this.projectData.groups.filter(g => g.parentId === parentId);
    let allIds = children.map(g => g.id);
    children.forEach(child => {
      allIds = [...allIds, ...this._getChildGroupIds(child.id)];
    });
    return allIds;
  }

  getGroupTree() {
    if (!this.projectData?.groups) {
      return [{ id: 'default', name: '默认', parentId: null, children: [] }];
    }
    const rootGroups = this.projectData.groups.filter(g => !g.parentId);
    const buildTree = (parentId) => {
      return this.projectData.groups.filter(g => g.parentId === parentId).map(g => ({
        ...g,
        children: buildTree(g.id)
      }));
    };
    return rootGroups.map(g => ({ ...g, children: buildTree(g.id) }));
  }

  getFlatGroupsWithLevel() {
    if (!this.projectData?.groups) {
      return [{ id: 'default', name: '默认', parentId: null, level: 0 }];
    }
    const result = [{ id: 'default', name: '默认', parentId: null, level: 0 }];
    const addGroupsRecursive = (parentId, level) => {
      this.projectData.groups.filter(g => g.parentId === parentId).forEach(g => {
        result.push({ ...g, level });
        addGroupsRecursive(g.id, level + 1);
      });
    };
    addGroupsRecursive(null, 0);
    return result;
  }

  updateGroups(groups) {
    if (!this.projectData) return;
    this.projectData.groups = groups;
    this.markDirty();
  }

  getGroups() {
    if (!this.projectData) return ['默认'];
    const groups = new Set(['默认']);
    this.projectData.apis?.forEach(api => {
      if (api.group && api.group !== '默认') groups.add(api.group);
    });
    this.projectData.groups?.forEach(g => groups.add(g.id));
    return Array.from(groups);
  }

  markDirty() {
    if (!this.isDirty) {
      this.isDirty = true;
      this._notifyListeners();
    }
  }

  clear() {
    this.projectData = null;
    this.dirPath = null;
    this.projectId = null;
    this.projectName = null;
    this.isDirty = false;
    this._apiDataCache = {};
    this._apiHistoryCache = {};
    this.disableAutoSave();
    this._notifyListeners();
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index !== -1) this.listeners.splice(index, 1);
  }

  _notifyListeners() {
    this.listeners.forEach(callback => {
      callback({ projectData: this.projectData, isDirty: this.isDirty });
    });
  }
}

export const projectManager = new ProjectManager();
export default ProjectManager;
