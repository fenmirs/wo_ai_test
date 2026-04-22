import React, { useState, useEffect } from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';
import './VariableManager.css';

function VariableManager({ mode, variableData, allProfiles, onSave, onCancel }) {
  const [formData, setFormData] = useState({ name: '', value: '' });
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (mode === 'edit' && variableData) {
      setFormData({ name: variableData.name, value: variableData.value });
      // 初始化所有环境的值
      const initialValues = {};
      allProfiles.forEach(p => {
        initialValues[p.name] = p[variableData.name] || '';
      });
      setValues(initialValues);
    } else if (mode === 'add') {
      setFormData({ name: '', value: '' });
      const initialValues = {};
      allProfiles.forEach(p => {
        initialValues[p.name] = '';
      });
      setValues(initialValues);
    }
  }, [mode, variableData, allProfiles]);

  const validate = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = '变量名不能为空';
    } else {
      // 检查变量名是否重复（排除自己）
      const existingVars = new Set();
      allProfiles.forEach(p => {
        Object.keys(p).forEach(key => {
          if (!['name', 'activate', 'domain'].includes(key)) {
            existingVars.add(key);
          }
        });
      });
      
      if (mode === 'add' && existingVars.has(formData.name)) {
        newErrors.name = `变量名 "${formData.name}" 已存在`;
      } else if (mode === 'edit' && formData.name !== variableData.name && existingVars.has(formData.name)) {
        newErrors.name = `变量名 "${formData.name}" 已存在`;
      }
    }
    
    // 检查至少有一个环境的值不为空
    const hasValue = Object.values(values).some(v => v.trim());
    if (!hasValue) {
      newErrors.value = '至少需要为某个环境设置值';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    
    // 如果是编辑模式且变量名改变了，需要处理重命名
    if (mode === 'edit' && formData.name !== variableData.name) {
      const confirmed = window.confirm(
        `变量名将从 "${variableData.name}" 改为 "${formData.name}"\n\n` +
        `这将影响所有使用该变量的 API 配置。确定继续吗？`
      );
      if (!confirmed) return;
    }
    
    onSave(formData);
  };

  const handleValueChange = (profileName, value) => {
    setValues(prev => ({
      ...prev,
      [profileName]: value
    }));
  };

  return (
    <div className="variable-manager">
      <div className="manager-header">
        <h2>{mode === 'add' ? '添加变量' : '编辑变量'}</h2>
      </div>
      
      <div className="manager-content">
        {/* 变量名 */}
        <div className="form-group">
          <label>
            变量名 *
            <span className="help-text">将在 API 配置中使用如: {`{变量名}`}</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="例如: api-prj, lcgl-prj"
            className={errors.name ? 'error' : ''}
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>

        {/* 环境值 */}
        <div className="form-group">
          <label>
            环境值 *
            <span className="help-text">为每个环境设置变量的值</span>
          </label>
          <div className="values-table">
            <table>
              <thead>
                <tr>
                  <th>环境</th>
                  <th>值</th>
                </tr>
              </thead>
              <tbody>
                {allProfiles.map(profile => (
                  <tr key={profile.name}>
                    <td>{profile.name}</td>
                    <td>
                      <input
                        type="text"
                        value={values[profile.name] || ''}
                        onChange={(e) => handleValueChange(profile.name, e.target.value)}
                        placeholder="输入变量值"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errors.value && <span className="error-message">{errors.value}</span>}
        </div>

        {/* 预览 */}
        {formData.name && (
          <div className="preview-section">
            <label>使用示例</label>
            <div className="preview-box">
              <code>{`{${formData.name}}`}</code>
              <span>→</span>
              <code>{values[allProfiles[0]?.name] || '(未设置)'}</code>
            </div>
          </div>
        )}

        {/* 警告 */}
        {mode === 'edit' && formData.name !== variableData.name && (
          <div className="warning-section">
            <AlertTriangle size={16} />
            <span>修改变量名后，需要手动更新所有引用该变量的 API 配置</span>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="manager-actions">
        <button className="btn-secondary" onClick={onCancel}>
          <X size={16} />
          取消
        </button>
        <button className="btn-primary" onClick={handleSave}>
          <Check size={16} />
          保存
        </button>
      </div>
    </div>
  );
}

export default VariableManager;