import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Upload, Check } from 'lucide-react';
import './ImportDialog.css';

const tryDecode = (val) => {
  try { return decodeURIComponent(val); } catch (e) { return val; }
};

function parseQueryString(raw) {
  const items = [];
  const fullText = raw.trim();
  if (!fullText) return items;

  // 如果粘贴的是完整 URL，截取 ? 后面的 query string
  let text = fullText;
  const qIdx = text.indexOf('?');
  if (qIdx >= 0 && !text.includes('\n')) {
    text = text.substring(qIdx + 1);
  }

  const processPair = (pair) => {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > 0) {
      const key = pair.substring(0, eqIdx).trim();
      const value = tryDecode(pair.substring(eqIdx + 1).trim());
      if (key) items.push({ key, value });
    }
  };

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.includes('&')) {
      trimmed.split('&').forEach(p => processPair(p));
    } else {
      processPair(trimmed);
    }
  }
  return items;
}

function parseChromeHeaders(text) {
  const items = [];
  const lines = text.trim().split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      items.push({
        key: trimmed.substring(0, colonIdx).trim(),
        value: trimmed.substring(colonIdx + 1).trim()
      });
    }
  }
  return items;
}

function detectFormat(text) {
  const trimmed = text.trim();
  if (!trimmed) return 'query';
  const lines = trimmed.split('\n').filter(l => l.trim());
  if (lines.length === 0) return 'query';
  const colonLines = lines.filter(l => /^[\w-]+:\s/.test(l));
  if (colonLines.length >= lines.length * 0.5) return 'headers';
  return 'query';
}

function ImportDialog({ section, existingItems, onConfirm, onClose, initialText }) {
  const [rawText, setRawText] = useState(initialText || '');
  const [format, setFormat] = useState('auto');
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [overwriteConflicts, setOverwriteConflicts] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const parsedItems = useMemo(() => {
    if (!rawText.trim()) return [];
    const fmt = format === 'auto' ? detectFormat(rawText) : format;
    const items = fmt === 'headers' ? parseChromeHeaders(rawText) : parseQueryString(rawText);
    const seen = new Set();
    return items.filter(item => {
      const key = item.key;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rawText, format]);

  const existingMap = useMemo(() => {
    const map = {};
    if (existingItems) {
      existingItems.forEach(item => {
        if (item.key) map[item.key] = item.default ?? item.value ?? '';
      });
    }
    return map;
  }, [existingItems]);

  const itemStatusMap = useMemo(() => {
    const map = {};
    for (const item of parsedItems) {
      const existingVal = existingMap[item.key];
      if (existingVal === undefined) {
        map[item.key] = 'new';
      } else if (existingVal === item.value) {
        map[item.key] = 'unchanged';
      } else {
        map[item.key] = 'changed';
      }
    }
    return map;
  }, [parsedItems, existingMap]);

  const changedKeys = useMemo(() => {
    const s = new Set();
    for (const [key, status] of Object.entries(itemStatusMap)) {
      if (status === 'changed') s.add(key);
    }
    return s;
  }, [itemStatusMap]);

  const unchangedKeys = useMemo(() => {
    const s = new Set();
    for (const [key, status] of Object.entries(itemStatusMap)) {
      if (status === 'unchanged') s.add(key);
    }
    return s;
  }, [itemStatusMap]);

  const allKeys = useMemo(() => new Set(parsedItems.map(i => i.key)), [parsedItems]);

  useEffect(() => {
    const keys = new Set(allKeys);
    for (const key of unchangedKeys) keys.delete(key);
    setSelectedKeys(keys);
  }, [allKeys, unchangedKeys]);

  const allSelected = selectedKeys.size === allKeys.size && allKeys.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(allKeys));
    }
  };

  const toggleItem = (key) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedItems = parsedItems.filter(item => selectedKeys.has(item.key));
    onConfirm(selectedItems, overwriteConflicts);
  };

  const labelMap = { param: 'Params', header: 'Headers', formData: 'Body (form-data)', xwww: 'Body (x-www-form-urlencoded)' };
  const label = labelMap[section] || section;

  return (
    <div className="import-dialog-overlay" onClick={onClose}>
      <div className="import-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="import-dialog-header">
          <span className="import-dialog-title"><Upload size={14} /> 导入 {label}</span>
          <button className="import-dialog-close" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="import-dialog-body">
          <textarea
            ref={textareaRef}
            className="import-textarea"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={`在此粘贴${label}内容...\n${section === 'header' ? '支持格式: Key: Value（每行一个）' : '支持格式: key1=val1&key2=val2 或 每行 key=value'}`}
            spellCheck={false}
          />

          {rawText.trim() && (
            <div className="import-format-row">
              <span className="import-format-label">格式</span>
              <select className="import-format-select" value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="auto">自动检测</option>
                <option value="query">Query String (key=value)</option>
                {(section === 'param' || section === 'header') && (
                  <option value="headers">Headers (Key: Value)</option>
                )}
              </select>
            </div>
          )}

          {parsedItems.length > 0 && (
            <div className="import-preview">
              <div className="import-preview-header">
                <span className="import-preview-info">
                  将导入 <strong>{parsedItems.length}</strong> 项
                  {changedKeys.size > 0 && <span className="import-conflict-count">（其中 <strong>{changedKeys.size}</strong> 项冲突）</span>}
                </span>
                <button className="import-toggle-all" onClick={toggleAll}>
                  {allSelected ? '取消全选' : '全选'}
                </button>
              </div>

              <div className="import-item-list">
                {parsedItems.map((item, idx) => {
                  const status = itemStatusMap[item.key] || 'new';
                  const isChanged = status === 'changed';
                  const isUnchanged = status === 'unchanged';
                  const existing = isChanged || isUnchanged ? existingItems.find(i => i.key === item.key) : null;
                  return (
                    <label key={`${item.key}_${idx}`} className={`import-item ${isChanged ? 'import-item-conflict' : ''} ${isUnchanged ? 'import-item-unchanged' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(item.key)}
                        onChange={() => toggleItem(item.key)}
                      />
                      <span className="import-item-key">{item.key}</span>
                      <div className="import-item-value-wrap">
                        {(isChanged || isUnchanged) && existing ? (
                          <>
                            <span className="import-item-value-old" title={existing.default}>现有: {existing.default && existing.default.length > 50 ? existing.default.slice(0, 50) + '...' : existing.default || '(空)'}</span>
                            <span className="import-item-value-new" title={item.value}>导入: {item.value.length > 50 ? item.value.slice(0, 50) + '...' : item.value}</span>
                          </>
                        ) : (
                          <span className="import-item-value" title={item.value}>
                            {item.value.length > 60 ? item.value.slice(0, 60) + '...' : item.value}
                          </span>
                        )}
                      </div>
                      {isChanged ? (
                        <span className="import-item-badge badge-conflict" title="值发生变化">冲突</span>
                      ) : isUnchanged ? (
                        <span className="import-item-badge badge-unchanged" title="值与现有相同">无变化</span>
                      ) : (
                        <span className="import-item-badge badge-new">新增</span>
                      )}
                    </label>
                  );
                })}
              </div>

              {changedKeys.size > 0 && (
                <label className="import-overwrite">
                  <input
                    type="checkbox"
                    checked={overwriteConflicts}
                    onChange={(e) => setOverwriteConflicts(e.target.checked)}
                  />
                  <span className="import-overwrite-track">
                    <span className="import-overwrite-thumb" />
                  </span>
                  <span className="import-overwrite-label">覆盖所有冲突项（未勾选则保留现有值）</span>
                </label>
              )}
            </div>
          )}
        </div>

        <div className="import-dialog-footer">
          <button className="import-btn-cancel" onClick={onClose}>取消</button>
          <button
            className="import-btn-confirm"
            onClick={handleConfirm}
            disabled={selectedKeys.size === 0}
          >
            <Check size={12} /> 确认导入{selectedKeys.size > 0 ? ` ${selectedKeys.size} 项` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportDialog;
