import React, { useRef } from 'react';
import { Trash2, Plus, AlertCircle } from 'lucide-react';
import { validateHeaderName } from '../utils/HTTPValidator';
import { toast } from './Toast';
import './KVTable.css';

const ALL_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'file', label: 'File' },
  { value: 'json', label: 'Json String' },
  { value: 'xml', label: 'Xml String' },
  { value: 'ref', label: 'Ref Variable' },
];

const NON_FILE_TYPES = ALL_TYPES.filter(t => t.value !== 'file');

function getFileList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

function KVTable({ items, onItemsChange, section, showType, showFileType, onValueClick, onDescClick, onActiveRowChange, activeRowIndex, excludeApiId, theme, readOnly = false, hideTypes = [] }) {
  const typeOptions = (showFileType ? ALL_TYPES : NON_FILE_TYPES).filter(t => !hideTypes.includes(t.value));
  const lastToastRef = useRef(0);

  const parseRefPreview = (val) => {
    if (typeof val !== 'string') return val;
    const m = val.match(/\{\{ref:([^}]+)\}\}/);
    if (!m) return val;
    const content = m[1];
    const atIdx = content.indexOf('@');
    const apiId = atIdx >= 0 ? content.substring(0, atIdx) : content.split('.')[0];
    const path = atIdx >= 0 ? content.substring(atIdx + 1) : content;
    const shortId = apiId.length > 6 ? `#${apiId.slice(-6)}` : apiId;
    return `🔗 ${shortId}.${path}`;
  };

  const getValuePreview = (item) => {
    const val = item.default;
    if (!val || (Array.isArray(val) && val.length === 0)) {
      return <span className="kv-empty">(空)</span>;
    }
    switch (item.type) {
      case 'file': {
        const files = getFileList(val);
        const label = files.length === 1 ? files[0] : `${files[0]} (+${files.length - 1})`;
        return <span className="kv-preview-file">📎 {label}</span>;
      }
      case 'json':
        return <span className="kv-preview-code">{`{ JSON }`}</span>;
      case 'xml':
        return <span className="kv-preview-code">{`< XML >`}</span>;
      case 'ref':
        return <span className="kv-preview-ref">{parseRefPreview(val)}</span>;
      default: {
        const str = String(val);
        return str.length > 40 ? <span title={str}>{str.slice(0, 40)}...</span> : <span>{str}</span>;
      }
    }
  };

  const getDescPreview = (desc) => {
    if (!desc) return <span className="kv-empty">(空)</span>;
    return desc.length > 30 ? <span title={desc}>{desc.slice(0, 30)}...</span> : <span>{desc}</span>;
  };

  const handleRowClick = (index) => {
    if (onActiveRowChange) onActiveRowChange(index);
  };

  return (
    <div className="kv-editor">
      <table className="kv-table-edit">
        <thead>
          <tr>
            <th className="col-check"></th>
            <th className="col-key">Key</th>
            {showType && <th className="col-type">类型</th>}
            <th className="col-value">值</th>
            <th className="col-desc">备注</th>
            <th className="col-action"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const isReadonly = readOnly || (item.key && item.key.toLowerCase() === 'content-type');
            const isActive = activeRowIndex === index;
            return (
              <tr key={index} className={isActive ? 'row-active' : ''} onClick={() => handleRowClick(index)}>
                <td className="col-check">
                  <input type="checkbox" checked={item.enabled !== false}
                    onChange={(e) => {
                      if (isReadonly) return;
                      const newItems = items.map((it, i) => i === index ? { ...it, enabled: e.target.checked } : it);
                      onItemsChange(newItems);
                    }}
                    disabled={isReadonly} />
                </td>
                <td className="col-key">
                  <div className="kv-key-cell">
                    <input type="text" value={item.key || ''}
                      onChange={(e) => {
                        if (isReadonly) return;
                        let val = e.target.value;
                        if (section === 'header') {
                          const cleaned = val.replace(/[^A-Za-z0-9\-_]/g, '');
                          if (cleaned !== val && Date.now() - lastToastRef.current > 1000) {
                            const removed = [...new Set(val.replace(/[A-Za-z0-9\-_]/g, '').split(''))].join('');
                            toast.info(`已去掉特殊字符: ${removed}`);
                            lastToastRef.current = Date.now();
                          }
                          val = cleaned;
                        }
                        const newItems = items.map((it, i) => i === index ? { ...it, key: val } : it);
                        onItemsChange(newItems);
                      }}
                      placeholder={`${section} Key`}
                      readOnly={isReadonly}
                      className={`${isReadonly ? 'readonly' : ''} ${section === 'header' && item.key && !validateHeaderName(item.key).valid ? 'header-name-invalid' : ''}`} />
                    {section === 'header' && item.key && !validateHeaderName(item.key).valid && (
                      <span className="kv-key-error-icon" title={validateHeaderName(item.key).error}>
                        <AlertCircle size={12} />
                      </span>
                    )}
                  </div>
                </td>
                {showType && (
                  <td className="col-type">
                    <select value={item.type || 'string'}
                      onChange={(e) => {
                        if (isReadonly) return;
                        const newItems = items.map((it, i) => i === index ? { ...it, type: e.target.value } : it);
                        onItemsChange(newItems);
                      }}
                      disabled={isReadonly}>
                      {typeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </td>
                )}
                <td className="col-value">
                  <div className="kv-cell-clickable" onClick={() => onValueClick(index)}>
                    {getValuePreview(item)}
                  </div>
                </td>
                <td className="col-desc">
                  <div className="kv-cell-clickable" onClick={() => { if (!isReadonly) onDescClick(index); }}>
                    {getDescPreview(item.description)}
                  </div>
                </td>
                <td className="col-action">
                  {!isReadonly && (
                    <button className="btn-delete" onClick={() => onItemsChange(items.filter((_, i) => i !== index))}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!readOnly && (
        <button className="btn-add-row" onClick={() => {
          onItemsChange([...items, { key: '', default: '', type: 'string', description: '', enabled: true }]);
        }}>
          <Plus size={14} /> 添加
        </button>
      )}
    </div>
  );
}

export default KVTable;
