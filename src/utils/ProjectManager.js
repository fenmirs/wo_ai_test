/**
 * 项目数据管理器
 * 负责在内存中管理项目数据，支持修改追踪和保存
 */

class ProjectManager {
  constructor() {
    this.projectData = null; // 完整的项目配置数据
    this.projectPath = null; // 项目路径
    this.isDirty = false; // 是否有未保存的修改
    this.listeners = []; // 状态变化监听器
    this.autoSaveTimer = null; // 自动保存定时器
  }

  /**
   * 加载项目配置
   */
  async loadProject(projectPath) {
    try {
      let configData;
      
      if (window.electron) {
        // Electron 环境：从文件读取
        const { data } = await window.electron.readConfig(projectPath);
        configData = data;
      } else {
        // 开发模式：使用模拟配置
        console.log('开发模式：加载模拟配置');
        configData = {
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

      this.projectData = JSON.parse(JSON.stringify(configData)); // 深拷贝
      this.projectPath = projectPath;
      this.isDirty = false;
      
      // 确保 groups 数组存在
      if (!this.projectData.groups) {
        this.projectData.groups = [];
      }
      
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
    if (!this.projectPath || !this.projectData) {
      return { success: false, error: '没有项目数据可保存' };
    }

    try {
      if (window.electron) {
        // 保存到文件
        const { success, error } = await window.electron.saveConfig(
          this.projectPath,
          this.projectData
        );
        
        if (success) {
          this.isDirty = false;
          this._notifyListeners();
          return { success: true };
        } else {
          return { success: false, error };
        }
      } else {
        // 开发模式：只标记为已保存
        console.log('开发模式：保存配置（模拟）');
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
   * 启用自动保存
   * @param {number} interval - 保存间隔（毫秒），默认 5000ms
   */
  enableAutoSave(interval = 5000) {
    this.disableAutoSave(); // 先清除之前的定时器
    
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
    // 同时将该分组下的 API 移回默认分组
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
    this.projectPath = null;
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