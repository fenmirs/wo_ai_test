import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search } from 'lucide-react';
import { projectManager } from '../utils/ProjectManager';
import { toast } from './Toast';
import CodeEditor from './CodeEditor';
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

  if (!visible) return null;

  const item = items?.[rowIndex];
  if (!item) return null;

  const isEditingValue = field === 'value';
  const isEditingDesc = field === 'description';
  const activeType = isEditingValue ? (item.type || 'string') : 'description';
  const isReadonly = item.key && item.key.toLowerCase() === 'content-type';

  const getTypeLabel = (type) => {
    const labels = { string: 'String', number: 'Number', boolean: 'Boolean', file: 'File', json: 'Json String', xml: 'Xml String', ref: 'Ref Variable', description: '备注' };
    return labels[type] || type;
  };

  const handleHeaderEditorMount = useCallback((editor) => {
    headerEditorRef.current = editor;
  }, []);

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
        ) : isReadonly ? (
          <div className="kv-panel-empty">🔒 Content-Type 自动生成，不可编辑</div>
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
            {section === 'param' && typeof item.default === 'string' && item.default && (
              <div className="kv-validation-bar kv-encoding-info">
                <div>编码结果:</div>
                <div>{encodeURIComponent(item.default)}</div>
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
function parseRefValue(val) {
  if (typeof val !== 'string') return { apiId: null, scenarioId: null, fieldPath: '' };
  const m = val.match(/\{\{ref:([^}]+)\}\}/);
  if (!m) return { apiId: null, scenarioId: null, fieldPath: val || '' };
  const content = m[1];
  const atIdx = content.indexOf('@');
  if (atIdx >= 0) {
    const apiId = content.substring(0, atIdx);
    const afterAt = content.substring(atIdx + 1);
    const dotIdx = afterAt.indexOf('.');
    if (dotIdx >= 0) {
      return { apiId, scenarioId: afterAt.substring(0, dotIdx), fieldPath: afterAt.substring(dotIdx + 1) };
    }
    return { apiId, scenarioId: afterAt, fieldPath: '' };
  }
  const dotIdx = content.indexOf('.');
  if (dotIdx >= 0) {
    return { apiId: content.substring(0, dotIdx), scenarioId: null, fieldPath: content.substring(dotIdx + 1) };
  }
  return { apiId: null, scenarioId: null, fieldPath: val };
}

function assembleRefValue(apiId, scenarioId, fieldPath) {
  if (!apiId) return fieldPath || '';
  const scenarioPart = scenarioId ? `@${scenarioId}` : '';
  return `{{ref:${apiId}${scenarioPart}.${fieldPath}}}`;
}

function RefEditor({ value, onChange, excludeApiId }) {
  const parsed = parseRefValue(value);
  const [searchQuery, setSearchQuery] = useState('');
  const [refApiId, setRefApiId] = useState(parsed.apiId || null);
  const [refScenarioId, setRefScenarioId] = useState(parsed.scenarioId || null);
  const [refFieldPath, setRefFieldPath] = useState(parsed.fieldPath || '');
  const [refScenarios, setRefScenarios] = useState([]);
  const [loadingScenarios, setLoadingScenarios] = useState(false);

  useEffect(() => {
    const p = parseRefValue(value);
    setRefApiId(p.apiId);
    setRefScenarioId(p.scenarioId);
    setRefFieldPath(p.fieldPath || '');
  }, [value]);

  useEffect(() => {
    if (!refApiId) { setRefScenarios([]); return; }
    setLoadingScenarios(true);
    projectManager.loadAPIData(refApiId).then(data => {
      if (data?.scenarios) {
        const list = Object.values(data.scenarios).filter(s => !s.deleted);
        setRefScenarios(list);
        if (!refScenarioId && list.length > 0) {
          setRefScenarioId(list[0].id);
        }
      } else {
        setRefScenarios([]);
      }
    }).catch(() => setRefScenarios([])).finally(() => setLoadingScenarios(false));
  }, [refApiId]);

  const handleApiSelect = (apiId) => {
    setRefApiId(apiId);
    setRefScenarioId(null);
    setRefFieldPath('');
    onChange(assembleRefValue(apiId, null, ''));
  };

  const handleScenarioSelect = (scenarioId) => {
    setRefScenarioId(scenarioId);
    onChange(assembleRefValue(refApiId, scenarioId, refFieldPath));
  };

  const handleFieldPathChange = (e) => {
    const newPath = e.target.value;
    setRefFieldPath(newPath);
    onChange(assembleRefValue(refApiId, refScenarioId, newPath));
  };

  const handleClear = () => {
    setRefApiId(null);
    setRefScenarioId(null);
    setRefFieldPath('');
    onChange('');
  };

  // Load API data
  const projectData = projectManager.getData();
  const allApis = projectData?.apis || [];
  const groups = projectData?.groups || [];

  const groupMap = {};
  groups.forEach(g => { groupMap[g.id] = g; });

  const getGroupPath = (groupId) => {
    const path = [];
    let current = groupMap[groupId];
    while (current) {
      path.unshift(current.name);
      current = groupMap[current.parentId];
    }
    return path.join(' / ');
  };

  const availableApis = allApis.filter(a => {
    if (excludeApiId && a.id === excludeApiId) return false;
    const cache = projectManager._apiDataCache?.[a.id];
    const scns = cache?.scenarios ? Object.values(cache.scenarios).filter(s => !s.deleted) : [];
    return scns.length > 0;
  });

  const groupedApis = {};
  availableApis.forEach(api => {
    const gid = api.group || 'default';
    if (!groupedApis[gid]) {
      groupedApis[gid] = { name: gid === 'default' ? '默认' : getGroupPath(gid), apis: [] };
    }
    groupedApis[gid].apis.push(api);
  });

  const filteredGroups = {};
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    Object.entries(groupedApis).forEach(([gid, g]) => {
      const matched = g.apis.filter(a => (a.name && a.name.toLowerCase().includes(q)) || (a.id && a.id.toLowerCase().includes(q)));
      if (matched.length > 0) {
        filteredGroups[gid] = { ...g, apis: matched };
      }
    });
  }

  const displayGroups = searchQuery ? filteredGroups : groupedApis;

  return (
    <div className="kv-panel-editor-wrapper">
      <div className="kv-ref-editor">
        {/* Assembled value at top */}
        <div className="kv-ref-value">
          <div className="kv-ref-value-label">引用值</div>
          <div className="kv-ref-value-box">
            {refApiId ? (
              <>
                <span className="kv-ref-prefix">{`{{ref:${refApiId}${refScenarioId ? `@${refScenarioId}` : ''}.`}</span>
                <input
                  className="kv-ref-field-input"
                  value={refFieldPath}
                  onChange={handleFieldPathChange}
                  placeholder="data.field"
                />
                <span className="kv-ref-suffix">}}</span>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>选择下方 API 后自动生成</span>
            )}
          </div>
        </div>

        <div className="kv-ref-divider" />

        {/* API filter + list */}
        <div className="kv-ref-section-label">选择 API</div>
        <div className="kv-ref-search">
          <Search size={12} className="kv-ref-search-icon" />
          <input
            type="text"
            placeholder="搜索 API..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="kv-ref-api-list">
          {Object.entries(displayGroups).map(([gid, g]) => (
            <div key={gid}>
              <div className="kv-ref-api-group-title">{g.name}</div>
              {g.apis.map(api => (
                <div
                  key={api.id}
                  className={`kv-ref-api-item ${refApiId === api.id ? 'selected' : ''}`}
                  onClick={() => handleApiSelect(api.id)}
                >
                  <div className="kv-ref-api-radio" />
                  <span className="kv-ref-api-name">{api.name}</span>
                  <span className="kv-ref-api-id">{api.id.slice(-6)}</span>
                </div>
              ))}
            </div>
          ))}
          {Object.keys(displayGroups).length === 0 && (
            <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              {searchQuery ? '无匹配 API' : '暂无可引用 API'}
            </div>
          )}
        </div>

        {/* Scenarios */}
        <div className="kv-ref-section-label">选择场景</div>
        <div className="kv-ref-scenarios">
          {loadingScenarios ? (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>加载中...</span>
          ) : refScenarios.length > 0 ? (
            refScenarios.map(scn => (
              <div
                key={scn.id}
                className={`kv-ref-scenario-tag ${refScenarioId === scn.id ? 'selected' : ''}`}
                onClick={() => handleScenarioSelect(scn.id)}
              >
                {scn.name}
              </div>
            ))
          ) : refApiId ? (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>该 API 暂无场景</span>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>请先选择 API</span>
          )}
        </div>

        {/* Clear button */}
        <div style={{ flexShrink: 0 }}>
          <button className="kv-ref-clear-btn" onClick={handleClear}>清除所有选择</button>
        </div>
      </div>
    </div>
  );
}

export default KVBottomPanel;
