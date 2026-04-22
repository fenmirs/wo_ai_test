import React, { useState, useEffect } from 'react';
import { Globe, Plus, Trash2, Check, X, AlertTriangle } from 'lucide-react';
import { projectManager } from '../utils/ProjectManager';
import './EnvironmentList.css';

function EnvironmentList({ profiles, onBack }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  
  // 本地编辑状态
  const [localProfiles, setLocalProfiles] = useState([]);

  useEffect(() => {
    if (profiles) {
      setLocalProfiles(profiles.map(p => ({ ...p })));
    }
  }, [profiles]);

  const handleAdd = () => {
    const newProfile = {
      name: `环境 ${localProfiles.length + 1}`,
      activate: false,
      domain: ''
    };
    projectManager.addProfile(newProfile);
  };

  const handleDelete = (profile) => {
    if (localProfiles.length === 1) {
      alert('至少需要保留一个环境配置');
      return;
    }
    setDeleteTarget(profile);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    projectManager.deleteProfile(deleteTarget.name);
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  const handleSetDefault = (profile) => {
    localProfiles.forEach(p => {
      projectManager.updateProfile(p.name, { activate: p.name === profile.name });
    });
  };

  // 失焦自动保存
  const handleBlur = (profile, field, value) => {
    if (value !== profile[field]) {
      const updates = { [field]: value };
      
      // 如果修改的是环境名称，需要特殊处理
      if (field === 'name' && value !== profile.name) {
        // 检查名称是否已存在
        const exists = localProfiles.find(p => p.name === value);
        if (exists) {
          alert('环境名称已存在');
          return;
        }
        projectManager.updateProfile(profile.name, updates);
      } else {
        projectManager.updateProfile(profile.name, updates);
      }
    }
  };

  return (
    <div className="environment-list">
      <div className="list-header">
        <div className="header-left">
          <Globe size={20} />
          <h2>环境配置</h2>
        </div>
        <div className="header-actions">
          <button className="icon-button" onClick={onBack} title="返回">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="list-content">
        <div className="list-header-row">
          <h3>环境列表</h3>
          <button className="add-btn" onClick={handleAdd}>
            <Plus size={16} />
            新增环境
          </button>
        </div>
        <div className="profile-list editable">
          {localProfiles?.map(profile => (
            <div key={profile.name} className="profile-item">
              <div className="profile-info">
                <div className="profile-main">
                  <input
                    type="text"
                    className="profile-name-input"
                    defaultValue={profile.name}
                    onBlur={(e) => handleBlur(profile, 'name', e.target.value.trim())}
                    placeholder="环境名称"
                  />
                  {profile.activate && <span className="badge default">默认</span>}
                </div>
                <input
                  type="text"
                  className="profile-domain-input"
                  defaultValue={profile.domain}
                  onBlur={(e) => handleBlur(profile, 'domain', e.target.value.trim())}
                  placeholder="域名，如：api.example.com"
                />
              </div>
              <div className="profile-actions">
                {!profile.activate && (
                  <button
                    className="icon-button"
                    onClick={() => handleSetDefault(profile)}
                    title="设为默认"
                  >
                    <Check size={16} />
                  </button>
                )}
                <button
                  className="icon-button danger"
                  onClick={() => handleDelete(profile)}
                  title="删除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 删除确认 */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <AlertTriangle size={24} className="warning-icon" />
              <h3>确认删除</h3>
            </div>
            <div className="modal-body">
              <p>确定要删除环境 "{deleteTarget?.name}" 吗？</p>
              <p className="warning-text">此操作不可撤销</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                取消
              </button>
              <button className="btn-danger" onClick={confirmDelete}>
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnvironmentList;