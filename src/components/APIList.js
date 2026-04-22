import React, { useState } from 'react';
import { Search, Link, Plus } from 'lucide-react';
import './APIList.css';

function APIList({ apis, selectedAPI, onSelect }) {
  const [searchQuery, setSearchQuery] = useState('');

  // 模糊搜索 API
  const searchAPIs = (query) => {
    if (!query) return apis;
    
    const lowerQuery = query.toLowerCase();
    return apis.filter(api => {
      const name = api.name.toLowerCase();
      return name.includes(lowerQuery) || 
             api.api_path.toLowerCase().includes(lowerQuery);
    });
  };

  const filteredAPIs = searchAPIs(searchQuery);

  const getMethodColor = (method) => {
    const colors = {
      'GET': '#10b981',
      'POST': '#3b82f6',
      'PUT': '#f59e0b',
      'DELETE': '#ef4444',
      'PATCH': '#8b5cf6'
    };
    return colors[method] || '#64748b';
  };

  return (
    <div className="api-list-container">
      {/* 搜索框 */}
      <div className="search-box">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="搜索 API..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {/* API 列表 */}
      <div className="api-list">
        {filteredAPIs.length === 0 ? (
          <div className="empty-message">
            {searchQuery ? '未找到匹配的 API' : '暂无 API 配置'}
          </div>
        ) : (
          filteredAPIs.map((api) => (
            <div
              key={api.name}
              className={`api-item ${selectedAPI?.name === api.name ? 'active' : ''}`}
              onClick={() => onSelect(api)}
            >
              <div className="api-header">
                <div className="api-method" style={{ color: getMethodColor(api.method) }}>
                  {api.method}
                </div>
                <div className="api-name">{api.name}</div>
              </div>
              
              <div className="api-path">{api.api_path}</div>
              
              {/* 依赖链 */}
              {api.chain && api.chain.length > 0 && (
                <div className="api-chain">
                  <Link size={12} className="chain-icon" />
                  <span className="chain-text">
                    依赖: {api.chain.join(', ')}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default APIList;