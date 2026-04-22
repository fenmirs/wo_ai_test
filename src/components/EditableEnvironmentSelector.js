import React, { useState } from 'react';
import { Check, Globe, Plus, Edit, Trash2, Settings } from 'lucide-react';
import { projectManager } from '../utils/ProjectManager';
import './EditableEnvironmentSelector.css';

function EditableEnvironmentSelector({ profiles, currentProfile, onSelect }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // 表单状态
  const [formData, setFormData] = useState({});

  const handleEdit = (profile) => {
    setEditingProfile(profile);
    setFormData({ ...profile });
    setIsEditing(true);
  };

  const handleAdd = () => {
    setEditingProfile(null);
    setFormData({
      name: '',
      activate: false,
      domain: '',
      'lcgl-prj': '',
      'api-prj': ''
    });
    setShowAddForm(true);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!formData.name) {
      alert('请输入环境名称');
      return;
    }

    if (editingProfile) {
      // 更新现有环境
      projectManager.updateProfile(editingProfile.name, formData);
      if (currentProfile?.name === editingProfile.name) {
        onSelect(formData);
      }
    } else {
      // 添加新环境
      projectManager.addProfile(formData);
    }

    setIsEditing(false);
    setEditingProfile(null);
    setShowAddForm(false);
    setFormData({});
  };

  const handleDelete = (profileName) => {
    if (profiles.length === 1) {
      alert('至少需要保留一个环境配置');
      return;
    }

    const confirmed = window.confirm(`确定要删除环境 "${profileName}" 吗？`);
    if (confirmed) {
      projectManager.deleteProfile(profileName);
      if (currentProfile?.name === profileName) {
        onSelect(profiles[0]);
      }
    }
  };

  const handleSetDefault = (profileName) => {
    // 取消所有环境的 activate
    profiles.forEach(p => {
      if (p.name !== profileName) {
        projectManager.updateProfile(p.name, { ...p, activate: false });
      }
    });
    
    // 设置当前环境为默认
    projectManager.updateProfile(profileName, { activate: true });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingProfile(null);
    setShowAddForm(false);
    setFormData({});
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="editable-environment-selector">
      {isEditing ? (
        /* 编辑/添加表单 */
        <div className="env-form">
          <div className="form-header">
            <h3>{editingProfile ? '编辑环境' : '添加环境'}</h3>
          </div>
          
          <div className="form-body">
            <div className="form-group">
              <label>环境名称 *</label>
              <input
                type="text"
                name="name"
                value={formData.name || ''}
                onChange={handleInputChange}
                placeholder="例如: dev, pre, prod"
              />
            </div>
            
            <div className="form-group">
              <label>域名</label>
              <input
                type="text"
                name="domain"
                value={formData.domain || ''}
                onChange={handleInputChange}
                placeholder="例如: 192.168.1.1"
              />
            </div>
            
            <div className="form-group">
              <label>lcgl-prj</label>
              <input
                type="text"
                name="lcgl-prj"
                value={formData['lcgl-prj'] || ''}
                onChange={handleInputChange}
                placeholder="例如: :25708/lcgl-prj"
              />
            </div>
            
            <div className="form-group">
              <label>api-prj</label>
              <input
                type="text"
                name="api-prj"
                value={formData['api-prj'] || ''}
                onChange={handleInputChange}
                placeholder="例如: :25710/api-prj"
              />
            </div>
          </div>
          
          <div className="form-actions">
            <button className="btn-secondary" onClick={handleCancel}>
              取消
            </button>
            <button className="btn-primary" onClick={handleSave}>
              保存
            </button>
          </div>
        </div>
      ) : (
        /* 环境列表 */
        <>
          <div className="env-list">
            {profiles?.map((profile) => (
              <div
                key={profile.name}
                className={`env-item ${currentProfile?.name === profile.name ? 'active' : ''}`}
                onClick={() => onSelect(profile)}
              >
                <div className="env-info">
                  <div className="env-name">
                    {profile.name}
                    {profile.activate && (
                      <span className="activate-badge" title="默认环境">
                        默认
                      </span>
                    )}
                  </div>
                  <div className="env-domain">{profile.domain}</div>
                </div>
                
                <div className="env-actions" onClick={(e) => e.stopPropagation()}>
                  {currentProfile?.name === profile.name && (
                    <Check size={16} className="check-icon" />
                  )}
                  <button
                    className="icon-btn small"
                    onClick={() => handleEdit(profile)}
                    title="编辑"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    className="icon-btn small"
                    onClick={() => handleSetDefault(profile.name)}
                    title="设为默认"
                    disabled={profile.activate}
                  >
                    <Settings size={14} />
                  </button>
                  <button
                    className="icon-btn small danger"
                    onClick={() => handleDelete(profile.name)}
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <button className="add-env-btn" onClick={handleAdd}>
            <Plus size={16} />
            添加环境
          </button>
        </>
      )}
    </div>
  );
}

export default EditableEnvironmentSelector;