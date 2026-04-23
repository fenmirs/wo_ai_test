import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Play, History, Save, Edit, X, Plus, FolderPlus, ArrowLeft, Sun, Moon, XCircle, Globe } from 'lucide-react';
import APIMain from './components/APIMain';
import APIDetail from './components/APIDetail';
import BottomBar from './components/BottomBar';
import EnvironmentList from './components/EnvironmentList';
import VariableList from './components/VariableList';
import EnvVarManager from './components/EnvVarManager';
import ExecutionHistory from './components/ExecutionHistory';
import EmptyState from './components/EmptyState';
import InputDialog from './components/InputDialog';
import ConfirmDialog from './components/ConfirmDialog';
import { projectManager } from './utils/ProjectManager';
import './App.css';

function App() {
  // 状态
  const [theme, setTheme] = useState('dark');
  const [hasProject, setHasProject] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [currentProfile, setCurrentProfile] = useState(null);
  const [selectedAPI, setSelectedAPI] = useState(null);
  const [activeGroup, setActiveGroup] = useState('默认');
  const [showHistory, setShowHistory] = useState(false);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [restoringHistoryEntry, setRestoringHistoryEntry] = useState(null);
  
  // 视图模式：'api' | 'api_detail' | 'environment_list' | 'variable_list'
  const [viewMode, setViewMode] = useState('api');
  
  // 编辑状态
  const [editingAPI, setEditingAPI] = useState(null);
  const [isAddingAPI, setIsAddingAPI] = useState(false);
  
  // 输入对话框状态
  const [showInputDialog, setShowInputDialog] = useState(false);
  const [inputDialogConfig, setInputDialogConfig] = useState({
    title: '',
    placeholder: '',
    defaultValue: '',
    onConfirm: null
  });
  
  // 确认对话框状态
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogConfig, setConfirmDialogConfig] = useState({
    title: '',
    message: '',
    options: [],
    onConfirm: null,
    onCancel: null
  });
  
  // 项目数据
  const projectData = projectManager.getData();

  // 主题切换
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // 监听 ProjectManager 状态变化
  useEffect(() => {
    const handleProjectChange = ({ projectData, isDirty }) => {
      setHasProject(!!projectData);
      setIsDirty(isDirty);
      
      // 自动选择默认环境
      if (projectData && projectData.profile && projectData.profile.length > 0) {
        const defaultProfile = projectData.profile.find(p => p.activate);
        if (defaultProfile) {
          setCurrentProfile(defaultProfile);
        } else if (projectData.profile.length > 0) {
          // 如果没有标记为默认的环境，选择第一个
          setCurrentProfile(projectData.profile[0]);
        }
      }
    };

    projectManager.addListener(handleProjectChange);

    return () => {
      projectManager.removeListener(handleProjectChange);
    };
  }, []);

  // 自动保存
  useEffect(() => {
    if (hasProject) {
      projectManager.enableAutoSave(5000);
    } else {
      projectManager.disableAutoSave();
    }

    return () => {
      projectManager.disableAutoSave();
    };
  }, [hasProject]);

  // 导入项目
  const handleImportProject = useCallback(async () => {
    if (!window.electron) {
      alert('此功能仅在 Electron 应用中可用');
      return;
    }

    const result = await window.electron.selectDirectory();
    if (result.success) {
      const loadResult = await projectManager.loadProject(result.path);
      if (loadResult.success) {
        setSaveMessage('项目加载成功');
        setTimeout(() => setSaveMessage(''), 2000);
      } else {
        alert(`加载项目失败: ${loadResult.error}`);
      }
    }
  }, []);

  // 创建新项目
  const handleNewProject = useCallback(async () => {
    console.log('handleNewProject called');
    console.log('window.electron:', window.electron);
    if (!window.electron) {
      alert('此功能仅在 Electron 应用中可用');
      return;
    }

    // 先弹出输入框让用户输入项目名称
    setInputDialogConfig({
      title: '新建项目',
      placeholder: '请输入项目名称',
      defaultValue: '',
      onConfirm: async (projectName) => {
        console.log('onConfirm called with:', projectName);
        // 选择保存位置
        const dirResult = await window.electron.selectDirectory();
        console.log('dirResult:', dirResult);
        if (!dirResult.success) {
          return;
        }

        const projectPath = `${dirResult.path}/${projectName}`;
        
        // 创建项目目录
        const createResult = await window.electron.createDirectory(projectPath);
        console.log('createResult:', createResult);
        if (!createResult.success) {
          alert(`创建项目目录失败: ${createResult.error}`);
          return;
        }
        
        // 创建空项目数据
        const emptyProject = {
          profile: [
            {
              activate: true,
              name: 'dev',
              domain: 'localhost',
              'api-prj': ':8080/api'
            }
          ],
          groups: [],
          apis: []
        };

        // 创建 config.json 文件
        try {
          await window.electron.saveConfig(projectPath, emptyProject);
          
          // 加载项目
          await projectManager.loadProject(projectPath);
          setSaveMessage('新项目创建成功');
          setTimeout(() => setSaveMessage(''), 2000);
        } catch (error) {
          alert(`创建项目失败: ${error.message}`);
        }
      },
      onCancel: () => {}
    });
    setShowInputDialog(true);
  }, []);

  // 保存项目
  const handleSaveProject = useCallback(async () => {
    if (!hasProject) return;

    setIsSaving(true);
    const result = await projectManager.saveProject();
    
    if (result.success) {
      setSaveMessage('保存成功');
    } else {
      setSaveMessage(`保存失败: ${result.error}`);
    }
    
    setTimeout(() => setSaveMessage(''), 3000);
    setIsSaving(false);
  }, [hasProject]);

  // 关闭项目
  const handleCloseProject = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm('有未保存的修改，确定要关闭项目吗？');
      if (!confirmed) return;
    }
    projectManager.clear();
    setCurrentProfile(null);
    setSelectedAPI(null);
    setEditingAPI(null);
    setIsAddingAPI(false);
    setViewMode('api');
  }, [isDirty]);

  // 选择环境
  const handleProfileSelect = (profile) => {
    setCurrentProfile(profile);
  };

  // 选择 API
  const handleAPISelect = (api) => {
    setSelectedAPI(api);
    setActiveGroup(api.group || '默认');
    setEditingAPI(null);
    setIsAddingAPI(false);
    setRestoringHistoryEntry(null);
    setViewMode('api_detail');
  };

  // 选择分组
  const handleGroupSelect = (groupName) => {
    setActiveGroup(groupName);
    const apisInGroup = projectData.apis?.filter(api => api.group === groupName) || [];
    if (apisInGroup.length > 0) {
      if (!selectedAPI || selectedAPI.group !== groupName) {
        setSelectedAPI(apisInGroup[0]);
        setViewMode('api_detail');
      }
    } else {
      setSelectedAPI(null);
      setViewMode('api');
    }
  };

  // 从历史记录恢复请求
  const handleRestoreFromHistory = (historyEntry) => {
    const apis = projectData?.apis || [];
    const existingApi = apis.find(api => api.name === historyEntry.apiName);
    
    if (existingApi) {
      setSelectedAPI(existingApi);
    } else {
      const restoredApi = {
        name: historyEntry.apiName,
        group: historyEntry.apiConfig?.group || '默认',
        api_path: historyEntry.apiPath || '',
        method: historyEntry.apiMethod || 'GET',
        header: historyEntry.apiConfig?.header || {},
        param: historyEntry.apiConfig?.param || {},
        body: historyEntry.apiConfig?.body || {},
        chain: historyEntry.apiConfig?.chain || [],
        successAssert: historyEntry.apiConfig?.successAssert || ''
      };
      setSelectedAPI(restoredApi);
    }
    
    setEditingAPI(null);
    setIsAddingAPI(false);
    setRestoringHistoryEntry(historyEntry);
    setShowHistory(false);
    setViewMode('api_detail');
  };

  // 添加分组
  const handleAddGroup = () => {
    setInputDialogConfig({
      title: '添加分组',
      placeholder: '请输入分组名称',
      defaultValue: '',
      onConfirm: async (groupName) => {
        // 检查分组是否已存在
        const existingGroups = projectData.groups || [];
        if (existingGroups.includes(groupName)) {
          alert('分组已存在');
          return;
        }
        // 添加到分组列表
        await projectManager.addGroup(groupName);
      }
    });
    setShowInputDialog(true);
  };

  // 编辑 API
  const handleEditAPI = () => {
    if (selectedAPI) {
      setEditingAPI({ ...selectedAPI });
      setIsAddingAPI(false);
    }
  };

  // 保存 API 编辑
  const handleSaveAPI = async (formData, isAdding = false) => {
    if (!formData) return;
    
    if (isAdding || isAddingAPI) {
      // 检查 API 名称是否重复
      const exists = projectData.apis.find(api => api.name === formData.name);
      if (exists) {
        alert('API 名称已存在');
        return;
      }
      // 添加新 API
      await projectManager.addAPI(formData);
      setSelectedAPI(formData);
    } else {
      // 编辑现有 API
      if (formData.name !== selectedAPI.name) {
        // 名称改变，检查是否重复
        const exists = projectData.apis.find(api => api.name === formData.name);
        if (exists) {
          alert('API 名称已存在');
          return;
        }
        // 删除旧的 API
        await projectManager.deleteAPI(selectedAPI.name);
        // 添加新的 API
        await projectManager.addAPI(formData);
      } else {
        // 名称没有改变，直接更新
        await projectManager.updateAPI(selectedAPI.name, formData);
      }
      setSelectedAPI(formData);
    }
    setEditingAPI(null);
    setIsAddingAPI(false);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingAPI(null);
    setIsAddingAPI(false);
  };

  // 执行 API 完成，保存到历史记录（保存全量数据以便复现）
  const handleExecute = (api, result) => {
    if (!result) return;
    
    const historyEntry = {
      id: Date.now(),
      apiName: api.name,
      apiMethod: api.method,
      apiPath: api.api_path,
      timestamp: new Date().toLocaleString('zh-CN'),
      // 全量 API 配置
      apiConfig: {
        name: api.name,
        group: api.group,
        api_path: api.api_path,
        method: api.method,
        header: api.header,
        param: api.param,
        body: api.body,
        chain: api.chain,
        successAssert: api.successAssert
      },
      // 执行结果
      targetResult: result.targetResult,
      success: result.targetResult?.success,
      httpSuccess: result.targetResult?.httpSuccess,
      status_code: result.targetResult?.status_code,
      elapsedTime: result.targetResult?.elapsedTime,
      error: result.targetResult?.error,
      errorType: result.targetResult?.errorType,
      responseData: result.targetResult?.data,
      assertionResult: result.targetResult?.assertionResult,
      responseHeaders: result.targetResult?.headers
    };
    
    setExecutionHistory(prev => [historyEntry, ...prev].slice(0, 100));
  };

  // 获取项目名称
  const getProjectName = () => {
    if (!projectManager.projectPath) return '';
    const parts = projectManager.projectPath.split('/');
    return parts[parts.length - 1];
  };

  // 渲染空状态
  if (!hasProject) {
    return (
      <div className="app">
        <header className="app-header">
          <div className="header-left">
            <FileText size={24} className="logo-icon" />
            <h1>API Test UI</h1>
          </div>
          <div className="header-center">
            <button 
              className="icon-button"
              onClick={toggleTheme}
              title={theme === 'dark' ? '切换到白昼模式' : '切换到暗黑模式'}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>
        <main className="app-main">
          <EmptyState 
            onImportProject={handleImportProject}
            onNewProject={handleNewProject}
          />
        </main>
        
        {/* 输入对话框 */}
        <InputDialog
          isOpen={showInputDialog}
          title={inputDialogConfig.title}
          placeholder={inputDialogConfig.placeholder}
          defaultValue={inputDialogConfig.defaultValue}
          onConfirm={inputDialogConfig.onConfirm}
          onCancel={inputDialogConfig.onCancel}
          onClose={() => setShowInputDialog(false)}
        />
        
        {/* 确认对话框 */}
        <ConfirmDialog
          isOpen={showConfirmDialog}
          title={confirmDialogConfig.title}
          message={confirmDialogConfig.message}
          options={confirmDialogConfig.options}
          onConfirm={confirmDialogConfig.onConfirm}
          onCancel={() => {
            if (confirmDialogConfig.onCancel) {
              confirmDialogConfig.onCancel();
            }
            setShowConfirmDialog(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="app">
      {/* 顶部导航栏 */}
      <header className="app-header">
        <div className="header-left">
          <FileText size={24} className="logo-icon" />
          <div className="project-info">
            <h1>{getProjectName()}</h1>
            {isDirty && <span className="dirty-indicator">未保存</span>}
          </div>
        </div>
        
        <div className="header-center">
          <button 
            className={`nav-button ${!showHistory ? 'active' : ''}`}
            onClick={() => {
              setShowHistory(false);
              setViewMode('api');
            }}
          >
            <Play size={18} />
            <span>测试</span>
          </button>
          <button 
            className={`nav-button ${showHistory ? 'active' : ''}`}
            onClick={() => setShowHistory(true)}
          >
            <History size={18} />
            <span>历史</span>
          </button>
        </div>

        <div className="header-right">
          {saveMessage && (
            <span className={`save-message ${saveMessage.includes('失败') ? 'error' : 'success'}`}>
              {saveMessage}
            </span>
          )}
          <button 
            className="icon-button"
            onClick={handleSaveProject}
            disabled={!isDirty || isSaving}
            title="保存配置"
          >
            <Save size={20} />
          </button>
          <button 
            className="icon-button"
            onClick={handleCloseProject}
            title="关闭项目"
          >
            <XCircle size={20} />
          </button>
          <button 
            className="icon-button"
            onClick={toggleTheme}
            title={theme === 'dark' ? '切换到白昼模式' : '切换到暗黑模式'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="app-main">
        {showHistory ? (
          /* 历史记录视图 */
          <ExecutionHistory 
            history={executionHistory}
            onSelect={handleRestoreFromHistory}
            onClear={() => setExecutionHistory([])}
          />
        ) : (
          /* 测试视图 */
          <>
            <div className="content-area">
              {/* 左侧面板 - API 列表 */}
              <div className="left-panel">
                <div className="panel-section flex-1">
                  {/* <div className="panel-header">
                    <h3>API 列表</h3>
                  </div> */}
                  <APIMain 
                    apis={projectData?.apis || []}
                    groupsData={projectData?.groups || []}
                    selectedAPI={selectedAPI}
                    activeGroup={activeGroup}
                    onSelect={handleAPISelect}
                    onGroupSelect={handleGroupSelect}
                    onAdd={() => {
                      const apis = projectData?.apis || [];
                      let baseName = '未命名的API';
                      let newName = baseName;
                      let counter = 1;
                      while (apis.some(api => api.name === newName)) {
                        newName = `${baseName} ${counter}`;
                        counter++;
                      }
                      const newApi = {
                        name: newName,
                        group: activeGroup || '默认',
                        api_path: '',
                        method: 'GET',
                        header: {},
                        param: {},
                        body: {},
                        chain: [],
                        successAssert: ''
                      };
                      projectManager.addAPI(newApi);
                      setEditingAPI(newApi);
                      setIsAddingAPI(true);
                      setSelectedAPI(newApi);
                      setViewMode('api_detail');
                    }}
                    onAddGroup={handleAddGroup}
                    onDeleteGroup={(groupName) => {
                      const apisInGroup = projectData.apis?.filter(api => api.group === groupName) || [];
                      
                      if (apisInGroup.length === 0) {
                        // 没有 API，直接删除分组
                        projectManager.deleteGroup(groupName);
                      } else {
                        // 有 API，显示确认对话框
                        setConfirmDialogConfig({
                          title: '删除分组',
                          message: `确定要删除分组 "${groupName}" 吗？该分组下有 ${apisInGroup.length} 个 API。`,
                          options: [
                            { value: 'move', label: '将 API 移至默认分组' },
                            { value: 'delete', label: '同时删除该分组下的所有 API' }
                          ],
                          onConfirm: (option) => {
                            if (option === 'delete') {
                              // 删除分组和该分组下的所有 API
                              apisInGroup.forEach(api => {
                                projectManager.deleteAPI(api.name);
                              });
                              projectManager.deleteGroup(groupName);
                            } else {
                              // 只删除分组，API 移至默认分组
                              projectManager.deleteGroup(groupName);
                            }
                            setShowConfirmDialog(false);
                          },
                          onCancel: () => {
                            setShowConfirmDialog(false);
                          }
                        });
                        setShowConfirmDialog(true);
                      }
                    }}
                    onEdit={(api) => {
                      setEditingAPI({ ...api });
                      setIsAddingAPI(false);
                      setSelectedAPI(api);
                      setViewMode('api_detail');
                    }}
                    onDelete={(api) => {
                      setConfirmDialogConfig({
                        title: '删除 API',
                        message: `确定要删除 API "${api.name}" 吗？`,
                        options: [],
                        onConfirm: () => {
                          projectManager.deleteAPI(api.name);
                          if (selectedAPI?.name === api.name) {
                            setSelectedAPI(null);
                            setEditingAPI(null);
                            setIsAddingAPI(false);
                            setViewMode('api');
                          }
                          setShowConfirmDialog(false);
                        },
                        onCancel: () => {
                          setShowConfirmDialog(false);
                        }
                      });
                      setShowConfirmDialog(true);
                    }}
                  />
                </div>
              </div>

              {/* 右侧面板 */}
              <div className="right-panel">
                {viewMode === 'env_var_manager' ? (
                  <EnvVarManager 
                    onBack={() => setViewMode('api')}
                  />
                ) : viewMode === 'environment_list' ? (
                  <EnvironmentList 
                    profiles={projectData?.profile || []}
                    onBack={() => setViewMode('api')}
                  />
                ) : viewMode === 'variable_list' ? (
                  <VariableList 
                    profiles={projectData?.profile || []}
                    onBack={() => setViewMode('api')}
                  />
                ) : viewMode === 'api_detail' && selectedAPI ? (
                /* API 详情/编辑/测试 */
                <APIDetail 
                  api={selectedAPI}
                  profile={currentProfile}
                  config={projectData}
                  projectPath={projectManager.projectPath}
                  onExecute={handleExecute}
                  history={executionHistory}
                  restoringHistoryEntry={restoringHistoryEntry}
                  onRestored={() => setRestoringHistoryEntry(null)}
                  onSaveAPI={handleSaveAPI}
                  groups={projectManager.getGroups()}
                  isAdding={isAddingAPI}
                />
              ) : (
                /* 默认空状态 */
                <div className="empty-state">
                  {!projectData?.profile || projectData.profile.length === 0 ? (
                    <>
                      <Globe size={48} className="empty-icon" />
                      <h2>暂无环境配置</h2>
                      <p>请先添加环境配置才能开始测试</p>
                      <button 
                        className="btn-primary"
                        onClick={() => setViewMode('env_var_manager')}
                      >
                        添加环境
                      </button>
                    </>
                  ) : selectedAPI ? (
                    <></>
                  ) : (
                    <>
                      <Plus size={48} className="empty-icon" />
                      <h2>当前分组还没有 API</h2>
                      <p>点击左上角 + 按钮新增 API</p>
                    </>
                  )}
                </div>
              )}
            </div>
            </div>

            {/* 底部栏 */}
            <BottomBar 
              currentProfile={currentProfile}
              allProfiles={projectData?.profile || []}
              onProfileSelect={handleProfileSelect}
              onEditVariables={() => {
                setSelectedAPI(null);
                setViewMode('env_var_manager');
              }}
            />
          </>
        )}
      </main>
      
      {/* 输入对话框 */}
      <InputDialog
        isOpen={showInputDialog}
        title={inputDialogConfig.title}
        placeholder={inputDialogConfig.placeholder}
        defaultValue={inputDialogConfig.defaultValue}
        onConfirm={inputDialogConfig.onConfirm}
        onCancel={inputDialogConfig.onCancel}
        onClose={() => setShowInputDialog(false)}
      />
      
      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title={confirmDialogConfig.title}
        message={confirmDialogConfig.message}
        options={confirmDialogConfig.options}
        onConfirm={confirmDialogConfig.onConfirm}
        onCancel={() => {
          if (confirmDialogConfig.onCancel) {
            confirmDialogConfig.onCancel();
          }
          setShowConfirmDialog(false);
        }}
      />
    </div>
  );
}

export default App;