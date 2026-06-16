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
    // 工作空间（多项目）
    this.workspaceDir = null;
    this.projects = {};
    this.activeProjectId = null;

    // 以下字段通过 getter/setter 代理到当前活跃项目
    // 保持向后兼容

    this.listeners = [];
    this.autoSaveTimer = null;
    this.dirProjects = [];
    this.recentProjects = [];
    this.maxRecentProjects = 10;
  }

  // ── Trash API 缓存（v3 新增） ──

  get _trashApiDataCache() { return this._activeProject?.trashApiDataCache ?? {}; }
  set _trashApiDataCache(val) { if (this._activeProject) this._activeProject.trashApiDataCache = val; }

  // ── 代理到当前活跃项目 ──

  get _activeProject() {
    return this.activeProjectId ? this.projects[this.activeProjectId] : null;
  }

  get projectData() { return this._activeProject?.config ?? null; }
  set projectData(val) { if (this._activeProject) this._activeProject.config = val; }

  get dirPath() { return this._activeProject?.dirPath ?? null; }
  set dirPath(val) { if (this._activeProject) this._activeProject.dirPath = val; }

  get projectId() { return this.activeProjectId; }
  set projectId(val) { this.activeProjectId = val; }

  get projectName() { return this._activeProject?.projectName ?? ''; }
  set projectName(val) { if (this._activeProject) this._activeProject.projectName = val; }

  get isDirty() { return this._activeProject?.isDirty ?? false; }
  set isDirty(val) { if (this._activeProject) this._activeProject.isDirty = val; }

  get _apiDataCache() { return this._activeProject?.apiDataCache ?? {}; }
  set _apiDataCache(val) { if (this._activeProject) this._activeProject.apiDataCache = val; }

  get _apiHistoryCache() { return this._activeProject?.apiHistoryCache ?? {}; }
  set _apiHistoryCache(val) { if (this._activeProject) this._activeProject.apiHistoryCache = val; }

  // ── 目录扫描 ──

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

  // ── 最近项目 ──

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

  // ── 创建项目 ──

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

  // ── 增量添加项目到工作空间缓存（不重新加载整个工作空间） ──

  async addProjectToWorkspace(dirPath, projectName) {
    try {
      const result = await window.electron.createNewProject(dirPath, projectName);
      if (!result.success) {
        return { success: false, error: result.error };
      }

      const projectId = result.projectId;

      const configResult = await window.electron.readProjectConfig(dirPath, projectId);
      if (!configResult.success) {
        return { success: false, error: '读取项目配置失败' };
      }

      this.projects[projectId] = {
        config: configResult.data,
        dirPath,
        projectName: configResult.data.projectName || projectName,
        apiDataCache: {},
        apiHistoryCache: {},
        isDirty: false,
        dirtyApiConfigs: new Set()
      };

      await this.scanDirectory(dirPath);

      return { success: true, project: { projectId, name: projectName } };
    } catch (error) {
      console.error('添加项目失败:', error);
      return { success: false, error: error.message };
    }
  }

  // ── 加载工作空间（配置目录，包含多个项目） ──

  async loadWorkspace(dirPath, onProgress) {
    try {
      this._apiDataCache = {};
      this._apiHistoryCache = {};
      this._trashApiDataCache = {};

      const projects = await this.scanDirectory(dirPath);
      this.workspaceDir = dirPath;
      this.projects = {};
      this.activeProjectId = null;

      const issues = [];
      let totalApis = 0;
      let loadedApis = 0;

      // 第一遍：统计总 API 数
      for (const proj of projects) {
        const configResult = await window.electron.readProjectConfig(dirPath, proj.id);
        if (configResult.success) {
          // 正常 API
          const normalApis = (configResult.data.apis || []).filter(a => !a.deleted);
          totalApis += normalApis.length;
        }
      }

      // 第二遍：加载每个项目
      for (const proj of projects) {
        const configResult = await window.electron.readProjectConfig(dirPath, proj.id);
        if (!configResult.success) continue;

        const configData = configResult.data;

        // [回收站] 已注释掉 - v3 migration
        // if (!configData.version || configData.version < 3) {
        //   await this._migrateToV3(configData, dirPath, proj.id);
        // }

        const apiDataCache = {};
        const apiHistoryCache = {};
        const trashApiDataCache = {};
        
        // 只处理未删除的 API
        const apis = configData.apis || [];
        let projectFixed = false;

        for (const api of apis) {
          // 检查 ①：索引中有条目但文件缺失
          const fileResult = await window.electron.readAPIConfig(dirPath, proj.id, api.id);
          if (!fileResult.success) {
            issues.push({
              type: 'missing_file',
              apiId: api.id,
              name: api.name,
              message: `索引中存在但文件缺失: ${api.name} (${api.id})`
            });
            projectFixed = true;
          } else {
            // 检查 ③：文件内 id 一致性
            if (fileResult.data.id && fileResult.data.id !== api.id) {
              issues.push({
                type: 'id_mismatch',
                apiId: api.id,
                fileName: `${api.id}_config.json`,
                message: `文件内 id 不一致: 期望 ${api.id}，实际 ${fileResult.data.id}`
              });
            }
            apiDataCache[api.id] = fileResult.data;
            loadedApis++;
          }

          if (onProgress) onProgress(loadedApis, totalApis);
        }

        // [回收站] 已注释掉 - 加载 trash API
        // const trashApis = configData.trash?.apis || [];
        // for (const api of trashApis) {
        //   const fileResult = await window.electron.readTrashAPIConfig(dirPath, proj.id, api.id);
        //   if (fileResult.success) {
        //     trashApiDataCache[api.id] = fileResult.data;
        //     loadedApis++;
        //   }
        //   if (onProgress) onProgress(loadedApis, totalApis);
        // }

        // 检查 ②：孤儿文件 — 需要 window.electron.listAPIFiles
        if (typeof window.electron.listAPIFiles === 'function') {
          try {
            const dirResult = await window.electron.listAPIFiles(dirPath, proj.id);
            const knownIds = new Set(apis.map(a => a.id));
            for (const fileName of (dirResult.data || [])) {
              const match = fileName.match(/^(.+)_config\.json$/);
              if (match && !knownIds.has(match[1])) {
                // 尝试读取孤儿文件的配置以获取 API 名称
                let apiName = match[1];
                try {
                  const fileResult = await window.electron.readAPIConfig(dirPath, proj.id, match[1]);
                  if (fileResult.success && fileResult.data.name) {
                    apiName = fileResult.data.name;
                  }
                } catch (_e) {
                  // 读取失败时使用 ID 作为名称
                }
                issues.push({
                  type: 'orphan_file',
                  name: apiName,
                  fileName: fileName,
                  projectId: proj.id,
                  message: `文件在 apis/ 目录中存在但不在索引中`
                });
              }
            }
          } catch (e) {
            console.warn('孤儿文件检查失败:', e);
          }
        }

        // 自动修复：从索引移除文件缺失的条目
        if (projectFixed) {
          const missingIds = new Set(
            issues.filter(i => i.type === 'missing_file').map(i => i.apiId)
          );
          configData.apis = apis.filter(a => !missingIds.has(a.id));
        }

        this.projects[proj.id] = {
          config: configData,
          dirPath,
          projectName: configData.projectName || proj.id,
          apiDataCache,
          apiHistoryCache,
          trashApiDataCache,
          isDirty: projectFixed,
          dirtyApiConfigs: new Set()
        };
      }

      // 设置第一个项目为活跃（但不通知监听器，由 App.js 在适当时机触发）
      if (projects.length > 0) {
        this.activeProjectId = projects[0].id;
      }

      return {
        success: true,
        issues,
        fixedCount: issues.filter(i => i.type === 'missing_file').length
      };
    } catch (error) {
      console.error('加载工作空间失败:', error);
      return { success: false, error: error.message, issues: [], fixedCount: 0 };
    }
  }

  // ── 加载单个项目（向后兼容） ──

  async loadProject(dirPath, projectId) {
    try {
      // 先创建项目槽位，使 getter/setter 可正确代理
      if (!this.projects[projectId]) {
        this.projects[projectId] = {
          config: null,
          dirPath,
          projectName: '',
          apiDataCache: {},
          apiHistoryCache: {},
          trashApiDataCache: {},
          isDirty: false,
          dirtyApiConfigs: new Set()
        };
      }
      const p = this.projects[projectId];
      p.apiDataCache = {};
      p.apiHistoryCache = {};
      p.trashApiDataCache = {};

      const configResult = await window.electron.readProjectConfig(dirPath, projectId);
      if (!configResult.success) {
        return { success: false, error: configResult.error };
      }
      const configData = configResult.data;

      // [回收站] 已注释掉 - v3 migration
      // if (!configData.version || configData.version < 3) {
      //   await this._migrateToV3(configData, dirPath, projectId);
      // }

      p.config = deepClone(configData);
      p.dirPath = dirPath;
      p.projectName = configData.projectName || projectId;
      p.isDirty = false;

// [回收站] 已注释掉 - 加载 trash API 数据
      // const trashApis = configData.trash?.apis || [];
      // for (const api of trashApis) {
      //   const result = await window.electron.readTrashAPIConfig(dirPath, projectId, api.id);
      //   if (result.success) {
      //     p.trashApiDataCache[api.id] = result.data;
      //   }
      // }

      this.activeProjectId = projectId;
      this.workspaceDir = dirPath;

      await this.addToRecentProjects(dirPath, projectId, p.projectName);
      this._notifyListeners();

      return { success: true };
    } catch (error) {
      console.error('加载项目失败:', error);
      return { success: false, error: error.message };
    }
  }

  // ── 切换项目（纯内存，无 I/O） ──

  switchProject(projectId) {
    if (!this.projects[projectId]) return false;
    this.activeProjectId = projectId;
    this._notifyListeners();
    return true;
  }

  // ── v2 迁移 ──

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
        try {
          await window.electron.writeAPIConfig(apisDir, projectId, api.id, apiConfig);
        } catch (e) {
          console.error(`写入 API 配置文件失败 ${api.id}:`, e);
        }

        Object.keys(api).forEach(k => {
          if (!['id', 'name', 'method', 'api_path', 'group'].includes(k)) {
            delete api[k];
          }
        });
        api.deleted = false;
        if (!api.method) api.method = apiConfig.method || 'GET';
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

  // [回收站] 已注释掉 - _migrateToV3
  // async _migrateToV3(configData, dirPath, projectId) {
  //   console.log('[ProjectManager] 迁移到 v3 格式（trash 结构分离）...');
  //   if (!configData.trash) { configData.trash = { apis: [], groups: [] }; }
  //   const deletedApis = (configData.apis || []).filter(a => a.deleted);
  //   for (const api of deletedApis) {
  //     configData.apis = configData.apis.filter(a => a.id !== api.id);
  //     const group = configData.groups?.find(g => g.id === api.group);
  //     configData.trash.apis.push({ id: api.id, name: api.name, method: api.method, api_path: api.api_path, group: api.group, deletedAt: Date.now(), originalGroupId: api.group, originalGroupName: api.originalGroupName || group?.name || null });
  //     try { await window.electron.moveAPIToTrash(dirPath, projectId, api.id); } catch (e) { console.warn(`[迁移] 移动 API 文件到 trash 失败 ${api.id}:`, e); }
  //   }
  //   const deletedGroups = (configData.groups || []).filter(g => g.deleted);
  //   for (const group of deletedGroups) {
  //     configData.groups = configData.groups.filter(g => g.id !== group.id);
  //     configData.trash.groups.push({ id: group.id, name: group.name, parentId: group.parentId, deletedAt: Date.now(), originalParentId: group.parentId });
  //   }
  //   configData.apis = configData.apis.map(api => { delete api.deleted; delete api.originalGroupName; return api; });
  //   if (configData.groups) { configData.groups = configData.groups.map(g => { delete g.deleted; return g; }); }
  //   configData.version = 3;
  //   try { await window.electron.saveProjectConfig(dirPath, projectId, configData); console.log('[ProjectManager] v3 迁移完成'); } catch (e) { console.error('保存迁移后的配置失败:', e); }
  // }

  // ── API 配置读写（缓存优先 + 脏标记） ──

  async loadAPIConfig(apiId) {
    if (!this.dirPath || !this.projectId || !apiId) return null;

    // 优先从工作空间缓存返回
    const cache = this._activeProject?.apiDataCache;
    if (cache && cache[apiId]) {
      return deepClone(cache[apiId]);
    }

    // 缓存未命中，从磁盘读取
    try {
      const result = await window.electron.readAPIConfig(this.dirPath, this.projectId, apiId);
      if (result.success) {
        if (this._activeProject) {
          this._activeProject.apiDataCache[apiId] = result.data;
        }
        return deepClone(result.data);
      }
      return null;
    } catch (error) {
      console.error(`加载 API 配置失败 ${apiId}:`, error);
      return null;
    }
  }

  async saveAPIConfig(apiId, data) {
    const proj = this._activeProject;
    if (!proj || !apiId) return { success: false, error: '无项目数据' };

    // 只更新缓存 + 标记脏
    proj.apiDataCache[apiId] = deepClone(data);
    proj.dirtyApiConfigs.add(apiId);
    this.markDirty();
    return { success: true };
  }

  async loadAPIHistory(apiId) {
    if (!this.dirPath || !this.projectId || !apiId) return [];

    const cache = this._activeProject?.apiHistoryCache;
    if (cache && cache[apiId]) {
      return deepClone(cache[apiId]);
    }

    try {
      const result = await window.electron.readAPIHistory(this.dirPath, this.projectId, apiId);
      const history = result.success ? (result.data || []) : [];
      if (this._activeProject) {
        this._activeProject.apiHistoryCache[apiId] = history;
      }
      return deepClone(history);
    } catch (error) {
      console.error(`加载 API 历史失败 ${apiId}:`, error);
      return [];
    }
  }

  async loadAllAPIHistory() {
    if (!this.dirPath || !this.projectId) return [];
    try {
      const result = await window.electron.readAllAPIHistory(this.dirPath, this.projectId);
      return result.success ? (result.data || []) : [];
    } catch (error) {
      console.error('加载全部 API 历史失败:', error);
      return [];
    }
  }

  async saveAPIHistory(apiId, history) {
    if (!this.dirPath || !this.projectId || !apiId) return { success: false, error: '无项目数据' };

    if (this._activeProject) {
      this._activeProject.apiHistoryCache[apiId] = deepClone(history);
    }

    try {
      const result = await window.electron.writeAPIHistory(this.dirPath, this.projectId, apiId, history);
      return result;
    } catch (error) {
      console.error(`保存 API 历史失败 ${apiId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async loadAPIData(apiId) {
    return await this.loadAPIConfig(apiId);
  }

  // ── 保存项目（落盘） ──

  async saveProject() {
    const proj = this._activeProject;
    if (!proj || !this.dirPath || !this.projectId) {
      return { success: false, error: '没有项目数据可保存' };
    }

    try {
      // 写所有脏 API 文件
      for (const apiId of proj.dirtyApiConfigs) {
        const data = proj.apiDataCache[apiId];
        if (data) {
          try {
            await window.electron.writeAPIConfig(this.dirPath, this.projectId, apiId, data);
          } catch (e) {
            console.error(`保存 API 文件失败 ${apiId}:`, e);
          }
        }
      }
      proj.dirtyApiConfigs.clear();

      // 写 config.json（清理 trash 数据）
      proj.config.projectName = proj.projectName;
      const configToSave = { ...proj.config };
      delete configToSave.trash;
      await window.electron.saveProjectConfig(this.dirPath, this.projectId, configToSave);

      proj.isDirty = false;
      this._notifyListeners();
      return { success: true };
    } catch (error) {
      console.error('保存项目失败:', error);
      return { success: false, error: error.message };
    }
  }

  // ── 自动保存 ──

  enableAutoSave(interval = 5000) {
    this.disableAutoSave();
    this.autoSaveTimer = setInterval(async () => {
      if (this.isDirty) {
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

  // ── 环境选择 ──

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

  // ── 获取器 ──

  getProjectPath() { return this.dirPath || ''; }
  getProjectId() { return this.projectId || ''; }
  getProjectName() { return this._activeProject?.projectName || ''; }

  getData() {
    const proj = this._activeProject;
    return proj?.config || null;
  }

  getIsDirty() { return this.isDirty; }

  // ── Profile ──

  updateProfile(profileName, newProfile) {
    const proj = this._activeProject;
    if (!proj?.config) return;
    const index = proj.config.profile.findIndex(p => p.name === profileName);
    if (index !== -1) {
      proj.config.profile[index] = { ...proj.config.profile[index], ...newProfile };
      this.markDirty();
    }
  }

  removeProfileField(profileName, fieldName) {
    const proj = this._activeProject;
    if (!proj?.config) return;
    const index = proj.config.profile.findIndex(p => p.name === profileName);
    if (index !== -1) {
      delete proj.config.profile[index][fieldName];
      this.markDirty();
    }
  }

  resetProfile(newProfile) {
    const proj = this._activeProject;
    if (!proj?.config) return;
    proj.config.profile = newProfile;
    this.markDirty();
  }

  addProfile(profile) {
    const proj = this._activeProject;
    if (!proj?.config) return;
    if (!proj.config.profile) proj.config.profile = [];
    proj.config.profile.push(profile);
    this.markDirty();
  }

  deleteProfile(profileName) {
    const proj = this._activeProject;
    if (!proj?.config) return;
    proj.config.profile = proj.config.profile.filter(p => p.name !== profileName);
    this.markDirty();
  }

  // ── 模板 CRUD ──

  getTemplates() {
    const proj = this._activeProject;
    return proj?.config?.templates || [];
  }

  addTemplate(template) {
    const proj = this._activeProject;
    if (!proj?.config) return null;
    if (!proj.config.templates) proj.config.templates = [];
    if (!template.id) template.id = generateId('tpl');
    proj.config.templates.push(template);
    this.markDirty();
    return template;
  }

  updateTemplate(templateId, updates) {
    const proj = this._activeProject;
    if (!proj?.config?.templates) return;
    const index = proj.config.templates.findIndex(t => t.id === templateId);
    if (index !== -1) {
      proj.config.templates[index] = { ...proj.config.templates[index], ...updates };
      this.markDirty();
    }
  }

  deleteTemplate(templateId) {
    const proj = this._activeProject;
    if (!proj?.config?.templates) return;
    proj.config.templates = proj.config.templates.filter(t => t.id !== templateId);
    this.markDirty();
  }

  // ── API CRUD ──

  async updateAPI(apiId, newData) {
    const proj = this._activeProject;
    if (!proj?.config) { console.log('[PM.updateAPI] no project/config'); return; }

    const index = proj.config.apis.findIndex(api => api.id === apiId);
    console.log('[PM.updateAPI] apiId:', apiId, 'index:', index, 'total apis:', proj.config.apis.length);
    if (index === -1) { console.log('[PM.updateAPI] INDEX NOT FOUND - returning early'); return; }

    const oldEntry = proj.config.apis[index];
    // v3: 不需要 deleted 字段
    const updatedEntry = {
      id: oldEntry.id,
      name: newData.name !== undefined ? newData.name : oldEntry.name,
      method: newData.method !== undefined ? newData.method : oldEntry.method,
      api_path: newData.api_path !== undefined ? newData.api_path : (oldEntry.api_path || ''),
      group: newData.group !== undefined ? newData.group : oldEntry.group
    };
    proj.config.apis[index] = updatedEntry;

    // 合并缓存：API 级字段覆盖，保留 scenarios
    const existingCache = proj.apiDataCache[apiId] || {};
    const apiConfig = {
      id: newData.id || oldEntry.id,
      name: newData.name !== undefined ? newData.name : (existingCache.name || oldEntry.name),
      method: newData.method !== undefined ? newData.method : (existingCache.method || oldEntry.method),
      api_path: newData.api_path !== undefined ? newData.api_path : (existingCache.api_path || ''),
      group: newData.group !== undefined ? newData.group : (existingCache.group || oldEntry.group || null),
      scenarios: newData.scenarios || existingCache.scenarios || {}
    };
    console.log('[PM.updateAPI] scenarios keys:', Object.keys(apiConfig.scenarios));
    proj.apiDataCache[apiId] = deepClone(apiConfig);
    proj.dirtyApiConfigs.add(apiId);
    this.markDirty();
    console.log('[PM.updateAPI] done');
  }

  async addAPI(api) {
    const proj = this._activeProject;
    if (!proj?.config) { console.log('[PM.addAPI] no project/config'); return; }

    if (!api.id) api.id = generateId('api');
    console.log('[PM.addAPI] api.id:', api.id, 'name:', api.name, 'total apis before:', proj.config.apis.length);

    // v3: indexEntry 只包含基本信息，无 deleted 字段
    const indexEntry = {
      id: api.id,
      name: api.name || '',
      method: api.method || 'GET',
      api_path: api.api_path || '',
      group: api.group || null
    };

    proj.config.apis.push(indexEntry);
    console.log('[PM.addAPI] pushed to config, total:', proj.config.apis.length);

    // Per-API config: 只存 API 级字段 + scenarios
    const apiConfig = {
      id: api.id,
      name: api.name || '',
      method: api.method || 'GET',
      api_path: api.api_path || '',
      group: api.group || null,
      scenarios: api.scenarios || {}
    };
    proj.apiDataCache[api.id] = deepClone(apiConfig);
    proj.dirtyApiConfigs.add(api.id);
    this.markDirty();
    console.log('[PM.addAPI] done');
  }

  // ═══════════════════════════════════════════════════════════════════
  // Trash 操作（v3 新结构：分离存储）
  // ═══════════════════════════════════════════════════════════════════

  // [回收站] 已注释掉 - _ensureTrashStructure
  // _ensureTrashStructure() {
  //   const proj = this._activeProject;
  //   if (!proj?.config) return;
  //   if (!proj.config.trash) {
  //     proj.config.trash = { apis: [], groups: [] };
  //   }
  //   if (!proj.config.trash.apis) proj.config.trash.apis = [];
  //   if (!proj.config.trash.groups) proj.config.trash.groups = [];
  // }

  // 物理删除 API（直接删除文件）
  async deleteAPI(apiId) {
    const proj = this._activeProject;
    if (!proj?.config) return;

    const api = proj.config.apis.find(a => a.id === apiId);
    if (!api) return;

    // 从正常列表移除
    proj.config.apis = proj.config.apis.filter(a => a.id !== apiId);

    // 清理缓存
    delete proj.apiDataCache[apiId];
    proj.dirtyApiConfigs.delete(apiId);

    // 物理删除文件
    try {
      await window.electron.deleteAPIFile(this.dirPath, this.projectId, apiId);
    } catch (e) {
      console.error(`[PM] 删除 API 文件失败 ${apiId}:`, e);
    }

    // 清理其他 API 中对该 API 的引用
    for (const api of proj.config.apis) {
      const cached = proj.apiDataCache[api.id];
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
    console.log(`[PM] deleteAPI: ${apiId} 已删除`);
  }

  // [回收站] 已注释掉 - restoreAPI
  // async restoreAPI(apiId, targetGroupId = null) {
  //   const proj = this._activeProject;
  //   if (!proj?.config) return;
  //   this._ensureTrashStructure();
  //   const api = proj.config.trash.apis.find(a => a.id === apiId);
  //   if (!api) return;
  //   let finalGroupId = targetGroupId || api.originalGroupId || 'default';
  //   const restoreAncestorChain = (groupId) => {
  //     if (proj.config.groups?.some(g => g.id === groupId)) return;
  //     const trashGroup = proj.config.trash.groups.find(g => g.id === groupId);
  //     if (!trashGroup) return;
  //     console.log(`[PM restoreAPI] 分组 ${groupId} 在回收站中，恢复祖先链`);
  //     if (trashGroup.parentId) restoreAncestorChain(trashGroup.parentId);
  //     this.restoreGroup(groupId, trashGroup.parentId);
  //   };
  //   if (finalGroupId !== 'default') {
  //     if (!proj.config.groups?.some(g => g.id === finalGroupId)) {
  //       const inTrash = proj.config.trash.groups.some(g => g.id === finalGroupId);
  //       if (inTrash) restoreAncestorChain(finalGroupId);
  //       else { console.log(`[PM restoreAPI] 分组 ${finalGroupId} 不存在，放入默认分组`); finalGroupId = 'default'; }
  //     }
  //   }
  //   if (proj.config.apis.some(a => a.id === apiId)) {
  //     console.log(`[PM restoreAPI] API ${apiId} 已存在，只从 trash 移除`);
  //     proj.config.trash.apis = proj.config.trash.apis.filter(a => a.id !== apiId);
  //   } else {
  //     const restoredApi = { id: api.id, name: this._ensureUniqueName(api.name, finalGroupId, 'api', api.id, false), method: api.method, api_path: api.api_path, group: finalGroupId };
  //     proj.config.apis.push(restoredApi);
  //     proj.config.trash.apis = proj.config.trash.apis.filter(a => a.id !== apiId);
  //   }
  //   proj.apiDataCache[apiId] = proj.trashApiDataCache[apiId];
  //   delete proj.trashApiDataCache[apiId];
  //   proj.dirtyApiConfigs.add(apiId);
  //   try { await window.electron.restoreAPIFromTrash(this.dirPath, this.projectId, apiId); } catch (e) { console.error(`[PM] 恢复 API 文件失败 ${apiId}:`, e); }
  //   this.markDirty();
  //   console.log(`[PM] restoreAPI: ${apiId} 已恢复到分组 ${finalGroupId}`);
  // }



  // [回收站] 已注释掉 - emptyTrash
  // async emptyTrash() {
  //   const proj = this._activeProject;
  //   if (!proj?.config) return;
  //   this._ensureTrashStructure();
  //   const trashApis = [...proj.config.trash.apis];
  //   for (const api of trashApis) {
  //     delete proj.trashApiDataCache[api.id];
  //     delete proj.apiHistoryCache[api.id];
  //     try { await window.electron.permanentDeleteTrashAPI(this.dirPath, this.projectId, api.id); } catch (e) { console.warn(`[PM] 清空回收站时删除文件失败 ${api.id}:`, e); }
  //   }
  //   proj.config.trash.apis = [];
  //   proj.config.trash.groups = [];
  //   try { await window.electron.emptyTrashDirectory(this.dirPath, this.projectId); } catch (e) { console.warn('[PM] 清空 trash 目录失败:', e); }
  //   this.markDirty();
  //   console.log('[PM] emptyTrash: 回收站已清空');
  // }

  // ═══════════════════════════════════════════════════════════════════
  // 名称唯一性检查（v3 简化：基于列表隔离）
  // ═══════════════════════════════════════════════════════════════════

  _ensureUniqueName(name, groupId, type, excludeId = null, inTrash = false) {
    const proj = this._activeProject;
    if (!proj?.config) return name;

    const list = inTrash ? (proj.config.trash?.apis || []) : (proj.config.apis || []);
    let result = name;
    let counter = 2;
    
    while (list.some(a =>
      a.name === result &&
      a.group === groupId &&
      a.id !== excludeId
    )) {
      result = `${name} (${counter})`;
      counter++;
    }
    return result;
  }

  // 正常 API 名称唯一性检查
  ensureUniqueAPIName(name, groupId, excludeId = null) {
    return this._ensureUniqueName(name, groupId, 'api', excludeId, false);
  }

  // 分组名称唯一性检查
  ensureUniqueGroupName(name, parentId, excludeId = null) {
    const proj = this._activeProject;
    if (!proj?.config?.groups) return name;
    
    let result = name;
    let counter = 2;
    while (proj.config.groups.some(g =>
      g.name === result &&
      g.parentId === parentId &&
      g.id !== excludeId
    )) {
      result = `${name} (${counter})`;
      counter++;
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 查询方法（v3 简化）
  // ═══════════════════════════════════════════════════════════════════

  getAPIs() {
    return this._activeProject?.config?.apis || [];
  }

  getTrashAPIs() {
    return this._activeProject?.config?.trash?.apis || [];
  }

  getGroups() {
    return this._activeProject?.config?.groups || [];
  }

  getTrashGroups() {
    return this._activeProject?.config?.trash?.groups || [];
  }

  // ═══════════════════════════════════════════════════════════════════

  async copyAPI(apiId) {
    const proj = this._activeProject;
    if (!proj?.config) return null;

    const sourceAPI = proj.apiDataCache[apiId];
    if (!sourceAPI) return null;

    const newAPI = deepClone(sourceAPI);
    newAPI.id = generateId('api');
    const baseName = `${sourceAPI.name}(复制)`;
    newAPI.name = this.ensureUniqueAPIName(baseName, newAPI.group || 'default');

    await this.addAPI(newAPI);
    return newAPI;
  }

  // ── 分组操作 ──

  addGroup(groupName, parentId = null) {
    const proj = this._activeProject;
    if (!proj?.config) return;

    if (groupName === '回收站') {
      console.warn('[PM.addGroup] "回收站" is a reserved name');
      return;
    }

    if (!proj.config.groups) proj.config.groups = [];

    // v3: 不需要 deleted 字段
    const uniqueName = this.ensureUniqueGroupName(groupName, parentId);
    proj.config.groups.push({
      id: generateId('group'),
      name: uniqueName,
      parentId: parentId
    });
    this.markDirty();
  }

  copyGroup(groupId, newParentId = null) {
    const proj = this._activeProject;
    if (!proj?.config) return null;

    const sourceGroup = proj.config.groups?.find(g => g.id === groupId);
    if (!sourceGroup) return null;

    const groupIdMap = {};

    const copyGroupRecursive = (sourceGroupId, parentId) => {
      const group = proj.config.groups.find(g => g.id === sourceGroupId);
      if (!group) return null;

      const newGroupId = generateId('group');
      groupIdMap[sourceGroupId] = newGroupId;

      const groupName = group.id === groupId
        ? this.ensureUniqueGroupName(`${group.name}(复制)`, parentId)
        : group.name;
      // v3: 不需要 deleted 字段
      proj.config.groups.push({
        id: newGroupId,
        name: groupName,
        parentId: parentId
      });

      proj.config.apis?.forEach(api => {
        if (api.group === sourceGroupId) {
          const newAPI = deepClone(api);
          newAPI.id = generateId('api');
          newAPI.group = newGroupId;
          proj.config.apis.push(newAPI);
        }
      });

      const children = proj.config.groups.filter(g => g.parentId === sourceGroupId);
      children.forEach(child => copyGroupRecursive(child.id, newGroupId));

      return newGroupId;
    };

    const newGroupId = copyGroupRecursive(groupId, newParentId);
    if (newGroupId) this.markDirty();
    return newGroupId;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 分组 Trash 操作（v3）
  // ═══════════════════════════════════════════════════════════════════

  deleteGroup(groupId) {
    const proj = this._activeProject;
    if (!proj?.config || !proj.config.groups) return;
    if (groupId === 'default' || groupId === null) return;

    const groupsToDelete = this._getGroupAndDescendantIds(groupId, true);
    groupsToDelete.push(groupId);
    proj.config.groups = proj.config.groups.filter(g => !groupsToDelete.includes(g.id));
    proj.config.apis?.forEach(api => {
      if (groupsToDelete.includes(api.group)) api.group = 'default';
    });
    this.markDirty();
  }
  // [回收站] 已注释掉 - softDeleteGroup，直接删除分组和 API

  deleteGroupWithChildren(groupId) {
    const proj = this._activeProject;
    if (!proj?.config || !proj.config.groups) return;
    if (groupId === 'default' || groupId === null) return;

    console.log(`[PM deleteGroupWithChildren] 开始删除分组: ${groupId}`);

    // 收集祖先链
    const ancestorChain = [];
    const targetGroup = proj.config.groups.find(g => g.id === groupId);
    if (!targetGroup) return;
    
    let currentGroupId = targetGroup.parentId;
    while (currentGroupId) {
      if (currentGroupId === 'default') {
        ancestorChain.unshift({ id: 'default', name: '默认分组', parentId: null });
        break;
      }
      const group = proj.config.groups.find(g => g.id === currentGroupId);
      if (!group) break;
      ancestorChain.unshift({ id: group.id, name: group.name, parentId: group.parentId });
      currentGroupId = group.parentId;
    }

    // 获取目标分组及其所有子孙分组ID
    const allDescendantIds = this._getGroupAndDescendantIds(groupId, true);
    allDescendantIds.push(groupId);
    const allGroupIdsSet = new Set(allDescendantIds);

    // 收集分组名称映射
    const groupNameMap = {};
    [...allGroupIdsSet].forEach(id => {
      const group = proj.config.groups.find(g => g.id === id);
      if (group) groupNameMap[id] = group.name;
    });

    // 直接物理删除目标分组及其子孙分组
    proj.config.groups = proj.config.groups.filter(g => !allGroupIdsSet.has(g.id));
    
    // 直接物理删除该分组下的所有 API
    const apisToDelete = proj.config.apis.filter(a => allGroupIdsSet.has(a.group));
    const apiIdsToDelete = apisToDelete.map(a => a.id);
    proj.config.apis = proj.config.apis.filter(a => !apiIdsToDelete.includes(a.id));

    // 清理缓存
    apiIdsToDelete.forEach(id => {
      delete proj.apiDataCache[id];
      proj.dirtyApiConfigs.delete(id);
    });

    // 物理删除文件
    apiIdsToDelete.forEach(id => {
      window.electron.deleteAPIFile(this.dirPath, this.projectId, id)
        .catch(e => console.error(`[PM] 删除 API 文件失败 ${id}:`, e));
    });

    this.markDirty();
    console.log(`[PM deleteGroupWithChildren] 删除完成!`);
  }

  // [回收站] 已注释掉 - restoreGroup
  // restoreGroup(groupId, targetParentId = null) {
  //   const proj = this._activeProject;
  //   if (!proj?.config || !proj.config.groups) return;
  //   this._ensureTrashStructure();
  //   const restoreRecursive = (id, parentId) => {
  //     // ... (完整代码见 git history)
  //   };
  //   restoreRecursive(groupId, targetParentId ?? null);
  //   this._cleanupEmptyGroups();
  //   this.markDirty();
  //   console.log(`[PM] restoreGroup: ${groupId} 已恢复`);
  // }

  // [回收站] 已注释掉 - permanentDeleteGroup
  // permanentDeleteGroup(groupId) {
  //   const proj = this._activeProject;
  //   if (!proj?.config) return;
  //   this._ensureTrashStructure();
  //   const allGroupIds = this._getGroupAndDescendantIds(groupId, true, true);
  //   allGroupIds.push(groupId);
  //   proj.config.trash.groups = proj.config.trash.groups.filter(g => !allGroupIds.includes(g.id));
  //   const apisToDelete = proj.config.trash.apis.filter(a => allGroupIds.includes(a.group));
  //   apisToDelete.forEach(api => {
  //     delete proj.trashApiDataCache[api.id];
  //     window.electron.permanentDeleteTrashAPI(this.dirPath, this.projectId, api.id)
  //       .catch(e => console.error(`[PM] 删除 trash API 文件失败 ${api.id}:`, e));
  //   });
  //   proj.config.trash.apis = proj.config.trash.apis.filter(a => !allGroupIds.includes(a.group));
  //   this.markDirty();
  //   console.log(`[PM] permanentDeleteGroup: ${groupId} 已永久删除`);
  // }

  updateGroup(groupId, updates) {
    const proj = this._activeProject;
    if (!proj?.config || !proj.config.groups) return;

    const index = proj.config.groups.findIndex(g => g.id === groupId);
    if (index !== -1) {
      // 不允许修改 deleted 相关字段
      delete updates.deleted;
      delete updates.deletedAt;
      delete updates.originalParentId;
      proj.config.groups[index] = { ...proj.config.groups[index], ...updates };
      this.markDirty();
    }
  }

  // 清理没有内容的空分组（递归检查子孙）
  _cleanupEmptyGroups() {
    const proj = this._activeProject;
    if (!proj?.config?.groups) return;

    let changed = true;
    while (changed) {
      changed = false;
      const emptyGroups = proj.config.groups.filter(g => {
        if (g.id === 'default') return false;
        const hasApis = proj.config.apis.some(a => a.group === g.id);
        const hasChildren = proj.config.groups.some(gg => gg.parentId === g.id);
        return !hasApis && !hasChildren;
      });

      emptyGroups.forEach(emptyGroup => {
        console.log(`[PM _cleanupEmptyGroups] 移除空分组: ${emptyGroup.name}`);
        proj.config.groups = proj.config.groups.filter(g => g.id !== emptyGroup.id);
        changed = true;
      });
    }
  }

  // 获取分组及其所有子分组的 ID（支持 trash）
  _getGroupAndDescendantIds(groupId, recursive = true, fromTrash = false) {
    const proj = this._activeProject;
    if (!proj?.config?.groups && !proj?.config?.trash?.groups) return [];

    const groups = fromTrash ? (proj.config.trash?.groups || []) : (proj.config.groups || []);
    const children = groups.filter(g => g.parentId === groupId);
    let allIds = children.map(g => g.id);
    
    if (recursive) {
      children.forEach(child => {
        allIds = [...allIds, ...this._getGroupAndDescendantIds(child.id, true, fromTrash)];
      });
    }
    return allIds;
  }

  // 获取分组树（v3：只处理正常分组）
  getGroupTree() {
    const proj = this._activeProject;
    if (!proj?.config?.groups) {
      return [{ id: 'default', name: '默认', parentId: null, children: [] }];
    }

    const rootGroups = proj.config.groups.filter(g => !g.parentId);
    const buildTree = (parentId) => {
      return proj.config.groups
        .filter(g => g.parentId === parentId)
        .map(g => ({ ...g, children: buildTree(g.id) }));
    };
    return rootGroups.map(g => ({ ...g, children: buildTree(g.id) }));
  }

  // 获取扁平化分组列表（v3：只处理正常分组）
  getFlatGroupsWithLevel() {
    const proj = this._activeProject;
    if (!proj?.config?.groups) {
      return [{ id: 'default', name: '默认', parentId: null, level: 0 }];
    }

    const result = [{ id: 'default', name: '默认', parentId: null, level: 0 }];
    const addGroupsRecursive = (parentId, level) => {
      proj.config.groups.filter(g => g.parentId === parentId).forEach(g => {
        result.push({ ...g, level });
        addGroupsRecursive(g.id, level + 1);
      });
    };
    addGroupsRecursive(null, 0);
    return result;
  }

  updateGroups(groups) {
    const proj = this._activeProject;
    if (!proj?.config) return;

    proj.config.groups = groups;
    this.markDirty();
  }

  // 获取分组列表（v3：直接从 groups 获取）
  getGroups() {
    const proj = this._activeProject;
    if (!proj?.config?.groups) return [{ id: 'default', name: '默认' }];
    return [{ id: 'default', name: '默认' }, ...proj.config.groups];
  }

  // ── 脏标记 ──

  markDirty() {
    const proj = this._activeProject;
    if (proj && !proj.isDirty) {
      proj.isDirty = true;
      this._notifyListeners();
    }
  }

  // ── 清除 ──

  clear() {
    this.workspaceDir = null;
    this.projects = {};
    this.activeProjectId = null;
    this.disableAutoSave();
    this._notifyListeners();
  }

  // ── 监听器 ──

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index !== -1) this.listeners.splice(index, 1);
  }

  _notifyListeners() {
    const proj = this._activeProject;
    this.listeners.forEach(callback => {
      callback({
        projectData: proj?.config || null,
        isDirty: proj?.isDirty || false
      });
    });
  }
}

export const projectManager = new ProjectManager();
export default ProjectManager;
