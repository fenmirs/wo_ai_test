import React, { useState, useRef, useEffect } from 'react';
import { Search, Folder, FolderOpen, Plus, Trash2, Edit2, FolderPlus } from 'lucide-react';
import './APIMain.css';

function APIMain({ apis, groupsData, selectedAPI, onSelect, onAdd, onEdit, onDelete, onAddGroup, onDeleteGroup }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(new Set(['默认']));
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef(null);

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
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
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
                className="group-header"
                onClick={() => toggleGroup(groupName)}
              >
                {expandedGroups.has(groupName) ? (
                  <FolderOpen size={16} className="group-icon" />
                ) : (
                  <Folder size={16} className="group-icon" />
                )}
                <span className="group-name">{groupName}</span>
                <span className="group-count">{filteredAPIs.length}</span>
                {onDeleteGroup && groupName !== '默认' && (
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
              {expandedGroups.has(groupName) && (
                <div className="group-content">
                  {filteredAPIs.map(api => (
                    <div 
                      key={api.name}
                      className={`api-item ${selectedAPI?.name === api.name ? 'active' : ''}`}
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