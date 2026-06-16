import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import './ApplyTemplateDialog.css';

function ApplyTemplateDialog({ templates, onApply, onClose }) {
  const [selectedTplId, setSelectedTplId] = useState(null);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [mergeMode, setMergeMode] = useState('append');

  const selectedTpl = templates.find(t => t.id === selectedTplId);

  useEffect(() => {
    if (templates.length > 0 && !selectedTplId) {
      setSelectedTplId(templates[0].id);
    }
  }, [templates]);

  useEffect(() => {
    if (selectedTpl) {
      const allIds = [];
      selectedTpl.sections.header.forEach((_, i) => allIds.push(`h_${i}`));
      selectedTpl.sections.param.forEach((_, i) => allIds.push(`p_${i}`));
      if (selectedTpl.sections.body) allIds.push('body');
      setSelectedItems(new Set(allIds));
    }
  }, [selectedTplId]);

  const toggleItem = (id) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getItemLabel = (type, idx) => {
    if (type === 'h') {
      const h = selectedTpl.sections.header[idx];
      return `Header: ${h.key}`;
    }
    if (type === 'p') {
      const p = selectedTpl.sections.param[idx];
      return `Param: ${p.key}`;
    }
    return 'Body';
  };

  const getItemValue = (type, idx) => {
    if (type === 'h') return selectedTpl.sections.header[idx]?.default || '';
    if (type === 'p') return selectedTpl.sections.param[idx]?.default || '';
    const ct = selectedTpl.sections.body?.activeContentType || 'json';
    const preview = (selectedTpl.sections.body?.content || '').slice(0, 60);
    return `[${ct.toUpperCase()}] ${preview || '(空)'}`;
  };

  const handleApply = () => {
    if (!selectedTpl) return;
    const hItems = [];
    const pItems = [];
    let bodyItem = null;

    selectedTpl.sections.header.forEach((item, i) => {
      if (selectedItems.has(`h_${i}`)) hItems.push({ ...item });
    });
    selectedTpl.sections.param.forEach((item, i) => {
      if (selectedItems.has(`p_${i}`)) pItems.push({ ...item });
    });
    if (selectedItems.has('body') && selectedTpl.sections.body) {
      bodyItem = JSON.parse(JSON.stringify(selectedTpl.sections.body));
    }

    onApply({ header: hItems, param: pItems, body: bodyItem }, mergeMode);
  };

  const allSelected = (() => {
    if (!selectedTpl) return false;
    const total = selectedTpl.sections.header.length + selectedTpl.sections.param.length + (selectedTpl.sections.body ? 1 : 0);
    return selectedItems.size === total;
  })();

  const toggleAll = () => {
    if (!selectedTpl) return;
    if (allSelected) {
      setSelectedItems(new Set());
    } else {
      const allIds = [];
      selectedTpl.sections.header.forEach((_, i) => allIds.push(`h_${i}`));
      selectedTpl.sections.param.forEach((_, i) => allIds.push(`p_${i}`));
      if (selectedTpl.sections.body) allIds.push('body');
      setSelectedItems(new Set(allIds));
    }
  };

  return (
    <div className="apply-tpl-overlay" onClick={onClose}>
      <div className="apply-tpl-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="apply-tpl-header">
          <span className="apply-tpl-title">应用参数模板</span>
          <button className="apply-tpl-close" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="apply-tpl-body">
          <div className="apply-tpl-select-row">
            <label className="apply-tpl-label">选择模板</label>
            <select
              className="apply-tpl-select"
              value={selectedTplId || ''}
              onChange={(e) => setSelectedTplId(e.target.value)}
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {selectedTpl && (
            <>
              <div className="apply-tpl-mode-row">
                <label className="apply-tpl-label">合并方式</label>
                <div className="apply-tpl-mode-options">
                  <label className={`apply-tpl-mode ${mergeMode === 'append' ? 'active' : ''}`}>
                    <input type="radio" name="mergeMode" value="append"
                      checked={mergeMode === 'append'}
                      onChange={() => setMergeMode('append')}
                    />
                    追加（保留现有参数）
                  </label>
                  <label className={`apply-tpl-mode ${mergeMode === 'overwrite' ? 'active' : ''}`}>
                    <input type="radio" name="mergeMode" value="overwrite"
                      checked={mergeMode === 'overwrite'}
                      onChange={() => setMergeMode('overwrite')}
                    />
                    覆盖（替换同名 section）
                  </label>
                </div>
              </div>

              <div className="apply-tpl-items-header">
                <span className="apply-tpl-items-title">选择要应用的条目</span>
                <button className="apply-tpl-toggle-all" onClick={toggleAll}>
                  {allSelected ? '取消全选' : '全选'}
                </button>
              </div>

              <div className="apply-tpl-items">
                {selectedTpl.sections.header.map((item, i) => (
                  <label key={`h_${i}`} className="apply-tpl-item">
                    <input type="checkbox" checked={selectedItems.has(`h_${i}`)}
                      onChange={() => toggleItem(`h_${i}`)}
                    />
                    <span className="apply-tpl-item-badge badge-header">H</span>
                    <span className="apply-tpl-item-key">{item.key}</span>
                    <span className="apply-tpl-item-val">{item.default}</span>
                  </label>
                ))}
                {selectedTpl.sections.param.map((item, i) => (
                  <label key={`p_${i}`} className="apply-tpl-item">
                    <input type="checkbox" checked={selectedItems.has(`p_${i}`)}
                      onChange={() => toggleItem(`p_${i}`)}
                    />
                    <span className="apply-tpl-item-badge badge-param">P</span>
                    <span className="apply-tpl-item-key">{item.key}</span>
                    <span className="apply-tpl-item-val">{item.default}</span>
                  </label>
                ))}
                {selectedTpl.sections.body && (
                  <label className="apply-tpl-item">
                    <input type="checkbox" checked={selectedItems.has('body')}
                      onChange={() => toggleItem('body')}
                    />
                    <span className="apply-tpl-item-badge badge-body">B</span>
                    <span className="apply-tpl-item-key">Body</span>
                    <span className="apply-tpl-item-val">{(selectedTpl.sections.body.activeContentType || 'json').toUpperCase()}</span>
                  </label>
                )}
              </div>

              {selectedItems.size === 0 && (
                <div className="apply-tpl-empty">请至少选择一个条目</div>
              )}
            </>
          )}
        </div>

        <div className="apply-tpl-footer">
          <button className="apply-tpl-btn-cancel" onClick={onClose}>取消</button>
          <button
            className="apply-tpl-btn-apply"
            onClick={handleApply}
            disabled={selectedItems.size === 0}
          >
            <Check size={12} /> 应用 {selectedItems.size > 0 ? `(${selectedItems.size} 项)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApplyTemplateDialog;
