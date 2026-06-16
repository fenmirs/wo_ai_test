import React, { useState, useRef, useEffect } from 'react';
import { Globe, Variable, ChevronUp, Settings2, FolderKanban, Save, XCircle, Sun, Moon, Newspaper, LogOut, Bell, CheckCheck, Trash2, PanelLeft, Columns, PanelRight, Bug, FolderOpen, Plus, Pencil, Layers, Clock } from 'lucide-react';
import { notificationManager } from '../utils/NotificationManager';
import { projectManager } from '../utils/ProjectManager';
import './BottomBar.css';

function BottomBar({
  currentProfile,
  allProfiles,
  onProfileSelect,
  onEditVariables,
  onEditTemplates,
  viewModeValue,
  projectName,
  projectList,
  onProjectSelect,
  onAddProject,
  onRenameProject,
  onDeleteProject,
  isDirty,
  onShowHistory,
  onSave,
  onCloseProject,
  toggleTheme,
  theme,
  isSaving,
  onBackToApi,
  showLeftPanel,
  onToggleLeftPanel,
  showCenterPanel,
  onToggleCenterPanel,
  showRightPanel,
  onToggleRightPanel,
  zenMode,
  onToggleZenMode,
  requestTimeout,
  onRequestTimeoutChange
}) {
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showVariableDropdown, setShowVariableDropdown] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const projectDropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const notificationRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target)) {
        setShowProjectDropdown(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
        setShowVariableDropdown(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotificationPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 监听通知管理器变化
  useEffect(() => {
    const handleNotificationChange = ({ notifications: notifs, unreadCount: count }) => {
      setNotifications(notifs || []);
      setUnreadCount(count || 0);
    };

    notificationManager.addListener(handleNotificationChange);
    // 初始化
    setNotifications(notificationManager.getNotifications());
    setUnreadCount(notificationManager.getUnreadCount());

    return () => {
      notificationManager.removeListener(handleNotificationChange);
    };
  }, []);

  const markAsRead = (id) => {
    notificationManager.markAsRead(id);
  };

  const markAllAsRead = () => {
    notificationManager.markAllAsRead();
  };

  const deleteNotification = (id) => {
    notificationManager.deleteNotification(id);
  };

  // 恢复被删除的 API（预留，当前未使用）
  const restoreAPI = (notification) => {
    console.log('恢复功能预留，通知数据:', notification);
  };

  const getCurrentVariables = () => {
    if (!currentProfile) return {};
    const variables = {};
    Object.keys(currentProfile).forEach(key => {
      if (!['name', 'activate', 'domain'].includes(key)) {
        variables[key] = currentProfile[key];
      }
    });
    return variables;
  };

  const onProjectItemClick = (project) => {
    onProjectSelect(project);
    setShowProjectDropdown(false);
  };

  return (
    <div className="bottom-bar">
      <button
        className={`bar-btn ${viewModeValue === 'template_manager' ? 'active' : ''}`}
        onClick={onEditTemplates}
        title="管理参数模板"
      >
        <Layers size={14} />
      </button>

      <div className="bar-section" ref={projectDropdownRef}>
        <div
          className="bar-item project-name"
          onClick={() => { setShowProjectDropdown(!showProjectDropdown); setShowProfileDropdown(false); setShowVariableDropdown(false); }}
        >
          <FolderKanban size={16} />
          <span className="bar-label">{projectName || '未加载项目'}</span>
          <ChevronUp size={14} className={`chevron ${showProjectDropdown ? 'up' : ''}`} />
          {isDirty && <span className="dirty-dot" title="未保存" />}
        </div>

        {showProjectDropdown && (
          <div className="dropdown-menu project-menu">
            <div className="dropdown-header project-exit-header">
              <span>选择项目</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="bar-btn"
                  onClick={onAddProject}
                  title="新增项目"
                >
                  <Plus size={14} />
                </button>
                <button
                  className="bar-btn"
                  onClick={onRenameProject}
                  title="修改项目名称"
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="bar-btn"
                  onClick={onDeleteProject}
                  title="删除项目"
                  style={{ color: 'var(--error-color)' }}
                >
                  <Trash2 size={14} />
                </button>
                <button
                  className="bar-btn"
                  onClick={onCloseProject}
                  title="退出"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
            {!projectList || projectList.length === 0 ? (
              <div className="dropdown-empty">
                <p>暂无项目</p>
              </div>
            ) : (
              projectList.map((project, index) => (
                <div
                  key={project.id || project.path || `project-${index}`}
                  className={`dropdown-item ${projectName === project.name ? 'active' : ''}`}
                  onClick={() => onProjectItemClick(project)}>
                  <div className="dropdown-item-main">
                    <span className="dropdown-item-name">{project.name}</span>
                  </div>
                  <span className="dropdown-item-sub" title={(project.dirPath || project.path) + '/' + project.id}>{(project.dirPath || project.path) + '/' + project.id}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="bar-section" ref={profileDropdownRef}>
        <div
          className="bar-item"
          onClick={() => { setShowProfileDropdown(!showProfileDropdown); setShowVariableDropdown(false); }}
        >
          <Globe size={16} />
          <span className="bar-label">{currentProfile?.name || '未选择环境'}</span>
          <ChevronUp size={14} className={`chevron ${showProfileDropdown ? 'up' : ''}`} />
        </div>

        {showProfileDropdown && (
          <div className="dropdown-menu">
            <div className="dropdown-header">选择环境</div>
            {!allProfiles || allProfiles.length === 0 ? (
              <div className="dropdown-empty">
                <p>暂无环境配置</p>
              </div>
            ) : (
              allProfiles.map(profile => (
                <div
                  key={profile.name}
                  className={`dropdown-item ${currentProfile?.name === profile.name ? 'active' : ''}`}
                  onClick={() => {
                    onProfileSelect(profile);
                    setShowProfileDropdown(false);
                    setShowVariableDropdown(false);
                    setShowProjectDropdown(false);
                  }}
                >
                  <div className="dropdown-item-main">
                    <span className="dropdown-item-name">{profile.name}</span>
                    {profile.activate && <span className="badge default">默认</span>}
                  </div>
                  <span className="dropdown-item-sub">{profile.domain}</span>
                </div>
              ))
            )}
          </div>
        )}

        <div
          className="bar-item"
          onClick={() => { setShowVariableDropdown(!showVariableDropdown); setShowProfileDropdown(false); }}
        >
          <Variable size={16} />
          <span className="bar-label">变量</span>
          <ChevronUp size={14} className={`chevron ${showVariableDropdown ? 'up' : ''}`} />
        </div>
        <button
          className={`bar-btn ${viewModeValue === 'env_var_manager' ? 'active' : ''}`}
          onClick={onEditVariables}
          title="管理环境和变量"
        >
          <Settings2 size={14} />
        </button>
        <div className="bar-separator"></div>

        {/* 超时控制 */}
        <div className="bar-item timeout-item" title="请求超时时间（毫秒）">
          <Clock size={14} />
          <input
            className="timeout-input"
            type="number"
            min={1000}
            max={300000}
            step={1000}
            value={requestTimeout}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 100) onRequestTimeoutChange(v);
            }}
          />
          <span className="timeout-unit">ms</span>
        </div>

        {showVariableDropdown && (
          <div className="dropdown-menu variable-menu">
            <div className="dropdown-header">当前环境变量</div>
            {Object.keys(getCurrentVariables()).length === 0 ? (
              <div className="dropdown-empty">暂无变量</div>
            ) : (
              Object.entries(getCurrentVariables()).map(([key, value]) => (
                <div key={key} className="variable-item">
                  <span className="variable-key">{key}</span>
                  <span className="variable-value">{value}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <button
        className={`bar-btn ${viewModeValue === 'history' ? 'active' : ''}`}
        onClick={onShowHistory}
        title="执行历史"
      >
          <Newspaper size={14} />
        {/* <span>执行历史</span> */}
      </button>

      <div className="bar-section" ref={notificationRef} style={{ marginLeft: 'auto' }}>
        {/* <button
          className="bar-btn"
          onClick={onSave}
          disabled={!isDirty || isSaving}
          title="保存配置"
        >
          <Save size={14} />
        </button> */}
        

      {/* 面板显隐切换 */}
      <button
        className={`bar-btn panel-toggle ${showLeftPanel ? 'active' : ''}`}
        onClick={onToggleLeftPanel}
        title={showLeftPanel ? '隐藏目录树' : '显示目录树'}
      >
        <PanelLeft size={13} />
      </button>
      {/* <button
        className={`bar-btn panel-toggle ${showCenterPanel ? 'active' : ''}`}
        onClick={onToggleCenterPanel}
        title={showCenterPanel ? '隐藏请求编辑区' : '显示请求编辑区'}
      >
        <Columns size={13} />
      </button> */}
      <button
        className={`bar-btn panel-toggle ${showRightPanel ? 'active' : ''}`}
        onClick={onToggleRightPanel}
        title={showRightPanel ? '隐藏响应面板' : '显示响应面板'}
      >
        <PanelRight size={13} />
      </button>

      <div className="bar-separator"></div>
        <button
          className={`bar-btn ${zenMode ? 'active' : ''}`}
          onClick={onToggleZenMode}
          title={zenMode ? '退出专注模式' : '专注模式'}
        >
          <Layers size={14} />
        </button>
      <div className="bar-separator"></div>
        <button
          className="bar-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? '切换到白昼模式' : '切换到暗黑模式'}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <button
          className="bar-btn"
          onClick={() => setShowNotificationPanel(!showNotificationPanel)}
          title="通知"
        >
          <Bell size={14} />
          {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
        </button>
        <button
          className="bar-btn"
          onClick={() => window.electron?.toggleDevtools()}
          title="开发者工具"
        >
          <Bug size={14} />
        </button>
          {showNotificationPanel && (
          <div className="notification-panel">
            <div className="notification-header">
              <span>通知</span>
              <button className="notification-action-btn" onClick={markAllAsRead} title="全部标为已读">
                <CheckCheck size={14} />
              </button>
            </div>
            <div className="notification-list">
              {notifications.length === 0 ? (
                <div className="notification-empty">暂无通知</div>
              ) : (
                notifications
                  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                  .map(notification => (
                    <div
                      key={notification.id}
                      className={`notification-item ${!notification.read ? 'unread' : ''}`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="notification-content">
                        <div className="notification-title-row">
                          <div className="notification-title">
                            {notification.title}
                            {!notification.read && <span className="unread-dot"></span>}
                          </div>
                          <div className="notification-actions">
                            {notification.data?.filePath && (
                              <button
                                className="notification-open-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.electron?.showItemInFolder(notification.data.filePath);
                                }}
                                title="在文件管理器中显示"
                              >
                                <FolderOpen size={12} />
                              </button>
                            )}
                            <button
                              className="notification-delete-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                              title="删除"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <div className="notification-message">{notification.message}</div>
                        <div className="notification-time">{notification.timestamp}</div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default BottomBar;
