import React, { useState, useRef, useEffect } from 'react';
import { Search, Folder, FolderOpen, Plus, Trash2, FolderPlus, ChevronRight, ChevronDown } from 'lucide-react';
import './APIMain.css';

function APIMain({ apis, groupsData, selectedAPI, activeGroup, onSelect, onAdd, onEdit, onDelete, onAddGroup, onDeleteGroup, onGroupSelect, onMoveToGroup, onRenameGroup, onMoveGroup }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [dragAPI, setDragAPI] = useState(null);
  const [dragGroup, setDragGroup] = useState(null);
  const [dragOverGroup, setDragOverGroup] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const addMenuRef = useRef(null);
  const editInputRef = useRef(null);

  const currentActiveGroup = activeGroup || null;

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
  const handleGroupRename = (groupId) => {
    const trimmed = newGroupName.trim();
    const group = groupsData?.find(g => g.id === groupId);
    
    // 如果名称为空或与原来相同，直接取消编辑
    if (!trimmed || (group && trimmed === group.name)) {
      setEditingGroup(null);
      setNewGroupName('');
      return;
    }
    
    if (onRenameGroup) {
      onRenameGroup(groupId, trimmed);
    }
    setEditingGroup(null);
    setNewGroupName('');
  };

  // 获取分组树形结构（默认分组作为常规组）
  const getGroupTree = () => {
    // 确保默认分组存在
    let allGroups = [...(groupsData || [])];
    const hasDefault = allGroups.some(g => g.id === 'default');
    if (!hasDefault) {
      allGroups.push({ id: 'default', name: '默认', parentId: null });
    }

    // 构建树形结构
    const groupMap = new Map();
    allGroups.forEach(g => {
      groupMap.set(g.id, { ...g, children: [] });
    });

    const rootGroups = [];
    allGroups.forEach(g => {
      const group = groupMap.get(g.id);
      if (g.parentId && groupMap.has(g.parentId)) {
        groupMap.get(g.parentId).children.push(group);
      } else {
        rootGroups.push(group);
      }
    });

    return rootGroups;
  };

  // 获取单个分组中的 API（不含子分组）
  const getAPIsInGroup = (groupId) => {
    if (groupId === 'default') {
      return apis?.filter(api => api.group === 'default') || [];
    }
    if (groupId === null) {
      return apis?.filter(api => !api.group || api.group === null) || [];
    }
    return apis?.filter(api => api.group === groupId) || [];
  };

  // 切换分组展开/折叠
  const toggleGroup = (groupId) => {
    if (onGroupSelect) {
      onGroupSelect(groupId);
    }
    
    // 切换展开状态
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  // API 拖拽处理
  const handleDragStart = (e, api) => {
    setDragAPI(api);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', api.id || api.name);
    e.dataTransfer.setData('type', 'api');
    
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
      box-shadow:0 4px 12px rgba(0, 0, 0, 0.3);
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

  // 分组拖拽处理
  const handleGroupDragStart = (e, group) => {
    // 默认分组不能拖拽
    if (group.id === 'default') return;
    
    setDragGroup(group);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', group.id);
    e.dataTransfer.setData('type', 'group');
    
    // 创建自定义拖拽预览
    const dragPreview = document.createElement('div');
    dragPreview.className = 'drag-preview group-drag-preview';
    dragPreview.textContent = `分组: ${group.name}`;
    dragPreview.style.cssText = `
      position: fixed;
      top: -100px;
      left: -100px;
      padding: 6px 12px;
      background: var(--bg-secondary, #2d2d2d);
      color: var(--text-primary, #ffffff);
      border: 1px solid var(--accent-warning, #f59e0b);
      border-radius: 4px;
      font-size: 12px;
      box-shadow:0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 9999;
      pointer-events: none;
      white-space: nowrap;
    `;
    document.body.appendChild(dragPreview);
    e.dataTransfer.setDragImage(dragPreview, 0, 0);
    
    setTimeout(() => {
      if (dragPreview.parentNode) {
        dragPreview.parentNode.removeChild(dragPreview);
      }
    }, 0);
  };

  // 检查是否是子分组的递归函数
  const isChildGroup = (parentId, childId) => {
    const children = (groupsData || []).filter(g => g.parentId === parentId);
    for (const child of children) {
      if (child.id === childId) return true;
      if (isChildGroup(child.id, childId)) return true;
    }
    return false;
  };

  const handleDragOver = (e, groupId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // 检查拖拽类型
    const dragType = e.dataTransfer.getData('type');
    
    // 如果是分组拖拽，检查是否合法（不能拖拽到自身或子分组，静默忽略）
    if (dragType === 'group' && dragGroup) {
      if (groupId === dragGroup.id) return;
      // 检查是否是子分组
      if (isChildGroup(dragGroup.id, groupId)) return;
    }
    
    if (dragOverGroup !== groupId) {
      setDragOverGroup(groupId);
    }
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverGroup(null);
    }
  };

  const handleDrop = (e, targetGroupId) => {
    e.preventDefault();
    setDragOverGroup(null);
    
    const dragType = e.dataTransfer.getData('type');
    
    if (dragType === 'group' && dragGroup && onMoveGroup) {
      // 分组拖拽：移动分组到新的父分组
      onMoveGroup(dragGroup.id, targetGroupId);
      setDragGroup(null);
    } else if (dragAPI && onMoveToGroup) {
      // API 拖拽：移动 API 到分组
      onMoveToGroup(dragAPI.id || dragAPI.name, targetGroupId);
      setDragAPI(null);
    }
  };

  const handleDragEnd = () => {
    setDragAPI(null);
    setDragGroup(null);
    setDragOverGroup(null);
  };

  // 搜索过滤
  const getFilteredAPIs = (groupId) => {
    const groupAPIs = getAPIsInGroup(groupId);
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

  // 渲染分组树
  const renderGroup = (group, level = 0) => {
    const isDefault = group.id === 'default';
    const groupId = group.id;
    const hasChildren = group.children && group.children.length > 0;
    const isExpanded = expandedGroups.has(groupId);
    const isActive = currentActiveGroup === groupId;
    const isDragOver = dragOverGroup === groupId;
    const isDraggingGroup = dragGroup && dragGroup.id === groupId;
    const filteredAPIs = getFilteredAPIs(groupId);
    const apiCount = getAPIsInGroup(groupId).length;
    
    // 如果有搜索条件，只显示有匹配 API 的分组
    if (searchQuery && filteredAPIs.length === 0 && !hasChildren) {
      return null;
    }

    return (
      <div key={groupId}>
        {/* 分组标题 */}
        <div
          className={`group-header ${isActive ? 'active' : ''} ${isDragOver ? 'drag-over' : ''} ${isDefault ? 'default-group' : ''} ${isDraggingGroup ? 'dragging' : ''}`}
          style={{ paddingLeft: `${12 + level * 16}px` }}
          onClick={() => toggleGroup(groupId)}
          onDoubleClick={() => {
            if (!isDefault && onRenameGroup) {
              setEditingGroup(groupId);
              setNewGroupName(group.name);
            }
          }}
          draggable={!isDefault}
          onDragStart={(e) => handleGroupDragStart(e, group)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, groupId)}
          onDragLeave={(e) => handleDragLeave(e)}
          onDrop={(e) => handleDrop(e, groupId)}
        >
          {/* 展开/折叠图标 - 所有分组都显示（包括默认） */}
          <span 
            className="expand-icon" 
            onClick={(e) => {
              e.stopPropagation();
              const newExpanded = new Set(expandedGroups);
              if (newExpanded.has(groupId)) {
                newExpanded.delete(groupId);
              } else {
                newExpanded.add(groupId);
              }
              setExpandedGroups(newExpanded);
            }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>

          {isActive ? (
            <FolderOpen size={16} className="group-icon" />
          ) : (
            <Folder size={16} className="group-icon" />
          )}

          {editingGroup === groupId ? (
            <input
              ref={editInputRef}
              type="text"
              className="group-name-edit"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleGroupRename(groupId);
                } else if (e.key === 'Escape') {
                  setEditingGroup(null);
                  setNewGroupName('');
                }
              }}
              onBlur={() => {
                // 失焦直接取消编辑，不保存
                setEditingGroup(null);
                setNewGroupName('');
              }}
            />
          ) : (
            <span className="group-name">{group.name}</span>
          )}

          <span className="group-count">{apiCount}</span>

          {!isDefault && !editingGroup && onDeleteGroup && (
            <button
              className="icon-btn danger"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteGroup(groupId);
              }}
              title="删除分组"
            >
              <Trash2 size={14} />
            </button>
          )}

          {/* 分组拖拽手柄
          {!isDefault && !editingGroup && (
            <span className="drag-handle" title="拖拽移动分组">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <circle cx="3" cy="3" r="1.5"/>
                <circle cx="9" cy="3" r="1.5"/>
                <circle cx="3" cy="9" r="1.5"/>
                <circle cx="9" cy="9" r="1.5"/>
              </svg>
            </span>
          )} */}
        </div>

        {/* API 列表 - 树形缩进 */}
        {isExpanded && (
          <div className="group-content">
            {filteredAPIs.map(api => (
              <div
                key={api.id || api.name}
                className={`api-item ${
                  (selectedAPI?.id && api.id && selectedAPI.id === api.id) || 
                  (!api.id && selectedAPI?.name === api.name) 
                    ? 'active' : ''
                } ${
                  (dragAPI?.id && api.id && dragAPI.id === api.id) || 
                  (!api.id && dragAPI?.name === api.name) 
                    ? 'dragging' : ''
                }`}
                style={{ paddingLeft: `${12 + (level + 1) * 16}px` }}
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

        {/* 递归渲染子分组 */}
        {hasChildren && isExpanded && (
          <div className="group-children">
            {group.children.map(child => renderGroup(child, level + 1))}
          </div>
        )}
      </div>
    );
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
        {getGroupTree().map(group => renderGroup(group, 0))}
      </div>
    </div>
  );
}

export default APIMain;
