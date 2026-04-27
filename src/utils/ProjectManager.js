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
      if (window.electron) {
        const { data, error } = await window.electron.scanDirectoryProjects(dirPath);
        if (error) throw new Error(error);
        this.dirProjects = data || [];
      } else {
        this.dirProjects = [];
      }
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
      if (window.electron) {
        const { data } = await window.electron.readProjectList();
        this.recentProjects = data || [];
      } else {
        const saved = localStorage.getItem('recentProjects');
        this.recentProjects = saved ? JSON.parse(saved) : [];
      }
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
      if (window.electron) {
        await window.electron.saveProjectList(this.recentProjects);
      } else {
        localStorage.setItem('recentProjects', JSON.stringify(this.recentProjects));
      }
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
      let result;
      
      if (window.electron) {
        result = await window.electron.createNewProject(dirPath, projectName);
      } else {
        result = {
          success: true,
          projectId: 'dev_' + Date.now(),
          projectName: projectName,
          configFile: 'dev_config.json',
          historyFile: 'dev_history.json'
        };
      }
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      // ���载项目列表
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
      let configData;
      let historyData = [];
      
      if (window.electron) {
        // 读取配置文件
        const configResult = await window.electron.readProjectConfig(dirPath, projectId);
        if (!configResult.success) {
          return { success: false, error: configResult.error };
        }
        configData = configResult.data;
        
        // 读取历史记录
        const historyResult = await window.electron.readProjectHistory(dirPath, projectId);
        if (historyResult.success) {
          historyData = historyResult.data || [];
        }
      } else {
        console.log('开发模式：加载模拟配置');
        configData = {
          projectName: '开发项目',
          profile: [
            {
              activate: true,
              name: 'dev',
              domain: '192.168.17.128',
              'lcgl-prj': ':25708/lcgl-prj',
              'api-prj': ':25710/api-prj'
            }
          ],
          apis: [
            {
              chain: [],
              name: '获取token',
              api_path: '{domain}{api-prj}/openapi/security/token',
              method: 'POST',
              header: {
                'Content-Type': 'application/json'
              },
              param: {},
              body: {
                appId: 'NC6bNAttXRh4',
                appSecret: '67ZwYAzTpzVUHJBME2WSXmV6qvZT4ZWS'
              },
              successAssert: '$.code == 200'
            }
          ]
        };
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
      
      if (!this.projectData.groups) {
        this.projectData.groups = [];
      }
      
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
   * 保存项目配置
   */
  async saveProject() {
    if (!this.dirPath || !this.projectId || !this.projectData) {
      return { success: false, error: '没有项目数据可保存' };
    }

    try {
      this.projectData.projectName = this.projectName;
      
      if (window.electron) {
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
      } else {
        console.log('开发模式：保存配置（��拟）');
        console.log('保存的配置:', this.projectData);
        this.isDirty = false;
        this._notifyListeners();
        return { success: true };
      }
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
      if (window.electron) {
        const { data } = await window.electron.readProjectHistory(this.dirPath, this.projectId);
        this.executionHistory = data || [];
      }
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
   * 清空历史记录
   */
  clearHistory() {
    this.executionHistory = [];
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
   * 获取项目名称
   */
  getProjectName() {
    return this.projectName || '';
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
  updateAPI(apiName, newAPI) {
    if (!this.projectData) return;
    
    const index = this.projectData.apis.findIndex(api => api.name === apiName);
    if (index !== -1) {
      this.projectData.apis[index] = { ...this.projectData.apis[index], ...newAPI };
      this.markDirty();
    }
  }

  /**
   * 添加 API 配置
   */
  addAPI(api) {
    if (!this.projectData) return;
    
    this.projectData.apis.push(api);
    this.markDirty();
  }

  /**
   * 删除 API 配置
   */
  deleteAPI(apiName) {
    if (!this.projectData) return;
    
    this.projectData.apis = this.projectData.apis.filter(api => api.name !== apiName);
    this.markDirty();
  }

  /**
   * 添加分组
   */
  addGroup(groupName) {
    if (!this.projectData) return;
    
    if (!this.projectData.groups) {
      this.projectData.groups = [];
    }
    
    if (!this.projectData.groups.includes(groupName)) {
      this.projectData.groups.push(groupName);
      this.markDirty();
    }
  }

  /**
   * 删除分组
   */
  deleteGroup(groupName) {
    if (!this.projectData || !this.projectData.groups) return;
    
    this.projectData.groups = this.projectData.groups.filter(g => g !== groupName);
    this.projectData.apis.forEach(api => {
      if (api.group === groupName) {
        api.group = '默认';
      }
    });
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
      groups.add(g);
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