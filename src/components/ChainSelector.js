import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, X, AlertTriangle } from 'lucide-react';
import './ChainSelector.css';

function ChainSelector({ 
  apis, 
  currentAPI, 
  selectedChains, 
  onChainsChange,
  excludeDependencies = true 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredAPIs, setFilteredAPIs] = useState([]);
  const [cycleError, setCycleError] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // 获取所有依赖于当前 API 的 API 名称（避免循环依赖）
  const getDependentAPIs = () => {
    if (!excludeDependencies || !currentAPI) return new Set();
    
    const dependentNames = new Set();
    
    // 递归查找所有依赖于某个 API 的 API
    const findDependents = (apiName) => {
      apis.forEach(api => {
        if (api.chain && api.chain.includes(apiName)) {
          if (!dependentNames.has(api.name)) {
            dependentNames.add(api.name);
            findDependents(api.name);
          }
        }
      });
    };
    
    findDependents(currentAPI.name);
    return dependentNames;
  };

  // 过滤 API 列表
  useEffect(() => {
    if (!apis) return;

    const dependents = getDependentAPIs();
    
    let filtered = apis.filter(api => {
      // 排除当前编辑的 API
      if (currentAPI && api.name === currentAPI.name) {
        return false;
      }
      
      // 排除依赖于当前 API 的 API（避免循环依赖）
      if (excludeDependencies && dependents.has(api.name)) {
        return false;
      }
      
      // 模糊搜索
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          api.name.toLowerCase().includes(query) ||
          (api.group && api.group.toLowerCase().includes(query)) ||
          (api.api_path && api.api_path.toLowerCase().includes(query))
        );
      }
      
      return true;
    });
    
    // 排除已选中的 API
    filtered = filtered.filter(api => !selectedChains.includes(api.name));
    
    setFilteredAPIs(filtered);
  }, [apis, searchQuery, selectedChains, currentAPI, excludeDependencies]);

  // 检查循环依赖
  const checkCycleDependency = (newChainName) => {
    if (!currentAPI) return null;
    
    // 构建依赖图
    const buildDependencyGraph = () => {
      const graph = {};
      
      apis.forEach(api => {
        graph[api.name] = api.chain || [];
      });
      
      // 添加新选中的依赖关系
      if (currentAPI.name) {
        const newChains = [...selectedChains, newChainName];
        graph[currentAPI.name] = newChains;
      }
      
      return graph;
    };
    
    const graph = buildDependencyGraph();
    
    // DFS 检测循环
    const visited = new Set();
    const recursionStack = new Set();
    
    const hasCycle = (nodeName, path = []) => {
      visited.add(nodeName);
      recursionStack.add(nodeName);
      path.push(nodeName);
      
      const dependencies = graph[nodeName] || [];
      for (const dep of dependencies) {
        if (!visited.has(dep)) {
          if (hasCycle(dep, [...path])) {
            return true;
          }
        } else if (recursionStack.has(dep)) {
          // 找到循环依赖
          const cyclePath = [...path, dep];
          return cyclePath;
        }
      }
      
      recursionStack.delete(nodeName);
      return false;
    };
    
    // 检查从当前 API 开始是否有循环
    if (currentAPI.name) {
      const result = hasCycle(currentAPI.name);
      if (result) {
        return Array.isArray(result) ? result : null;
      }
    }
    
    return null;
  };

  // 添加依赖
  const handleAddChain = (apiName) => {
    // 检查循环依赖
    const cyclePath = checkCycleDependency(apiName);
    if (cyclePath) {
      setCycleError(`循环依赖检测: ${cyclePath.join(' → ')}`);
      setTimeout(() => setCycleError(''), 3000);
      return;
    }
    
    onChainsChange([...selectedChains, apiName]);
    setSearchQuery('');
    setShowDropdown(false);
    setCycleError('');
  };

  // 移除依赖
  const handleRemoveChain = (chainName) => {
    onChainsChange(selectedChains.filter(name => name !== chainName));
    setCycleError('');
  };

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 获取 API 信息
  const getAPIInfo = (apiName) => {
    return apis.find(api => api.name === apiName);
  };

  return (
    <div className="chain-selector">
      <div className="chain-selector-header">
        <label>API 依赖</label>
        <span className="help-text">选择此 API 依赖的其他 API（并行执行）</span>
      </div>

      {/* 已选中的依赖 */}
      {selectedChains.length > 0 && (
        <div className="selected-chains">
          {selectedChains.map((chainName) => {
            const api = getAPIInfo(chainName);
            return (
              <div key={chainName} className="chain-tag">
                <span className="chain-tag-name">{chainName}</span>
                {api?.group && (
                  <span className="chain-tag-group">{api.group}</span>
                )}
                <button 
                  className="chain-tag-remove"
                  onClick={() => handleRemoveChain(chainName)}
                  title="移除依赖"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 搜索框 */}
      <div className="chain-search" ref={dropdownRef}>
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="搜索 API 名称、分组或路径..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowDropdown(true)}
          />
          <button 
            className="add-button"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <Plus size={16} />
          </button>
        </div>

        {/* 循环依赖错误提示 */}
        {cycleError && (
          <div className="cycle-error">
            <AlertTriangle size={14} />
            <span>{cycleError}</span>
          </div>
        )}

        {/* 下拉列表 */}
        {showDropdown && filteredAPIs.length > 0 && (
          <div className="chain-dropdown">
            {filteredAPIs.map(api => (
              <div 
                key={api.name}
                className="chain-dropdown-item"
                onClick={() => handleAddChain(api.name)}
              >
                <div className="dropdown-item-main">
                  <span className="dropdown-item-name">{api.name}</span>
                  <span className="dropdown-item-method">{api.method}</span>
                </div>
                <div className="dropdown-item-sub">
                  {api.group && <span className="dropdown-item-group">{api.group}</span>}
                  <span className="dropdown-item-path">{api.api_path}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 无结果提示 */}
        {showDropdown && searchQuery && filteredAPIs.length === 0 && (
          <div className="chain-empty">
            <span>未找到匹配的 API</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChainSelector;