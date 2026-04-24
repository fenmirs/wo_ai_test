import React, { useState, useEffect, useRef } from 'react';
import { Play, RefreshCw, Copy, CheckCircle, XCircle, Clock, ChevronRight, ChevronDown, Trash2, Plus, Upload, X, AlertCircle, FileText, Save } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import axios from 'axios';
import './APIDetail.css';
import APIExecutor from '../utils/APIExecutor';
import { projectManager } from '../utils/ProjectManager';
import CodeEditor from './CodeEditor';

function APIDetail({ api, profile, config, projectPath, onExecute, history = [], restoringHistoryEntry, onRestored, onSaveAPI, groups = [], isAdding = false, onViewDetail, theme = 'dark' }) {
  const [resolvedPath, setResolvedPath] = useState('');
  const [executionResult, setExecutionResult] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState('params');
  const [responseTab, setResponseTab] = useState('request');
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const fileInputRef = useRef(null);
  const executorRef = useRef(null);
  
  const [formData, setFormData] = useState({
    name: '',
    group: '默认',
    api_path: '',
    method: 'GET',
    header: [],
    param: [],
    body: { type: 'none', formData: [], xwwwFormUrlencoded: [], contentType: 'text', content: '' },
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
    if (!body) return { type: 'none', formData: [], xwwwFormUrlencoded: [], contentType: 'text', content: '' };
    const contentType = header?.['Content-Type'] || '';
    
    if (typeof body === 'object' && !Array.isArray(body)) {
      if (contentType.includes('application/json')) {
        return { type: 'raw', formData: [], xwwwFormUrlencoded: [], contentType: 'json', content: JSON.stringify(body, null, 2) };
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        return { type: 'x-www-form-urlencoded', formData: [], xwwwFormUrlencoded: parseToArray(body), contentType: 'text', content: '' };
      } else if (contentType.includes('multipart/form-data')) {
        return { type: 'form-data', formData: parseToArray(body), xwwwFormUrlencoded: [], contentType: 'text', content: '' };
      }
    }
    
    if (typeof body === 'string') {
      let detectedContentType = 'text';
      if (contentType.includes('application/json') || contentType.includes('json')) {
        detectedContentType = 'json';
      } else if (contentType.includes('xml')) {
        detectedContentType = 'xml';
      } else if (contentType.includes('html')) {
        detectedContentType = 'html';
      } else if (contentType.includes('text/plain')) {
        detectedContentType = 'text';
      }
      return { type: 'raw', formData: [], xwwwFormUrlencoded: [], contentType: detectedContentType, content: body };
    }
    
    return { type: 'raw', formData: [], xwwwFormUrlencoded: [], contentType: 'text', content: typeof body === 'string' ? body : JSON.stringify(body, null, 2) };
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
    
    if (isExecuting) {
      executorRef.current?.cancel();
      return;
    }
    
    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const execAPI = prepareForExecute();
      const requestInfo = {
        url: generateResolvedPath(),
        method: formData.method,
        header: formData.header.filter(h => h.enabled && h.key),
        param: formData.param.filter(p => p.enabled && p.key),
        body: { ...formData.body },
        bodyType: formData.body.type,
        rawContentType: formData.body.contentType
      };
      
      if (onSaveAPI) {
        await onSaveAPI(execAPI, isAdding);
      }
      
      const executor = new APIExecutor(projectPath, config, profile);
      executorRef.current = executor;
      
      const cancelPromise = new Promise((resolve) => {
        executor._cancelResolver = resolve;
      });
      
      const result = await Promise.race([
        executor.executeChain(execAPI, {}),
        cancelPromise
      ]);
      result.requestInfo = requestInfo;
      setExecutionResult(result);
      
      if (onExecute) onExecute(execAPI, result);
    } catch (error) {
      setExecutionResult({ success: false, error: error.message, allResults: {} });
    } finally {
      setIsExecuting(false);
      executorRef.current = null;
    }
  };

  const handleSave = async () => {
    if (!formData.name) {
      alert('请输入 API 名称');
      return;
    }
    if (!formData.api_path) {
      alert('请输入 API 路径');
      return;
    }
    
    const execAPI = prepareForExecute();
    if (onSaveAPI) {
      await onSaveAPI(execAPI, isAdding);
      alert('保存成功');
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
    
    if (formData.body.type === 'none') {
      body = {};
    } else if (formData.body.type === 'form-data') {
      body = {};
      formData.body.formData.forEach(item => {
        if (item.enabled && item.key) {
          body[item.key] = { default: item.value || item.default || '', type: item.type };
        }
      });
    } else if (formData.body.type === 'x-www-form-urlencoded') {
      body = {};
      formData.body.xwwwFormUrlencoded.forEach(item => {
        if (item.enabled && item.key) {
          body[item.key] = item.value || item.default || '';
        }
      });
    } else if (formData.body.type === 'raw') {
      body = formData.body.content || '';
    }

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
        case 'none': return null;
        case 'form-data': return 'multipart/form-data';
        case 'x-www-form-urlencoded': return 'application/x-www-form-urlencoded';
        case 'raw':
          const rawContentTypes = {
            'json': 'application/json',
            'xml': 'application/xml',
            'html': 'text/html',
            'text': 'text/plain'
          };
          return rawContentTypes[newBody.contentType] || 'text/plain';
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
          <input
            type="text"
            className="api-name-input"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="API 名称"
          />
        </div>
        <div className="header-actions">
          <button className="btn-save" onClick={handleSave} title="保存 API">
            <Save size={16} />
            保存
          </button>
          <button className="btn-send" onClick={handleSend}>
            {isExecuting ? <X size={16} /> : <Play size={16} />}
            {isExecuting ? '发送中' : '发送'}
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
              {['none', 'form-data', 'x-www-form-urlencoded', 'raw'].map(type => (
                <label key={type} className={`body-type ${formData.body.type === type ? 'active' : ''}`}>
                  <input type="radio" name="bodyType" value={type}
                    checked={formData.body.type === type}
                    onChange={() => updateFormBody({ type })} />
                  <span>{type === 'none' ? 'none' : type === 'form-data' ? 'form-data' : type === 'x-www-form-urlencoded' ? 'x-www-form-urlencoded' : 'raw'}</span>
                  {type === 'raw' && formData.body.type === 'raw' && (
                    <select 
                      value={formData.body.contentType || 'text'}
                      onChange={(e) => updateFormBody({ contentType: e.target.value })}
                      className="raw-type-select"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="text">Text</option>
                      <option value="json">JSON</option>
                      <option value="xml">XML</option>
                      <option value="html">HTML</option>
                    </select>
                  )}
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
                <CodeEditor 
                  value={formData.body.content || ''}
                  onChange={(content) => updateFormBody({ content })}
                  contentType={formData.body.contentType || 'text'}
                  onTypeChange={(contentType) => updateFormBody({ contentType })}
                  theme={theme}
                />
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
            <div className="history-list" style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {apiHistory.map((entry) => (
                <div key={entry.id} className="history-item">
                  <div className="history-status">
                    {entry.error ? (
                      <AlertCircle size={14} className="error-icon" />
                    ) : entry.success ? (
                      <CheckCircle size={14} className="success-icon" />
                    ) : (
                      <XCircle size={14} className="error-icon" />
                    )}
                  </div>
                  
                  <div className="history-info">
                    <div className="history-meta">
                      <span className={`status-badge ${entry.success ? 'success' : 'error'}`}>
                        {entry.error ? '请求失败' : entry.success ? '通过' : '失败'}
                      </span>
                      {entry.status_code && (
                        <span className="http-code">HTTP {entry.status_code}</span>
                      )}
                      {entry.assertionResult && (
                        <span className="assert-summary">断言: {entry.assertionResult.summary}</span>
                      )}
                      <span className="history-time">
                        <Clock size={10} />
                        {entry.elapsedTime}
                      </span>
                    </div>
                    <div className="history-path">{entry.requestInfo?.url || entry.apiPath}</div>
                  </div>
                  
                  <div className="history-actions">
                    <button 
                      className="history-btn detail"
                      onClick={() => {
                        console.log('[History] 查看详情 clicked:', entry);
                        if (onViewDetail) {
                          onViewDetail(entry);
                        }
                      }}
                      title="查看详情"
                    >
                      <FileText size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
              ) : executionResult.targetResult?.error ? (
                <span className="http-status error">错误</span>
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
            
            <div className="summary-left">
              <span className="summary-label">耗时</span>
              <span className="meta-value">{executionResult.targetResult?.elapsedTime || '-'}</span>
            </div>
            
            {executionResult.targetResult?.error && (
              <>
                <div className="summary-divider"></div>
                <div className="summary-left error-info">
                  <XCircle size={14} className="error-icon" />
                  <span className="error-text">{executionResult.targetResult.error}</span>
                </div>
              </>
            )}
            
            <div className="summary-right">
              <span className={`final-status ${executionResult.targetResult?.success ? 'success' : 'error'}`}>
                {executionResult.targetResult?.success ? <><CheckCircle size={16} /> 通过</> : <><XCircle size={16} /> 失败</>}
              </span>
            </div>
          </div>
          
          <div className="response-tabs">
            <button className={`response-tab ${responseTab === 'request' ? 'active' : ''}`} onClick={() => setResponseTab('request')}>请求</button>
            <button className={`response-tab ${responseTab === 'response' ? 'active' : ''}`} onClick={() => setResponseTab('response')}>响应</button>
          </div>
          
          {responseTab === 'request' && executionResult.requestInfo && (
            <div className="request-info">
              <div className="request-section">
                <div className="request-section-title">基本信息</div>
                <div className="request-info-row">
                  <span className="info-label">URL</span>
                  <code className="info-value">{executionResult.requestInfo.url}</code>
                </div>
                <div className="request-info-row">
                  <span className="info-label">Method</span>
                  <span className="info-value method">{executionResult.requestInfo.method}</span>
                </div>
              </div>
              
              {executionResult.requestInfo.header.length > 0 && (
                <div className="request-section">
                  <div className="request-section-title">请求 Headers</div>
                  <div className="kv-list">
                    {executionResult.requestInfo.header.map((h, idx) => (
                      <div key={idx} className="kv-item">
                        <span className="kv-key">{h.key}</span>
                        <span className="kv-value">{h.default || ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {executionResult.requestInfo.param.length > 0 && (
                <div className="request-section">
                  <div className="request-section-title">Query Parameters</div>
                  <div className="kv-list">
                    {executionResult.requestInfo.param.map((p, idx) => (
                      <div key={idx} className="kv-item">
                        <span className="kv-key">{p.key}</span>
                        <span className="kv-value">{p.default || ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {executionResult.requestInfo.bodyType !== 'none' && (
                <div className="request-section">
                  <div className="request-section-title">请求 Body ({executionResult.requestInfo.bodyType})</div>
                  <div className="request-body-content">
                    {executionResult.requestInfo.bodyType === 'raw' && (
                      <pre className="body-text">{executionResult.requestInfo.body.content || ''}</pre>
                    )}
                    {(executionResult.requestInfo.bodyType === 'form-data' || executionResult.requestInfo.bodyType === 'x-www-form-urlencoded') && (
                      <div className="kv-list">
                        {(executionResult.requestInfo.bodyType === 'form-data' ? executionResult.requestInfo.body.formData : executionResult.requestInfo.body.xwwwFormUrlencoded)
                          .filter(p => p.enabled && p.key)
                          .map((p, idx) => (
                            <div key={idx} className="kv-item">
                              <span className="kv-key">{p.key}</span>
                              <span className="kv-value">{p.default || ''}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {responseTab === 'response' && (
            <div className="response-info">
              <div className="request-section">
                <div className="request-section-title">基本信息</div>
                <div className="request-info-row">
                  <span className="info-label">状态码</span>
                  <span className={`info-value status ${executionResult.targetResult?.httpSuccess ? 'success' : 'error'}`}>
                    {executionResult.targetResult?.status_code || '-'}
                  </span>
                </div>
                <div className="request-info-row">
                  <span className="info-label">耗时</span>
                  <span className="info-value">{executionResult.targetResult?.elapsedTime || '-'}</span>
                </div>
                <div className="request-info-row">
                  <span className="info-label">大小</span>
                  <span className="info-value">{executionResult.targetResult?.responseSize || '-'}</span>
                </div>
              </div>
              
              {executionResult.targetResult?.headers && Object.keys(executionResult.targetResult.headers).length > 0 && (
                <div className="request-section">
                  <div className="request-section-title">响应 Headers</div>
                  <div className="kv-list">
                    {Object.entries(executionResult.targetResult.headers).map(([key, value]) => (
                      <div key={key} className="kv-item">
                        <span className="kv-key">{key}</span>
                        <span className="kv-value">{Array.isArray(value) ? value.join(', ') : value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="request-section">
                <div className="request-section-title">响应 Body</div>
                <div className="request-body-content">
                  {executionResult.targetResult?.data !== undefined ? (
                    <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ margin: 0, fontSize: '11px', maxHeight: '250px' }}>
                      {JSON.stringify(executionResult.targetResult.data, null, 2)}
                    </SyntaxHighlighter>
                  ) : (
                    <div className="response-empty">无响应体</div>
                  )}
                </div>
              </div>
              
              {executionResult.targetResult?.assertionResult && (
                <div className="request-section">
                  <div className="request-section-title">断言结果</div>
                  <div className="assert-results">
                    {executionResult.targetResult.assertionResult.results.map((r, idx) => (
                      <div key={idx} className={`assert-item ${r.passed ? 'passed' : 'failed'}`}>
                        <span className="assert-icon">{r.passed ? <CheckCircle size={14} /> : <XCircle size={14} />}</span>
                        <span className="assert-expr">{r.expression}</span>
                        <span className="assert-actual">实际值: {r.actual}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default APIDetail;