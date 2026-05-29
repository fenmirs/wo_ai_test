import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from './Toast';
import CodeEditor from './CodeEditor';
import RefSelector from './RefSelector';
import './KVBottomPanel.css';

const SECTION_LABELS = {
  param: 'Params',
  header: 'Headers',
  formData: 'form-data',
  xwww: 'x-www-form-urlencoded',
};

function KVBottomPanel({ visible, section, rowIndex, field, items, onItemsChange, onClose, theme, excludeApiId }) {
  const [collapsed, setCollapsed] = useState(false);
  const [panelHeight, setPanelHeight] = useState(250);
  const fileInputRef = useRef(null);
  const lastToastRef = useRef(0);
  const headerEditorRef = useRef(null);

  // --- Resize ---
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = panelHeight;
    const onMove = (ev) => {
      const delta = startY - ev.clientY;
      setPanelHeight(Math.max(100, Math.min(window.innerHeight * 0.6, startHeight + delta)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [panelHeight]);

  // Reset collapse when visibility/section/row/field changes
  useEffect(() => {
    if (visible) setCollapsed(false);
  }, [visible, section, rowIndex, field]);

  const handleHeaderEditorMount = useCallback((editor) => {
    headerEditorRef.current = editor;
  }, []);

  if (!visible) return null;

  const item = items?.[rowIndex];
  if (!item) return null;

  const isEditingValue = field === 'value';
  const isEditingDesc = field === 'description';
  const activeType = isEditingValue ? (item.type || 'string') : 'description';
  const isContentType = item.key && item.key.toLowerCase() === 'content-type';

  const getTypeLabel = (type) => {
    const labels = { string: 'String', number: 'Number', boolean: 'Boolean', file: 'File', json: 'Json String', xml: 'Xml String', ref: 'Ref Variable', description: '备注' };
    return labels[type] || type;
  };

  const updateDefault = (newVal) => {
    if (!onItemsChange) return;
    let finalVal = newVal;
    if (section === 'header') {
      const str = String(newVal);
      const cleaned = str.replace(/[^\t\x20-\x7e]/g, '');
      if (cleaned !== str) {
        if (Date.now() - lastToastRef.current > 1000) {
          const removed = [...new Set(str.replace(/[\t\x20-\x7e]/g, '').split(''))].join('');
          toast.info(`已去掉特殊字符: ${removed}`);
          lastToastRef.current = Date.now();
        }
        if (headerEditorRef.current) {
          headerEditorRef.current.setValue(cleaned);
        }
        return;
      }
    }
    const newItems = items.map((it, i) => i === rowIndex ? { ...it, default: finalVal } : it);
    onItemsChange(newItems);
  };

  const updateDescription = (newDesc) => {
    if (!onItemsChange) return;
    const newItems = items.map((it, i) => i === rowIndex ? { ...it, description: newDesc } : it);
    onItemsChange(newItems);
  };

  const keyEmpty = !item.key || !item.key.trim();

  if (collapsed) {
    const sectionLabel = SECTION_LABELS[section] || section;
    return (
      <div className="kv-panel-collapsed-bar" onClick={() => setCollapsed(false)} title="展开底部面板">
        <span>编辑{isEditingValue ? '值' : '备注'}: {item.key || '(空key)'} ({getTypeLabel(activeType)})</span>
        <span>↕ 展开</span>
      </div>
    );
  }

  return (
    <div className="kv-bottom-panel" style={{ height: panelHeight }}>
      <div className="kv-panel-header" onMouseDown={handleResizeStart}>
        <div className="kv-panel-header-title">
          <span>编辑{isEditingValue ? '值' : '备注'}:</span>
          <strong>{item.key || '(空key)'}</strong>
          <span className="kv-panel-section">({SECTION_LABELS[section] || section})</span>
          <span className={`kv-panel-type-badge ${activeType === 'description' ? 'type-description' : ''}`}>
            {getTypeLabel(activeType)}
          </span>
        </div>
        <div className="kv-panel-header-actions">
          <button className="kv-panel-toggle-btn" onClick={() => setCollapsed(true)} title="折叠">
            ↕
          </button>
        </div>
      </div>

      <div className="kv-panel-body">
        {keyEmpty ? (
          <div className="kv-panel-empty">⚠ 请先填写 Key 名称</div>
        ) : isEditingDesc && isContentType ? (
          <div className="kv-panel-empty">🔒 Content-Type 备注不可编辑</div>
        ) : isEditingDesc ? (
          <div className="kv-panel-editor-wrapper">
            <CodeEditor
              value={item.description || ''}
              onChange={updateDescription}
              contentType="text"
              theme={theme}
            />
          </div>
        ) : (
          <div className="kv-panel-editor-wrapper">
            <ValueEditor
              type={activeType}
              value={item.default}
              onChange={updateDefault}
              theme={theme}
              excludeApiId={excludeApiId}
              fileInputRef={fileInputRef}
              onMount={handleHeaderEditorMount}
            />
            {section === 'param' && typeof item.default === 'string' && item.default && activeType !== 'ref' && (
              <div className="kv-encoding-info">
                <div className="kv-encoding-label">编码结果:</div>
                <div className="kv-encoding-value">{encodeURIComponent(item.default)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ====== Type-driven value editor ====== */
function ValueEditor({ type, value, onChange, theme, excludeApiId, fileInputRef, onMount }) {
  switch (type) {
    case 'boolean':
      return <BooleanEditor value={value} onChange={onChange} />;
    case 'file':
      return <FileEditor value={value} onChange={onChange} fileInputRef={fileInputRef} />;
    case 'json':
      return (
        <div className="kv-panel-editor-wrapper">
          <CodeEditor value={typeof value === 'string' ? value : ''} onChange={onChange} contentType="json" theme={theme} />
        </div>
      );
    case 'xml':
      return (
        <div className="kv-panel-editor-wrapper">
          <CodeEditor value={typeof value === 'string' ? value : ''} onChange={onChange} contentType="xml" theme={theme} />
        </div>
      );
    case 'ref':
      return <RefEditor value={value} onChange={onChange} excludeApiId={excludeApiId} />;
    default:
      return (
        <div className="kv-panel-editor-wrapper">
          <CodeEditor value={typeof value === 'string' ? value : ''} onChange={onChange} contentType="text" theme={theme} onMount={onMount} />
        </div>
      );
  }
}

/* ====== Boolean Editor ====== */
function BooleanEditor({ value, onChange }) {
  const boolVal = value === 'true' || value === true;
  return (
    <div className="kv-panel-editor-wrapper">
      <div className="kv-boolean-toggle">
        <span className={`kv-bool-label ${!boolVal ? 'active' : ''}`}>false</span>
        <label className="kv-boolean-switch">
          <input type="checkbox" checked={boolVal} onChange={(e) => onChange(e.target.checked ? 'true' : 'false')} />
          <span className="kv-bool-slider" />
        </label>
        <span className={`kv-bool-label ${boolVal ? 'active' : ''}`}>true</span>
      </div>
    </div>
  );
}

/* ====== File Editor ====== */
function getFileList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

function FileEditor({ value, onChange, fileInputRef }) {
  const files = getFileList(value);

  const handleAddFiles = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    const newNames = selected.map(f => f.name);
    const merged = [...files, ...newNames];
    onChange(merged.length === 1 ? merged[0] : merged);
    e.target.value = '';
  };

  const handleRemove = (idx) => {
    const merged = files.filter((_, i) => i !== idx);
    onChange(merged.length === 0 ? '' : merged.length === 1 ? merged[0] : merged);
  };

  return (
    <div className="kv-panel-editor-wrapper">
      <div className="kv-file-manager">
        {files.length > 0 && (
          <div className="kv-file-list">
            {files.map((f, i) => (
              <div key={i} className="kv-file-item">
                <span>📎</span>
                <span className="kv-file-name">{f}</span>
                <button className="kv-file-remove" onClick={() => handleRemove(i)} title="移除">✕</button>
              </div>
            ))}
          </div>
        )}
        <input type="file" ref={fileInputRef} onChange={handleAddFiles} multiple style={{ display: 'none' }} />
        <button className="kv-file-add-btn" onClick={() => fileInputRef.current?.click()}>
          + 添加文件
        </button>
        {files.length === 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>暂无已选文件</span>
        )}
      </div>
    </div>
  );
}

/* ====== Ref Variable Editor ====== */

function RefEditor({ value, onChange, excludeApiId }) {
  return (
    <div className="kv-panel-editor-wrapper">
      <RefSelector value={value} onChange={onChange} excludeApiId={excludeApiId} />
    </div>
  );
}

export default KVBottomPanel;
