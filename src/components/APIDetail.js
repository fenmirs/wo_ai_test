import React, { useState, useEffect, useRef } from 'react';
import { Play, RefreshCw, Copy, CheckCircle, XCircle, Clock, Trash2, Plus, X, AlertCircle, FileText, Save, FileDown, Code, Layout, Edit } from 'lucide-react';
import './APIDetail.css';
import ChainManager from '../utils/ChainManager';
import { projectManager } from '../utils/ProjectManager';
import { notificationManager } from '../utils/NotificationManager';
import APIDocGenerator from '../utils/APIDocGenerator';
import JSONSchemaConverter from '../utils/JSONSchemaConverter';
import XMLSchemaConverter from '../utils/XMLSchemaConverter';
import CodeEditor from './CodeEditor';
import BodyTreeEditor from './BodyTreeEditor';
import KVTable from './KVTable';
import KVBottomPanel from './KVBottomPanel';
import { toast } from './Toast';
import { useProgress } from './ProgressOverlay';


function APIDetail({ api, profile, config, projectPath, onExecute, history = [], restoringHistoryEntry, onRestored, onSaveAPI, groups = [], isTemporary = false, onViewDetail, onRestoreHistory, onDeleteHistory, theme = 'dark', onResultChange, onDraftChange, requestedScenarioId, requestedScenarioAction, onScenarioChange, onRequestedScenarioActionHandled, onRequestedScenarioHandled }) {
  const [resolvedPath, setResolvedPath] = useState('');
  const [executionResult, setExecutionResult] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState('params');
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);
  const executorRef = useRef(null);
  const initializedApiIdRef = useRef(null);
  const pendingActionRef = useRef(null);

  const createEmptyScenario = (id, name, description) => ({
    id: id || `scn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    name: name || '默认场景',
    description: description || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false,
    header: [],
    param: [],
    body: {
      type: 'none', formData: [], xwwwFormUrlencoded: [],
      activeContentType: 'json',
      contentType: 'json',
      content: '',
      schema: null,
      contents: {
        json: { content: '', schema: null },
        xml: { content: '', schema: null },
        text: { content: '', schema: null },
        html: { content: '', schema: null }
      }
    },
    assertions: [{ expression: '', enabled: true }],
    refChain: []
  });

  const [scenarioList, setScenarioList] = useState([]);
  const [currentScenarioId, setCurrentScenarioId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    group: '默认',
    api_path: '',
    method: 'GET',
    header: [],
    param: [],
    body: {
      type: 'none', formData: [], xwwwFormUrlencoded: [],
      activeContentType: 'json',
      contentType: 'json',
      content: '',
      schema: null,
      contents: {
        json: { content: '', schema: null },
        xml: { content: '', schema: null },
        text: { content: '', schema: null },
        html: { content: '', schema: null }
      }
    },
    assertions: [{ expression: '', enabled: true }]
  });

  const [urlSegments, setUrlSegments] = useState([{ type: 'text', value: '' }]);
  const [activeSegmentIdx, setActiveSegmentIdx] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const segmentInputRef = useRef(null);
  const isDropdownClickRef = useRef(false);
  const [dropdownPos, setDropdownPos] = useState(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const [jsonEditMode, setJsonEditMode] = useState('code');
  const [xmlEditMode, setXmlEditMode] = useState('code');
  const [jsonParseError, setJsonParseError] = useState(null);
  const [xmlParseError, setXmlParseError] = useState(null);
  const [xmlAllowMixed, setXmlAllowMixed] = useState(false);
  const { showProgress, hideProgress } = useProgress();
  const [showCodeSwitchConfirm, setShowCodeSwitchConfirm] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [apiEditMode, setApiEditMode] = useState(false);
  const savedUrlSegmentsRef = useRef(null);
  const cleanSnapshotRef = useRef(null);
  const [bottomPanel, setBottomPanel] = useState({ visible: false, section: null, rowIndex: null, field: 'value' });

  const apiHistory = history.filter(h =>
    (h.apiId && h.apiId === formData.id) ||
    (!h.apiId && h.apiName === formData.name)
  );

  useEffect(() => {
    if (api) {
      if (initializedApiIdRef.current === api.id) {
        return;
      }
      initializedApiIdRef.current = api.id;
      setApiEditMode(false);
      savedUrlSegmentsRef.current = null;
      initializeFromApi(api, requestedScenarioId);
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
    if (requestedScenarioId && requestedScenarioId !== currentScenarioId) {
      if (scenarioList.length > 0) {
        switchScenario(requestedScenarioId);
        onRequestedScenarioHandled?.();
      }
    }
  }, [requestedScenarioId]);

  useEffect(() => {
    if (!requestedScenarioAction) return;
    if (requestedScenarioAction.type === 'add') {
      if (initializedApiIdRef.current === api?.id) {
        addScenario();
        onRequestedScenarioActionHandled?.();
      } else {
        pendingActionRef.current = requestedScenarioAction;
      }
    } else if (requestedScenarioAction.type === 'delete') {
      deleteScenario(requestedScenarioAction.scenarioId);
      onRequestedScenarioActionHandled?.();
    }
  }, [requestedScenarioAction]);

  useEffect(() => {
    updateResolvedPath();
  }, [formData.api_path, profile]);

  useEffect(() => {
    const path = urlSegments.map(seg =>
      seg.type === 'variable' ? `{${seg.value}}` : seg.value
    ).join('');
    setFormData(prev => prev.api_path === path ? prev : { ...prev, api_path: path });
  }, [urlSegments]);

  useEffect(() => {
    if (executionResult && onResultChange) {
      onResultChange(executionResult);
    }
  }, [executionResult]);

  useEffect(() => {
    if (formData.body.activeContentType === 'json' && formData.body.type === 'raw') {
      const content = getBodyContent();
      if (content.trim()) {
        try { JSON.parse(content); setJsonParseError(null); }
        catch (e) { setJsonParseError(e.message); }
      } else {
        setJsonParseError(null);
      }
    } else {
      setJsonParseError(null);
    }
  }, [formData.body.contents, formData.body.activeContentType, formData.body.type]);

  useEffect(() => {
    cleanSnapshotRef.current = null;
    setDraftDirty(false);
  }, []);

  useEffect(() => {
    onDraftChange?.(draftDirty);
  }, [draftDirty, onDraftChange]);



  // 计算变量下拉菜单位置
  useEffect(() => {
    if (activeSegmentIdx !== null && segmentInputRef.current) {
      const rect = segmentInputRef.current.getBoundingClientRect();
      setDropdownPos({ left: rect.left, top: rect.bottom + 4, width: rect.width });
    } else {
      setDropdownPos(null);
    }
  }, [activeSegmentIdx]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveSegmentIdx(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const extractApiIdFromRef = (refContent) => {
    const atIdx = refContent.indexOf('@');
    return atIdx >= 0 ? refContent.substring(0, atIdx) : refContent.split('.')[0];
  };

  const extractRefApis = () => {
    const refRegex = /\{\{ref:([^}]+)\}\}/g;
    const apiIds = new Set();

    const scanValue = (value) => {
      if (typeof value !== 'string') return;
      refRegex.lastIndex = 0;
      let match;
      while ((match = refRegex.exec(value)) !== null) {
        const apiId = extractApiIdFromRef(match[1]);
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
      scanValue(getBodyContent());
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

  const initializeFromApi = (apiData, pendingScenarioId) => {
    const defaultHeader = {};
    if (apiData.header?.['Content-Type'] !== undefined) {
      defaultHeader['Content-Type'] = apiData.header['Content-Type'];
    } else {
      defaultHeader['Content-Type'] = 'application/json';
    }

    const parseAssertions = (assertStr) => {
      if (!assertStr) return [{ expression: '', enabled: true }];
      return assertStr.split(/[;\n]/).map(a => a.trim()).filter(a => a)
        .map(a => ({ expression: a, enabled: true }));
    };

    // API-level method and path
    const apiPath = apiData.api_path || '';
    const apiMethod = apiData.method || 'GET';
    const isFullUrl = apiPath.startsWith('http://') || apiPath.startsWith('https://');

    // Parse scenarios from API data
    let scenarios = [];
    let activeScenarioId = null;

    if (apiData.scenarios && Object.keys(apiData.scenarios).length > 0) {
      scenarios = Object.values(apiData.scenarios).filter(s => !s.deleted);
      if (scenarios.length === 0) {
        const firstKey = Object.keys(apiData.scenarios)[0];
        scenarios = [apiData.scenarios[firstKey]];
      }
      activeScenarioId = scenarios[0].id;
      // If a specific scenario was requested (e.g. from tree click), use it
      if (pendingScenarioId && scenarios.find(s => s.id === pendingScenarioId)) {
        activeScenarioId = pendingScenarioId;
      }
    } else {
      // Try cache first (apiData prop may not include scenarios for new APIs)
      const cacheEntry = projectManager._apiDataCache[apiData.id];
      if (cacheEntry?.scenarios && Object.keys(cacheEntry.scenarios).length > 0) {
        scenarios = Object.values(cacheEntry.scenarios).filter(s => !s.deleted);
        if (scenarios.length === 0) {
          const firstKey = Object.keys(cacheEntry.scenarios)[0];
          scenarios = [cacheEntry.scenarios[firstKey]];
        }
        activeScenarioId = scenarios[0]?.id;
      } else {
        // No scenarios yet: create default scenario from top-level fields
        const parsedParam = parseToArray(apiData.param);
        const parsedHeader = parseToArray({ ...defaultHeader, ...apiData.header });
        const defaultScn = createEmptyScenario('scn_default', '默认场景', '');
        defaultScn.header = parsedHeader;
        defaultScn.param = parsedParam;
        defaultScn.body = parseBodyData(apiData.body, { ...defaultHeader, ...apiData.header });
        defaultScn.assertions = parseAssertions(apiData.successAssert);
        scenarios = [defaultScn];
        activeScenarioId = defaultScn.id;
      }
    }

    // Handle pending add scenario action
    if (pendingActionRef.current?.type === 'add') {
      pendingActionRef.current = null;
      const newScnId = `scn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const currentScn = scenarios.find(s => s.id === activeScenarioId);
      const baseName = scenarios.length === 0 ? '默认场景' : '新场景';
      let name = baseName;
      let counter = 1;
      while (scenarios.some(s => s.name === name)) {
        name = `${baseName} ${counter++}`;
      }
      const newScenario = {
        ...createEmptyScenario(newScnId, name, currentScn?.description || ''),
        id: newScnId,
        name,
      };
      scenarios = [...scenarios, newScenario];
      activeScenarioId = newScnId;
    }

    setScenarioList(scenarios);
    setCurrentScenarioId(activeScenarioId);

    const firstScenario = scenarios.find(s => s.id === activeScenarioId);
    const newFormData = {
      id: apiData.id,
      name: apiData.name || '',
      group: apiData.group || '默认',
      api_path: apiPath,
      method: apiMethod,
      header: firstScenario?.header || parseToArray({ ...defaultHeader, ...apiData.header }),
      param: firstScenario?.param || parseToArray(apiData.param),
      body: firstScenario?.body || parseBodyData(apiData.body, { ...defaultHeader, ...apiData.header }),
      assertions: firstScenario?.assertions || parseAssertions(apiData.successAssert)
    };

    setFormData(newFormData);

    // Notify tree which scenario is active
    onScenarioChange?.(apiData.id, activeScenarioId);

    if (isFullUrl) {
      setUrlSegments([{ type: 'text', value: apiPath }]);
    } else {
      setUrlSegments(parseApiPathToSegments(apiPath));
    }

    onRequestedScenarioHandled?.();
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

    // API-level method/path from history (not per-scenario)
    const apiMethod = cfg.method || 'GET';
    const apiPath = cfg.api_path || '';

    const restoredScn = createEmptyScenario('scn_restored', '已恢复', `从历史记录恢复 - ${historyEntry.timestamp}`);
    restoredScn.header = parseToArray({ ...defaultHeader, ...cfg.header });
    restoredScn.param = parseToArray(cfg.param);
    restoredScn.body = parseBodyData(cfg.body, { ...defaultHeader, ...cfg.header });
    restoredScn.assertions = parseAssertions(cfg.successAssert);

    setScenarioList(prev => [...prev, restoredScn]);
    setCurrentScenarioId(restoredScn.id);

    setFormData({
      name: cfg.name || '',
      group: cfg.group || '默认',
      api_path: apiPath,
      method: apiMethod,
      header: parseToArray({ ...defaultHeader, ...cfg.header }),
      param: parseToArray(cfg.param),
      body: parseBodyData(cfg.body, { ...defaultHeader, ...cfg.header }),
      assertions: parseAssertions(cfg.successAssert)
    });

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
    const emptyContents = () => ({
      json: { content: '', schema: null },
      xml: { content: '', schema: null },
      text: { content: '', schema: null },
      html: { content: '', schema: null }
    });

    const defaultResult = () => ({
      type: 'none', formData: [], xwwwFormUrlencoded: [],
      activeContentType: 'text', contentType: 'text', content: '', schema: null,
      contents: emptyContents()
    });

    if (!body) return defaultResult();
    const contentType = header?.['Content-Type'] || '';

    if (typeof body === 'object' && !Array.isArray(body)) {
      if (body.contents && body.activeContentType) {
        const ct = body.activeContentType;
        return {
          type: body.type || 'raw',
          formData: body.formData || [],
          xwwwFormUrlencoded: body.xwwwFormUrlencoded || [],
          activeContentType: ct,
          contentType: ct,
          content: body.contents[ct]?.content || '',
          schema: body.contents[ct]?.schema || null,
          contents: body.contents
        };
      }

      if (body.contentType && body.content !== undefined) {
        const ct = body.contentType || 'text';
        const contents = emptyContents();
        contents[ct] = { content: body.content || '', schema: body.schema || null };
        return {
          type: body.type || 'raw',
          formData: body.formData || [],
          xwwwFormUrlencoded: body.xwwwFormUrlencoded || [],
          activeContentType: ct,
          contentType: ct,
          content: contents[ct].content,
          schema: contents[ct].schema,
          contents
        };
      }

      if (contentType.includes('application/json') || body.contentType === 'json') {
        const content = typeof body.content === 'string' ? body.content : JSON.stringify(body, null, 2);
        let schema = null;
        try {
          const parsed = typeof body.content === 'string' ? JSON.parse(body.content) : body;
          schema = JSONSchemaConverter.jsonToSchema(parsed);
        } catch (e) { console.warn('[APIDetail] Failed to parse JSON for schema:', e); }
        const contents = emptyContents();
        contents.json = { content, schema };
        return { type: 'raw', formData: [], xwwwFormUrlencoded: [], activeContentType: 'json', contentType: 'json', content, schema, contents };
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        return { type: 'x-www-form-urlencoded', formData: [], xwwwFormUrlencoded: parseToArray(body), activeContentType: 'text', contentType: 'text', content: '', schema: null, contents: emptyContents() };
      } else if (contentType.includes('multipart/form-data')) {
        return { type: 'form-data', formData: parseToArray(body), xwwwFormUrlencoded: [], activeContentType: 'text', contentType: 'text', content: '', schema: null, contents: emptyContents() };
      }
    }

    if (typeof body === 'string') {
      let detectedContentType = 'text';
      let schema = null;
      if (contentType.includes('application/json') || contentType.includes('json')) {
        detectedContentType = 'json';
        try { schema = JSONSchemaConverter.jsonToSchema(body); } catch (e) { console.warn('[APIDetail] Failed to parse JSON for schema:', e); }
      } else if (contentType.includes('xml')) { detectedContentType = 'xml'; }
      else if (contentType.includes('html')) { detectedContentType = 'html'; }
      else if (contentType.includes('text/plain')) { detectedContentType = 'text'; }
      const contents = emptyContents();
      contents[detectedContentType] = { content: body, schema };
      return { type: 'raw', formData: [], xwwwFormUrlencoded: [], activeContentType: detectedContentType, contentType: detectedContentType, content: body, schema, contents };
    }

    const contents = emptyContents();
    const strContent = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    contents.text = { content: strContent, schema: null };
    return { type: 'raw', formData: [], xwwwFormUrlencoded: [], activeContentType: 'text', contentType: 'text', content: strContent, schema: null, contents };
  };

  const getBodyContent = () => {
    if (formData.body.type !== 'raw') return '';
    const ct = formData.body.activeContentType || formData.body.contentType || 'text';
    return formData.body.contents?.[ct]?.content || formData.body.content || '';
  };

  const getBodySchema = () => {
    if (formData.body.type !== 'raw') return null;
    const ct = formData.body.activeContentType || formData.body.contentType || 'text';
    return formData.body.contents?.[ct]?.schema || formData.body.schema || null;
  };

  const formToScenarioData = () => ({
    header: formData.header,
    param: formData.param,
    body: formData.body,
    assertions: formData.assertions
  });

  const scenarioToForm = (scenario) => {
    if (!scenario) return;
    setFormData(prev => ({
      ...prev,
      header: scenario.header || [],
      param: scenario.param || [],
      body: scenario.body || {
        type: 'none', formData: [], xwwwFormUrlencoded: [],
        activeContentType: 'json', contentType: 'json',
        content: '', schema: null,
        contents: {
          json: { content: '', schema: null },
          xml: { content: '', schema: null },
          text: { content: '', schema: null },
          html: { content: '', schema: null }
        }
      },
      assertions: scenario.assertions || [{ expression: '', enabled: true }]
    }));
  };

  const switchScenario = (scenarioId) => {
    const scenario = scenarioList.find(s => s.id === scenarioId);
    if (!scenario) return;
    const updatedList = scenarioList.map(s => {
      if (s.id === currentScenarioId) {
        return { ...s, ...formToScenarioData(), updatedAt: new Date().toISOString() };
      }
      return s;
    });
    setScenarioList(updatedList);
    setCurrentScenarioId(scenarioId);
    scenarioToForm(scenario);
    onScenarioChange?.(api?.id, scenarioId);
  };

  const addScenario = () => {
    const newId = `scn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const defaultScenario = scenarioList[0];
    const cacheScns = api?.id && projectManager._apiDataCache[api.id]?.scenarios
      ? Object.values(projectManager._apiDataCache[api.id].scenarios).filter(s => !s.deleted)
      : [];
    const baseName = cacheScns.length === 0 ? '默认场景' : '新场景';
    let name = baseName;
    let counter = 1;
    while (scenarioList.some(s => s.name === name)) {
      name = `${baseName} ${counter}`;
      counter++;
    }
    const newScenario = {
      ...createEmptyScenario(newId, name, ''),
      id: newId,
      name,
      header: defaultScenario?.header || formData.header,
      param: defaultScenario?.param || formData.param,
      body: defaultScenario?.body || formData.body,
      assertions: defaultScenario?.assertions || formData.assertions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setScenarioList(prev => [...prev, newScenario]);
    setCurrentScenarioId(newId);
    // 同步更新缓存，使左侧树能立即反映场景数变化
    if (api?.id && projectManager._apiDataCache[api.id]) {
      if (!projectManager._apiDataCache[api.id].scenarios) {
        projectManager._apiDataCache[api.id].scenarios = {};
      }
      projectManager._apiDataCache[api.id].scenarios[newId] = { ...newScenario };
      projectManager.markDirty();
    }
    onScenarioChange?.(api?.id, newId);
  };

  const renameScenario = (scenarioId, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (scenarioList.some(s => s.id !== scenarioId && s.name === trimmed)) {
      toast.error('场景名称不能重复');
      return;
    }
    setScenarioList(prev => prev.map(s =>
      s.id === scenarioId ? { ...s, name: trimmed, updatedAt: new Date().toISOString() } : s
    ));
  };

  const deleteScenario = (scenarioId) => {
    if (scenarioList.length <= 1) return;
    setScenarioList(prev => prev.filter(s => s.id !== scenarioId));
    if (currentScenarioId === scenarioId) {
      const remaining = scenarioList.filter(s => s.id !== scenarioId);
      const next = remaining[0];
      setCurrentScenarioId(next.id);
      scenarioToForm(next);
      onScenarioChange?.(api?.id, next.id);
    }
  };

  // --- KV Bottom Panel Handlers ---
  const handleBottomPanelOpen = (section, rowIndex, field) => {
    setBottomPanel({ visible: true, section, rowIndex, field });
  };

  const handleBottomPanelClose = () => {
    setBottomPanel({ visible: false, section: null, rowIndex: null, field: 'value' });
  };

  const handleActiveRowChange = (rowIndex) => {
    setBottomPanel(prev => prev.visible ? { ...prev, rowIndex } : prev);
  };

  const handleSectionItemsChange = (section, newItems) => {
    switch (section) {
      case 'param':
        setFormData(prev => ({ ...prev, param: newItems }));
        break;
      case 'header':
        setFormData(prev => ({ ...prev, header: newItems }));
        break;
      case 'formData':
        updateFormBody({ formData: newItems });
        break;
      case 'xwww':
        updateFormBody({ xwwwFormUrlencoded: newItems });
        break;
    }
  };

  const getSectionItems = (section) => {
    switch (section) {
      case 'param': return formData.param;
      case 'header': return formData.header;
      case 'formData': return formData.body.formData;
      case 'xwww': return formData.body.xwwwFormUrlencoded;
      default: return [];
    }
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
        const refApiId = extractApiIdFromRef(match[1]);
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
      scanValue('Body', 'content', getBodyContent());
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
      scanValue('Body', 'content', getBodyContent());
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
        await onSaveAPI(execAPI, false);
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
    if (!formData.name) {
      toast.error('请输入 API 名称');
      return;
    }
    if (!formData.api_path) {
      toast.error('请输入 API 路径');
      return;
    }

    const bodyCT = formData.body.activeContentType || formData.body.contentType;
    const bodyContent = getBodyContent();

    if (formData.body.type === 'raw' && bodyCT === 'json') {
      if (bodyContent.trim()) {
        try { JSON.parse(bodyContent); }
        catch (e) {
          toast.error('JSON 格式错误，请检查后重试');
          return;
        }
      }
    }

    if (formData.body.type === 'raw' && bodyCT === 'xml') {
      if (bodyContent.trim()) {
        const err = XMLSchemaConverter.validateXml(bodyContent);
        if (err) {
          toast.error('XML 格式错误，请检查后重试');
          return;
        }
        if (!xmlAllowMixed && XMLSchemaConverter.hasMixedContent(bodyContent)) {
          toast.error('存在混合内容，请允许混合内容或清理数据后再保存');
          return;
        }
      }
    }

    console.log('[APIDetail.handleSave] formData.id:', formData.id, 'isTemporary:', isTemporary, 'scenarioList.length:', scenarioList.length);
    const execAPI = prepareForExecute();
    console.log('[APIDetail.handleSave] execAPI.id:', execAPI.id, 'name:', execAPI.name);
    setIsSaving(true);

    try {
      if (onSaveAPI) {
        await onSaveAPI(execAPI, isTemporary);
      }
      toast.success('保存成功');
    } catch (error) {
      const errMsg = error.message || '保存失败';
      toast.error(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateDoc = async () => {
    const markdown = APIDocGenerator.generate(formData, resolvedPath, executionResult, config, profile);
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
            notificationManager.addNotification('success', '文档保存成功', result.filePath, { filePath: result.filePath });
          } else {
            notificationManager.addNotification('error', '文档保存失败', writeResult?.error || '未知错误');
          }
        }
      } else {
        // 浏览器环境：直接下载
        APIDocGenerator.download(markdown, fileName);
      }
    } catch (error) {
      console.error('保存文档失败:', error);
      notificationManager.addNotification('error', '文档保存失败', error.message || '未知错误');
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
      const currentContent = getBodyContent();
      const currentSchema = getBodySchema();
      if (currentSchema) {
        body = {
          content: currentContent,
          schema: currentSchema,
          type: formData.body.type,
          contentType: formData.body.activeContentType || formData.body.contentType
        };
      } else {
        body = currentContent || '';
      }
    }

    const successAssert = formData.assertions
      .filter(a => a.enabled && a.expression.trim())
      .map(a => a.expression.trim())
      .join('; ');

    // Build scenarios object from scenarioList (scenarios no longer carry method/apiPath)
    const scenarios = {};
    let list = scenarioList;
    if (list.length === 0) {
      const defaultScn = createEmptyScenario(`scn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, '默认场景', '');
      defaultScn.header = formData.header;
      defaultScn.param = formData.param;
      defaultScn.body = formData.body;
      defaultScn.assertions = formData.assertions;
      list = [defaultScn];
    }
    const updatedList = list.map(s => {
      if (s.id === currentScenarioId) {
        return {
          ...s,
          header: formData.header,
          param: formData.param,
          body: formData.body,
          assertions: formData.assertions,
          updatedAt: new Date().toISOString()
        };
      }
      return s;
    });
    updatedList.forEach(s => { scenarios[s.id] = s; });

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
      successAssert,
      scenarios
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

    const oldCT = formData.body.activeContentType || formData.body.contentType;
    const newCT = newBody.activeContentType || newBody.contentType;

    if (newBody.type === 'raw') {
      if (!newBody.contents) {
        newBody.contents = {
          json: { content: '', schema: null },
          xml: { content: '', schema: null },
          text: { content: '', schema: null },
          html: { content: '', schema: null }
        };
      }

      if (updates.activeContentType || (updates.contentType && oldCT !== newCT)) {
        const actualOldCT = oldCT || 'text';
        const actualNewCT = newCT || 'text';
        const prevContent = formData.body.contents?.[actualOldCT]?.content;
        const newContents = { ...newBody.contents };
        if (prevContent !== undefined) {
          newContents[actualOldCT] = {
            content: formData.body.content || prevContent || '',
            schema: formData.body.schema || null
          };
        }
        const saved = newContents[actualNewCT] || { content: '', schema: null };
        newBody.content = saved.content;
        newBody.schema = saved.schema;
        newBody.activeContentType = actualNewCT;
        newBody.contentType = actualNewCT;
        newBody.contents = newContents;
      } else if (updates.content !== undefined || updates.schema !== undefined) {
        const ct = newBody.activeContentType || newBody.contentType || 'text';
        const newContents = { ...(newBody.contents) };
        if (!newContents[ct]) newContents[ct] = { content: '', schema: null };
        newContents[ct] = {
          content: updates.content !== undefined ? updates.content : (newBody.content || ''),
          schema: updates.schema !== undefined ? updates.schema : (newBody.schema || null)
        };
        newBody.contents = newContents;
      }
    }

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
          return rawContentTypes[newBody.activeContentType || newBody.contentType] || 'text/plain';
        default: return null;
      }
    };

    const ctHeader = getContentType(newBody.type);
    if (ctHeader) {
      if (contentTypeIndex >= 0) {
        newHeader[contentTypeIndex] = { ...newHeader[contentTypeIndex], default: ctHeader };
      } else {
        newHeader.push({ key: 'Content-Type', default: ctHeader, type: 'string', description: '', enabled: true });
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

  if (!api && !formData.name) return null;

  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

  return (
    <div className="api-detail">
      {/* API 级别：方法 + URL（只读/可编辑切换）+ 操作按钮 */}
      <div className="api-line">
        {apiEditMode ? (
          <div className="method-select" style={{ flexShrink: 0 }}>
            <select
              value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value })}
              style={{ backgroundColor: getMethodColor(formData.method) }}
            >
              {methods.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        ) : (
          <div className="api-method-label" style={{ backgroundColor: getMethodColor(formData.method) }}>
            {formData.method}
          </div>
        )}
        <div className="api-line-url">
          {apiEditMode ? (
            <div className="url-builder" style={{ border: 'none', padding: 0 }}>
              <div className="url-segments">
                {urlSegments.map((seg, idx) => (
                  <div
                    key={idx}
                    className={`url-segment ${idx === 0 ? 'first' : ''} ${activeSegmentIdx === idx ? 'active' : ''}`}
                  >
                    {activeSegmentIdx === idx ? (
                      <>
                        <input
                          ref={segmentInputRef}
                          type="text"
                          className="segment-edit-input"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const newSegments = [...urlSegments];
                              newSegments[idx] = { ...seg, value: editingValue, type: 'text' };
                              setUrlSegments(newSegments);
                              setActiveSegmentIdx(null);
                            } else if (e.key === 'Escape') {
                              setActiveSegmentIdx(null);
                            }
                          }}
                          onBlur={() => {
                            if (isDropdownClickRef.current) {
                              isDropdownClickRef.current = false;
                              return;
                            }
                            const newSegments = [...urlSegments];
                            newSegments[idx] = { ...seg, value: editingValue, type: 'text' };
                            setUrlSegments(newSegments);
                            setActiveSegmentIdx(null);
                          }}
                          autoFocus
                        />
                        {urlSegments.length > 1 && (
                          <button className="segment-delete" onMouseDown={(e) => { e.preventDefault(); setUrlSegments(urlSegments.filter((_, i) => i !== idx)); }}>
                            <X size={10} />
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="segment-content" onClick={() => { setActiveSegmentIdx(idx); setEditingValue(seg.value); }}>
                        <span className="segment-text">
                          {seg.value || (idx === 0 ? '输入或选择' : '输入路径')}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                <button className="segment-add-btn" onClick={() => setUrlSegments([...urlSegments, { type: 'text', value: '' }])} title="添加片段">
                  <Plus size={12} />
                </button>
              </div>
            </div>
          ) : (
            <span className="api-line-url-text" title={formData.api_path}>{formData.api_path}</span>
          )}
          {dropdownPos && (
            <div className="segment-var-dropdown" style={{ position: 'fixed', left: dropdownPos.left, top: dropdownPos.top, minWidth: dropdownPos.width, zIndex: 10000 }}>
              {profile && Object.keys(profile)
                .filter(k => k !== 'name' && k !== 'activate')
                .filter(k => activeSegmentIdx === 0 || k !== 'domain')
                .map(k => (
                  <div key={k} className="segment-var-option" onMouseDown={(e) => {
                    e.preventDefault();
                    isDropdownClickRef.current = true;
                    const newSegments = [...urlSegments];
                    newSegments[activeSegmentIdx] = { type: 'variable', value: k };
                    setUrlSegments(newSegments);
                    setActiveSegmentIdx(null);
                  }}>
                    {k}
                  </div>
                ))}
            </div>
          )}
        </div>
        <div className="api-line-right">
          {apiEditMode ? (
            <>
              <button className="api-edit-btn confirm" onClick={() => {
                savedUrlSegmentsRef.current = null;
                setApiEditMode(false);
              }} title="完成编辑">
                <CheckCircle size={16} />
              </button>
              <button className="api-edit-btn cancel" onClick={() => { setUrlSegments(savedUrlSegmentsRef.current); savedUrlSegmentsRef.current = null; setApiEditMode(false); }} title="取消">
                <X size={16} />
              </button>
            </>
          ) : (
            <button className="api-edit-btn" onClick={() => { savedUrlSegmentsRef.current = [...urlSegments]; setApiEditMode(true); }} title="编辑 API">
              <Edit size={16} />
            </button>
          )}
          <div className="api-line-actions">
            <button className="scene-action-btn btn-save-icon" onClick={handleSave} title="保存">
              {isSaving ? <RefreshCw size={16} className="spin" /> : <Save size={16} />}
            </button>
            <span className="scene-action-divider">|</span>
            <button className="scene-action-btn btn-send-icon" onClick={handleSend} title={isExecuting ? '取消' : '发送'}>
              {isExecuting ? <X size={16} /> : <Play size={16} />}
            </button>
            <span className="scene-action-divider">|</span>
            <button className="scene-action-btn btn-doc-icon" onClick={handleGenerateDoc} title="生成文档">
              <FileDown size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* URL 预览 */}
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

      <div className="desc-line">
          {(() => {
            const curScn = scenarioList.find(s => s.id === currentScenarioId);
            if (!curScn) return null;
            return (
              <textarea
                className="desc-textarea"
                value={curScn.description || ''}
                onChange={(e) => {
                  const newDesc = e.target.value;
                  setScenarioList(prev => prev.map(s =>
                    s.id === curScn.id ? { ...s, description: newDesc, updatedAt: new Date().toISOString() } : s
                  ));
                }}
                placeholder="点击添加场景描述..."
                rows={1}
              />
            );
          })()}
        </div>

      {(() => { const refs = extractRefApis(); if (refs.length === 0) return null; return (
      <div className="chain-section">
        <span className="section-label">依赖</span>
        <div className="chain-tags">
          {(() => {
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
            return refs.map((apiId, index) => {
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
      </div>); })()}

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
            <KVTable
              items={formData.param}
              onItemsChange={(items) => setFormData(prev => ({ ...prev, param: items }))}
              section="param"
              showType={true}
              onValueClick={(idx) => handleBottomPanelOpen('param', idx, 'value')}
              onDescClick={(idx) => handleBottomPanelOpen('param', idx, 'description')}
              onActiveRowChange={handleActiveRowChange}
              activeRowIndex={bottomPanel.section === 'param' ? bottomPanel.rowIndex : null}
              excludeApiId={formData.id}
              theme={theme}
            />
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="tab-content">
            <KVTable
              items={formData.header}
              onItemsChange={(items) => setFormData(prev => ({ ...prev, header: items }))}
              section="header"
              showType={false}
              onValueClick={(idx) => handleBottomPanelOpen('header', idx, 'value')}
              onDescClick={(idx) => handleBottomPanelOpen('header', idx, 'description')}
              onActiveRowChange={handleActiveRowChange}
              activeRowIndex={bottomPanel.section === 'header' ? bottomPanel.rowIndex : null}
              excludeApiId={formData.id}
              theme={theme}
            />
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
                      value={formData.body.activeContentType || formData.body.contentType || 'text'}
                      onChange={(e) => {
                        const newType = e.target.value;
                        const currentContent = getBodyContent();
                        const updates = { activeContentType: newType, contentType: newType };
                        if (!currentContent && !formData.body.contents?.[newType]?.content) {
                          switch (newType) {
                            case 'json': updates.content = '{\n  \n}'; break;
                            case 'xml':  updates.content = '<root></root>'; break;
                            default:     updates.content = '';
                          }
                        }
                        updateFormBody(updates);
                        setJsonEditMode('code');
                        setXmlEditMode('code');
                        setJsonParseError(null);
                        setXmlParseError(null);
                        if (newType !== 'xml') setXmlAllowMixed(false);
                      }}
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
                {(() => {
                  const section = formData.body.type === 'form-data' ? 'formData' : 'xwww';
                  const items = section === 'formData' ? formData.body.formData : formData.body.xwwwFormUrlencoded;
                  return (
                    <KVTable
                      items={items}
                      onItemsChange={(newItems) => handleSectionItemsChange(section, newItems)}
                      section={section}
                      showType={true}
                      showFileType={section === 'formData'}
                      onValueClick={(idx) => handleBottomPanelOpen(section, idx, 'value')}
                      onDescClick={(idx) => handleBottomPanelOpen(section, idx, 'description')}
                      onActiveRowChange={handleActiveRowChange}
                      activeRowIndex={bottomPanel.section === section ? bottomPanel.rowIndex : null}
                      excludeApiId={formData.id}
                      theme={theme}
                    />
                  );
                })()}
              </div>
            )}

             {formData.body.type === 'raw' && (
               <div className="body-raw">
                  {(formData.body.activeContentType === 'json' || formData.body.contentType === 'json') && (
                    <div className="json-mode-switcher">
                      <button
                        className={`json-mode-btn${jsonParseError ? ' disabled' : ''}`}
                        disabled={!!jsonParseError}
                        onClick={() => {
                          if (jsonEditMode === 'code') {
                            const currentContent = getBodyContent() || '{}';
                            if (!currentContent.trim()) return;
                            try { JSON.parse(currentContent); } catch (_) { return; }
                            try {
                              const existingSchema = getBodySchema();
                              const newSchema = JSONSchemaConverter.jsonToSchema(currentContent, existingSchema);
                              if (newSchema) {
                                updateFormBody({ schema: newSchema });
                                setJsonEditMode('ui');
                              }
                            } catch (err) {
                              console.warn('[APIDetail] Failed to convert JSON to schema:', err);
                            }
                          } else {
                            setJsonEditMode('code');
                            setJsonParseError(null);
                          }
                        }}
                      >
                        {jsonEditMode === 'code' ? <><Layout size={12} /> UI</> : <><Code size={12} /> 代码</>}
                        {jsonParseError && <span className="parse-error-badge" title={jsonParseError}>!</span>}
                      </button>
                    </div>
                  )}

                  {(formData.body.activeContentType === 'xml' || formData.body.contentType === 'xml') && (
                    <div className="json-mode-switcher">
                      <button
                        className={`json-mode-btn${xmlParseError ? ' disabled' : ''}`}
                        disabled={!!xmlParseError}
                        onClick={() => {
                          if (xmlEditMode === 'code') {
                            const currentContent = getBodyContent() || '<root></root>';
                            if (!currentContent.trim()) return;
                            const err = XMLSchemaConverter.validateXml(currentContent);
                            if (err) return;
                            if (!xmlAllowMixed && XMLSchemaConverter.hasMixedContent(currentContent)) return;
                            try {
                              const existingSchema = getBodySchema();
                              const newSchema = XMLSchemaConverter.xmlToSchema(currentContent, existingSchema);
                              if (newSchema) {
                                updateFormBody({ schema: newSchema });
                              }
                            } catch (err) {
                              console.warn('[APIDetail] Failed to convert XML to schema:', err);
                            }
                            setXmlEditMode('ui');
                          } else {
                            showProgress();
                            setTimeout(() => {
                              setXmlEditMode('code');
                              hideProgress();
                            }, 16);
                          }
                        }}
                      >
                        {xmlEditMode === 'code' ? <><Layout size={12} /> UI</> : <><Code size={12} /> 代码</>}
                        {xmlParseError && <span className="parse-error-badge" title={xmlParseError}>!</span>}
                      </button>
                      <label
                        className="mixed-toggle"
                        title={xmlAllowMixed ? '允许混合内容中' : '不允许混合内容 (推荐)'}
                      >
                        <input
                          type="checkbox"
                          checked={xmlAllowMixed}
                          onChange={() => {
                            const newVal = !xmlAllowMixed;
                            setXmlAllowMixed(newVal);
                            const content = formData.body.content || '';
                            if (content.trim()) {
                              const parseErr = XMLSchemaConverter.validateXml(content);
                              if (parseErr) {
                                setXmlParseError(parseErr);
                              } else if (!newVal && XMLSchemaConverter.hasMixedContent(content)) {
                                setXmlParseError('存在混合内容 (文本与标签不能混写)');
                              } else {
                                setXmlParseError(null);
                              }
                            }
                          }}
                        />
                        <span className="mixed-toggle-track">
                          <span className="mixed-toggle-thumb" />
                        </span>
                        <span className="mixed-toggle-label">混合</span>
                      </label>
                    </div>
                  )}

                  {(formData.body.activeContentType === 'json' || formData.body.contentType === 'json') && jsonEditMode === 'ui' ? (
                    <div className="json-editor-wrapper">
                      {getBodySchema() ? (
                        <BodyTreeEditor
                          schema={getBodySchema()}
                          onChange={(newSchema) => {
                            const newContent = JSONSchemaConverter.schemaToJson(newSchema, true);
                            updateFormBody({ schema: newSchema, content: newContent });
                          }}
                          excludeApiId={formData.id}
                          theme={theme}
                        />
                      ) : (
                        <div className="body-none">
                          无法解析 JSON 数据，请切换到代码模式检查格式
                        </div>
                      )}
                    </div>
                  ) : (formData.body.activeContentType === 'xml' || formData.body.contentType === 'xml') && xmlEditMode === 'ui' ? (
                    <div className="json-editor-wrapper">
                      {getBodySchema() ? (
                        <BodyTreeEditor
                          mode="xml"
                          schema={getBodySchema()}
                          onChange={(newSchema) => {
                            const newContent = XMLSchemaConverter.schemaToXml(newSchema, true);
                            updateFormBody({ schema: newSchema, content: newContent });
                          }}
                          excludeApiId={formData.id}
                          theme={theme}
                        />
                      ) : (
                        <div className="body-none">
                          无法解析 XML 数据，请切换到代码模式检查格式
                        </div>
                      )}
                    </div>
                  ) : (
                    <CodeEditor
                      value={getBodyContent()}
                      onChange={(content) => {
                        const bodyCT = formData.body.activeContentType || formData.body.contentType;
                        const updates = { content };
                        
                         if (bodyCT === 'json' && jsonEditMode === 'code') {
                            let isJsonValid = true;
                            if (content && content.trim()) {
                              try {
                                JSON.parse(content);
                                setJsonParseError(null);
                              } catch (e) {
                                setJsonParseError(e.message);
                                isJsonValid = false;
                              }
                            } else {
                              setJsonParseError(null);
                            }
                            if (isJsonValid) {
                              try {
                                const existingSchema = getBodySchema();
                                const newSchema = JSONSchemaConverter.jsonToSchema(content, existingSchema);
                                if (newSchema) {
                                  updates.schema = newSchema;
                                }
                              } catch (err) {
                                // Ignore parse errors when typing
                              }
                            }
                          }

                          if (bodyCT === 'xml' && xmlEditMode === 'code') {
                            let isXmlValid = true;
                            if (content && content.trim()) {
                              const err = XMLSchemaConverter.validateXml(content);
                              if (err) {
                                setXmlParseError(err);
                                isXmlValid = false;
                              } else if (!xmlAllowMixed && XMLSchemaConverter.hasMixedContent(content)) {
                                setXmlParseError('存在混合内容 (文本与标签不能混写)');
                                isXmlValid = false;
                              } else {
                                setXmlParseError(null);
                              }
                            } else {
                              setXmlParseError(null);
                            }
                            if (isXmlValid) {
                              try {
                                const existingSchema = getBodySchema();
                                const newSchema = XMLSchemaConverter.xmlToSchema(content, existingSchema);
                                if (newSchema) {
                                  updates.schema = newSchema;
                                }
                              } catch (err) {
                                // Ignore parse errors when typing
                              }
                            }
                          }

                         updateFormBody(updates);
                      }}
                      contentType={formData.body.activeContentType || formData.body.contentType || 'text'}
                      onTypeChange={(newType) => {
                        updateFormBody({ activeContentType: newType, contentType: newType });
                        if (newType !== 'json') {
                          setJsonEditMode('code');
                        }
                        if (newType !== 'xml') {
                          setXmlEditMode('code');
                          setXmlAllowMixed(false);
                        }
                      }}
                      theme={theme}
                    />
                  )}
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
            <div className="history-list">
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

      <KVBottomPanel
        visible={bottomPanel.visible}
        section={bottomPanel.section}
        rowIndex={bottomPanel.rowIndex}
        field={bottomPanel.field}
        items={getSectionItems(bottomPanel.section)}
        onItemsChange={(newItems) => handleSectionItemsChange(bottomPanel.section, newItems)}
        onClose={handleBottomPanelClose}
        theme={theme}
        excludeApiId={formData.id}
      />
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