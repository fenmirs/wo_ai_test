import React, { useState, useEffect, useRef } from 'react';
import { Play, RefreshCw, Copy, CheckCircle, XCircle, Clock, ChevronRight, ChevronDown, ChevronUp, Trash2, Plus, Upload, X, AlertCircle, FileText, Save, FileDown } from 'lucide-react';
import './APIDetail.css';
import ChainManager from '../utils/ChainManager';
import { projectManager } from '../utils/ProjectManager';
import APIDocGenerator from '../utils/APIDocGenerator';
import CodeEditor from './CodeEditor';
import RefVariableSelector from './RefVariableSelector';

function APIDetail({ api, profile, config, projectPath, onExecute, history = [], restoringHistoryEntry, onRestored, onSaveAPI, onSaveError, saveError, groups = [], isAdding = false, isTemporary = false, onViewDetail, onRestoreHistory, onDeleteHistory, theme = 'dark', onResultChange }) {
  const [resolvedPath, setResolvedPath] = useState('');
  const [executionResult, setExecutionResult] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState('params');
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localSaveError, setLocalSaveError] = useState(null);
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
    assertions: [{ expression: '', enabled: true }]
  });

  const [urlSegments, setUrlSegments] = useState([{ type: 'text', value: '' }]);
  const [activeSegmentIdx, setActiveSegmentIdx] = useState(null);
  const [editingSegmentIdx, setEditingSegmentIdx] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [urlCopied, setUrlCopied] = useState(false);

  const apiHistory = history.filter(h =>
    (h.apiId && h.apiId === formData.id) ||
    (!h.apiId && h.apiName === formData.name)
  );

  useEffect(() => {
    if (api) {
      console.log(`[APIDetail] useEffect(api) fired, api.id=${api.id}, api.name=${api.name}, api.param=`, JSON.stringify(api.param));
      initializeFromApi(api);
      setExecutionResult(null);

      // 从历史记录恢复最近一次执行结果
      const matchingHistory = history
        .filter(h => (h.apiId && h.apiId === api.id) || (!h.apiId && h.apiName === api.name))
        .sort((a, b) => b.id - a.id);
      if (matchingHistory.length > 0) {
        const latest = matchingHistory[0];
        const restoredAllResults = latest.allResults || {};
        const targetApiResult = latest.targetResult || {
          success: latest.success,
          status_code: latest.status_code,
          elapsedTime: latest.elapsedTime,
          error: latest.error,
          data: latest.responseData,
          headers: latest.responseHeaders,
          assertionResult: latest.assertionResult,
          allResults: {}
        };
        if (targetApiResult) {
          const allApis = projectManager.getData()?.apis || [];
          const restoredCards = latest.resultCards || (() => {
            const cards = [];
            for (const [apiId, res] of Object.entries(restoredAllResults)) {
              const a = allApis.find(ap => ap.id === apiId);
              cards.push({ apiId, name: a?.name || apiId, result: res, isTarget: apiId === api.id });
            }
            if (!cards.find(c => c.isTarget)) {
              cards.push({ apiId: api.id, name: api.name || '目标', result: targetApiResult, isTarget: true });
            }
            return cards;
          })();
          setExecutionResult({
            targetResult: targetApiResult,
            allResults: restoredAllResults,
            requestInfo: latest.requestInfo || null,
            resultCards: restoredCards
          });
        }
      }
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

  useEffect(() => {
    if (executionResult && onResultChange) {
      onResultChange(executionResult);
    }
  }, [executionResult]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveSegmentIdx(null);
        setEditingSegmentIdx(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const extractRefApis = () => {
    const refRegex = /\{\{ref:([^}]+)\}\}/g;
    const apiIds = new Set();

    const scanValue = (value) => {
      if (typeof value !== 'string') return;
      refRegex.lastIndex = 0;
      let match;
      while ((match = refRegex.exec(value)) !== null) {
        const apiId = match[1].split('.')[0];
        if (apiId) apiIds.add(apiId);
      }
    };

    formData.header.forEach(item => {
      if (item.enabled) scanValue(item.default);
    });
    formData.param.forEach(item => {
      if (item.enabled) scanValue(item.default);
    });
    if (formData.body.type === 'form-data') {
      formData.body.formData.forEach(item => {
        if (item.enabled) scanValue(item.default);
      });
    }
    if (formData.body.type === 'x-www-form-urlencoded') {
      formData.body.xwwwFormUrlencoded.forEach(item => {
        if (item.enabled) scanValue(item.default);
      });
    }
    if (formData.body.type === 'raw') {
      scanValue(formData.body.content);
    }

    return [...apiIds];
  };

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

    const parsedParam = parseToArray(apiData.param);
    const parsedHeader = parseToArray({ ...defaultHeader, ...apiData.header });
    console.log(`[APIDetail] initializeFromApi - parsedParam:`, JSON.stringify(parsedParam));
    console.log(`[APIDetail] initializeFromApi - parsedHeader:`, JSON.stringify(parsedHeader));

    setFormData({
      id: apiData.id,
      name: apiData.name || '',
      group: apiData.group || '默认',
      api_path: apiData.api_path || '',
      method: apiData.method || 'GET',
      header: parsedHeader,
      param: parsedParam,
      body: parseBodyData(apiData.body, { ...defaultHeader, ...apiData.header }),

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
        return { key, default: value, type: 'string', description: '', enabled: true };
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

  const findRefParamsForApi = (apiId) => {
    const refs = [];
    const refRegex = /\{\{ref:([^}]+)\}\}/g;

    const scanValue = (section, key, value) => {
      if (typeof value !== 'string') return;
      refRegex.lastIndex = 0;
      let match;
      while ((match = refRegex.exec(value)) !== null) {
        const refApiId = match[1].split('.')[0];
        if (refApiId === apiId) {
          refs.push({ section, key, ref: match[1] });
        }
      }
    };

    formData.header.forEach(item => {
      if (item.enabled) scanValue('Header', item.key, item.default);
    });
    formData.param.forEach(item => {
      if (item.enabled) scanValue('Params', item.key, item.default);
    });
    if (formData.body.type === 'form-data') {
      formData.body.formData.forEach(item => {
        if (item.enabled) scanValue('Body', item.key, item.default);
      });
    }
    if (formData.body.type === 'x-www-form-urlencoded') {
      formData.body.xwwwFormUrlencoded.forEach(item => {
        if (item.enabled) scanValue('Body', item.key, item.default);
      });
    }
    if (formData.body.type === 'raw') {
      scanValue('Body', 'content', formData.body.content);
    }

    return refs;
  };

  const findRefParamsByRefPath = (refPath) => {
    const refs = [];
    const refRegex = /\{\{ref:([^}]+)\}\}/g;

    const scanValue = (section, key, value) => {
      if (typeof value !== 'string') return;
      refRegex.lastIndex = 0;
      let match;
      while ((match = refRegex.exec(value)) !== null) {
        if (match[1] === refPath) {
          refs.push({ section, key, ref: match[1] });
        }
      }
    };

    formData.header.forEach(item => {
      if (item.enabled) scanValue('Header', item.key, item.default);
    });
    formData.param.forEach(item => {
      if (item.enabled) scanValue('Params', item.key, item.default);
    });
    if (formData.body.type === 'form-data') {
      formData.body.formData.forEach(item => {
        if (item.enabled) scanValue('Body', item.key, item.default);
      });
    }
    if (formData.body.type === 'x-www-form-urlencoded') {
      formData.body.xwwwFormUrlencoded.forEach(item => {
        if (item.enabled) scanValue('Body', item.key, item.default);
      });
    }
    if (formData.body.type === 'raw') {
      scanValue('Body', 'content', formData.body.content);
    }

    return refs;
  };

  const extractRefPathFromError = (errorMessage) => {
    const match = errorMessage.match(/\{\{ref:([^}]+)\}\}/);
    return match ? match[1] : null;
  };

  const buildResultCards = (execAPI, allResults, targetResult, errorMessage) => {
    const allApis = projectManager.getData()?.apis || [];
    const cards = [];

    // 判断错误类型
    const isRefResolveFail = errorMessage && errorMessage.includes('引用变量解析失败');

    // 从错误信息中提取失败的依赖 ID
    let failedApiId = null;
    if (errorMessage && !isRefResolveFail) {
      const idMatch = errorMessage.match(/\(ID:\s*([^)]+)\)/);
      if (idMatch) failedApiId = idMatch[1];
    }

    for (const depId of (execAPI.chain || [])) {
      const api = allApis.find(a => a.id === depId);
      const res = allResults?.[depId];
      if (res) {
        cards.push({ apiId: depId, name: api?.name || depId, result: res, isTarget: false });
      } else {
        // 未执行的依赖 - 标记失败原因
        const refs = findRefParamsForApi(depId);
        const isFailed = depId === failedApiId;
        cards.push({
          apiId: depId,
          name: api?.name || depId,
          result: {
            success: false,
            error: isRefResolveFail ? '引用参数解析失败，本请求中断' : (isFailed ? errorMessage : '前置依赖API未执行成功，中断本请求'),
            errorType: 'chain_break',
            refParams: refs
          },
          isTarget: false
        });
      }
    }

    // 目标 API 卡片
    const targetApi = allApis.find(a => a.id === execAPI.id);
    if (targetResult) {
      cards.push({ apiId: execAPI.id, name: targetApi?.name || execAPI.name || '目标', result: targetResult, isTarget: true });
    } else if (isRefResolveFail) {
      cards.push({
        apiId: execAPI.id,
        name: targetApi?.name || execAPI.name || '目标',
        result: { success: false, error: errorMessage, errorType: 'ref_resolve_fail' },
        isTarget: true
      });
    } else {
      cards.push({
        apiId: execAPI.id,
        name: targetApi?.name || execAPI.name || '目标',
        result: { success: false, error: '前置依赖API未执行成功，中断本请求', errorType: 'chain_break' },
        isTarget: true
      });
    }

    return cards;
  };

  const handleSend = async () => {
    if (!formData.api_path) return;

    if (isExecuting) {
      executorRef.current?.executor?.cancel();
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

      if (onSaveAPI && !isTemporary) {
        await onSaveAPI(execAPI, isAdding);
      }

      const chainManager = new ChainManager(projectPath, config, profile);
      executorRef.current = chainManager;

      const cancelPromise = new Promise((resolve) => {
        chainManager.executor._cancelResolver = resolve;
      });

      const result = await Promise.race([
        chainManager.execute(execAPI, {}),
        cancelPromise
      ]);

      const cards = buildResultCards(execAPI, result.allResults, result.targetResult, null);

      result.requestInfo = requestInfo;
      result.resultCards = cards;
      setExecutionResult(result);

      if (onExecute) onExecute(execAPI, result);
    } catch (error) {
      const partialResults = executorRef.current?.chainResults || {};
      const execAPI = prepareForExecute();
      const cards = buildResultCards(execAPI, partialResults, null, error.message);
      cards.forEach(card => {
        if (card.result?.errorType === 'ref_resolve_fail') {
          const refPath = extractRefPathFromError(card.result.error);
          card.result._refs = refPath ? findRefParamsByRefPath(refPath) : [];
        }
      });
      setExecutionResult({ success: false, error: error.message, allResults: partialResults, resultCards: cards });
    } finally {
      setIsExecuting(false);
      executorRef.current = null;
    }
  };

  const handleSave = async () => {
    if (!formData.name && (isAdding || isTemporary)) {
      setLocalSaveError('请输入 API 名称');
      return;
    }
    if (!formData.api_path) {
      setLocalSaveError('请输入 API 路径');
      return;
    }

    setIsSaving(true);
    setLocalSaveError(null);

    try {
      const execAPI = prepareForExecute();
      console.log(`[APIDetail] handleSave - execAPI params:`, JSON.stringify(execAPI.param));
      console.log(`[APIDetail] handleSave - execAPI headers:`, JSON.stringify(execAPI.header));
      if (onSaveAPI) {
        await onSaveAPI(execAPI, isAdding || isTemporary);
      }
      console.log(`[APIDetail] handleSave - after save complete`);
    } catch (error) {
      const errMsg = error.message || '保存失败';
      setLocalSaveError(errMsg);
      if (onSaveError) onSaveError(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateDoc = async () => {
    const markdown = APIDocGenerator.generate(formData, resolvedPath, executionResult);
    const fileName = `${formData.name || 'api'}_文档.md`;

    try {
      if (window.electron) {
        // Electron 环境：使用文件保存对话框
        const result = await window.electron.saveFile({
          defaultPath: fileName,
          filters: [
            { name: 'Markdown', extensions: ['md'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (result && result.filePath) {
          const writeResult = await window.electron.writeFile(result.filePath, markdown);
          if (writeResult && writeResult.success) {
            alert(`文档已保存到: ${result.filePath}`);
          } else {
            alert(`保存文档失败: ${writeResult?.error || '未知错误'}`);
          }
        }
      } else {
        // 浏览器环境：直接下载
        APIDocGenerator.download(markdown, fileName);
      }
    } catch (error) {
      console.error('保存文档失败:', error);
      alert('保存文档失败');
    }
  };

  const prepareForExecute = () => {
    const headerObj = {};
    formData.header.forEach(item => {
      if (item.enabled && item.key && item.key.toLowerCase() !== 'content-type') {
        headerObj[item.key] = item.default || '';
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
          default: item.default || '',
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
          body[item.key] = { default: item.default || '', type: item.type };
        }
      });
    } else if (formData.body.type === 'x-www-form-urlencoded') {
      body = {};
      formData.body.xwwwFormUrlencoded.forEach(item => {
        if (item.enabled && item.key) {
          body[item.key] = item.default || '';
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
      id: formData.id,
      name: formData.name,
      group: formData.group,
      api_path: formData.api_path,
      method: formData.method,
      header: headerObj,
      param: paramObj,
      body,
      chain: extractRefApis(),
      successAssert
    };
  };

  const getMethodColor = (method) => {
    const colors = { 'GET': '#10b981', 'POST': '#3b82f6', 'PUT': '#f59e0b', 'DELETE': '#ef4444', 'PATCH': '#8b5cf6', 'HEAD': '#6b7280', 'OPTIONS': '#6b7280' };
    return colors[method] || '#64748b';
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
            'xml': 'text/xml',
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
    ...(!isTemporary && apiHistory.length > 0 ? [{ id: 'history', label: '历史', count: apiHistory.length }] : [])
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
                    ) : isReadonly ? (
                      <input type="text" value={item.default || ''} readOnly className="readonly" />
                    ) : (
                      <RefVariableSelector
                        value={item.default || ''}
                        onChange={(val) => {
                          const newItems = [...items];
                          newItems[index] = { ...item, default: val };
                          setItems(newItems);
                        }}
                        excludeApiId={formData.id}
                        theme={theme}
                      />
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
          {isTemporary && <span className="temp-badge">草稿</span>}
          <input
            type="text"
            className="api-name-input"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={isTemporary ? "请输入 API 名称以保存" : "API 名称"}
          />
          {formData.id && (
            <span className="api-id-badge" onClick={() => navigator.clipboard.writeText(formData.id)} title="点击复制 ID">
              <span className="api-id-text">{formData.id}</span>
              <Copy size={10} />
            </span>
          )}
        </div>
        <div className="header-actions">
          <button
            className={`btn-save ${saveError || localSaveError ? 'error' : ''}`}
            onClick={handleSave}
            title={saveError || localSaveError || '保存 API'}
          >
            {isSaving ? (
              <RefreshCw size={16} className="spin" />
            ) : saveError || localSaveError ? (
              <AlertCircle size={16} />
            ) : (
              <Save size={16} />
            )}
            {isSaving ? '保存中' : '保存'}
          </button>
          <button className="btn-send" onClick={handleSend}>
            {isExecuting ? <X size={16} /> : <Play size={16} />}
            {isExecuting ? '发送中' : '发送'}
          </button>
          <button className="btn-doc" onClick={handleGenerateDoc} title="生成API文档">
            <FileDown size={16} />
            生成文档
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
                        setActiveSegmentIdx(null);
                      } else if (e.key === 'Escape') {
                        setEditingSegmentIdx(null);
                        setActiveSegmentIdx(null);
                      }
                    }}
                    onBlur={() => {
                      const newSegments = [...urlSegments];
                      newSegments[idx] = { ...seg, value: editingValue, type: 'text' };
                      setUrlSegments(newSegments);
                      setEditingSegmentIdx(null);
                      setActiveSegmentIdx(null);
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
      </div>

      <div className="url-preview">
        <span className="preview-label">完整路径:</span>
        <code className="preview-path">{generateResolvedPath()}</code>
        <button className={`btn-copy ${urlCopied ? 'copied' : ''}`} onClick={() => {
          navigator.clipboard.writeText(generateResolvedPath());
          setUrlCopied(true);
          setTimeout(() => setUrlCopied(false), 1500);
        }} title={urlCopied ? '已复制' : '复制URL'}>
          {urlCopied ? <CheckCircle size={14} /> : <Copy size={14} />}
        </button>
      </div>

      <div className="chain-section">
        <span className="section-label">依赖</span>
        <div className="chain-tags">
          {(() => {
            const computed = extractRefApis();
            if (computed.length === 0) {
              return <span className="chain-empty">自动从引用变量中检测</span>;
            }
            const projectData = projectManager.getData();
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
            return computed.map((apiId, index) => {
              const chainAPI = projectData?.apis?.find(a => a.id === apiId);
              const displayName = chainAPI ? chainAPI.name : apiId;
              const idSuffix = chainAPI?.id ? ` (${chainAPI.id.substr(-6)})` : '';
              const groupPath = chainAPI ? getGroupPath(chainAPI.group || 'default') : '';
              return (
                <span key={`${apiId}_${index}`} className="chain-tag" title={groupPath}>
                  <span className="chain-tag-name">{String(displayName)}{idSuffix}</span>
                </span>
              );
            });
          })()}
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
                <br />示例：<code>$.code == 200</code> <code>$.obj.length &gt; 0</code>
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
                    <button
                      className="history-btn restore"
                      onClick={() => {
                        console.log('[History] 恢复请求 clicked:', entry);
                        if (onRestoreHistory) {
                          onRestoreHistory(entry);
                        }
                      }}
                      title="恢复请求"
                    >
                      <Play size={12} />
                    </button>
                    {onDeleteHistory && (
                      <button
                        className="history-btn delete"
                        onClick={() => onDeleteHistory(entry.id)}
                        title="删除记录"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
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

    </div>
  );
}

export default APIDetail;