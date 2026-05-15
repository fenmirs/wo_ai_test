import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Folder, FolderOpen, Plus, Trash2, FolderPlus, ChevronRight, ChevronDown, MoreHorizontal, Copy, Edit, X, Layers } from 'lucide-react';
import { projectManager } from '../utils/ProjectManager';
import './APIMain.css';

function APIMain({ apis, groupsData, selectedAPI, activeGroup, onSelect, onAdd, onEdit, onDelete, onAddGroup, onDeleteGroup, onGroupSelect, onMoveToGroup, onRenameGroup, onMoveGroup, onCopyAPI, onCopyGroup, onScenarioSelect, onAddScenario, onDeleteScenario, zenMode, zenApiId, currentScenarioId, expandScenarioApiId, onExpandScenarioHandled }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dragAPI, setDragAPI] = useState(null);
  const [dragGroup, setDragGroup] = useState(null);
  const [dragOverGroup, setDragOverGroup] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [expandedScenarioApis, setExpandedScenarioApis] = useState(new Set());
  const [operationMenu, setOperationMenu] = useState({ visible: false, type: null, data: null, buttonRef: null });
  const [refPopup, setRefPopup] = useState({ visible: false, api: null, data: null, loading: false });
  const [editingApiId, setEditingApiId] = useState(null);
  const [editingApiName, setEditingApiName] = useState('');
  const [editingScenarioKey, setEditingScenarioKey] = useState(null);
  const [editingScenarioName, setEditingScenarioName] = useState('');
  const editInputRef = useRef(null);
  const editApiInputRef = useRef(null);
  const editScenarioInputRef = useRef(null);
  const operationMenuRef = useRef(null);
  const refPopupRef = useRef(null);

  const currentActiveGroup = activeGroup || null;

  // 激活分组时自动展开其所有祖先
  useEffect(() => {
    if (!activeGroup) return;
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (!next.has(activeGroup)) {
        next.add(activeGroup);
      }
      let parentId = groupsData?.find(g => g.id === activeGroup)?.parentId;
      while (parentId) {
        next.add(parentId);
        parentId = groupsData?.find(g => g.id === parentId)?.parentId;
      }
      return next;
    });
  }, [activeGroup]);

  // 添加场景时自动展开该 API 的场景子列表
  useEffect(() => {
    if (!expandScenarioApiId) return;
    setExpandedScenarioApis(prev => {
      if (prev.has(expandScenarioApiId)) return prev;
      const next = new Set(prev);
      next.add(expandScenarioApiId);
      return next;
    });
    onExpandScenarioHandled?.();
  }, [expandScenarioApiId]);

  // 点击外部关闭菜单和引用弹窗
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (operationMenuRef.current && !operationMenuRef.current.contains(event.target) &&
          !event.target.closest('.operation-trigger')) {
        setOperationMenu({ visible: false, type: null, data: null, buttonRef: null });
      }
      if (refPopupRef.current && !refPopupRef.current.contains(event.target) &&
          !event.target.closest('.operation-trigger')) {
        setRefPopup({ visible: false, api: null, data: null, loading: false });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 处理操作菜单显示/隐藏
  const toggleOperationMenu = (e, type, data) => {
    e.stopPropagation();
    if (operationMenu.visible && operationMenu.data === data) {
      setOperationMenu({ visible: false, type: null, data: null, buttonRef: null });
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setOperationMenu({
        visible: true,
        type,
        data,
        x: rect.left,
        y: rect.bottom + 4
      });
    }
  };

  // 执行操作菜单操作
  const handleOperationMenuAction = (action) => {
    const { type, data } = operationMenu;

    if (type === 'group') {
      const group = data;
      switch (action) {
        case 'addAPI':
          if (onAdd) onAdd(group.id);
          break;
        case 'addSubGroup':
          projectManager.addGroup('新分组', group.id);
          {
            const groups = projectManager._activeProject?.config?.groups || [];
            const newGroup = groups.filter(g => g.parentId === group.id).pop();
            if (newGroup) { setEditingGroup(newGroup.id); setNewGroupName('新分组'); onGroupSelect?.(newGroup.id); }
          }
          break;
        case 'addSiblingGroup':
          projectManager.addGroup('新分组', group.parentId || null);
          {
            const groups = projectManager._activeProject?.config?.groups || [];
            const newGroup = groups.filter(g => g.parentId === (group.parentId || null)).pop();
            if (newGroup) { setEditingGroup(newGroup.id); setNewGroupName('新分组'); onGroupSelect?.(newGroup.id); }
          }
          break;
        case 'rename':
          setEditingGroup(group.id);
          setNewGroupName(group.name);
          break;
        case 'delete':
          if (onDeleteGroup) onDeleteGroup(group.id);
          break;
        case 'copy':
          if (onCopyGroup) onCopyGroup(group.id);
          break;
        default:
          break;
      }
    } else if (type === 'api') {
      const api = data;
      switch (action) {
        case 'delete':
          if (onDelete) onDelete(api);
          break;
        case 'copy':
          if (onCopyAPI) onCopyAPI(api.id);
          break;
        case 'copyId':
          if (api.id) {
            navigator.clipboard.writeText(api.id);
          }
          break;
        case 'viewRefs':
          findReferences(api);
          break;
        default:
          break;
      }
    }

    setOperationMenu({ visible: false, type: null, data: null, buttonRef: null });
  };

  // 编辑分组时自动聚焦
  useEffect(() => {
    if (editingGroup && editInputRef.current) {
      editInputRef.current.focus({ preventScroll: true });
      editInputRef.current.select();
    }
  }, [editingGroup]);

  // 编辑 API 名称时自动聚焦
  useEffect(() => {
    if (editingApiId && editApiInputRef.current) {
      editApiInputRef.current.focus({ preventScroll: true });
      editApiInputRef.current.select();
    }
  }, [editingApiId]);

  // 编辑场景名称时自动聚焦
  useEffect(() => {
    if (editingScenarioKey && editScenarioInputRef.current) {
      editScenarioInputRef.current.focus({ preventScroll: true });
      editScenarioInputRef.current.select();
    }
  }, [editingScenarioKey]);

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

  const handleAPIRename = (apiId) => {
    const trimmed = editingApiName.trim();
    const api = apis.find(a => a.id === apiId);
    if (!trimmed || !api || trimmed === api.name) {
      setEditingApiId(null);
      setEditingApiName('');
      return;
    }
    projectManager.updateAPI(apiId, { name: trimmed });
    if (projectManager._apiDataCache[apiId]) {
      projectManager._apiDataCache[apiId].name = trimmed;
    }
    projectManager.markDirty();
    setEditingApiId(null);
    setEditingApiName('');
  };

  const handleScenarioRename = (apiId, scenarioId) => {
    const trimmed = editingScenarioName.trim();
    const config = projectManager._apiDataCache[apiId];
    const scn = config?.scenarios?.[scenarioId];
    if (!trimmed || !scn || trimmed === scn.name) {
      setEditingScenarioKey(null);
      setEditingScenarioName('');
      return;
    }
    scn.name = trimmed;
    projectManager.markDirty();
    setEditingScenarioKey(null);
    setEditingScenarioName('');
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
    const filterDeleted = list => (list || []).filter(a => !a.deleted);
    if (groupId === 'default') {
      return filterDeleted(apis?.filter(api => api.group === 'default'));
    }
    if (groupId === null) {
      return filterDeleted(apis?.filter(api => !api.group || api.group === null));
    }
    return filterDeleted(apis?.filter(api => api.group === groupId));
  };

  // 递归计算分组（含所有子分组）的 API 数量
  const getGroupAPICount = (group) => {
    let count = getAPIsInGroup(group.id).length;
    if (group.children && group.children.length > 0) {
      group.children.forEach(child => {
        count += getGroupAPICount(child);
      });
    }
    return count;
  };

  // 递归计算分组（含所有子分组）的搜索匹配 API 数量
  const getFilteredGroupAPICount = (group) => {
    let count = getFilteredAPIs(group.id).length;
    if (group.children && group.children.length > 0) {
      group.children.forEach(child => {
        count += getFilteredGroupAPICount(child);
      });
    }
    return count;
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
      // 展开时自动展开所有祖先分组
      let parentId = groupsData?.find(g => g.id === groupId)?.parentId;
      while (parentId) {
        newExpanded.add(parentId);
        parentId = groupsData?.find(g => g.id === parentId)?.parentId;
      }
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

  // 提取简短 ID 后缀
  const getShortIdSuffix = (id) => {
    if (!id) return '';
    const parts = id.split('_');
    const suffix = parts[parts.length - 1];
    return suffix && suffix !== id ? `#${suffix}` : '';
  };

  // 计算分组深度
  const getGroupDepth = (groupId, groups) => {
    let depth = 0;
    let current = groups.find(g => g.id === groupId);
    while (current && current.parentId) {
      depth++;
      current = groups.find(g => g.id === current.parentId);
    }
    return depth;
  };

  // 搜索过滤：按名称、ID、组名、路径、场景名全内存搜索
  const getFilteredAPIs = (groupId) => {
    const groupAPIs = getAPIsInGroup(groupId);
    if (!searchQuery) return groupAPIs;
    
    const lowerQuery = searchQuery.toLowerCase();
    const matchedGroupIds = new Set();
    (groupsData || []).forEach(g => {
      if (g.name && g.name.toLowerCase().includes(lowerQuery)) {
        matchedGroupIds.add(g.id);
      }
    });

    return groupAPIs.filter(api => {
      const nameMatch = api.name && api.name.toLowerCase().includes(lowerQuery);
      const idMatch = api.id && api.id.toLowerCase().includes(lowerQuery);
      const groupMatch = matchedGroupIds.has(api.group);

      // 路径搜索直接从索引 api.api_path (Phase 3 优化：不再需要加载 per-API 缓存)
      const pathMatch = !!(api.api_path && api.api_path.toLowerCase().includes(lowerQuery));

      // 场景名 + 描述搜索
      let scenarioMatch = false;
      if (api.id && !pathMatch) {
        const config = projectManager._apiDataCache[api.id];
        if (config && config.scenarios) {
          for (const scn of Object.values(config.scenarios)) {
            if (scn && scn.name && scn.name.toLowerCase().includes(lowerQuery)) {
              scenarioMatch = true;
              break;
            }
            if (scn && scn.description && scn.description.toLowerCase().includes(lowerQuery)) {
              scenarioMatch = true;
              break;
            }
          }
        }
      }

      return nameMatch || idMatch || groupMatch || pathMatch || scenarioMatch;
    });
  };

  // 获取 API 的场景数量和列表
  const getScenarioData = (apiId) => {
    const config = projectManager._apiDataCache[apiId];
    if (!config?.scenarios) return { count: 1, list: [] };
    const scns = Object.values(config.scenarios).filter(s => !s.deleted);
    return { count: scns.length, list: scns };
  };

  const toggleScenarioList = (apiId) => {
    setExpandedScenarioApis(prev => {
      const next = new Set(prev);
      if (next.has(apiId)) next.delete(apiId); else next.add(apiId);
      return next;
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
    const isActive = (() => {
      if (currentActiveGroup === groupId) return true;
      let pid = groupsData?.find(g => g.id === currentActiveGroup)?.parentId;
      while (pid) {
        if (pid === groupId) return true;
        pid = groupsData?.find(g => g.id === pid)?.parentId;
      }
      return false;
    })();
    const isDragOver = dragOverGroup === groupId;
    const isDraggingGroup = dragGroup && dragGroup.id === groupId;
    const filteredAPIs = getFilteredAPIs(groupId);
    const apiCount = searchQuery ? getFilteredGroupAPICount(group) : getGroupAPICount(group);
    
    // 如果有搜索条件，只显示有匹配 API 的分组
    if (searchQuery && filteredAPIs.length === 0 && !hasChildren) {
      return null;
    }

    return (
      <div key={groupId} className="group-wrapper" style={{ '--guide-x': `${8 + level * 8 + 5}px` }}>
        {/* 分组标题 */}
        <div
          className={`group-header ${isActive ? 'active' : ''} ${isDragOver ? 'drag-over' : ''} ${isDefault ? 'default-group' : ''} ${isDraggingGroup ? 'dragging' : ''}`}
          style={{ paddingLeft: `${8 + level * 8}px` }}
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
              toggleGroup(groupId);
            }}
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>

          {isActive ? (
            <FolderOpen size={14} className="group-icon" />
          ) : (
            <Folder size={14} className="group-icon" />
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

            <button
              className="icon-btn operation-trigger"
              style={{ visibility: editingGroup ? 'hidden' : 'visible' }}
              onClick={(e) => toggleOperationMenu(e, 'group', group)}
              title="操作"
            >
              <MoreHorizontal size={12} />
            </button>

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
            {filteredAPIs.map(api => {
              const scnData = getScenarioData(api.id);
              const hasMultiScenarios = scnData.count >= 2;
              const isScnExpanded = hasMultiScenarios && expandedScenarioApis.has(api.id);
              return (
              <React.Fragment key={api.id || api.name}>
                <div
                  className={`api-item ${
                    (selectedAPI?.id && api.id && selectedAPI.id === api.id) ||
                    (!api.id && selectedAPI?.name === api.name)
                      ? 'active' : ''
                  } ${
                    (dragAPI?.id && api.id && dragAPI.id === api.id) ||
                    (!api.id && dragAPI?.name === api.name)
                      ? 'dragging' : ''
                  }`}
                  style={{ paddingLeft: `${8 + (level + 1) * 8}px` }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, api)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onSelect(api)}
                  onDoubleClick={() => {
                    if (api.id) {
                      setEditingApiId(api.id);
                      setEditingApiName(api.name);
                    }
                  }}
                >
                    <div className="api-header">
                      <div className="api-info">
                        <div className="api-info-row">
                          <span
                            className="api-expand-icon"
                            onClick={(e) => { if (hasMultiScenarios) { e.stopPropagation(); toggleScenarioList(api.id); } }}
                            style={{ visibility: hasMultiScenarios ? 'visible' : 'hidden' }}
                          >
                            {isScnExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </span>
                          <span className="api-method-bar" style={{ background: getMethodColor(api.method) }} />
                          {editingApiId === api.id ? (
                            <input
                              ref={editApiInputRef}
                              type="text"
                              className="group-name-edit"
                              value={editingApiName}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setEditingApiName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.stopPropagation(); handleAPIRename(api.id); }
                                else if (e.key === 'Escape') { e.stopPropagation(); setEditingApiId(null); setEditingApiName(''); }
                              }}
                              onBlur={() => { handleAPIRename(api.id); }}
                            />
                          ) : (
                            <span className="api-name" title={`${api.name}\nID: ${api.id}`}>
                              {api.name}
                            </span>
                          )}
                          <span className="scenario-count-badge" title={`${scnData.count} 个场景`}>
                            <Layers size={11} />
                            {scnData.count}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="api-actions">
                      <button
                        className="icon-btn operation-trigger"
                        onClick={(e) => toggleOperationMenu(e, 'api', api)}
                        title="操作"
                      >
                        <MoreHorizontal size={12} />
                      </button>
                    </div>
                  </div>
                {/* 场景子列表 */}
                {isScnExpanded && (
                  <div className="scenario-sublist">
                    {scnData.list.map(scn => (
                      <div
                        key={scn.id}
                        className={`scenario-item ${currentScenarioId === scn.id && selectedAPI?.id === api.id ? 'active' : ''}`}
                        style={{ paddingLeft: `${8 + (level + 1) * 8}px` }}
                        onClick={() => onScenarioSelect?.(api, scn.id)}
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingScenarioKey(`${api.id}:${scn.id}`); setEditingScenarioName(scn.name); }}
                      >
                        <span className="scenario-dot" />
                        {editingScenarioKey === `${api.id}:${scn.id}` ? (
                          <input
                            ref={editScenarioInputRef}
                            type="text"
                            className="group-name-edit"
                            value={editingScenarioName}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditingScenarioName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.stopPropagation(); handleScenarioRename(api.id, scn.id); }
                              else if (e.key === 'Escape') { e.stopPropagation(); setEditingScenarioKey(null); setEditingScenarioName(''); }
                            }}
                            onBlur={() => { handleScenarioRename(api.id, scn.id); }}
                            style={{ fontSize: '11px' }}
                          />
                        ) : (
                          <span className="scenario-item-name" title={scn.description || scn.name}>
                            {scn.name}
                          </span>
                        )}
                        <button
                          className="scenario-item-del icon-btn"
                          onClick={(e) => { e.stopPropagation(); onDeleteScenario?.(api.id, scn.id); }}
                          title="删除场景"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </React.Fragment>
              );
            })}
          </div>
        )}
        {/* Need React import for Fragment */}

        {/* 递归渲染子分组 */}
        {hasChildren && isExpanded && (
          <div className="group-children">
            {group.children.map(child => renderGroup(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const escapeRegex = (str) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // 扫描场景数据中的引用
  const scanRefInScenario = (scn, targetApiId) => {
    const refPattern = new RegExp(`\\{\\{ref:${escapeRegex(targetApiId)}(?:@|\\}|\\.)`, 'i');

    // 扫描 header
    if (Array.isArray(scn.header)) {
      for (const h of scn.header) {
        if (h.default && typeof h.default === 'string' && refPattern.test(h.default)) return true;
      }
    } else if (scn.header && typeof scn.header === 'object') {
      for (const val of Object.values(scn.header)) {
        if (val && typeof val === 'object' && val.default && typeof val.default === 'string' && refPattern.test(val.default)) return true;
      }
    }

    // 扫描 param
    if (Array.isArray(scn.param)) {
      for (const p of scn.param) {
        if (p.default && typeof p.default === 'string' && refPattern.test(p.default)) return true;
      }
    } else if (scn.param && typeof scn.param === 'object') {
      for (const val of Object.values(scn.param)) {
        if (val && typeof val === 'object' && val.default && typeof val.default === 'string' && refPattern.test(val.default)) return true;
      }
    }

    // 扫描 body
    if (scn.body) {
      if (typeof scn.body === 'string' && refPattern.test(scn.body)) return true;
      if (scn.body.contents) {
        for (const contentType of Object.values(scn.body.contents)) {
          if (contentType?.content && typeof contentType.content === 'string' && refPattern.test(contentType.content)) return true;
        }
      }
    }

    return false;
  };

  // 查找引用：遍历所有已缓存的 API 配置，匹配 {{ref:targetApiId...}}
  const findReferences = (targetApi) => {
    if (!targetApi?.id || !projectManager._activeProject) return;

    setRefPopup({ visible: true, api: targetApi, data: null, loading: true });

    const refs = [];
    const cache = projectManager._activeProject.apiDataCache;
    const apis = projectManager._activeProject.config?.apis || [];

    for (const apiEntry of apis) {
      if (apiEntry.id === targetApi.id) continue;
      const config = cache[apiEntry.id];
      if (!config?.scenarios) continue;

      const scenarioMatches = [];
      for (const scn of Object.values(config.scenarios)) {
        if (!scn) continue;
        const found = scanRefInScenario(scn, targetApi.id);
        if (found) {
          scenarioMatches.push({ scnId: scn.id, scnName: scn.name || scn.id });
        }
      }

      if (scenarioMatches.length > 0) {
        refs.push({
          apiId: apiEntry.id,
          apiName: apiEntry.name || apiEntry.id,
          scenarios: scenarioMatches
        });
      }
    }

    setRefPopup({ visible: true, api: targetApi, data: refs, loading: false });
  };

  return (
    <div className="api-main">
      {/* 搜索框 */}
      <div className="search-bar">
        <div className="search-box">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            placeholder="搜索 API..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            className="search-input"
            title="支持按 API 名称、请求路径、场景名、场景描述、组名、ID 模糊搜索"
          />
        </div>
      </div>

      {/* API 列表 */}
      <div className="api-list">
        {zenMode && zenApiId ? (
          <div className="zen-scenario-list">
            <div className="zen-header">
              <span className="zen-title">专注模式</span>
              <button className="icon-btn" onClick={() => onSelect?.({ id: zenApiId })} title="退出专注模式">
                <X size={14} />
              </button>
            </div>
            {(() => {
              const scnData = getScenarioData(zenApiId);
              const apiEntry = apis.find(a => a.id === zenApiId);
              return scnData.list.map(scn => (
                <div
                  key={scn.id}
                  className={`scenario-item zen-scenario-item ${currentScenarioId === scn.id ? 'active' : ''}`}
                  onClick={() => onScenarioSelect?.({ id: zenApiId, ...apiEntry }, scn.id)}
                  onDoubleClick={() => { setEditingScenarioKey(`${zenApiId}:${scn.id}`); setEditingScenarioName(scn.name); }}
                >
                  <span className="scenario-dot" />
                  {editingScenarioKey === `${zenApiId}:${scn.id}` ? (
                    <input
                      ref={editScenarioInputRef}
                      type="text"
                      className="group-name-edit"
                      value={editingScenarioName}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setEditingScenarioName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.stopPropagation(); handleScenarioRename(zenApiId, scn.id); }
                        else if (e.key === 'Escape') { e.stopPropagation(); setEditingScenarioKey(null); setEditingScenarioName(''); }
                      }}
                      onBlur={() => { handleScenarioRename(zenApiId, scn.id); }}
                      style={{ fontSize: '11px' }}
                    />
                  ) : (
                    <span className="scenario-item-name">{scn.name}</span>
                  )}
                  <button
                    className="scenario-item-del icon-btn"
                    onClick={(e) => { e.stopPropagation(); onDeleteScenario?.(zenApiId, scn.id); }}
                    title="删除场景"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ));
            })()}
          </div>
        ) : (
          getGroupTree().map(group => renderGroup(group, 0))
        )}
      </div>

      {/* 操作菜单 */}
      {operationMenu.visible && (
        <div
          ref={operationMenuRef}
          className="operation-menu"
          style={{ left: operationMenu.x, top: operationMenu.y }}
        >
          {operationMenu.type === 'group' && (
            <>
              <div className="operation-menu-item" onClick={() => { handleOperationMenuAction('addAPI'); }}>
                <Plus size={14} />
                <span>添加 API</span>
              </div>
              {getGroupDepth(operationMenu.data?.id, groupsData) < 6 && (
                <div className="operation-menu-item" onClick={() => { handleOperationMenuAction('addSubGroup'); }}>
                  <FolderPlus size={14} />
                  <span>添加子分组</span>
                </div>
              )}
              <div className="operation-menu-item" onClick={() => { handleOperationMenuAction('addSiblingGroup'); }}>
                <FolderPlus size={14} />
                <span>添加同级分组</span>
              </div>
              {operationMenu.data?.id !== 'default' && (
                <>
                  <div className="operation-menu-item" onClick={() => handleOperationMenuAction('copy')}>
                    <Copy size={14} />
                    <span>复制</span>
                  </div>
                  <div className="operation-menu-item" onClick={() => handleOperationMenuAction('rename')}>
                    <Edit size={14} />
                    <span>重命名</span>
                  </div>
                  <div className="operation-menu-item danger" onClick={() => handleOperationMenuAction('delete')}>
                    <Trash2 size={14} />
                    <span>删除分组</span>
                  </div>
                </>
              )}
            </>
          )}
          {operationMenu.type === 'api' && (
            <>
              <div className="operation-menu-item" onClick={() => handleOperationMenuAction('copy')}>
                <Copy size={14} />
                <span>复制</span>
              </div>
              <div className="operation-menu-item" onClick={() => handleOperationMenuAction('copyId')}>
                <Copy size={14} />
                <span>复制 ID</span>
              </div>
              <div className="operation-menu-item" onClick={() => { setOperationMenu({ visible: false, type: null, data: null, buttonRef: null }); onAddScenario?.(operationMenu.data); }}>
                <Plus size={14} />
                <span>添加场景</span>
              </div>
              <div className="operation-menu-item" onClick={() => handleOperationMenuAction('viewRefs')}>
                <Search size={14} />
                <span>查看引用</span>
              </div>
              <div className="operation-menu-item danger" onClick={() => handleOperationMenuAction('delete')}>
                <Trash2 size={14} />
                <span>删除</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* 引用弹窗 */}
      {refPopup.visible && (
        <div className="ref-popup-overlay" onClick={() => setRefPopup({ visible: false, api: null, data: null, loading: false })}>
          <div className="ref-popup" ref={refPopupRef} onClick={(e) => e.stopPropagation()}>
            <div className="ref-popup-header">
              <h3>引用查看: {refPopup.api?.name}</h3>
              <button className="icon-btn" onClick={() => setRefPopup({ visible: false, api: null, data: null, loading: false })}>
                <X size={16} />
              </button>
            </div>
            <div className="ref-popup-body">
              {refPopup.loading ? (
                <div className="ref-popup-loading">正在查找引用...</div>
              ) : refPopup.data && refPopup.data.length > 0 ? (
                <div className="ref-popup-list">
                  {refPopup.data.map((ref, idx) => (
                    <div key={idx} className="ref-popup-group">
                      <div
                        className="ref-popup-api-name"
                        onClick={() => {
                          const apiEntry = apis.find(a => a.id === ref.apiId);
                          if (apiEntry && onSelect) onSelect(apiEntry);
                          setRefPopup({ visible: false, api: null, data: null, loading: false });
                        }}
                      >
                        {ref.apiName}
                      </div>
                      <div className="ref-popup-scenarios">
                        {ref.scenarios.map((scn, sci) => (
                          <span key={sci} className="ref-popup-scenario-tag">{scn.scnName}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ref-popup-empty">该 API 未被任何其他 API 引用</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default APIMain;
