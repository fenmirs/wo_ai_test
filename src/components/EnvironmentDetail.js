import React, { useState, useEffect } from 'react';
import { Globe, Plus, Edit2, Trash2, Check, X, AlertTriangle } from 'lucide-react';
import { projectManager } from '../utils/ProjectManager';
import VariableManager from './VariableManager';
import './EnvironmentDetail.css';

function EnvironmentDetail({ profile, allProfiles, apis, onBack, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // 变量管理状态
  const [variableMode, setVariableMode] = useState(null); // 'add' | 'edit' | null
  const [variableData, setVariableData] = useState({});

  useEffect(() => {
    if (profile) {
      setEditData({ ...profile });
    }
  }, [profile]);

  const handleSave = () => {
    if (!editData.name) {
      alert('请输入环境名称');
      return;
    }
    projectManager.updateProfile(profile.name, editData);
    onUpdate();
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData({ ...profile });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (allProfiles.length === 1) {
      alert('至少需要保留一个环境配置');
      return;
    }
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    projectManager.deleteProfile(profile.name);
    onBack();
    setShowDeleteConfirm(false);
  };

  const handleSetDefault = () => {
    // 取消所有环境的 activate
    allProfiles.forEach(p => {
      if (p.name !== profile.name) {
        projectManager.updateProfile(p.name, { ...p, activate: false });
      }
    });
    
    // 设置当前环境为默认
    projectManager.updateProfile(profile.name, { activate: true });
    onUpdate();
  };

  const handleVariableAdd = () => {
    setVariableData({ name: '', value: '' });
    setVariableMode('add');
  };

  const handleVariableEdit = (varName) => {
    setVariableData({ name: varName, value: profile[varName] });
    setVariableMode('edit');
  };

  const handleVariableSave = (newVarData) => {
    const updates = {};
    
    if (variableMode === 'add') {
      // 添加新变量到所有环境
      allProfiles.forEach(p => {
        updates[p.name] = { ...p, [newVarData.name]: newVarData.value };
      });
    } else {
      // 更新变量在所有环境中的值
      allProfiles.forEach(p => {
        updates[p.name] = { ...p, [newVarData.name]: newVarData.value };
      });
    }
    
    Object.entries(updates).forEach(([name, data]) => {
      projectManager.updateProfile(name, data);
    });
    
    onUpdate();
    setVariableMode(null);
    setVariableData({});
  };

  const handleVariableCancel = () => {
    setVariableMode(null);
    setVariableData({});
  };

  // 获取变量列表（排除 name, activate, domain）
  const getVariables = () => {
    if (!profile) return [];
    return Object.keys(profile)
      .filter(key => !['name', 'activate', 'domain'].includes(key))
      .sort();
  };

  // 检查变量在哪些 API 中被使用
  const findVariableUsage = (varName) => {
    const usage = [];
    apis?.forEach(api => {
      const checkInString = (str) => {
        if (typeof str !== 'string') return false;
        return str.includes(`{${varName}}`);
      };
      
      // 检查 api_path
      if (checkInString(api.api_path)) {
        usage.push(api.name);
        return;
      }
      
      // 检查 header
      Object.values(api.header || {}).forEach(val => {
        if (checkInString(val)) usage.push(api.name);
      });
      
      // 检查 param
      Object.values(api.param || {}).forEach(val => {
        if (checkInString(val)) usage.push(api.name);
      });
      
      // 检查 body
      if (api.body) {
        if (typeof api.body === 'string') {
          if (checkInString(api.body)) usage.push(api.name);
        } else {
          const checkInObject = (obj) => {
            Object.values(obj).forEach(val => {
              if (checkInString(val)) usage.push(api.name);
              if (typeof val === 'object' && val !== null) {
                checkInObject(val);
              }
            });
          };
          checkInObject(api.body);
        }
      }
    });
    
    return [...new Set(usage)]; // 去重
  };

  const handleVariableDelete = (varName) => {
    const usage = findVariableUsage(varName);
    
    if (usage.length > 0) {
      alert(`变量 "${varName}" 被以下 API 使用，无法删除：\n${usage.join('\n')}`);
      return;
    }
    
    // 显示删除确认对话框
    const confirmed = window.confirm(
      `确定要删除变量 "${varName}" 吗？\n\n` +
      `该变量在所有环境中的值：\n` +
      allProfiles.map(p => `  ${p.name}: ${p[varName]}`).join('\n')
    );
    
    if (confirmed) {
      allProfiles.forEach(p => {
        const { [varName]: removed, ...rest } = p;
        projectManager.updateProfile(p.name, rest);
      });
      onUpdate();
    }
  };

  if (variableMode) {
    return (
      <VariableManager
        mode={variableMode}
        variableData={variableData}
        allProfiles={allProfiles}
        onSave={handleVariableSave}
        onCancel={handleVariableCancel}
      />
    );
  }

  return (
    <div className="environment-detail">
      {/* 头部 */}
      <div className="detail-header">
        <div className="header-left">
          <button className="back-button" onClick={onBack}>
            <X size={20} />
          </button>
          <div className="header-title">
            <Globe size={20} />
            <h2>环境配置</h2>
          </div>
        </div>
        <div className="header-actions">
          {profile?.activate && (
            <span className="default-badge">默认环境</span>
          )}
          {!isEditing ? (
            <>
              {!profile?.activate && (
                <button 
                  className="icon-button"
                  onClick={handleSetDefault}
                  title="设为默认"
                >
                  <Check size={18} />
                </button>
              )}
              <button 
                className="icon-button"
                onClick={() => setIsEditing(true)}
                title="编辑"
              >
                <Edit2 size={18} />
              </button>
              <button 
                className="icon-button danger"
                onClick={handleDelete}
                title="删除"
              >
                <Trash2 size={18} />
              </button>
            </>
          ) : (
            <>
              <button 
                className="icon-button"
                onClick={handleCancel}
                title="取消"
              >
                <X size={18} />
              </button>
              <button 
                className="icon-button primary"
                onClick={handleSave}
                title="保存"
              >
                <Check size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 内容 */}
      <div className="detail-content">
        {showDeleteConfirm ? (
          <div className="delete-confirm">
            <AlertTriangle size={48} className="warning-icon" />
            <h3>确认删除环境</h3>
            <p>确定要删除环境 "{profile?.name}" 吗？</p>
            <p className="warning-text">此操作不可恢复！</p>
            <div className="confirm-actions">
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                取消
              </button>
              <button className="btn-danger" onClick={confirmDelete}>
                确认删除
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 基本信息 */}
            <div className="info-section">
              <h3>基本信息</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>环境名称</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      placeholder="例如: dev, test, prod"
                    />
                  ) : (
                    <span>{profile?.name}</span>
                  )}
                </div>
                <div className="info-item">
                  <label>域名</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.domain}
                      onChange={(e) => setEditData({ ...editData, domain: e.target.value })}
                      placeholder="例如: 192.168.1.1"
                    />
                  ) : (
                    <span>{profile?.domain}</span>
                  )}
                </div>
              </div>
            </div>

            {/* 变量列表 */}
            <div className="variables-section">
              <div className="section-header">
                <h3>变量配置</h3>
                <button className="add-var-btn" onClick={handleVariableAdd}>
                  <Plus size={16} />
                  添加变量
                </button>
              </div>
              
              {getVariables().length === 0 ? (
                <div className="empty-variables">
                  <p>暂无变量配置</p>
                  <button className="btn-primary" onClick={handleVariableAdd}>
                    添加第一个变量
                  </button>
                </div>
              ) : (
                <div className="variables-list">
                  {getVariables().map(varName => (
                    <div key={varName} className="variable-item">
                      <div className="variable-header">
                        <div className="variable-name">
                          <code>{`{${varName}}`}</code>
                        </div>
                        <div className="variable-actions">
                          <button 
                            className="icon-button small"
                            onClick={() => handleVariableEdit(varName)}
                            title="编辑变量"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            className="icon-button small danger"
                            onClick={() => handleVariableDelete(varName)}
                            title="删除变量"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="variable-values">
                        <table>
                          <thead>
                            <tr>
                              <th>环境</th>
                              <th>值</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allProfiles.map(p => (
                              <tr key={p.name}>
                                <td>{p.name}</td>
                                <td className={p.name === profile.name ? 'highlight' : ''}>
                                  <code>{p[varName] || '-'}</code>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default EnvironmentDetail;