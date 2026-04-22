import React, { useState, useRef, useEffect } from 'react';
import { Variable, Plus, Trash2, X, AlertTriangle } from 'lucide-react';
import { projectManager } from '../utils/ProjectManager';
import './VariableList.css';

function VariableList({ profiles, onBack }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // 获取所有环境共有的变量名
  const getAllVariableNames = () => {
    if (!profiles || profiles.length === 0) return [];
    const variables = new Set();
    Object.keys(profiles[0]).forEach(key => {
      if (!['name', 'activate', 'domain'].includes(key)) {
        variables.add(key);
      }
    });
    return Array.from(variables);
  };

  // 获取变量在所有环境中的值
  const getVariableValues = (varName) => {
    const values = {};
    profiles?.forEach(profile => {
      values[profile.name] = profile[varName] || '';
    });
    return values;
  };

  // 获取使用该变量的 API
  const getAPIUsages = (varName) => {
    const apis = projectManager.getData()?.apis || [];
    const usages = new Set();
    apis.forEach(api => {
      const checkUsage = (obj) => {
        if (typeof obj === 'string') {
          if (obj.includes(`{${varName}}`)) {
            usages.add(api.name);
          }
        } else if (typeof obj === 'object' && obj !== null) {
          Object.values(obj).forEach(checkUsage);
        }
      };
      
      checkUsage(api.api_path);
      checkUsage(api.header);
      checkUsage(api.param);
      checkUsage(api.body);
      api.chain?.forEach(chainApi => {
        if (chainApi === varName) {
          usages.add(api.name);
        }
      });
    });
    return Array.from(usages);
  };

  // 新增变量
  const handleAdd = () => {
    if (!newVarName.trim()) {
      alert('请输入变量名称');
      return;
    }

    profiles.forEach(profile => {
      projectManager.updateProfile(profile.name, {
        [newVarName.trim()]: newVarValue
      });
    });

    setNewVarName('');
    setNewVarValue('');
    setIsAdding(false);
  };

  // 更新单个环境的变量值
  const handleValueChange = (profileName, varName, newValue) => {
    projectManager.updateProfile(profileName, {
      [varName]: newValue
    });
  };

  // 删除变量
  const handleDelete = (varName) => {
    const usages = getAPIUsages(varName);
    setDeleteTarget({ name: varName, usages });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    profiles.forEach(profile => {
      const newData = { ...profile };
      delete newData[deleteTarget.name];
      projectManager.updateProfile(profile.name, newData);
    });
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  return (
    <div className="variable-list">
      <div className="list-header">
        <div className="header-left">
          <Variable size={20} />
          <h2>变量管理</h2>
        </div>
        <div className="header-actions">
          <button className="icon-button" onClick={onBack} title="返回">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="list-content">
        <div className="list-header-row">
          <h3>变量列表（所有环境共用）</h3>
          <button className="add-btn" onClick={() => setIsAdding(true)}>
            <Plus size={16} />
            新增变量
          </button>
        </div>

        {/* 新增变量表单 */}
        {isAdding && (
          <div className="add-variable-form">
            <div className="form-row">
              <div className="form-group flex-1">
                <label>变量名称 *</label>
                <input
                  type="text"
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value)}
                  placeholder="如：api-prj"
                />
              </div>
              <div className="form-group flex-1">
                <label>默认值 *</label>
                <input
                  type="text"
                  value={newVarValue}
                  onChange={(e) => setNewVarValue(e.target.value)}
                  placeholder="应用到所有环境"
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => {
                setIsAdding(false);
                setNewVarName('');
                setNewVarValue('');
              }}>
                取消
              </button>
              <button className="btn-primary" onClick={handleAdd}>
                确认添加
              </button>
            </div>
          </div>
        )}

        {getAllVariableNames().length === 0 && !isAdding ? (
          <div className="empty-state">
            <Variable size={48} />
            <p>暂无变量</p>
            <button className="add-btn" onClick={() => setIsAdding(true)}>
              <Plus size={16} />
              新增变量
            </button>
          </div>
        ) : (
          <div className="variable-items">
            {getAllVariableNames().map(varName => (
              <div key={varName} className="variable-item">
                <div className="variable-header">
                  <span className="variable-name">{varName}</span>
                  <button
                    className="icon-button small danger"
                    onClick={() => handleDelete(varName)}
                    title="删除变量"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="variable-values">
                  {profiles?.map(profile => (
                    <div key={profile.name} className="value-row">
                      <span className="env-name">{profile.name}:</span>
                      <input
                        type="text"
                        className="env-value-input"
                        value={profile[varName] || ''}
                        onChange={(e) => handleValueChange(profile.name, varName, e.target.value)}
                        placeholder="输入值"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
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
              <p>确定要删除变量 "{deleteTarget?.name}" 吗？</p>
              {deleteTarget?.usages?.length > 0 && (
                <>
                  <p className="warning-text">该变量正在被以下 API 使用：</p>
                  <ul className="usage-list">
                    {deleteTarget.usages.map(api => (
                      <li key={api}>{api}</li>
                    ))}
                  </ul>
                </>
              )}
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

export default VariableList;