import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { projectManager } from '../utils/ProjectManager';
import './RefSelector.css';

export function parseRefValue(val) {
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

function assembleRef(apiId, scenarioId, fieldPath) {
  if (!apiId) return '';
  const scenarioPart = scenarioId ? `@${scenarioId}` : '';
  return `{{ref:${apiId}${scenarioPart}.${fieldPath}}}`;
}

function RefSelector({ value = '', onChange, excludeApiId, showSearch = false }) {
  const parsed = parseRefValue(value);
  const [searchQuery, setSearchQuery] = useState('');
  const [refApiId, setRefApiId] = useState(parsed.apiId);
  const [refScenarioId, setRefScenarioId] = useState(parsed.scenarioId);
  const [refFieldPath, setRefFieldPath] = useState(parsed.fieldPath);
  const [apiScenarios, setApiScenarios] = useState([]);
  const [loadingScenarios, setLoadingScenarios] = useState(false);

  useEffect(() => {
    const p = parseRefValue(value);
    setRefApiId(p.apiId);
    setRefScenarioId(p.scenarioId);
    setRefFieldPath(p.fieldPath);
  }, [value]);

  useEffect(() => {
    if (!refApiId) { setApiScenarios([]); return; }
    setLoadingScenarios(true);
    projectManager.loadAPIData(refApiId).then(data => {
      if (data?.scenarios) {
        const list = Object.values(data.scenarios).filter(s => !s.deleted);
        setApiScenarios(list);
        if (!refScenarioId && list.length > 0) {
          setRefScenarioId(list[0].id);
          onChange?.(assembleRef(refApiId, list[0].id, refFieldPath));
        }
      } else {
        setApiScenarios([]);
      }
    }).catch(() => setApiScenarios([])).finally(() => setLoadingScenarios(false));
  }, [refApiId]);

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

  const displayGroups = showSearch && searchQuery ? filteredGroups : groupedApis;

  const handleApiSelect = (apiId) => {
    setRefApiId(apiId);
    setRefScenarioId(null);
    setRefFieldPath('');
    onChange?.(assembleRef(apiId, null, ''));
  };

  const handleScenarioSelect = (scenarioId) => {
    setRefScenarioId(scenarioId);
    onChange?.(assembleRef(refApiId, scenarioId, refFieldPath));
  };

  const handleFieldPathChange = (path) => {
    setRefFieldPath(path);
    onChange?.(assembleRef(refApiId, refScenarioId, path));
  };

  const handleClear = () => {
    setRefApiId(null);
    setRefScenarioId(null);
    setRefFieldPath('');
    setSearchQuery('');
    onChange?.('');
  };

  return (
    <div className="ref-selector">
      {showSearch && (
        <div className="ref-selector-search">
          <Search size={12} className="ref-selector-search-icon" />
          <input
            type="text"
            placeholder="搜索 API..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      <div className="ref-selector-api-list">
        {Object.entries(displayGroups).map(([gid, g]) => (
          <div key={gid}>
            <div className="ref-selector-group-title">{g.name}</div>
            {g.apis.map(api => (
              <div
                key={api.id}
                className={`ref-selector-api-item ${refApiId === api.id ? 'selected' : ''}`}
                onClick={() => handleApiSelect(api.id)}
              >
                <div className="ref-selector-api-radio" />
                <span className="ref-selector-api-name">{api.name}</span>
                <span className="ref-selector-api-id">{api.id.slice(-6)}</span>
              </div>
            ))}
          </div>
        ))}
        {Object.keys(displayGroups).length === 0 && (
          <div className="ref-selector-empty">{searchQuery ? '无匹配 API' : '暂无可引用 API'}</div>
        )}
      </div>

      <div className="ref-selector-scenarios">
        {loadingScenarios ? (
          <span className="ref-selector-hint">加载中...</span>
        ) : apiScenarios.length > 0 ? (
          <select
            className="ref-selector-scenario-select"
            value={refScenarioId || ''}
            onChange={(e) => handleScenarioSelect(e.target.value)}
          >
            {apiScenarios.map(scn => (
              <option key={scn.id} value={scn.id}>{scn.name}</option>
            ))}
          </select>
        ) : refApiId ? (
          <span className="ref-selector-hint">该 API 暂无场景</span>
        ) : (
          <span className="ref-selector-hint" />
        )}
      </div>

      <div className="ref-selector-value">
        <div className="ref-selector-value-label">引用值</div>
        <div className="ref-selector-value-box">
          {refApiId ? (
            <>
              <span className="ref-selector-prefix">{`{{ref:${refApiId}${refScenarioId ? `@${refScenarioId}` : ''}.`}</span>
              <input
                className="ref-selector-field-inline"
                value={refFieldPath || ''}
                onChange={(e) => handleFieldPathChange(e.target.value)}
                placeholder="data.field"
              />
              <span className="ref-selector-suffix">{'}}'}</span>
            </>
          ) : (
            <span className="ref-selector-placeholder">选择 API 后自动生成</span>
          )}
        </div>
      </div>

      <button className="ref-selector-clear-btn" onClick={handleClear}>清除所有选择</button>
    </div>
  );
}

export default RefSelector;
