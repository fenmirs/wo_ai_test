import React, { useState, useEffect, useCallback } from 'react';
import { FileText, LucideHistory, Save, Edit, X, Plus, FolderPlus, ArrowLeft, Sun, Moon, XCircle, Globe } from 'lucide-react';
import APIMain from './components/APIMain';
import APIDetail from './components/APIDetail';
import BottomBar from './components/BottomBar';
import EnvVarManager from './components/EnvVarManager';
import ExecutionHistory from './components/ExecutionHistory';
import EmptyState from './components/EmptyState';
import InputDialog from './components/InputDialog';
import ConfirmDialog from './components/ConfirmDialog';
import HistoryDetailDialog from './components/HistoryDetailDialog';
import { projectManager } from './utils/ProjectManager';
import './App.css';

function App() {
  // 状态
  const [theme, setTheme] = useState('dark');
  const [hasProject, setHasProject] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [selectedAPI, setSelectedAPI] = useState(null);
  const [temporaryAPI, setTemporaryAPI] = useState(null);
  const [activeGroup, setActiveGroup] = useState('默认');
  const [showEnvVarConfig, setShowEnvVarConfig] = useState(false);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [restoringHistoryEntry, setRestoringHistoryEntry] = useState(null);
  const [viewingHistoryEntry, setViewingHistoryEntry] = useState(null);
  const [projectList, setProjectList] = useState([]);
  const [currentProjectDir, setCurrentProjectDir] = useState(null);
  
  // 视图模式：'api' | 'api_detail' | 'env_var_manager' | 'history'
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
      
      // 首次加载项目时自动选择默认环境
      if (projectData && projectData.profile && projectData.profile.length > 0 && !hasProject) {
        // 优先使用之前保存的环境选择
        const savedProfileName = projectManager.getSelectedProfileName();
        let selectedProfile = null;
        
        if (savedProfileName) {
          selectedProfile = projectData.profile.find(p => p.name === savedProfileName);
        }
        
        if (!selectedProfile) {
          selectedProfile = projectData.profile.find(p => p.activate);
        }
        
        if (!selectedProfile && projectData.profile.length > 0) {
          selectedProfile = projectData.profile[0];
        }
        
        if (selectedProfile) {
          setCurrentProfile(selectedProfile);
        }
      }
      
      // 切换项目时，恢复之前保存的环境
      if (projectData && projectData.profile && projectData.profile.length > 0 && hasProject) {
        const savedProfileName = projectManager.getSelectedProfileName();
        let selectedProfile = null;
        
        if (savedProfileName) {
          selectedProfile = projectData.profile.find(p => p.name === savedProfileName);
        }
        
        if (!selectedProfile && projectData.profile.length > 0) {
          selectedProfile = projectData.profile.find(p => p.activate) || projectData.profile[0];
        }
        
        if (selectedProfile) {
          setCurrentProfile(selectedProfile);
        }
      }
    };

    projectManager.addListener(handleProjectChange);

    return () => {
      projectManager.removeListener(handleProjectChange);
    };
  }, [hasProject]);

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

  // 导入项目（扫描目录下所有项目）
  const handleImportProject = useCallback(async () => {
    console.log('handleImportProject called');
    console.log('window.electron:', window.electron);
    if (!window.electron) {
      alert('此功能仅在 Electron 应用中可用');
      return;
    }

    console.log('Calling selectDirectory...');
    const result = await window.electron.selectDirectory();
    console.log('selectDirectory result:', result);
    if (result.success) {
      console.log('Scanning directory:', result.path);
      const projects = await projectManager.scanDirectory(result.path);
      console.log('Scan results:', projects);
      setProjectList(projects);
      
      if (projects.length > 0) {
        setSaveMessage('项目扫描成功');
        setTimeout(() => setSaveMessage(''), 2000);
      } else {
        alert('该目录下没有找到项目，请先创建新项目');
      }
    }
  }, []);

  // 选择项目（从目录项目列表中选择）
  const handleProjectSelect = useCallback(async (project) => {
    const dirPath = project.dirPath || project.path;
    const loadResult = await projectManager.loadProject(dirPath, project.id);
    if (loadResult.success) {
      setCurrentProjectDir(dirPath);
      if (window.electron) {
        const listResult = await window.electron.readDirectoryProjectList(dirPath);
        setProjectList(listResult.data || []);
      }
      setExecutionHistory(projectManager.getHistory());
      setSaveMessage('项目切换成功');
      setTimeout(() => setSaveMessage(''), 2000);
    } else {
      alert(`加载项目失败: ${loadResult.error}`);
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

        // 创建新项目（使用随机ID的配置文件和历史记录文件）
        const createResult = await projectManager.createProject(dirResult.path, projectName);
        if (!createResult.success) {
          alert(`创建项目失败: ${createResult.error}`);
          return;
        }

        // 加载刚创建的项目
        const loadResult = await projectManager.loadProject(dirResult.path, createResult.project.projectId);
        if (!loadResult.success) {
          alert(`加载项目失败: ${loadResult.error}`);
          return;
        }

        // 更新项目列表
        const projects = await projectManager.getDirProjects();
        setProjectList(projects);
        
        setSaveMessage('新项目创建成功');
        setTimeout(() => setSaveMessage(''), 2000);
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
    setHasProject(false);
    setCurrentProfile(null);
    setSelectedAPI(null);
    setEditingAPI(null);
    setIsAddingAPI(false);
    setViewMode('api');
  }, [isDirty]);

  // 选择环境
  const handleProfileSelect = (profile) => {
    setCurrentProfile(profile);
    projectManager.setSelectedProfileName(profile.name);
  };

  // 选择 API
  const handleAPISelect = (api) => {
    setSelectedAPI(api);
    setActiveGroup(api.group || '默认');
    setEditingAPI(null);
    setIsAddingAPI(false);
    setTemporaryAPI(null);
    setRestoringHistoryEntry(null);
    setSaveError(null);
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

  // 从历史记录恢复请求（临时模式）
  const handleRestoreFromHistory = (historyEntry) => {
    const restoredApi = {
      name: historyEntry.apiName || '临时API',
      group: historyEntry.apiConfig?.group || '默认',
      api_path: historyEntry.apiPath || '',
      method: historyEntry.apiMethod || 'GET',
      header: historyEntry.apiConfig?.header || {},
      param: historyEntry.apiConfig?.param || {},
      body: historyEntry.apiConfig?.body || {},
      chain: historyEntry.apiConfig?.chain || [],
      successAssert: historyEntry.apiConfig?.successAssert || ''
    };
    
    setTemporaryAPI(restoredApi);
    setRestoringHistoryEntry(historyEntry);
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
    
    const isTemporary = temporaryAPI !== null;
    
    if (isTemporary || isAdding) {
      // 检查 API 名称是否重复
      const exists = projectData.apis.find(api => api.name === formData.name);
      if (exists) {
        throw new Error('API 名称已存在');
      }
      // 添加新 API
      await projectManager.addAPI(formData);
      setSelectedAPI(formData);
      setTemporaryAPI(null);
    } else {
      // 编辑现有 API
      if (formData.name !== selectedAPI.name) {
        // 名称改变，检查是否重复
        const exists = projectData.apis.find(api => api.name === formData.name);
        if (exists) {
          throw new Error('API 名称已存在');
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
    if (temporaryAPI) {
      setTemporaryAPI(null);
      setRestoringHistoryEntry(null);
      setViewMode('api');
    }
  };

  // 执行 API 完成，保存到历史记录
  const handleExecute = (api, result) => {
    if (!result) return;
    
    const historyEntry = {
      id: Date.now(),
      apiName: api.name,
      apiMethod: api.method,
      apiPath: api.api_path,
      timestamp: new Date().toLocaleString('zh-CN'),
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
      requestInfo: result.requestInfo || null,
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
    
    // 保存到 ProjectManager
    projectManager.addHistory(historyEntry);
    setExecutionHistory(projectManager.getHistory());
  };

  // 渲染空状态
  if (!hasProject) {
    return (
      <div className="app">
        <main className="app-main">
          <EmptyState 
            onImportProject={handleImportProject}
            onNewProject={handleNewProject}
            projectList={projectList}
            onProjectSelect={handleProjectSelect}
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
      {/* 主内容区 */}
      <main className="app-main">
        <div className="content-area">
          {/* 左侧面板 - API 列表 */}
          <div className="left-panel">
            <div className="panel-section flex-1">
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
                    projectManager.deleteGroup(groupName);
                  } else {
                    setConfirmDialogConfig({
                      title: '删除分组',
                      message: `确定要删除分组 "${groupName}" 吗？该分组下有 ${apisInGroup.length} 个 API。`,
                      options: [
                        { value: 'move', label: '将 API 移至默认分组' },
                        { value: 'delete', label: '同时删除该分组下的所有 API' }
                      ],
                      onConfirm: (option) => {
                        if (option === 'delete') {
                          apisInGroup.forEach(api => {
                            projectManager.deleteAPI(api.name);
                          });
                          projectManager.deleteGroup(groupName);
                        } else {
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
            {viewMode === 'history' ? (
              <ExecutionHistory 
                history={executionHistory}
                onSelect={handleRestoreFromHistory}
                onClear={() => setExecutionHistory([])}
                onViewDetail={(entry) => setViewingHistoryEntry(entry)}
              />
            ) : viewMode === 'env_var_manager' ? (
              <EnvVarManager 
                onBack={() => {
                  if (selectedAPI) {
                    setViewMode('api_detail');
                  } else {
                    setViewMode('api');
                  }
                }}
              />
            ) : viewMode === 'api_detail' && (selectedAPI || temporaryAPI) ? (
              <APIDetail 
                api={temporaryAPI || selectedAPI}
                profile={currentProfile}
                config={projectData}
                projectPath={projectManager.getProjectPath()}
                onExecute={handleExecute}
                history={executionHistory}
                restoringHistoryEntry={restoringHistoryEntry}
                onRestored={() => setRestoringHistoryEntry(null)}
                onSaveAPI={handleSaveAPI}
                onSaveError={(msg) => setSaveError(msg)}
                saveError={saveError}
                groups={projectManager.getGroups()}
                isAdding={isAddingAPI}
                isTemporary={temporaryAPI !== null}
                onViewDetail={(entry) => setViewingHistoryEntry(entry)}
                onRestoreHistory={handleRestoreFromHistory}
                theme={theme}
              />
            ) : (
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
          projectName={projectManager.getProjectName()}
          isDirty={isDirty}
          onSave={handleSaveProject}
          onCloseProject={handleCloseProject}
          toggleTheme={toggleTheme}
          theme={theme}
          isSaving={isSaving}
          onShowHistory={()=>{setViewMode('history')}}
          onBackToApi={() => setViewMode('api')}
          viewModeValue={viewMode}
          projectList={projectList}
          onProjectSelect={handleProjectSelect}
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

      {viewingHistoryEntry && (
        <HistoryDetailDialog 
          entry={viewingHistoryEntry} 
          onClose={() => setViewingHistoryEntry(null)} 
        />
      )}
    </div>
  );
}

export default App;