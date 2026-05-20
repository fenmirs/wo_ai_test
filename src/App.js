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
import { toast, ToastContainer } from './components/Toast';
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
  const [currentScenarioId, setCurrentScenarioId] = useState(null);
  const [requestedScenarioId, setRequestedScenarioId] = useState(null);
  const [requestedScenarioAction, setRequestedScenarioAction] = useState(null);
  const [expandScenarioApiId, setExpandScenarioApiId] = useState(null);
  const [scrollToApiId, setScrollToApiId] = useState(null);
  const [expandGroupId, setExpandGroupId] = useState(null);
  const [zenMode, setZenMode] = useState(false);
  const [restoringHistoryEntry, setRestoringHistoryEntry] = useState(null);
  const [viewingHistoryEntry, setViewingHistoryEntry] = useState(null);
  const [projectList, setProjectList] = useState([]);
  const [currentProjectDir, setCurrentProjectDir] = useState(null);

  // 工作空间加载状态
  const [workspaceStatus, setWorkspaceStatus] = useState('idle'); // idle | loading | issues | done | error
  const [workspaceProgress, setWorkspaceProgress] = useState({ current: 0, total: 0 });
  const [workspaceIssues, setWorkspaceIssues] = useState([]);
  const [workspaceError, setWorkspaceError] = useState('');
  
  // 刷新触发器（用于强制 re-render 使 projectData 刷新）
  const [refreshKey, setRefreshKey] = useState(0);
  
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
  const [draftDirty, setDraftDirty] = useState(false);
  const checkDraftThen = useCallback((action) => {
    if (draftDirty) {
      setConfirmDialogConfig({
        title: '丢弃草稿',
        message: '当前 API 尚未保存，确定要丢弃所有更改吗？',
        options: [],
        onConfirm: () => {
          setShowConfirmDialog(false);
          setDraftDirty(false);
          action();
        },
        onCancel: () => setShowConfirmDialog(false)
      });
      setShowConfirmDialog(true);
    } else {
      action();
    }
  }, [draftDirty]);
  
  // 输入对话框状态
  const [showInputDialog, setShowInputDialog] = useState(false);
  const [inputDialogConfig, setInputDialogConfig] = useState({
    title: '',
    placeholder: '',
    defaultValue: '',
    onConfirm: null
  });
  const [deleteConfirmValue, setDeleteConfirmValue] = useState('');
  const [deleteProjectName, setDeleteProjectName] = useState('');
  const [dialogError, setDialogError] = useState('');
  
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

  // 对话框关闭时重置删除确认状态
  useEffect(() => {
    if (!showInputDialog) {
      setDeleteProjectName('');
      setDeleteConfirmValue('');
    }
  }, [showInputDialog]);

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

  // 导入空间（扫描目录下所有项目）
  const handleImportProject = useCallback(async () => {
    const result = await window.electron.selectDirectory();
    if (result.success) {
      const projects = await projectManager.scanDirectory(result.path);
      setProjectList(projects);
      
      if (projects.length > 0) {
        setSaveMessage('项目扫描成功');
        setTimeout(() => setSaveMessage(''), 2000);
        handleProjectSelect(projects[0]);
      } else {
        setInputDialogConfig({
          title: '新建项目',
          placeholder: '请输入项目名称',
          defaultValue: '',
          onConfirm: async (projectName) => {
            const createResult = await projectManager.createProject(result.path, projectName);
            if (!createResult.success) {
              alert(`创建项目失败: ${createResult.error}`);
              return;
            }

            const loadResult = await projectManager.loadProject(result.path, createResult.project.projectId);
            if (!loadResult.success) {
              alert(`加载项目失败: ${loadResult.error || createResult.error}`);
              return;
            }

            const updatedProjects = await projectManager.getDirProjects();
            setProjectList(updatedProjects);
            setCurrentProjectDir(result.path);

            setSaveMessage('新项目创建成功');
            setTimeout(() => setSaveMessage(''), 2000);
          },
          onCancel: () => {}
        });
        setShowInputDialog(true);
      }
    }
  }, [handleProjectSelect]);

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

  // 底部栏新增项目（增量添加到当前工作空间）
  const handleAddProject = useCallback(async () => {
    if (!currentProjectDir) return;
    setDialogError('');
    setInputDialogConfig({
      title: '新增项目',
      placeholder: '请输入项目名称',
      defaultValue: '',
      onValueChange: () => setDialogError(''),
      onConfirm: async (projectName) => {
        const existing = projectManager.getDirProjects().find(p => p.name === projectName);
        if (existing) {
          setDialogError(`项目名称 "${projectName}" 已存在，请使用其他名称`);
          return false;
        }
        const result = await projectManager.addProjectToWorkspace(currentProjectDir, projectName);
        if (!result.success) {
          alert(`创建项目失败: ${result.error}`);
          return;
        }

        const projects = await projectManager.getDirProjects();
        setProjectList(projects);

        // 自动切换到新项目（handleProjectSwitch 会检查脏状态）
        const newProject = projects.find(p => p.id === result.project.projectId);
        if (newProject) {
          handleProjectSwitch(newProject);
        }

        setSaveMessage('新项目创建成功');
        setTimeout(() => setSaveMessage(''), 2000);
      },
      onCancel: () => {}
    });
    setShowInputDialog(true);
  }, [currentProjectDir, handleProjectSwitch]);

  // 修改当前项目名称
  const handleRenameProject = useCallback(async () => {
    const activeProject = projectManager._activeProject;
    if (!activeProject || !activeProject.projectName) return;
    setDialogError('');
    setInputDialogConfig({
      title: '修改项目名称',
      placeholder: '请输入新的项目名称',
      defaultValue: activeProject.projectName,
      onValueChange: () => setDialogError(''),
      onConfirm: async (newName) => {
        if (newName === activeProject.projectName) return;
        const existing = projectManager.getDirProjects().find(p => p.name === newName && p.id !== activeProject.id);
        if (existing) {
          setDialogError(`项目名称 "${newName}" 已存在，请使用其他名称`);
          return false;
        }

        activeProject.projectName = newName;
        activeProject.config.projectName = newName;
        projectManager.markDirty();
        await projectManager.saveProject();

        // 重新扫描目录以刷新项目列表（dirProjects 在初始扫描后是静态的）
        await projectManager.scanDirectory(projectManager.dirPath);
        const projects = projectManager.getDirProjects();
        setProjectList(projects);

        setSaveMessage('项目名称已修改');
        setTimeout(() => setSaveMessage(''), 2000);
      },
      onCancel: () => {}
    });
    setShowInputDialog(true);
  }, []);

  // 删除项目（需输入项目名称确认）
  const handleDeleteProject = useCallback(() => {
    const activeProject = projectManager._activeProject;
    if (!activeProject || !activeProject.projectName) return;
    const targetId = projectManager.activeProjectId;
    const projectName = activeProject.projectName;

    setDeleteProjectName(projectName);
    setDeleteConfirmValue('');

    setInputDialogConfig({
      title: `删除项目 "${projectName}"`,
      placeholder: '请输入项目名称以确认删除',
      defaultValue: '',
      onConfirm: async () => {
        // 从磁盘删除
        await window.electron.deleteProject(currentProjectDir, targetId);

        // 从缓存移除
        delete projectManager.projects[targetId];

        // 重新扫描目录以刷新项目列表
        await projectManager.scanDirectory(currentProjectDir);
        const projects = projectManager.getDirProjects();
        setProjectList(projects);

        // 如果删除的是当前活跃项目，切换到其他项目或退出
        if (targetId === projectManager.activeProjectId) {
          const remaining = Object.keys(projectManager.projects);
          if (remaining.length > 0) {
            projectManager.switchProject(remaining[0]);
            setApiHistory([]);
            setSelectedAPI(null);
            setEditingAPI(null);
            setTemporaryAPI(null);
            setViewMode('api');
          } else {
            projectManager.clear();
            setHasProject(false);
            setCurrentProfile(null);
          }
        }

        setSaveMessage(`项目 "${projectName}" 已删除`);
        setTimeout(() => setSaveMessage(''), 2000);
      },
      onCancel: () => {},
      onValueChange: setDeleteConfirmValue,
      confirmLabel: '删除'
    });
    setShowInputDialog(true);
  }, [currentProjectDir]);

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

        // 更新项目列表和当前项目目录
        const projects = await projectManager.getDirProjects();
        setProjectList(projects);
        setCurrentProjectDir(dirResult.path);
        
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
      setViewMode('api');
    });
  }, [isDirty, draftDirty]);

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
    return new Promise((resolve) => {
      checkDraftThen(async () => {
        let fullData = api;
        if (api.id) {
          const loaded = await projectManager.loadAPIData(api.id);
          if (loaded) fullData = loaded;
        }
        const hist = projectManager._apiHistoryCache[api.id] || await projectManager.loadAPIHistory(api.id);
        setSelectedAPI(fullData);
        setApiHistory(hist || []);
        const groupId = fullData.group || null;
        setActiveGroup(groupId);
        setEditingAPI(null);
        setTemporaryAPI(null);
        setRestoringHistoryEntry(null);
        setViewMode('api_detail');
        setTimeout(resolve, 0);
      });
    });
  };

  // 选择分组（仅切换激活分组，不自动选中 API）
  const handleGroupSelect = (groupId) => {
    setActiveGroup(groupId);
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

  // 场景选择（从 API 树中的场景项点击）
  const handleScenarioSelect = (api, scenarioId) => {
    if (api?.id) {
      handleAPISelect(api);
      setRequestedScenarioId(scenarioId);
    }
  };

  // 添加场景（从 API 树操作菜单触发）
  const handleAddScenario = async (api) => {
    if (!api?.id) return;
    await handleAPISelect(api);
    setExpandScenarioApiId(api.id);
    setRequestedScenarioAction({ type: 'add', ts: Date.now() });
  };

  const handleExpandScenarioApiHandled = useCallback(() => {
    setExpandScenarioApiId(null);
  }, []);

  // 删除场景（从 API 树场景项触发）
  const handleDeleteScenario = async (apiId, scenarioId) => {
    if (!apiId || !scenarioId) return;
    const config = projectManager._apiDataCache[apiId];
    if (config?.scenarios && Object.keys(config.scenarios).length > 1) {
      const scnName = config.scenarios[scenarioId]?.name || scenarioId;
      delete config.scenarios[scenarioId];
      projectManager.markDirty();
      if (selectedAPI?.id === apiId) {
        setRequestedScenarioAction({ type: 'delete', scenarioId, ts: Date.now() });
      }
      toast.success(`场景 "${scnName}" 已删除`);
    } else {
      toast.warning('至少保留一个场景');
    }
  };

  // 场景切换通知（来自 APIDetail）
  const handleScenarioChange = (apiId, scenarioId) => {
    setCurrentScenarioId(scenarioId);
  };

  // 专注模式切换
  const handleToggleZenMode = () => {
    setZenMode(prev => !prev);
  };

  // 添加分组
  const handleAddGroup = (parentId = null) => {
    setInputDialogConfig({
      title: parentId ? '添加子分组' : '添加分组',
      placeholder: '请输入分组名称',
      defaultValue: '',
      onConfirm: async (groupName) => {
        if (groupName === '回收站') {
          toast.warning('"回收站" 是保留分组名称，不能使用');
          return;
        }
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

    // 重名检查：目标父级下是否有同名分组
    const group = projectData.groups?.find(g => g.id === groupId);
    if (group) {
      const uniqueName = projectManager.ensureUniqueGroupName(group.name, newParentId, groupId);
      if (uniqueName !== group.name) {
        projectManager.updateGroup(groupId, { name: uniqueName });
        toast.success(`目标位置已存在同名分组，已自动重命名为 "${uniqueName}"`);
      }
    }
    
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

    // 如果名称没有变化，直接返回
    if (newName === currentGroup.name) return;

    // 不能使用保留名称
    if (newName === '默认') {
      toast.warning('"默认" 是保留分组名称，不能使用');
      return;
    }
    if (newName === '回收站') {
      toast.warning('"回收站" 是保留分组名称，不能使用');
      return;
    }

    // 重名检查：同父级下拒绝重名
    const parentId = currentGroup.parentId;
    const duplicate = projectData.groups?.find(g =>
      g.name === newName && g.parentId === parentId && g.id !== groupId
    );
    if (duplicate) {
      toast.error(`同级下已存在名为 "${newName}" 的分组`);
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
      const newGroup = projectManager.getData().groups?.find(g => g.name === newGroupId);
      if (newGroup) {
        newGroupId = newGroup.id;
      }
    }

    // 如果 API 已删除（从回收站拖出），先恢复
    const api = projectData.apis?.find(a => a.id === apiId);
    if (api?.deleted) {
      projectManager.restoreAPI(apiId);
    }
    
    // 重名检查：同分组内自动追加后缀
    const uniqueName = projectManager.ensureUniqueAPIName(api?.name || '', newGroupId, apiId);
    
    // 更新 API 的分组和名称
    projectManager.updateAPI(apiId, { group: newGroupId, name: uniqueName });
    
    if (uniqueName !== (api?.name || '')) {
      toast.success(`目标分组下已存在同名 API，已自动重命名为 "${uniqueName}"`);
    }
    
    // 如果移动的是当前选中的 API，更新选中状态
    if (selectedAPI?.id === apiId) {
      setSelectedAPI({ ...selectedAPI, group: newGroupId, name: uniqueName });
    }
    
    setSaveMessage(`已将 API 移动到新分组`);
    setTimeout(() => setSaveMessage(''), 2000);
  };

  // 恢复已删除 API
  const handleRestoreAPI = async (apiId) => {
    await projectManager.restoreAPI(apiId);
    if (selectedAPI?.id === apiId) {
      const restored = await projectManager.loadAPIData(apiId);
      setSelectedAPI(restored);
    }
    setRefreshKey(k => k + 1);
    toast.success('API 已恢复');
  };

  // 彻底删除 API
  const handlePermanentDelete = async (apiId) => {
    const api = projectData.apis?.find(a => a.id === apiId);
    await projectManager.deleteAPI(apiId);
    if (selectedAPI?.id === apiId) {
      setSelectedAPI(null);
      setEditingAPI(null);
      setViewMode('api');
    }
    toast.success(`"${api?.name || apiId}" 已永久删除`);
    setRefreshKey(k => k + 1);
  };

  // 恢复已删除分组（及其下所有 API）
  const handleRestoreGroup = (groupId) => {
    projectManager.restoreGroup(groupId);
    setRefreshKey(k => k + 1);
    toast.success('分组及下属 API 已恢复');
  };

  // 永久删除已删除分组（及其下所有 API）
  const handlePermanentDeleteGroup = (groupId) => {
    projectManager.deleteGroup(groupId);
    setRefreshKey(k => k + 1);
    toast.success('分组及下属 API 已永久删除');
  };

  // 清空回收站
  const handleEmptyTrash = async () => {
    projectManager.emptyTrash();
    if (selectedAPI && projectData.apis?.find(a => a.id === selectedAPI.id) === undefined) {
      setSelectedAPI(null);
      setEditingAPI(null);
      setViewMode('api');
    }
    setRefreshKey(k => k + 1);
    toast.success('回收站已清空');
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
      }
    });
  };

  // 保存 API 编辑（v2：per-API 文件）
  const handleSaveAPI = async (formData) => {
    if (!formData) return;
    
    const isTemporary = temporaryAPI !== null;
    console.log('[App.handleSaveAPI] isTemporary:', isTemporary, 'formData.id:', formData.id, 'formData.name:', formData.name, 'selectedAPI.id:', selectedAPI?.id);
    
    if (isTemporary) {
      console.log('[App.handleSaveAPI] BRANCH: addAPI');
      const uniqueName = projectManager.ensureUniqueAPIName(formData.name, formData.group);
      if (uniqueName !== formData.name) {
        toast.success(`当前分组下已存在同名 API，已自动重命名为 "${uniqueName}"`);
        formData.name = uniqueName;
      }
      if (!formData.id) {
        formData.id = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      await projectManager.addAPI(formData);
      console.log('[App.handleSaveAPI] addAPI done, new id:', formData.id);
      setSelectedAPI(formData);
      setTemporaryAPI(null);
    } else {
      console.log('[App.handleSaveAPI] BRANCH: updateAPI');
      if (formData.id !== selectedAPI.id) {
        console.log('[App.handleSaveAPI] ID MISMATCH!', formData.id, 'vs', selectedAPI.id);
        throw new Error('API ID 不匹配');
      }
      // 重名检查：API 重命名时拒绝操作
      if (formData.name !== selectedAPI.name) {
        const exists = projectData.apis?.some(a =>
          a.name === formData.name && a.group === formData.group && !a.deleted && a.id !== formData.id
        );
        if (exists) {
          toast.error(`当前分组下已存在名为 "${formData.name}" 的 API`);
          return;
        }
      }
      await projectManager.updateAPI(formData.id, formData);
      console.log('[App.handleSaveAPI] updateAPI done');
      setSelectedAPI(formData);
    }
    setEditingAPI(null);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingAPI(null);
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
          onValueChange={inputDialogConfig.onValueChange}
          confirmDisabled={deleteProjectName ? deleteConfirmValue !== deleteProjectName : inputDialogConfig.confirmDisabled}
          confirmLabel={inputDialogConfig.confirmLabel}
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
                      const uniqueName = projectManager.ensureUniqueAPIName('未命名的API', parentId || 'default');
                      const id = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                      const newApi = {
                        id,
                        name: uniqueName,
                        group: parentId || 'default',
                        api_path: '{domain}',
                        method: 'GET',
                        header: {},
                        param: {},
                        body: {},
                        chain: [],
                        successAssert: ''
                      };
                      if (uniqueName !== '未命名的API') {
                        toast.success(`当前分组下已存在同名 API，已自动重命名为 "${uniqueName}"`);
                      }
                      projectManager.addAPI(newApi);
                      setActiveGroup(parentId || 'default');
                      setExpandGroupId(parentId || 'default');
                      setSelectedAPI(newApi);
                      setScrollToApiId(newApi.id);
                      setViewMode('api_detail');
                    }}
                   onAddGroup={handleAddGroup}
                    onDeleteGroup={(groupId) => {
                       const group = projectData.groups?.find(g => g.id === groupId);
                       if (!group) return;
                       const childGroupIds = projectManager._getChildGroupIds(groupId);
                       const allGroupIds = [groupId, ...childGroupIds];
                       const apisInGroups = (projectData.apis || []).filter(api =>
                         !api.deleted && allGroupIds.includes(api.group)
                       );

                       if (apisInGroups.length === 0) {
                         projectManager.deleteGroup(groupId);
                         if (activeGroup === groupId || childGroupIds.includes(activeGroup)) {
                           setActiveGroup('default');
                         }
                         setRefreshKey(k => k + 1);
                         toast.success(`分组 "${group.name}" 已删除`);
                       } else {
                         setInputDialogConfig({
                           title: `确认删除分组 "${group.name}"`,
                           description: `该分组及其子分组下共有 ${apisInGroups.length} 个 API 将被移至回收站。请输入分组名称 "${group.name}" 以确认删除：`,
                           placeholder: '请输入分组名称',
                           defaultValue: '',
                           confirmLabel: '确认删除',
                           onConfirm: (input) => {
                             if (input !== group.name) {
                               toast.error(`请输入正确的分组名称 "${group.name}" 以确认删除`);
                               return false;
                             }
                             projectManager.softDeleteGroup(groupId);
                             if (activeGroup === groupId || childGroupIds.includes(activeGroup)) {
                               setActiveGroup('default');
                             }
                             setRefreshKey(k => k + 1);
                             toast.success(`分组 "${group.name}" 及其 API 已移至回收站`);
                             return true;
                           },
                           onCancel: () => {
                             setShowInputDialog(false);
                           }
                         });
                         setShowInputDialog(true);
                       }
                    }}
                    onEdit={(api) => {
                       checkDraftThen(() => {
                         setEditingAPI({ ...api });
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
                       }
                       setViewMode('api');
                       toast.success(`"${api.name}" 已删除`);
                     }}
                    onScenarioSelect={handleScenarioSelect}
                    onAddScenario={handleAddScenario}
                    onDeleteScenario={handleDeleteScenario}
                    zenMode={zenMode}
                    zenApiId={selectedAPI?.id}
                    currentScenarioId={currentScenarioId}
                    expandScenarioApiId={expandScenarioApiId}
                    onExpandScenarioHandled={handleExpandScenarioApiHandled}
                    scrollToApiId={scrollToApiId}
                    onScrollToApiHandled={() => setScrollToApiId(null)}
                    expandGroupId={expandGroupId}
                    onExpandGroupHandled={() => setExpandGroupId(null)}
                    profile={currentProfile}
                    onRestoreAPI={handleRestoreAPI}
                    onPermanentDelete={handlePermanentDelete}
                    onEmptyTrash={handleEmptyTrash}
                    onRestoreGroup={handleRestoreGroup}
                    onPermanentDeleteGroup={handlePermanentDeleteGroup}
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
                  isTemporary={temporaryAPI !== null}
                  readOnly={!temporaryAPI && projectData?.apis?.find(a => a.id === selectedAPI?.id)?.deleted}
                  onDraftChange={setDraftDirty}
                  onViewDetail={(entry) => setViewingHistoryEntry(entry)}
                  onRestoreHistory={handleRestoreFromHistory}
                  onDeleteHistory={handleDeleteHistory}
                  theme={theme}
                  onResultChange={handleResultChange}
                  requestedScenarioId={requestedScenarioId}
                  requestedScenarioAction={requestedScenarioAction}
                  onScenarioChange={handleScenarioChange}
                   onRequestedScenarioActionHandled={() => setRequestedScenarioAction(null)}
                   onRequestedScenarioHandled={() => setRequestedScenarioId(null)}
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
          onAddProject={handleAddProject}
          onRenameProject={handleRenameProject}
          onDeleteProject={handleDeleteProject}
          showLeftPanel={showLeftPanel}
          onToggleLeftPanel={toggleLeftPanel}
          showCenterPanel={showCenterPanel}
          onToggleCenterPanel={toggleCenterPanel}
          showRightPanel={showRightPanel}
          onToggleRightPanel={toggleRightPanel}
          zenMode={zenMode}
          onToggleZenMode={handleToggleZenMode}
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
        onValueChange={inputDialogConfig.onValueChange}
        confirmDisabled={deleteProjectName ? deleteConfirmValue !== deleteProjectName : inputDialogConfig.confirmDisabled}
        confirmLabel={inputDialogConfig.confirmLabel}
        error={dialogError}
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