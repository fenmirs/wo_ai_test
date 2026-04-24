import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertTriangle, Check, Globe, Variable } from 'lucide-react';
import { projectManager } from '../utils/ProjectManager';
import './EnvVarManager.css';

function EnvVarManager({ onBack }) {
  const [profiles, setProfiles] = useState([]);
  const [variables, setVariables] = useState([]);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isAddingEnv, setIsAddingEnv] = useState(false);
  const [isAddingVar, setIsAddingVar] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');
  const [newVarName, setNewVarName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [editingEnvName, setEditingEnvName] = useState(null);
  const [editEnvNameValue, setEditEnvNameValue] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const data = projectManager.getData();
    if (!data || !data.profile) {
      setProfiles([]);
      setVariables([]);
      return;
    }

    const vars = new Set();
    data.profile.forEach(p => {
      Object.keys(p).forEach(key => {
        if (!['name', 'activate', 'domain'].includes(key)) {
          vars.add(key);
        }
      });
    });

    setProfiles([...data.profile]);
    setVariables(Array.from(vars).sort());
  };

  const getValue = (varName, profileName) => {
    const profile = profiles.find(p => p.name === profileName);
    return profile ? (profile[varName] || '') : '';
  };

  const handleCellClick = (type, varName, profileName) => {
    if (type === 'value') {
      const value = getValue(varName, profileName);
      setEditingCell({ type, varName, profileName });
      setEditValue(value);
    } else if (type === 'domain') {
      const value = profiles.find(p => p.name === profileName)?.domain || '';
      setEditingCell({ type, varName: profileName, profileName });
      setEditValue(value);
    }
  };

  const handleCellBlur = () => {
    if (!editingCell) return;

    if (editingCell.type === 'value') {
      const { varName, profileName } = editingCell;
      projectManager.updateProfile(profileName, { [varName]: editValue });
    } else if (editingCell.type === 'domain') {
      const { profileName } = editingCell;
      projectManager.updateProfile(profileName, { domain: editValue });
    }

    setEditingCell(null);
    setEditValue('');
    loadData();
  };

  const handleCellKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleAddEnv = () => {
    if (!newEnvName.trim()) {
      alert('请输入环境名称');
      return;
    }

    const exists = profiles.find(p => p.name === newEnvName.trim());
    if (exists) {
      alert('环境名称已存在');
      return;
    }

    const newProfile = {
      name: newEnvName.trim(),
      activate: false,
      domain: ''
    };

    variables.forEach(v => {
      newProfile[v] = '';
    });

    projectManager.addProfile(newProfile);
    setNewEnvName('');
    setIsAddingEnv(false);
    loadData();
  };

  const handleDeleteEnv = (profileName) => {
    if (profiles.length <= 1) {
      alert('至少需要保留一个环境');
      return;
    }
    setShowDeleteConfirm({ type: 'env', name: profileName });
  };

  const handleSetDefault = (profileName) => {
    profiles.forEach(p => {
      projectManager.updateProfile(p.name, { activate: p.name === profileName });
    });
    loadData();
  };

  const handleAddVar = () => {
    if (!newVarName.trim()) {
      alert('请输入变量名称');
      return;
    }

    const exists = variables.includes(newVarName.trim());
    if (exists) {
      alert('变量名已存在');
      return;
    }

    profiles.forEach(p => {
      projectManager.updateProfile(p.name, { [newVarName.trim()]: '' });
    });

    setNewVarName('');
    setIsAddingVar(false);
    loadData();
  };

  const handleDeleteVar = (varName) => {
    setShowDeleteConfirm({ type: 'var', name: varName });
  };

  const confirmDelete = () => {
    if (!showDeleteConfirm) return;

    if (showDeleteConfirm.type === 'env') {
      projectManager.deleteProfile(showDeleteConfirm.name);
    } else {
      const varName = showDeleteConfirm.name;
      profiles.forEach(p => {
        projectManager.removeProfileField(p.name, varName);
      });
    }

    setShowDeleteConfirm(null);
    loadData();
  };

  const handleEnvNameDblClick = (profileName) => {
    setEditingEnvName(profileName);
    setEditEnvNameValue(profileName);
  };

  const handleEnvNameBlur = () => {
    if (!editingEnvName) return;

    const newName = editEnvNameValue.trim();
    if (newName && newName !== editingEnvName) {
      const exists = profiles.find(p => p.name === newName);
      if (exists) {
        alert('环境名称已存在');
      } else {
        const profile = profiles.find(p => p.name === editingEnvName);
        projectManager.updateProfile(editingEnvName, { ...profile, name: newName });
      }
    }

    setEditingEnvName(null);
    setEditEnvNameValue('');
    loadData();
  };

  const handleEnvNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleEnvNameBlur();
    } else if (e.key === 'Escape') {
      setEditingEnvName(null);
      setEditEnvNameValue('');
    }
  };

  return (
    <div className="env-var-manager">
      {/* <div className="evm-header">
        <div className="evm-title">
          <Globe size={20} />
          <h1>环境与变量管理</h1>
        </div>
        <button className="close-btn" onClick={onBack}>
          <X size={20} />
        </button>
      </div> */}

      <div className="evm-content">
        <div className="evm-toolbar">
          <button className="toolbar-btn" onClick={() => setIsAddingEnv(true)}>
            <Plus size={16} />
            新增环境
          </button>
          <button className="toolbar-btn" onClick={() => setIsAddingVar(true)}>
            <Plus size={16} />
            新增变量
          </button>
        </div>

        {isAddingEnv && (
          <div className="add-form">
            <input
              type="text"
              placeholder="环境名称"
              value={newEnvName}
              onChange={(e) => setNewEnvName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddEnv();
                if (e.key === 'Escape') { setIsAddingEnv(false); setNewEnvName(''); }
              }}
              autoFocus
            />
            <button className="btn-confirm" onClick={handleAddEnv}>
              <Check size={14} />
            </button>
            <button className="btn-cancel" onClick={() => { setIsAddingEnv(false); setNewEnvName(''); }}>
              <X size={14} />
            </button>
          </div>
        )}

        {isAddingVar && (
          <div className="add-form">
            <input
              type="text"
              placeholder="变量名称"
              value={newVarName}
              onChange={(e) => setNewVarName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddVar();
                if (e.key === 'Escape') { setIsAddingVar(false); setNewVarName(''); }
              }}
              autoFocus
            />
            <button className="btn-confirm" onClick={handleAddVar}>
              <Check size={14} />
            </button>
            <button className="btn-cancel" onClick={() => { setIsAddingVar(false); setNewVarName(''); }}>
              <X size={14} />
            </button>
          </div>
        )}

        <div className="evm-grid" style={{ '--env-count': profiles.length }}>
          <div className="grid-header" style={{ '--env-count': profiles.length }}>
            <div className="grid-corner">
              <Variable size={14} />
              <span>变量 / 环境</span>
            </div>
            {profiles.map(p => (
              <div key={p.name} className="grid-header-cell">
                <div className="env-name-wrapper">
                  {editingEnvName === p.name ? (
                    <input
                      type="text"
                      className="env-name-input"
                      value={editEnvNameValue}
                      onChange={(e) => setEditEnvNameValue(e.target.value)}
                      onBlur={handleEnvNameBlur}
                      onKeyDown={handleEnvNameKeyDown}
                      autoFocus
                    />
                  ) : (
                    <span 
                      className="env-name-text"
                      onDoubleClick={() => handleEnvNameDblClick(p.name)}
                    >
                      {p.name}
                    </span>
                  )}
                  {p.activate && <span className="default-tag">默认</span>}
                </div>
                <div className="env-actions">
                  {!p.activate && (
                    <button 
                      className="action-btn" 
                      onClick={() => handleSetDefault(p.name)}
                      title="设为默认"
                    >
                      <Check size={12} />
                    </button>
                  )}
                  <button 
                    className="action-btn danger" 
                    onClick={() => handleDeleteEnv(p.name)}
                    title="删除环境"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid-body" style={{ '--env-count': profiles.length }}>
            <div className="grid-row domain-row">
              <div className="grid-cell var-name-cell">
                <Globe size={14} />
                <span>域名</span>
              </div>
              {profiles.map(p => (
                <div 
                  key={p.name} 
                  className="grid-cell domain-cell"
                  onDoubleClick={() => handleCellClick('domain', null, p.name)}
                >
                  {editingCell?.type === 'domain' && editingCell?.profileName === p.name ? (
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
                    <span className="cell-text">
                      {p.domain || <span className="empty">未设置</span>}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {variables.map(varName => (
              <div key={varName} className="grid-row">
                <div className="grid-cell var-name-cell">
                  <code>{`{${varName}}`}</code>
                  <button 
                    className="delete-var-btn" 
                    onClick={() => handleDeleteVar(varName)}
                    title="删除变量"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                {profiles.map(p => (
                  <div 
                    key={p.name} 
                    className="grid-cell value-cell"
                    onDoubleClick={() => handleCellClick('value', varName, p.name)}
                  >
                    {editingCell?.type === 'value' && 
                     editingCell?.varName === varName && 
                     editingCell?.profileName === p.name ? (
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
                      <span className="cell-text">
                        {getValue(varName, p.name) || <span className="empty">-</span>}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}

            {variables.length === 0 && profiles.length > 0 && (
              <div className="grid-row empty-row">
                <div className="grid-cell" style={{ gridColumn: `span ${profiles.length + 1}` }}>
                  暂无变量，点击"新增变量"添加
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="evm-tip">
          <p>💡 提示：双击单元格可编辑变量值，双击环境名称可重命名</p>
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
              {showDeleteConfirm.type === 'env' ? (
                <>
                  <p>确定要删除环境 "{showDeleteConfirm.name}" 吗？</p>
                  <p className="warning-text">该环境下的所有变量值将被删除！</p>
                </>
              ) : (
                <>
                  <p>确定要删除变量 "{showDeleteConfirm.name}" 吗？</p>
                  <p className="warning-text">该变量在所有环境中的值都将被删除！</p>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(null)}>
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

export default EnvVarManager;
