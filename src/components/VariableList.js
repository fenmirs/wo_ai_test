import React, { useState, useEffect } from 'react';
import { Variable, Plus, Trash2, X, AlertTriangle, Edit2 } from 'lucide-react';
import { projectManager } from '../utils/ProjectManager';
import './VariableList.css';

function VariableList({ profiles, onBack }) {
  const [variables, setVariables] = useState([]);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    loadVariables();
  }, [profiles]);

  const loadVariables = () => {
    if (!profiles || profiles.length === 0) {
      setVariables([]);
      return;
    }
    
    const varNames = new Set();
    profiles.forEach(p => {
      Object.keys(p).forEach(key => {
        if (!['name', 'activate', 'domain'].includes(key)) {
          varNames.add(key);
        }
      });
    });
    
    setVariables(Array.from(varNames).sort());
  };

  const getVariableValue = (varName, profileName) => {
    const profile = profiles?.find(p => p.name === profileName);
    return profile ? (profile[varName] || '') : '';
  };

  const handleCellClick = (varName, profileName) => {
    const value = getVariableValue(varName, profileName);
    setEditingCell({ varName, profileName });
    setEditValue(value);
  };

  const handleCellBlur = () => {
    if (!editingCell) return;
    
    const { varName, profileName } = editingCell;
    const profile = profiles.find(p => p.name === profileName);
    if (profile) {
      projectManager.updateProfile(profileName, { [varName]: editValue });
    }
    
    setEditingCell(null);
    setEditValue('');
  };

  const handleCellKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleAddVariable = () => {
    if (!newVarName.trim()) {
      alert('请输入变量名称');
      return;
    }
    
    const exists = variables.includes(newVarName.trim());
    if (exists) {
      alert(`变量 "${newVarName}" 已存在`);
      return;
    }
    
    profiles.forEach(profile => {
      projectManager.updateProfile(profile.name, { [newVarName.trim()]: '' });
    });
    
    setNewVarName('');
    setIsAdding(false);
    loadVariables();
  };

  const handleDeleteVariable = (varName) => {
    const usages = getAPIUsages(varName);
    setDeleteTarget({ name: varName, usages });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    
    const varName = deleteTarget.name;
    profiles.forEach(profile => {
      const newData = { ...profile };
      delete newData[varName];
      projectManager.updateProfile(profile.name, newData);
    });
    
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
    loadVariables();
  };

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
          <h3>变量表格（行: 变量名, 列: 环境）</h3>
          {!isAdding && (
            <button className="add-btn" onClick={() => setIsAdding(true)}>
              <Plus size={16} />
              新增变量
            </button>
          )}
        </div>

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
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddVariable();
                    if (e.key === 'Escape') { setIsAdding(false); setNewVarName(''); }
                  }}
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => { setIsAdding(false); setNewVarName(''); }}>
                取消
              </button>
              <button className="btn-primary" onClick={handleAddVariable}>
                确认添加
              </button>
            </div>
          </div>
        )}

        {variables.length === 0 && !isAdding ? (
          <div className="empty-state">
            <Variable size={48} />
            <p>暂无变量</p>
            <button className="add-btn" onClick={() => setIsAdding(true)}>
              <Plus size={16} />
              新增变量
            </button>
          </div>
        ) : (
          <div className="variable-table-container">
            <table className="variable-table">
              <thead>
                <tr>
                  <th className="var-name-header">变量名</th>
                  {profiles?.map(profile => (
                    <th key={profile.name} className="env-header">
                      <div className="env-header-content">
                        <span className="env-name">{profile.name}</span>
                        {profile.activate && <span className="default-tag">默认</span>}
                      </div>
                    </th>
                  ))}
                  <th className="action-header">操作</th>
                </tr>
              </thead>
              <tbody>
                {variables.map(varName => (
                  <tr key={varName}>
                    <td className="var-name-cell">
                      <code>{`{${varName}}`}</code>
                    </td>
                    {profiles?.map(profile => (
                      <td 
                        key={profile.name} 
                        className="value-cell"
                        onClick={() => handleCellClick(varName, profile.name)}
                      >
                        {editingCell?.varName === varName && editingCell?.profileName === profile.name ? (
                          <input
                            type="text"
                            className="cell-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleCellKeyDown}
                            autoFocus
                          />
                        ) : (
                          <span className="cell-value">
                            {getVariableValue(varName, profile.name) || <span className="empty-placeholder">-</span>}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="action-cell">
                      <button
                        className="icon-button small danger"
                        onClick={() => handleDeleteVariable(varName)}
                        title="删除变量"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        <div className="table-tip">
          <p>💡 点击单元格可直接编辑变量值</p>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <AlertTriangle size={24} className="warning-icon" />
              <h3>确认删除</h3>
            </div>
            <div className="modal-body">
              <p>确定要删除变量 "{deleteTarget?.name}" 吗？</p>
              <p className="warning-text">该变量在所有环境中的值都将被删除！</p>
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
