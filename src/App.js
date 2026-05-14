import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, LucideHistory, Save, Edit, X, Plus, FolderPlus, ArrowLeft, Sun, Moon, XCircle, Globe, PanelLeft, Columns, PanelRight } from 'lucide-react';
import APIMain from './components/APIMain';
import APIDetail from './components/APIDetail';
import BottomBar from './components/BottomBar';
import EnvVarManager from './components/EnvVarManager';
import ExecutionHistory from './components/ExecutionHistory';
import EmptyState from './components/EmptyState';
import EmbeddedProgress from './components/EmbeddedProgress';
import InputDialog from './components/InputDialog';
import ConfirmDialog from './components/ConfirmDialog';
import HistoryDetailDialog from './components/HistoryDetailDialog';
import ResponsePanel from './components/ResponsePanel';
import { ToastContainer } from './components/Toast';
import { ProgressProvider } from './components/ProgressOverlay';
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
  const [currentProfile, setCurrentProfile] = useState(null);
  const [selectedAPI, setSelectedAPI] = useState(null);
  const [temporaryAPI, setTemporaryAPI] = useState(null);
  const [activeGroup, setActiveGroup] = useState('默认');
  const [showEnvVarConfig, setShowEnvVarConfig] = useState(false);
  const [apiHistory, setApiHistory] = useState([]);
  const [restoringHistoryEntry, setRestoringHistoryEntry] = useState(null);
  const [viewingHistoryEntry, setViewingHistoryEntry] = useState(null);
  const [projectList, setProjectList] = useState([]);
  const [currentProjectDir, setCurrentProjectDir] = useState(null);

  // 工作空间加载状态
  const [workspaceStatus, setWorkspaceStatus] = useState('idle'); // idle | loading | issues | done | error
  const [workspaceProgress, setWorkspaceProgress] = useState({ current: 0, total: 0 });
  const [workspaceIssues, setWorkspaceIssues] = useState([]);
  const [workspaceError, setWorkspaceError] = useState('');
  
  // 当前执行结果（供右侧 ResponsePanel 使用）
  const [currentExecutionResult, setCurrentExecutionResult] = useState(null);
  
  // 面板显隐状态
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showCenterPanel, setShowCenterPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

  // 面板宽度（可拖动调整）
  const [leftPanelWidth, setLeftPanelWidth] = useState(280);
  const [rightPanelWidth, setRightPanelWidth] = useState(450);
  const dragInfo = useRef(null);

  // 面板拖动调整宽度
  const handleResizeStart = useCallback((e, side) => {
    e.preventDefault();
    dragInfo.current = {
      side,
      startX: e.clientX,
      startLeft: leftPanelWidth,
      startRight: rightPanelWidth
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [leftPanelWidth, rightPanelWidth]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragInfo.current) return;
      const { side, startX, startLeft, startRight } = dragInfo.current;
      const dx = e.clientX - startX;

      if (side === 'left') {
        const newWidth = Math.max(200, Math.min(600, startLeft + dx));
        setLeftPanelWidth(newWidth);
      } else {
        const newWidth = Math.max(300, Math.min(800, startRight - dx));
        setRightPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      dragInfo.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // 视图模式：'api' | 'api_detail' | 'env_var_manager' | 'history'
  const [viewMode, setViewMode] = useState('api');
  
  // 编辑状态
  const [editingAPI, setEditingAPI] = useState(null);
  const [isAddingAPI, setIsAddingAPI] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const checkDraftThen = useCallback((action) => {
    if (isAddingAPI && draftDirty) {
      setConfirmDialogConfig({
        title: '丢弃草稿',
        message: '当前 API 尚未保存，确定要丢弃所有更改吗？',
        options: [],
        onConfirm: () => {
          setShowConfirmDialog(false);
          setIsAddingAPI(false);
          setDraftDirty(false);
          action();
        },
        onCancel: () => setShowConfirmDialog(false)
      });
      setShowConfirmDialog(true);
    } else {
      action();
    }
  }, [isAddingAPI, draftDirty]);
  
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

  // 导入工作空间（扫描目录下所有项目）
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

  // 选择项目（从目录项目列表中选择）— 加载整个工作空间
  const handleProjectSelect = useCallback(async (project) => {
    const dirPath = project.dirPath || project.path;
    setWorkspaceStatus('loading');
    setWorkspaceProgress({ current: 0, total: 0 });
    setWorkspaceIssues([]);
    setWorkspaceError('');

    const result = await projectManager.loadWorkspace(dirPath, (current, total) => {
      setWorkspaceProgress({ current, total });
    });

    if (result.success) {
      setCurrentProjectDir(dirPath);
      const listResult = await window.electron.readDirectoryProjectList(dirPath);
      setProjectList(listResult.data || []);
      setApiHistory([]);

      if (result.issues && result.issues.length > 0) {
        setWorkspaceIssues(result.issues);
        setWorkspaceStatus('issues');
      } else {
        setWorkspaceStatus('done');
        // 短暂延迟后自动进入
        setTimeout(() => {
          projectManager.switchProject(projectManager.activeProjectId);
          setWorkspaceStatus('idle');
          setSaveMessage('项目加载成功');
          setTimeout(() => setSaveMessage(''), 2000);
        }, 300);
      }
    } else {
      setWorkspaceError(result.error || '加载失败');
      setWorkspaceStatus('error');
    }
  }, []);

  // 工作空间加载完成后进入项目（忽略问题）
  const handleEnterProject = useCallback(async () => {
    const projId = projectManager.activeProjectId;
    if (!projId) return;

    // 触发监听器（hasProject → true，主界面渲染）
    projectManager.switchProject(projId);

    // 添加到最近项目
    const proj = projectManager._activeProject;
    if (proj) {
      await projectManager.addToRecentProjects(proj.dirPath, projId, proj.projectName);
    }

    setWorkspaceStatus('idle');
    setApiHistory([]);
    setSaveMessage('项目加载成功');
    setTimeout(() => setSaveMessage(''), 2000);
  }, []);

  // 重试加载工作空间
  const handleRetryWorkspace = useCallback(async () => {
    if (!currentProjectDir) return;
    setWorkspaceStatus('loading');
    setWorkspaceProgress({ current: 0, total: 0 });
    setWorkspaceIssues([]);
    setWorkspaceError('');

    const result = await projectManager.loadWorkspace(currentProjectDir, (current, total) => {
      setWorkspaceProgress({ current, total });
    });

    if (result.success) {
      const listResult = await window.electron.readDirectoryProjectList(currentProjectDir);
      setProjectList(listResult.data || []);

      if (result.issues && result.issues.length > 0) {
        setWorkspaceIssues(result.issues);
        setWorkspaceStatus('issues');
      } else {
        setWorkspaceStatus('done');
        setTimeout(() => {
          projectManager.switchProject(projectManager.activeProjectId);
          setWorkspaceStatus('idle');
          setSaveMessage('项目加载成功');
          setTimeout(() => setSaveMessage(''), 2000);
        }, 300);
      }
    } else {
      setWorkspaceError(result.error || '加载失败');
      setWorkspaceStatus('error');
    }
  }, [currentProjectDir]);

  // 底部栏项目切换（纯内存操作，需检查脏数据）
  const handleProjectSwitch = useCallback((project) => {
    const targetId = project.id;
    if (targetId === projectManager.activeProjectId) return;

    const doSwitch = () => {
      projectManager.switchProject(targetId);
      setApiHistory([]);
      setSelectedAPI(null);
      setEditingAPI(null);
      setIsAddingAPI(false);
      setTemporaryAPI(null);
      setViewMode('api');
    };

    if (projectManager.isDirty) {
      setConfirmDialogConfig({
        title: '未保存的更改',
        message: '当前项目有未保存的更改，是否保存后再切换？',
        options: [
          { value: 'save', label: '保存并切换' },
          { value: 'discard', label: '放弃并切换' },
          { value: 'cancel', label: '取消' }
        ],
        onConfirm: (option) => {
          setShowConfirmDialog(false);
          if (option === 'save') {
            projectManager.saveProject().then(doSwitch);
          } else if (option === 'discard') {
            doSwitch();
          }
        },
        onCancel: () => setShowConfirmDialog(false)
      });
      setShowConfirmDialog(true);
    } else {
      doSwitch();
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
    checkDraftThen(() => {
      projectManager.clear();
      setHasProject(false);
      setCurrentProfile(null);
      setSelectedAPI(null);
      setEditingAPI(null);
      setIsAddingAPI(false);
      setViewMode('api');
    });
  }, [isDirty, isAddingAPI, draftDirty]);

  // 选择环境
  const handleProfileSelect = (profile) => {
    setCurrentProfile(profile);
    projectManager.setSelectedProfileName(profile.name);
  };

  // 面板显隐切换（至少保持一栏可见）
  const toggleLeftPanel = () => {
    if (showLeftPanel && !showCenterPanel && !showRightPanel) return;
    setShowLeftPanel(!showLeftPanel);
  };
  const toggleCenterPanel = () => {
    if (showCenterPanel && !showLeftPanel && !showRightPanel) return;
    setShowCenterPanel(!showCenterPanel);
  };
  const toggleRightPanel = () => {
    if (showRightPanel && !showLeftPanel && !showCenterPanel) return;
    setShowRightPanel(!showRightPanel);
  };

  // 处理 APIDetail 执行结果变化（供右侧 ResponsePanel 使用）
  const handleResultChange = useCallback((result) => {
    setCurrentExecutionResult(result);
  }, []);

  // 选择 API（加载完整数据 + 历史）
  const handleAPISelect = async (api) => {
    checkDraftThen(async () => {
      let fullData = api;
      if (api.id && !api.api_path && !api.method) {
        const loaded = await projectManager.loadAPIData(api.id);
        if (loaded) fullData = loaded;
      }
      const hist = projectManager._apiHistoryCache[api.id] || await projectManager.loadAPIHistory(api.id);
      setSelectedAPI(fullData);
      setApiHistory(hist || []);
      const groupId = fullData.group || null;
      setActiveGroup(groupId);
      setEditingAPI(null);
      setIsAddingAPI(false);
      setTemporaryAPI(null);
      setRestoringHistoryEntry(null);
      setViewMode('api_detail');
    });
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
    checkDraftThen(() => {
      if (selectedAPI) {
        setEditingAPI({ ...selectedAPI });
        setIsAddingAPI(false);
      }
    });
  };

  // 保存 API 编辑（v2：per-API 文件）
  const handleSaveAPI = async (formData) => {
    if (!formData) return;
    
    const isTemporary = temporaryAPI !== null;
    
    if (isTemporary || isAddingAPI) {
      const exists = projectData.apis.find(api => 
        api.name === formData.name && api.group === formData.group
      );
      if (exists && !isTemporary) {
        throw new Error('当前分组下已存在同名 API');
      }
      if (!formData.id) {
        formData.id = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      await projectManager.addAPI(formData);
      setSelectedAPI(formData);
      setTemporaryAPI(null);
    } else {
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

  // 清空历史记录（per-API）
  const handleClearHistory = async () => {
    if (!selectedAPI?.id) return;
    await projectManager.saveAPIHistory(selectedAPI.id, []);
    setApiHistory([]);
    setSaveMessage('历史记录已清空');
    setTimeout(() => setSaveMessage(''), 2000);
  };

  // 删除单条历史记录（per-API）
  const handleDeleteHistory = async (entryId) => {
    if (!selectedAPI?.id) return;
    const history = await projectManager.loadAPIHistory(selectedAPI.id);
    const filtered = history.filter(h => h.id !== entryId);
    await projectManager.saveAPIHistory(selectedAPI.id, filtered);
    setApiHistory(filtered);
  };

  // 执行 API 完成，保存到 per-API 历史
  const handleExecute = async (api, result) => {
    if (!result) return;
    setCurrentExecutionResult(result);
    
    const historyEntry = {
      id: Date.now(),
      scenarioId: null,
      scenarioName: null,
      apiId: api.id || null,
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
      responseHeaders: result.targetResult?.headers,
      allResults: result.allResults || null,
      resultCards: result.resultCards || null
    };
    
    if (api.id) {
      const existing = await projectManager.loadAPIHistory(api.id);
      existing.unshift(historyEntry);
      if (existing.length > 100) existing.length = 100;
      await projectManager.saveAPIHistory(api.id, existing);
      setApiHistory(existing);
    }
  };

  // 渲染空状态 / 工作空间加载
  if (!hasProject) {
    return (
      <div className="app">
        <ToastContainer />
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? '切换到白昼模式' : '切换到暗黑模式'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <main className="app-main">
          {workspaceStatus !== 'idle' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <EmbeddedProgress
                status={workspaceStatus}
                current={workspaceProgress.current}
                total={workspaceProgress.total}
                message={
                  workspaceStatus === 'loading' ? '正在加载 API 配置...' :
                  workspaceStatus === 'issues' ? '加载完成，发现以下问题' :
                  workspaceStatus === 'error' ? workspaceError :
                  '加载完成'
                }
                issues={workspaceIssues}
                actions={
                  workspaceStatus === 'issues' ? [
                    { label: '忽略并进入项目', onClick: handleEnterProject, primary: true }
                  ] : workspaceStatus === 'error' ? [
                    { label: '重试', onClick: handleRetryWorkspace, primary: true }
                  ] : []
                }
              />
            </div>
          ) : (
            <EmptyState 
              onImportProject={handleImportProject}
              onNewProject={handleNewProject}
              projectList={projectList}
              onProjectSelect={handleProjectSelect}
            />
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

  return (
    <div className="app">
      <ToastContainer />
      <ProgressProvider>
      {/* 主内容区 */}
      <main className="app-main">
        <div className="content-area">
          {/* 左侧面板 - API 树 */}
          {showLeftPanel && (
            <div className="left-panel" style={{ width: leftPanelWidth }}>
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
                      checkDraftThen(() => {
                        setEditingAPI({ ...api });
                        setIsAddingAPI(false);
                        setSelectedAPI(api);
                        setViewMode('api_detail');
                      });
                    }}
                    onDelete={async (api) => {
                      // 逻辑删除：标记 deleted，UI 隐藏
                      await projectManager.softDeleteAPI(api.id);
                      if (selectedAPI?.id === api.id) {
                        setSelectedAPI(null);
                        setEditingAPI(null);
                        setIsAddingAPI(false);
                        // 显示撤销提示
                        setSaveMessage(`"${api.name}" 已删除 (可恢复)`);
                        setTimeout(() => setSaveMessage(''), 5000);
                      }
                      setTimeout(() => setSaveMessage(''), 5000);
                      setViewMode('api');
                    }}
                 />
              </div>
            </div>
          )}

          {/* 左侧调整手柄 */}
          {showLeftPanel && showCenterPanel && (
            <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'left')} />
          )}

          {/* 中间面板 - API 内容操作区 */}
          {showCenterPanel && (
            <div className="center-panel">
              {viewMode === 'history' ? (
                <ExecutionHistory 
                  history={apiHistory}
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
                  history={apiHistory}
                  restoringHistoryEntry={restoringHistoryEntry}
                  onRestored={() => setRestoringHistoryEntry(null)}
                  onSaveAPI={handleSaveAPI}
                  groups={projectManager.getGroups()}
                  isAdding={isAddingAPI}
                  isTemporary={temporaryAPI !== null}
                  onDraftChange={setDraftDirty}
                  onViewDetail={(entry) => setViewingHistoryEntry(entry)}
                  onRestoreHistory={handleRestoreFromHistory}
                  onDeleteHistory={handleDeleteHistory}
                  theme={theme}
                  onResultChange={handleResultChange}
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
          )}

          {/* 右侧调整手柄 */}
          {showCenterPanel && showRightPanel && (
            <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'right')} />
          )}

          {/* 右侧面板 - 响应/文档 */}
          {showRightPanel && (
            <div className="right-panel" style={{ width: rightPanelWidth }}>
              <ResponsePanel executionResult={currentExecutionResult} theme={theme} />
            </div>
          )}
        </div>

        {/* 底部栏 */}
        <BottomBar 
          currentProfile={currentProfile}
          allProfiles={projectData?.profile || []}
          onProfileSelect={handleProfileSelect}
          onEditVariables={() => {
            checkDraftThen(() => {
              setSelectedAPI(null);
              setViewMode('env_var_manager');
            });
          }}
          projectName={projectManager.getProjectName()}
          isDirty={isDirty}
          onSave={handleSaveProject}
          onCloseProject={handleCloseProject}
          toggleTheme={toggleTheme}
          theme={theme}
          isSaving={isSaving}
          onShowHistory={() => { checkDraftThen(() => setViewMode('history')); }}
          onBackToApi={() => setViewMode('api')}
          viewModeValue={viewMode}
          projectList={projectList}
          onProjectSelect={handleProjectSwitch}
          showLeftPanel={showLeftPanel}
          onToggleLeftPanel={toggleLeftPanel}
          showCenterPanel={showCenterPanel}
          onToggleCenterPanel={toggleCenterPanel}
          showRightPanel={showRightPanel}
          onToggleRightPanel={toggleRightPanel}
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
      </ProgressProvider>
    </div>
  );
}

export default App;