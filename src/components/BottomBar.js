import React, { useState, useRef, useEffect } from 'react';
import { Globe, Variable, ChevronUp, Settings2,FolderKanban, Save, XCircle, Sun, Moon, History,LogOut, Bell, CheckCheck, Trash2 } from 'lucide-react';
import './BottomBar.css';

function BottomBar({
  currentProfile,
  allProfiles,
  onProfileSelect,
  onEditVariables,
  viewModeValue,
  projectName,
  projectList,
  onProjectSelect,
  isDirty,
  onShowHistory,
  onSave,
  onCloseProject,
  toggleTheme,
  theme,
  isSaving,
  onBackToApi
}) {
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showVariableDropdown, setShowVariableDropdown] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'system', title: '欢迎使用', message: 'API 测试工具已准备就绪', timestamp: new Date().toLocaleString('zh-CN'), read: false },
    { id: 2, type: 'system', title: '项目加载成功', message: '项目数据已成功加载', timestamp: new Date(Date.now() - 3600000).toLocaleString('zh-CN'), read: true },
    { id: 3, type: 'system', title: '自动保存', message: '项目配置已自动保存', timestamp: new Date(Date.now() - 7200000).toLocaleString('zh-CN'), read: false }
  ]);
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

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const addNotification = (type, title, message) => {
    const newNotification = {
      id: Date.now(),
      type,
      title,
      message,
      timestamp: new Date().toLocaleString('zh-CN'),
      read: false
    };
    setNotifications(prev => [newNotification, ...prev]);
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
              <button
                className="bar-btn"
                onClick={onCloseProject}
                title="退出"
              >
                <LogOut size={14} />
              </button>
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
                  <span className="dropdown-item-sub" title={project.dirPath || project.path}>{project.dirPath || project.path}</span>
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
        <History size={14} />
        {/* <span>执行历史</span> */}
      </button>

      <div className="bar-section" ref={notificationRef}>
        <button
          className="bar-btn"
          onClick={() => setShowNotificationPanel(!showNotificationPanel)}
          title="通知"
        >
          <Bell size={14} />
          {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
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
                        <div className="notification-title">
                          {notification.title}
                          {!notification.read && <span className="unread-dot"></span>}
                        </div>
                        <div className="notification-message">{notification.message}</div>
                        <div className="notification-time">{notification.timestamp}</div>
                      </div>
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
                  ))
              )}
            </div>
          </div>
        )}
      </div>
      <div className="bar-section" style={{ marginLeft: 'auto' }}>
        {/* <button
          className="bar-btn"
          onClick={onSave}
          disabled={!isDirty || isSaving}
          title="保存配置"
        >
          <Save size={14} />
        </button> */}
        {/* <button
          className="bar-btn"
          onClick={onCloseProject}
          title="关闭项目"
        >
          <XCircle size={14} />
        </button> */}
        <button
          className="bar-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? '切换到白昼模式' : '切换到暗黑模式'}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      {!window.electron && (
        <div className="proxy-status">
          <span className="proxy-indicator" title="开发模式下使用代理服务器转发请求"></span>
          <span>开发模式</span>
        </div>
      )}
    </div>
  );
}

export default BottomBar;
