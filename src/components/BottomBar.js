import React, { useState, useRef, useEffect } from 'react';
import { Globe, Variable, ChevronUp, Settings } from 'lucide-react';
import './BottomBar.css';

function BottomBar({ 
  currentProfile, 
  allProfiles, 
  onProfileSelect, 
  onEditVariables 
}) {
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showVariableDropdown, setShowVariableDropdown] = useState(false);
  const profileDropdownRef = useRef(null);
  const variableDropdownRef = useRef(null);

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
      if (variableDropdownRef.current && !variableDropdownRef.current.contains(event.target)) {
        setShowVariableDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="bottom-bar">
      <div className="bar-section" ref={profileDropdownRef}>
        <div 
          className="bar-item"
          onClick={() => setShowProfileDropdown(!showProfileDropdown)}
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
      </div>

      <div className="bar-section" ref={variableDropdownRef}>
        <div 
          className="bar-item"
          onClick={() => setShowVariableDropdown(!showVariableDropdown)}
        >
          <Variable size={16} />
          <span className="bar-label">变量</span>
          <ChevronUp size={14} className={`chevron ${showVariableDropdown ? 'up' : ''}`} />
        </div>
        <button 
          className="icon-btn"
          onClick={onEditVariables}
          title="管理环境和变量"
        >
          <Settings size={14} />
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
