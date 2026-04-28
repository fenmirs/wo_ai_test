import React, { useState, useRef, useEffect } from 'react';
import { Search, Folder, FolderOpen, Plus, Trash2, Edit2, FolderPlus } from 'lucide-react';
import './APIMain.css';

function APIMain({ apis, groupsData, selectedAPI, activeGroup, onSelect, onAdd, onEdit, onDelete, onAddGroup, onDeleteGroup, onGroupSelect, onMoveToGroup, onRenameGroup }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [dragAPI, setDragAPI] = useState(null);
  const [dragOverGroup, setDragOverGroup] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const addMenuRef = useRef(null);
  const editInputRef = useRef(null);

  const currentActiveGroup = activeGroup || '默认';

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target)) {
        setShowAddMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 编辑分组时自动聚焦
  useEffect(() => {
    if (editingGroup && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingGroup]);

  // 处理分组名编辑完成
  const handleGroupRename = (oldName) => {
    const trimmed = newGroupName.trim();
    if (trimmed && trimmed !== oldName && onRenameGroup) {
      onRenameGroup(oldName, trimmed);
    }
    setEditingGroup(null);
    setNewGroupName('');
  };

  // 获取所有分组
  const getGroups = () => {
    const groups = new Set(['默认']);
    apis?.forEach(api => {
      if (api.group && api.group !== '默认') {
        groups.add(api.group);
      }
    });
    // 如果有额外的分组数据
    if (groupsData && groupsData.length > 0) {
      groupsData.forEach(g => groups.add(g));
    }
    return Array.from(groups);
  };

  // 获取分组中的 API
  const getAPIsInGroup = (groupName) => {
    return apis?.filter(api => {
      if (groupName === '默认') {
        return !api.group || api.group === '默认';
      }
      return api.group === groupName;
    }) || [];
  };

  // 切换分组展开/折叠
  const toggleGroup = (groupName) => {
    if (onGroupSelect) {
      onGroupSelect(groupName);
    }
  };

  // 拖拽处理
  const handleDragStart = (e, api) => {
    setDragAPI(api);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', api.name);
    
    // 创建自定义拖拽预览，只显示 API 名称
    const dragPreview = document.createElement('div');
    dragPreview.className = 'drag-preview';
    dragPreview.textContent = api.name;
    dragPreview.style.cssText = `
      position: fixed;
      top: -100px;
      left: -100px;
      padding: 6px 12px;
      background: var(--bg-secondary, #2d2d2d);
      color: var(--text-primary, #ffffff);
      border: 1px solid var(--accent-primary, #3b82f6);
      border-radius: 4px;
      font-size: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 9999;
      pointer-events: none;
      white-space: nowrap;
    `;
    document.body.appendChild(dragPreview);
    e.dataTransfer.setDragImage(dragPreview, 0, 0);
    
    // 拖拽结束后移除预览元素
    setTimeout(() => {
      if (dragPreview.parentNode) {
        dragPreview.parentNode.removeChild(dragPreview);
      }
    }, 0);
  };

  const handleDragOver = (e, groupName) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverGroup !== groupName) {
      setDragOverGroup(groupName);
    }
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverGroup(null);
    }
  };

  const handleDrop = (e, targetGroup) => {
    e.preventDefault();
    setDragOverGroup(null);
    if (dragAPI && dragAPI.group !== targetGroup && onMoveToGroup) {
      onMoveToGroup(dragAPI.name, targetGroup);
      setDragAPI(null);
    }
  };

  const handleDragEnd = () => {
    setDragAPI(null);
    setDragOverGroup(null);
  };

  // 搜索过滤
  const getFilteredAPIs = (groupName) => {
    const groupAPIs = getAPIsInGroup(groupName);
    if (!searchQuery) return groupAPIs;
    
    const lowerQuery = searchQuery.toLowerCase();
    return groupAPIs.filter(api => {
      const name = api.name.toLowerCase();
      return name.includes(lowerQuery) || 
             api.api_path.toLowerCase().includes(lowerQuery);
    });
  };

  // 获取方法颜色
  const getMethodColor = (method) => {
    const colors = {
      GET: '#10b981',
      POST: '#3b82f6',
      PUT: '#f59e0b',
      DELETE: '#ef4444',
      PATCH: '#8b5cf6'
    };
    return colors[method] || '#6b7280';
  };

  return (
    <div className="api-main">
      {/* 搜索框和新增按钮 */}
      <div className="search-bar">
        <div className="search-box">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            placeholder="搜索 API..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        {(onAdd || onAddGroup) && (
          <div className="add-menu-container" ref={addMenuRef}>
            <button 
              className="add-api-btn" 
              onClick={() => setShowAddMenu(!showAddMenu)}
              title="新增"
            >
              <Plus size={14} />
            </button>
            {showAddMenu && (
              <div className="add-dropdown">
                {onAdd && (
                  <div className="dropdown-item" onClick={() => { onAdd(); setShowAddMenu(false); }}>
                    <Plus size={14} />
                    <span>API</span>
                  </div>
                )}
                {onAddGroup && (
                  <div className="dropdown-item" onClick={() => { onAddGroup(); setShowAddMenu(false); }}>
                    <FolderPlus size={14} />
                    <span>分组</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* API 列表 */}
      <div className="api-list">
        {getGroups().map(groupName => {
          const filteredAPIs = getFilteredAPIs(groupName);
          if (filteredAPIs.length === 0 && searchQuery) return null;
          
          return (
            <div key={groupName} className="api-group">
              {/* 分组标题 */}
              <div
                className={`group-header ${currentActiveGroup === groupName ? 'active' : ''} ${dragOverGroup === groupName ? 'drag-over' : ''}`}
                onClick={() => toggleGroup(groupName)}
                onDoubleClick={() => {
                  if (groupName !== '默认' && onRenameGroup) {
                    setEditingGroup(groupName);
                    setNewGroupName(groupName);
                  }
                }}
                onDragOver={(e) => handleDragOver(e, groupName)}
                onDragLeave={(e) => handleDragLeave(e)}
                onDrop={(e) => handleDrop(e, groupName)}
              >
                {currentActiveGroup === groupName ? (
                  <FolderOpen size={16} className="group-icon" />
                ) : (
                  <Folder size={16} className="group-icon" />
                )}
                {editingGroup === groupName ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    className="group-name-edit"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleGroupRename(groupName);
                      } else if (e.key === 'Escape') {
                        setEditingGroup(null);
                        setNewGroupName('');
                      }
                    }}
                    onBlur={() => handleGroupRename(groupName)}
                  />
                ) : (
                  <span className="group-name">{groupName}</span>
                )}
                <span className="group-count">{filteredAPIs.length}</span>
                {onDeleteGroup && groupName !== '默认' && !editingGroup && (
                  <button
                    className="icon-btn danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteGroup(groupName);
                    }}
                    title="删除分组"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* API 列表 */}
              {currentActiveGroup === groupName && (
                <div className="group-content">
                  {filteredAPIs.map(api => (
                    <div 
                      key={api.name}
                      className={`api-item ${selectedAPI?.name === api.name ? 'active' : ''} ${dragAPI?.name === api.name ? 'dragging' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, api)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onSelect(api)}
                    >
                      <div className="api-header">
                        <div className="api-info">
                          <span className="api-name" title={api.name}>
                             <span 
                          className="api-method"
                          style={{ background: getMethodColor(api.method) }}
                        >
                          {api.method}
                        </span>
                            {api.name}
                            </span>
                          <span className="api-path" title={api.api_path}>{api.api_path}</span>
                        </div>
                      </div>
                      <div className="api-actions">
  
                        {onDelete && (
                          <button 
                            className="icon-btn danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(api);
                            }}
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default APIMain;