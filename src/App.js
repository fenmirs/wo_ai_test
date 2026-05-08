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
import { notificationManager } from './utils/NotificationManager';
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
      
      // 设置通知管理器的当前项目
      if (projectData && projectManager.getProjectId()) {
        notificationManager.setCurrentProject(projectManager.getProjectId());
      }
      
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
    const result = await window.electron.selectDirectory();
    if (result.success) {
      const projects = await projectManager.scanDirectory(result.path);
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
      // 设置通知管理器的当前项目
      notificationManager.setCurrentProject(project.id);
      
      const listResult = await window.electron.readDirectoryProjectList(dirPath);
      setProjectList(listResult.data || []);
      setExecutionHistory(projectManager.getHistory());
      setSaveMessage('项目切换成功');
      setTimeout(() => setSaveMessage(''), 2000);
    } else {
      alert(`加载项目失败: ${loadResult.error}`);
    }
  }, []);

  // 创建新项目
  const handleNewProject = useCallback(async () => {
    // 先弹出输入框让用户输入项目名称
    setInputDialogConfig({
      title: '新建项目',
      placeholder: '请输入项目名称',
      defaultValue: '',
      onConfirm: async (projectName) => {
        // 选择保存位置
        const dirResult = await window.electron.selectDirectory();
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
          alert(`加载项目失败: ${createResult.error}`);
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
    // api.group 现在是 id，需要找到对应的 group
    const groupId = api.group || null;
    setActiveGroup(groupId);
    setEditingAPI(null);
    setIsAddingAPI(false);
    setTemporaryAPI(null);
    setRestoringHistoryEntry(null);
    setSaveError(null);
    setViewMode('api_detail');
  };

  // 选择分组
  const handleGroupSelect = (groupId) => {
    setActiveGroup(groupId);
    const apisInGroup = projectData.apis?.filter(api => {
      if (groupId === null || groupId === 'default' || groupId === '默认') {
        return !api.group || api.group === null || api.group === 'default' || api.group === '默认';
      }
      return api.group === groupId;
    }) || [];
    
    if (apisInGroup.length > 0) {
      if (!selectedAPI || selectedAPI.group !== groupId) {
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
      id: historyEntry.apiId || null,
      name: historyEntry.apiName || '临时API',
      group: historyEntry.apiConfig?.group || null,
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
  const handleAddGroup = (parentId = null) => {
    setInputDialogConfig({
      title: parentId ? '添加子分组' : '添加分组',
      placeholder: '请输入分组名称',
      defaultValue: '',
      onConfirm: async (groupName) => {
        // 检查分组是否已存在（同父分组下）
        const existingGroups = projectData.groups || [];
        if (existingGroups.find(g => g.name === groupName && g.parentId === parentId)) {
          alert('当前层级下已存在同名分组');
          return;
        }
        // 添加分组
        await projectManager.addGroup(groupName, parentId);
      }
    });
    setShowInputDialog(true);
  };

  // 移动分组到新的父分组（静默处理非法操作）
  const handleMoveGroup = (groupId, newParentId) => {
    if (groupId === 'default') return;
    
    // 检查是否是自己或自己的子分组（静默忽略）
    if (groupId === newParentId) return;
    
    const childIds = projectManager._getChildGroupIds?.(groupId) || [];
    if (childIds.includes(newParentId)) return;
    
    projectManager.updateGroup(groupId, { parentId: newParentId });
    
    setSaveMessage(`分组已移动`);
    setTimeout(() => setSaveMessage(''), 2000);
  };

  // 重命名分组
  const handleRenameGroup = async (groupId, newName) => {
    if (groupId === 'default') {
      setConfirmDialogConfig({
        title: '提示',
        message: '默认分组不能重命名',
        options: [{ value: 'ok', label: '确定' }],
        onConfirm: () => setShowConfirmDialog(false),
        onCancel: () => setShowConfirmDialog(false)
      });
      setShowConfirmDialog(true);
      return;
    }

    // 查找当前分组
    const currentGroup = projectData.groups?.find(g => g.id === groupId);
    if (!currentGroup) return;

    // 如果名称没有变化，直接返回（不报错）
    if (newName === currentGroup.name) return;

    // 检查新名称是否已存在（同父分组下，排除自己）
    const existingGroup = projectData.groups?.find(g => 
      g.id !== groupId && // 排除自己
      g.name === newName && 
      g.parentId === currentGroup.parentId
    );
    
    if (existingGroup) {
      setConfirmDialogConfig({
        title: '提示',
        message: '当前层级下已存在同名分组',
        options: [{ value: 'ok', label: '确定' }],
        onConfirm: () => setShowConfirmDialog(false),
        onCancel: () => setShowConfirmDialog(false)
      });
      setShowConfirmDialog(true);
      return;
    }

    // 更新分组名称
    await projectManager.updateGroup(groupId, { name: newName });

    setSaveMessage(`分组已重命名为 "${newName}"`);
    setTimeout(() => setSaveMessage(''), 2000);
  };

  // 移动 API 到新分组
  const handleMoveToGroup = (apiId, newGroupId) => {
    if (!apiId || newGroupId === undefined) return;
    
    // 检查目标分组是否存在，不存在则先创建（如果是字符串，说明是旧数据）
    if (typeof newGroupId === 'string' && !newGroupId.startsWith('group_') && newGroupId !== 'default' && newGroupId !== null) {
      projectManager.addGroup(newGroupId);
      // 获取新创建的分组 id
      const newGroup = projectManager.getData().groups?.find(g => g.name === newGroupId);
      if (newGroup) {
        newGroupId = newGroup.id;
      }
    }
    
    // 更新 API 的分组
    projectManager.updateAPI(apiId, { group: newGroupId });
    
    // 如果移动的是当前选中的 API，更新选中状态
    if (selectedAPI?.id === apiId) {
      setSelectedAPI({ ...selectedAPI, group: newGroupId });
    }
    
    setSaveMessage(`已将 API 移动到新分组`);
    setTimeout(() => setSaveMessage(''), 2000);
  };

  // 复制 API
  const handleCopyAPI = (apiId) => {
    const newAPI = projectManager.copyAPI(apiId);
    if (newAPI) {
      setSaveMessage(`API 已复制为 "${newAPI.name}"`);
      setTimeout(() => setSaveMessage(''), 2000);
    }
  };

  // 复制分组
  const handleCopyGroup = (groupId) => {
    const newGroupId = projectManager.copyGroup(groupId);
    if (newGroupId) {
      const newGroup = projectData.groups?.find(g => g.id === newGroupId);
      setSaveMessage(`分组已复制为 "${newGroup?.name || '未知'}"`);
      setTimeout(() => setSaveMessage(''), 2000);
    }
  };

  // 编辑 API
  const handleEditAPI = () => {
    if (selectedAPI) {
      setEditingAPI({ ...selectedAPI });
      setIsAddingAPI(false);
    }
  };

  // 保存 API 编辑
  const handleSaveAPI = async (formData) => {
    if (!formData) return;
    
    const isTemporary = temporaryAPI !== null;
    
    if (isTemporary || isAddingAPI) {
      // 检查 API 名称是否重复（同一分组下）
      const exists = projectData.apis.find(api => 
        api.name === formData.name && api.group === formData.group
      );
      if (exists && !isTemporary) {
        throw new Error('当前分组下已存在同名 API');
      }
      // 添加新 API（确保有 id）
      if (!formData.id) {
        formData.id = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      await projectManager.addAPI(formData);
      setSelectedAPI(formData);
      setTemporaryAPI(null);
    } else {
      // 更新现有 API（通过 id）
      if (formData.id !== selectedAPI.id) {
        throw new Error('API ID 不匹配');
      }
      await projectManager.updateAPI(formData.id, formData);
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

  // 清空历史记录
  const handleClearHistory = () => {
    projectManager.clearHistory();
    setExecutionHistory([]);
    setSaveMessage('历史记录已清空');
    setTimeout(() => setSaveMessage(''), 2000);
  };

  // 删除单条历史记录
  const handleDeleteHistory = (entryId) => {
    projectManager.deleteHistory(entryId);
    setExecutionHistory(projectManager.getHistory());
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
                 onMoveToGroup={handleMoveToGroup}
                 onMoveGroup={handleMoveGroup}
                 onRenameGroup={handleRenameGroup}
                 onCopyAPI={handleCopyAPI}
                 onCopyGroup={handleCopyGroup}
                 onAdd={(parentId) => {
                   const apis = projectData?.apis || [];
                   let baseName = '未命名的API';
                   let newName = baseName;
                   let counter = 1;
                   while (apis.some(api => api.name === newName && api.group === (parentId || 'default'))) {
                     newName = `${baseName} ${counter}`;
                     counter++;
                   }
                   const newApi = {
                     name: newName,
                     group: parentId || 'default',
                     api_path: '',
                     method: 'GET',
                     header: {},
                     param: {},
                     body: {},
                     chain: [],
                     successAssert: ''
                   };
                   // 不在这里添加 API，而是在保存时添加
                   setEditingAPI(newApi);
                   setIsAddingAPI(true);
                   setSelectedAPI(newApi);
                   setViewMode('api_detail');
                 }}
                 onAddGroup={handleAddGroup}
                 onDeleteGroup={(groupId) => {
                   const group = projectData.groups?.find(g => g.id === groupId);
                   if (!group) return;
                   
                   // 获取所有子分组
                   const childGroupIds = projectManager._getChildGroupIds?.(groupId) || [];
                   const allGroupIds = [groupId, ...childGroupIds];
                   
                   // 统计受影响的 API
                   const apisInGroups = projectData.apis?.filter(api => 
                     allGroupIds.includes(api.group)
                   ) || [];
                   
                   if (apisInGroups.length === 0 && childGroupIds.length === 0) {
                     projectManager.deleteGroup(groupId);
                   } else {
                     setConfirmDialogConfig({
                       title: '删除分组',
                       message: `确定要删除分组 "${group.name}" 吗？该分组下有 ${apisInGroups.length} 个 API，${childGroupIds.length} 个子分组。`,
                       options: [
                         { value: 'move', label: '将 API 移至默认分组' },
                         { value: 'delete', label: '同时删除该分组下的所有 API' }
                       ],
                       onConfirm: (option) => {
                         if (option === 'delete') {
                           // 删除所有子分组和 API
                           childGroupIds.forEach(id => projectManager.deleteGroup(id));
                           apisInGroups.forEach(api => {
                             projectManager.deleteAPI(api.id);
                           });
                           projectManager.deleteGroup(groupId);
                         } else {
                           // 只删除分组，API 移到默认分组
                           projectManager.deleteGroup(groupId);
                         }
                         // 如果当前激活的分组被删除，切换到默认分组
                         if (activeGroup === groupId) {
                           setActiveGroup('default');
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
                       projectManager.deleteAPI(api.id);
                       
                       if (selectedAPI?.id === api.id) {
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
                onClear={handleClearHistory}
                onViewDetail={(entry) => setViewingHistoryEntry(entry)}
                onDelete={handleDeleteHistory}
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
                onDeleteHistory={handleDeleteHistory}
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