import React, { useState, useEffect, useRef } from 'react';
import { Play, RefreshCw, Copy, CheckCircle, XCircle, Clock, ChevronRight, ChevronDown, Trash2, Plus, Upload, X } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './APIDetail.css';
import APIExecutor from '../utils/APIExecutor';
import { projectManager } from '../utils/ProjectManager';

function APIDetail({ api, profile, config, projectPath, onExecute, history = [], restoringHistoryEntry, onRestored, onSaveAPI, groups = [], isAdding = false }) {
  const [resolvedPath, setResolvedPath] = useState('');
  const [executionResult, setExecutionResult] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState('params');
  const [responseTab, setResponseTab] = useState('body');
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    name: '',
    group: '默认',
    api_path: '',
    method: 'GET',
    header: [],
    param: [],
    body: { type: 'none', formData: [], xwwwFormUrlencoded: [], raw: '', json: '{}' },
    chain: [],
    assertions: [{ expression: '', enabled: true }]
  });

  const [urlSegments, setUrlSegments] = useState([{ type: 'text', value: '' }]);
  const [activeSegmentIdx, setActiveSegmentIdx] = useState(null);
  const [editingSegmentIdx, setEditingSegmentIdx] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  const apiHistory = history.filter(h => h.apiName === formData.name);

  useEffect(() => {
    if (api) {
      initializeFromApi(api);
    }
  }, [api]);

  useEffect(() => {
    if (restoringHistoryEntry) {
      restoreFromHistory(restoringHistoryEntry);
      if (onRestored) onRestored();
    }
  }, [restoringHistoryEntry]);

  useEffect(() => {
    updateResolvedPath();
  }, [formData.api_path, profile]);

  useEffect(() => {
    const path = urlSegments.map(seg => 
      seg.type === 'variable' ? `{${seg.value}}` : seg.value
    ).join('');
    setFormData(prev => ({ ...prev, api_path: path }));
  }, [urlSegments]);

  const generateResolvedPath = () => {
    if (!profile) return '';
    let fullUrl = '';
    
    const path = urlSegments.map(seg => {
      if (seg.type === 'variable') {
        return profile[seg.value] || `{${seg.value}}`;
      }
      return seg.value;
    }).join('');
    
    if (path.startsWith('http://') || path.startsWith('https://')) {
      fullUrl = path;
    } else if (path) {
      fullUrl = 'http://' + path;
    }
    
    return fullUrl;
  };

  const parseApiPathToSegments = (apiPath) => {
    if (!apiPath) return [{ type: 'text', value: '' }];
    
    const regex = /\{([^}]+)\}/g;
    const segments = [];
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(apiPath)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', value: apiPath.slice(lastIndex, match.index) });
      }
      segments.push({ type: 'variable', value: match[1] });
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < apiPath.length) {
      segments.push({ type: 'text', value: apiPath.slice(lastIndex) });
    }
    
    return segments.length > 0 ? segments : [{ type: 'text', value: '' }];
  };

  const initializeFromApi = (apiData) => {
    const defaultHeader = {};
    if (!apiData.header?.['Content-Type']) {
      defaultHeader['Content-Type'] = 'application/json';
    }
    
    const parseAssertions = (assertStr) => {
      if (!assertStr) return [{ expression: '', enabled: true }];
      return assertStr.split(/[;\n]/).map(a => a.trim()).filter(a => a)
        .map(a => ({ expression: a, enabled: true }));
    };

    const apiPath = apiData.api_path || '';
    const isFullUrl = apiPath.startsWith('http://') || apiPath.startsWith('https://');
    
    setFormData({
      name: apiData.name || '',
      group: apiData.group || '默认',
      api_path: apiData.api_path || '',
      method: apiData.method || 'GET',
      header: parseToArray({ ...defaultHeader, ...apiData.header }),
      param: parseToArray(apiData.param),
      body: parseBodyData(apiData.body, { ...defaultHeader, ...apiData.header }),
      chain: apiData.chain || [],
      assertions: parseAssertions(apiData.successAssert)
    });

    if (isFullUrl) {
      setUrlSegments([{ type: 'text', value: apiPath }]);
    } else {
      setUrlSegments(parseApiPathToSegments(apiPath));
    }
  };

  const restoreFromHistory = (historyEntry) => {
    const cfg = historyEntry.apiConfig;
    if (!cfg) return;

    const defaultHeader = {};
    if (!cfg.header?.['Content-Type']) {
      defaultHeader['Content-Type'] = 'application/json';
    }
    
    const parseAssertions = (assertStr) => {
      if (!assertStr) return [{ expression: '', enabled: true }];
      return assertStr.split(/[;\n]/).map(a => a.trim()).filter(a => a)
        .map(a => ({ expression: a, enabled: true }));
    };
    
    setFormData({
      name: cfg.name || '',
      group: cfg.group || '默认',
      api_path: cfg.api_path || '',
      method: cfg.method || 'GET',
      header: parseToArray({ ...defaultHeader, ...cfg.header }),
      param: parseToArray(cfg.param),
      body: parseBodyData(cfg.body, { ...defaultHeader, ...cfg.header }),
      chain: cfg.chain || [],
      assertions: parseAssertions(cfg.successAssert)
    });

    const apiPath = cfg.api_path || '';
    const isFullUrl = apiPath.startsWith('http://') || apiPath.startsWith('https://');
    if (isFullUrl) {
      setUrlSegments([{ type: 'text', value: apiPath }]);
    } else {
      setUrlSegments(parseApiPathToSegments(apiPath));
    }
  };

  const parseToArray = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'object') {
      return Object.entries(data).map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          return { key, ...value };
        }
        return { key, default: value, value, type: 'string', description: '', enabled: true };
      });
    }
    return [];
  };

  const parseBodyData = (body, header) => {
    if (!body) return { type: 'json', formData: [], xwwwFormUrlencoded: [], raw: '', json: '{}' };
    const contentType = header?.['Content-Type'] || '';
    
    if (typeof body === 'object' && !Array.isArray(body)) {
      if (contentType.includes('application/json')) {
        return { type: 'json', formData: [], xwwwFormUrlencoded: [], raw: JSON.stringify(body, null, 2), json: JSON.stringify(body, null, 2) };
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        return { type: 'x-www-form-urlencoded', formData: [], xwwwFormUrlencoded: parseToArray(body), raw: '', json: '{}' };
      } else if (contentType.includes('multipart/form-data')) {
        return { type: 'form-data', formData: parseToArray(body), xwwwFormUrlencoded: [], raw: '', json: '{}' };
      }
      return { type: 'raw', formData: [], xwwwFormUrlencoded: [], raw: typeof body === 'string' ? body : JSON.stringify(body, null, 2), json: '{}' };
    }
    return { type: 'json', formData: [], xwwwFormUrlencoded: [], raw: '', json: '{}' };
  };

  const updateResolvedPath = () => {
    if (!formData.api_path || !profile) return;
    let path = formData.api_path;
    Object.keys(profile).forEach(key => {
      if (key !== 'name' && key !== 'activate') {
        path = path.replace(`{${key}}`, profile[key]);
      }
    });
    if (!path.startsWith('http://') && !path.startsWith('https://')) {
      path = 'http://' + path;
    }
    setResolvedPath(path);
  };

  const handleSend = async () => {
    if (!formData.api_path) return;
    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const execAPI = prepareForExecute();
      
      if (onSaveAPI) {
        await onSaveAPI(execAPI, isAdding);
      }
      
      const executor = new APIExecutor(projectPath, config, profile);
      const result = await executor.executeChain(execAPI, {});
      setExecutionResult(result);
      
      if (onExecute) onExecute(execAPI, result);
    } catch (error) {
      setExecutionResult({ success: false, error: error.message, allResults: {} });
    } finally {
      setIsExecuting(false);
    }
  };

  const prepareForExecute = () => {
    const headerObj = {};
    formData.header.forEach(item => {
      if (item.enabled && item.key && item.key.toLowerCase() !== 'content-type') {
        headerObj[item.key] = item.value || item.default || '';
      }
    });

    formData.header.forEach(item => {
      if (item.enabled && item.key && item.key.toLowerCase() === 'content-type') {
        headerObj[item.key] = item.default || '';
      }
    });

    const paramObj = {};
    formData.param.forEach(item => {
      if (item.enabled && item.key) {
        paramObj[item.key] = {
          default: item.value || item.default || '',
          description: item.description || '',
          type: item.type || 'string',
          enabled: item.enabled
        };
      }
    });

    let body = null;
    formData.header.forEach(item => {
      if (item.key.toLowerCase() === 'content-type') {
        const ct = item.default || '';
        if (ct.includes('application/json') && formData.body.type === 'json') {
          try {
            body = JSON.parse(formData.body.json);
          } catch { body = {}; }
        } else if (ct.includes('application/x-www-form-urlencoded')) {
          body = {};
          formData.body.xwwwFormUrlencoded.forEach(item => {
            if (item.enabled && item.key) {
              body[item.key] = item.value || item.default || '';
            }
          });
        } else if (ct.includes('multipart/form-data')) {
          body = {};
          formData.body.formData.forEach(item => {
            if (item.enabled && item.key) {
              body[item.key] = { default: item.value || item.default || '', type: item.type };
            }
          });
        } else if (formData.body.type === 'raw') {
          body = formData.body.raw;
        }
      }
    });

    if (formData.body.type === 'none') body = {};

    const successAssert = formData.assertions
      .filter(a => a.enabled && a.expression.trim())
      .map(a => a.expression.trim())
      .join('; ');

    return {
      name: formData.name,
      group: formData.group,
      api_path: formData.api_path,
      method: formData.method,
      header: headerObj,
      param: paramObj,
      body,
      chain: formData.chain,
      successAssert
    };
  };

  const getMethodColor = (method) => {
    const colors = { 'GET': '#10b981', 'POST': '#3b82f6', 'PUT': '#f59e0b', 'DELETE': '#ef4444', 'PATCH': '#8b5cf6', 'HEAD': '#6b7280', 'OPTIONS': '#6b7280' };
    return colors[method] || '#64748b';
  };

  const getErrorTitle = (errorType) => {
    const titles = { 'cors': 'CORS 跨域错误', 'network': '网络错误', 'timeout': '请求超时', 'server_error': '服务器错误', 'ssl': '证书错误', 'connection_refused': '连接被拒绝', 'dns_error': 'DNS 解析失败', 'connection_reset': '连接被重置', 'network_unreachable': '网络不可达', 'socket_error': '网络错误', 'unknown': '请求失败' };
    return titles[errorType] || '请求失败';
  };

  const hasBody = () => {
    return formData.body.type !== 'none';
  };

  const updateFormBody = (updates) => {
    const newBody = { ...formData.body, ...updates };
    let newHeader = [...formData.header];
    const contentTypeIndex = newHeader.findIndex(h => h.key.toLowerCase() === 'content-type');
    
    const getContentType = (type) => {
      switch (type) {
        case 'json': return 'application/json';
        case 'x-www-form-urlencoded': return 'application/x-www-form-urlencoded';
        case 'form-data': return 'multipart/form-data';
        default: return null;
      }
    };
    
    const newContentType = getContentType(newBody.type);
    if (newContentType) {
      if (contentTypeIndex >= 0) {
        newHeader[contentTypeIndex] = { ...newHeader[contentTypeIndex], default: newContentType };
      } else {
        newHeader.push({ key: 'Content-Type', default: newContentType, type: 'string', description: '', enabled: true });
      }
    } else {
      if (contentTypeIndex >= 0) {
        newHeader = newHeader.filter((_, i) => i !== contentTypeIndex);
      }
    }
    
    setFormData(prev => ({ ...prev, body: newBody, header: newHeader }));
  };

  const tabs = [
    { id: 'params', label: 'Params', count: formData.param.filter(p => p.enabled && p.key).length },
    { id: 'headers', label: 'Headers', count: formData.header.filter(h => h.enabled && h.key).length },
    { id: 'body', label: 'Body', count: formData.body.type !== 'none' ? 1 : 0 },
    { id: 'assert', label: '断言', count: formData.assertions.filter(a => a.enabled && a.expression.trim()).length },
    ...(apiHistory.length > 0 ? [{ id: 'history', label: '历史', count: apiHistory.length }] : [])
  ];

  const paramTypes = [
    { value: 'string', label: 'String' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'file', label: 'File' }
  ];

  const renderKVTable = (items, setItems, label, showType = false, showFileSelect = false) => {
    return (
      <div className="kv-editor">
        <table className="kv-table-edit">
          <thead>
            <tr>
              <th className="col-check"></th>
              <th className="col-key">Key</th>
              <th className="col-desc">Description</th>
              {showType && <th className="col-type">Type</th>}
              <th className="col-default">Default</th>
              <th className="col-action"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const isReadonly = item.key.toLowerCase() === 'content-type';
              return (
                <tr key={index}>
                  <td>
                    <input type="checkbox" checked={item.enabled !== false}
                      onChange={(e) => {
                        if (isReadonly) return;
                        const newItems = [...items];
                        newItems[index] = { ...item, enabled: e.target.checked };
                        setItems(newItems);
                      }}
                      disabled={isReadonly} />
                  </td>
                  <td>
                    <input type="text" value={item.key || ''}
                      onChange={(e) => {
                        if (isReadonly) return;
                        const newItems = [...items];
                        newItems[index] = { ...item, key: e.target.value };
                        setItems(newItems);
                      }}
                      placeholder={`${label} Key`}
                      readOnly={isReadonly} className={isReadonly ? 'readonly' : ''} />
                  </td>
                  <td>
                    <input type="text" value={item.description || ''}
                      onChange={(e) => {
                        if (isReadonly) return;
                        const newItems = [...items];
                        newItems[index] = { ...item, description: e.target.value };
                        setItems(newItems);
                      }}
                      placeholder="备注" readOnly={isReadonly} className={isReadonly ? 'readonly' : ''} />
                  </td>
                  {showType && (
                    <td>
                      <select value={item.type || 'string'}
                        onChange={(e) => {
                          if (isReadonly) return;
                          const newItems = [...items];
                          newItems[index] = { ...item, type: e.target.value };
                          setItems(newItems);
                        }}
                        disabled={isReadonly}>
                        {paramTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </td>
                  )}
                  <td>
                    {item.type === 'file' || (showFileSelect && isReadonly) ? (
                      <div className="file-input">
                        <span className="file-name">{item.default || '选择文件...'}</span>
                        {!isReadonly && (
                          <>
                            <input type="file"
                              ref={index === items.length - 1 ? fileInputRef : null}
                              onChange={(e) => {
                                const newItems = [...items];
                                newItems[index] = { ...item, default: e.target.files[0]?.name || '', type: 'file' };
                                setItems(newItems);
                              }}
                              style={{ display: 'none' }} />
                            <button className="btn-file" onClick={() => fileInputRef.current?.click()}>
                              <Upload size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    ) : item.type === 'boolean' ? (
                      <select 
                        value={item.default === true || item.default === 'true' ? 'true' : (item.default === false || item.default === 'false' ? 'false' : '')}
                        onChange={(e) => {
                          if (isReadonly) return;
                          const newItems = [...items];
                          newItems[index] = { ...item, default: e.target.value === 'true' };
                          setItems(newItems);
                        }}
                        disabled={isReadonly}
                        className={isReadonly ? 'readonly' : ''}
                      >
                        <option value="">选择</option>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : item.type === 'number' ? (
                      <input 
                        type="number" 
                        value={item.default ?? ''}
                        onChange={(e) => {
                          if (isReadonly) return;
                          const newItems = [...items];
                          newItems[index] = { ...item, default: e.target.value === '' ? '' : Number(e.target.value) };
                          setItems(newItems);
                        }}
                        placeholder="数字" 
                        readOnly={isReadonly} 
                        className={isReadonly ? 'readonly' : ''} 
                      />
                    ) : (
                      <input type="text" value={item.default || ''}
                        onChange={(e) => {
                          if (isReadonly) return;
                          const newItems = [...items];
                          newItems[index] = { ...item, default: e.target.value };
                          setItems(newItems);
                        }}
                        placeholder="默认值" readOnly={isReadonly} className={isReadonly ? 'readonly' : ''} />
                    )}
                  </td>
                  <td>
                    {!isReadonly && (
                      <button className="btn-delete" onClick={() => setItems(items.filter((_, i) => i !== index))}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button className="btn-add-row" onClick={() => setItems([...items, { key: '', default: '', type: 'string', description: '', enabled: true }])}>
          <Plus size={14} /> 添加
        </button>
      </div>
    );
  };

  if (!api && !formData.name) return null;

  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

  return (
    <div className="api-detail">
      <div className="api-detail-header">
        <div className="api-title">
          {/* <span className="api-method-badge" style={{ backgroundColor: getMethodColor(formData.method) }}>
            {formData.method}
          </span> */}
          <input
            type="text"
            className="api-name-input"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="API 名称"
          />
        </div>
        <div className="header-actions">
          <button className="btn-send" onClick={handleSend} disabled={isExecuting}>
            {isExecuting ? <RefreshCw size={16} className="spin" /> : <Play size={16} />}
            {isExecuting ? '发送中...' : '发送'}
          </button>
        </div>
      </div>

      <div className="url-bar">
        <div className="method-select">
          <select 
            value={formData.method} 
            onChange={(e) => setFormData({ ...formData, method: e.target.value })}
            style={{ backgroundColor: getMethodColor(formData.method) }}
          >
            {methods.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        
        <div className="url-builder">
          <div className="url-segments">
            {/* 所有片段统一样式 */}
            {urlSegments.map((seg, idx) => (
              <div 
                key={idx} 
                className={`url-segment ${idx === 0 ? 'first' : ''} ${activeSegmentIdx === idx ? 'active' : ''}`}
              >
                {editingSegmentIdx === idx ? (
                  <input
                    type="text"
                    className="segment-edit-input"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const newSegments = [...urlSegments];
                        newSegments[idx] = { ...seg, value: editingValue, type: 'text' };
                        setUrlSegments(newSegments);
                        setEditingSegmentIdx(null);
                      } else if (e.key === 'Escape') {
                        setEditingSegmentIdx(null);
                      }
                    }}
                    onBlur={() => {
                      const newSegments = [...urlSegments];
                      newSegments[idx] = { ...seg, value: editingValue, type: 'text' };
                      setUrlSegments(newSegments);
                      setEditingSegmentIdx(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <div 
                    className="segment-content"
                    onClick={() => setActiveSegmentIdx(idx)}
                  >
                    <span className="segment-text">
                      {seg.value || (idx === 0 ? '输入或选择' : '输入路径')}
                    </span>
                  </div>
                )}
                {urlSegments.length > 1 && activeSegmentIdx === idx && (
                  <button 
                    className="segment-delete"
                    onClick={() => setUrlSegments(urlSegments.filter((_, i) => i !== idx))}
                  >
                    <X size={10} />
                  </button>
                )}
                {/* 变量下拉面板 */}
                {activeSegmentIdx === idx && editingSegmentIdx !== idx && (
                  <div className="segment-var-dropdown">
                    <div 
                      className="segment-var-option input-option"
                      onClick={() => {
                        setEditingSegmentIdx(idx);
                        setEditingValue(seg.value);
                      }}
                    >
                      输入内容...
                    </div>
                    {profile && Object.keys(profile)
                      .filter(k => k !== 'name' && k !== 'activate')
                      .filter(k => idx === 0 || k !== 'domain')
                      .map(k => (
                        <div 
                          key={k} 
                          className="segment-var-option"
                          onClick={() => {
                            const newSegments = [...urlSegments];
                            newSegments[idx] = { type: 'variable', value: k };
                            setUrlSegments(newSegments);
                            setActiveSegmentIdx(null);
                          }}
                        >
                          {k}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
            
            {/* 添加片段按钮 */}
            <button 
              className="segment-add-btn"
              onClick={() => setUrlSegments([...urlSegments, { type: 'text', value: '' }])}
              title="添加片段"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
        
        <button className="btn-copy" onClick={() => navigator.clipboard.writeText(generateResolvedPath())} title="复制URL">
          <Copy size={14} />
        </button>
      </div>
      
      <div className="url-preview">
        <span className="preview-label">完整路径:</span>
        <code className="preview-path">{generateResolvedPath()}</code>
      </div>

      <div className="chain-section">
        <span className="section-label">依赖</span>
        <div className="chain-tags">
          {Array.isArray(formData.chain) && formData.chain.map((chainName, index) => (
            <span key={index} className="chain-tag">
              <span className="chain-tag-name">{String(chainName)}</span>
              <button className="chain-tag-remove" onClick={() => setFormData(prev => ({ ...prev, chain: prev.chain.filter((_, i) => i !== index) }))}>
                <X size={10} />
              </button>
            </span>
          ))}
          <select 
            className="chain-add-select"
            value=""
            onChange={(e) => {
              const selectedValue = e.target.value;
              if (selectedValue) {
                setFormData(prev => {
                  const currentChain = prev.chain || [];
                  if (!currentChain.includes(selectedValue)) {
                    return { ...prev, chain: [...currentChain, selectedValue] };
                  }
                  return prev;
                });
                e.target.value = '';
              }
            }}
          >
            <option value="">+ 添加</option>
            {(projectManager.getData()?.apis || [])
              .filter(a => a.name !== formData.name && !formData.chain?.includes(a.name))
              .map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
          </select>
        </div>
      </div>

      <div className="detail-content">
        <div className="tab-bar">
          {tabs.map(tab => (
            <button key={tab.id} className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}>
              {tab.label}
              {tab.count > 0 && <span className="tab-count">{tab.count}</span>}
            </button>
          ))}
        </div>

        {activeTab === 'params' && (
          <div className="tab-content">
            {renderKVTable(formData.param, (items) => setFormData(prev => ({ ...prev, param: items })), 'Params', true, false)}
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="tab-content">
            {renderKVTable(formData.header, (items) => setFormData(prev => ({ ...prev, header: items })), 'Headers', false, false)}
          </div>
        )}

        {activeTab === 'body' && (
          <div className="tab-content">
            <div className="body-types">
              {['none', 'form-data', 'x-www-form-urlencoded', 'raw', 'json'].map(type => (
                <label key={type} className={`body-type ${formData.body.type === type ? 'active' : ''}`}>
                  <input type="radio" name="bodyType" value={type}
                    checked={formData.body.type === type}
                    onChange={() => updateFormBody({ type })} />
                  <span>{type === 'none' ? 'none' : type === 'form-data' ? 'form-data' : type === 'x-www-form-urlencoded' ? 'x-www-form-urlencoded' : type === 'raw' ? 'raw' : 'JSON'}</span>
                </label>
              ))}
            </div>

            {formData.body.type === 'none' && (
              <div className="body-none">此请求没有 body</div>
            )}

            {(formData.body.type === 'form-data' || formData.body.type === 'x-www-form-urlencoded') && (
              <div className="body-form">
                <p className="body-hint">
                  {formData.body.type === 'form-data' ? '支持 String、Number、Boolean、File 类型' : '支持 String、Number、Boolean 类型'}
                </p>
                {renderKVTable(
                  formData.body.type === 'form-data' ? formData.body.formData : formData.body.xwwwFormUrlencoded,
                  (items) => updateFormBody(formData.body.type === 'form-data' ? { formData: items } : { xwwwFormUrlencoded: items }),
                  'Form', true, formData.body.type === 'form-data'
                )}
              </div>
            )}

            {formData.body.type === 'raw' && (
              <div className="body-raw">
                <textarea value={formData.body.raw}
                  onChange={(e) => updateFormBody({ raw: e.target.value })}
                  placeholder="输入 raw 内容..." rows={6} />
              </div>
            )}

            {formData.body.type === 'json' && (
              <div className="body-json">
                <div className="json-toolbar">
                  <button className="btn-format" onClick={() => {
                    try {
                      const parsed = JSON.parse(formData.body.json);
                      updateFormBody({ json: JSON.stringify(parsed, null, 2) });
                    } catch {}
                  }}>格式化</button>
                </div>
                <textarea value={formData.body.json}
                  onChange={(e) => updateFormBody({ json: e.target.value })}
                  placeholder='{"key": "value"}' rows={8} className="json-textarea" />
              </div>
            )}
          </div>
        )}

        {activeTab === 'assert' && (
          <div className="tab-content">
            <div className="assert-editor">
              <p className="assert-help-text">
                JSONPath 格式：<code>$.字段路径</code>，操作符：<code>==</code> <code>!=</code> <code>&gt;</code> <code>&lt;</code> <code>&gt;=</code> <code>&lt;=</code>
                <br/>示例：<code>$.code == 200</code> <code>$.obj.length &gt; 0</code>
              </p>
              <div className="assert-list">
                {formData.assertions.map((assertion, index) => (
                  <div key={index} className="assert-row">
                    <input type="checkbox" checked={assertion.enabled}
                      onChange={(e) => {
                        const newAssertions = [...formData.assertions];
                        newAssertions[index] = { ...newAssertions[index], enabled: e.target.checked };
                        setFormData({ ...formData, assertions: newAssertions });
                      }}
                    />
                    <input type="text" value={assertion.expression}
                      onChange={(e) => {
                        const newAssertions = [...formData.assertions];
                        newAssertions[index] = { ...newAssertions[index], expression: e.target.value };
                        setFormData({ ...formData, assertions: newAssertions });
                      }}
                      placeholder="$.code == 200" className="assert-input"
                    />
                    <button className="btn-delete" onClick={() => {
                      const newAssertions = formData.assertions.filter((_, i) => i !== index);
                      if (newAssertions.length === 0) newAssertions.push({ expression: '', enabled: true });
                      setFormData({ ...formData, assertions: newAssertions });
                    }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn-add-row" onClick={() => setFormData({ ...formData, assertions: [...formData.assertions, { expression: '', enabled: true }] })}>
                <Plus size={14} /> 添加断言
              </button>
            </div>
          </div>
        )}

        {activeTab === 'history' && apiHistory.length > 0 && (
          <div className="tab-content">
            {apiHistory.map((entry) => (
              <div key={entry.id} className="history-entry-item">
                <div className="history-entry-status">
                  {entry.success ? <CheckCircle size={14} className="success-icon" /> : <XCircle size={14} className="error-icon" />}
                </div>
                <div className="history-entry-info">
                  <div className="history-entry-main">
                    <span className="history-entry-status-text">
                      {entry.success ? '通过' : entry.error ? '请求失败' : '断言失败'}
                    </span>
                    {entry.status_code && <span className="history-entry-code">HTTP {entry.status_code}</span>}
                    {entry.assertionResult && <span className="history-entry-assert">{entry.assertionResult.summary}</span>}
                  </div>
                  <div className="history-entry-meta">
                    <span><Clock size={10} /> {entry.elapsedTime}</span>
                    <span>{entry.timestamp}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {formData.assertions.filter(a => a.enabled && a.expression.trim()).length > 0 && (
        <div className="assertion-bar">
          <span className="assertion-label">断言:</span>
          <code className="assertion-code">
            {formData.assertions.filter(a => a.enabled && a.expression.trim()).map(a => a.expression).join('; ')}
          </code>
        </div>
      )}

      {executionResult && (
        <div className="response-panel">
          <div className="response-summary">
            <div className="summary-left">
              <span className="summary-label">HTTP</span>
              {executionResult.targetResult?.status_code ? (
                <span className={`http-status ${executionResult.targetResult.httpSuccess ? 'success' : 'error'}`}>
                  {executionResult.targetResult.status_code}
                </span>
              ) : (
                <span className="http-status error">请求失败</span>
              )}
            </div>
            
            <div className="summary-divider"></div>
            
            {executionResult.targetResult?.assertionResult && (
              <div className="summary-left">
                <span className="summary-label">断言</span>
                <span className={`assert-status ${executionResult.targetResult.assertionResult.passed ? 'success' : 'error'}`}>
                  {executionResult.targetResult.assertionResult.summary}
                </span>
              </div>
            )}
            
            <div className="summary-divider"></div>
            
            <div className="summary-right">
              <span className="meta-item"><Clock size={14} /> {executionResult.targetResult?.elapsedTime || '-'}</span>
            </div>
            
            <span className={`final-status ${executionResult.targetResult?.success ? 'success' : 'error'}`}>
              {executionResult.targetResult?.success ? <><CheckCircle size={16} /> 通过</> : <><XCircle size={16} /> 失败</>}
            </span>
          </div>
          
          {executionResult.targetResult?.error && (
            <div className={`response-error error-${executionResult.targetResult.errorType || 'network'}`}>
              <div className="error-header">
                <XCircle size={14} />
                <span>{getErrorTitle(executionResult.targetResult.errorType)}</span>
              </div>
              <pre className="error-message">{executionResult.targetResult.error}</pre>
            </div>
          )}
          
          <div className="response-tabs">
            <button className={`response-tab ${responseTab === 'body' ? 'active' : ''}`} onClick={() => setResponseTab('body')}>Body</button>
            <button className={`response-tab ${responseTab === 'headers' ? 'active' : ''}`} onClick={() => setResponseTab('headers')}>Headers</button>
          </div>
          
          {responseTab === 'headers' && executionResult.targetResult?.headers && (
            <div className="response-headers">
              {Object.entries(executionResult.targetResult.headers).map(([key, value]) => (
                <div key={key} className="response-header-item">
                  <span className="header-key">{key}</span>
                  <span className="header-value">{value}</span>
                </div>
              ))}
            </div>
          )}
          
          {responseTab === 'body' && executionResult.targetResult?.data !== undefined && (
            <div className="response-body">
              <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ margin: 0, fontSize: '12px', maxHeight: '300px' }}>
                {JSON.stringify(executionResult.targetResult.data, null, 2)}
              </SyntaxHighlighter>
            </div>
          )}
          
          {responseTab === 'body' && executionResult.targetResult?.data === undefined && (
            <div className="response-empty">无响应体</div>
          )}
        </div>
      )}
    </div>
  );
}

export default APIDetail;