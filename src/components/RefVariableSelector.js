import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Zap } from 'lucide-react';
import { projectManager } from '../utils/ProjectManager';
import './RefVariableSelector.css';

function RefVariableSelector({ value, onChange, excludeApiId, theme = 'dark' }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedApiId, setSelectedApiId] = useState(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);
  const [fieldPath, setFieldPath] = useState('');
  const [apiScenarios, setApiScenarios] = useState([]);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    parseRefValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target) &&
          dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedApiId) {
      loadApiScenarios(selectedApiId);
    }
  }, [selectedApiId]);

  const loadApiScenarios = async (apiId) => {
    try {
      const data = await projectManager.loadAPIData(apiId);
      if (data && data.scenarios) {
        const list = Object.values(data.scenarios).filter(s => !s.deleted);
        setApiScenarios(list);
        if (!selectedScenarioId && list.length > 0) {
          setSelectedScenarioId(list[0].id);
        }
      } else {
        setApiScenarios([]);
      }
    } catch {
      setApiScenarios([]);
    }
  };

  const parseRefValue = (val) => {
    const match = val?.match(/\{\{ref:([^}]+)\}\}/);
    if (match) {
      const refContent = match[1];
      const atIdx = refContent.indexOf('@');
      if (atIdx >= 0) {
        const apiId = refContent.substring(0, atIdx);
        const afterAt = refContent.substring(atIdx + 1);
        const dotIdx = afterAt.indexOf('.');
        if (dotIdx >= 0) {
          setSelectedApiId(apiId);
          setSelectedScenarioId(afterAt.substring(0, dotIdx));
          setFieldPath(afterAt.substring(dotIdx + 1));
        } else {
          setSelectedApiId(apiId);
          setSelectedScenarioId(afterAt);
          setFieldPath('');
        }
      } else {
        const parts = refContent.split('.');
        setSelectedApiId(parts[0]);
        setSelectedScenarioId(null);
        setFieldPath(parts.slice(1).join('.'));
      }
    } else {
      setSelectedApiId(null);
      setSelectedScenarioId(null);
      setFieldPath(val || '');
    }
  };

  const handleModeChange = (mode) => {
    if (mode === 'static') {
      setSelectedApiId(null);
      setSelectedScenarioId(null);
      setFieldPath('');
      onChange('');
    } else {
      setIsDropdownOpen(true);
    }
  };

  const handleApiSelect = (apiId) => {
    setSelectedApiId(apiId);
    setSelectedScenarioId(null);
    setFieldPath('');
    setIsDropdownOpen(false);
    loadApiScenarios(apiId);
  };

  const handleScenarioSelect = (scenarioId) => {
    setSelectedScenarioId(scenarioId);
    updateRefValue(selectedApiId, scenarioId, fieldPath);
  };

  const handleFieldPathChange = (e) => {
    const newPath = e.target.value;
    setFieldPath(newPath);
    updateRefValue(selectedApiId, selectedScenarioId, newPath);
  };

  const updateRefValue = (apiId, scenarioId, path) => {
    if (!apiId) return;
    const scenarioPart = scenarioId ? `@${scenarioId}` : '';
    const refValue = `{{ref:${apiId}${scenarioPart}.${path}}}`;
    onChange(refValue);
  };

  const handleClearSelection = () => {
    setSelectedApiId(null);
    setSelectedScenarioId(null);
    setFieldPath('');
    setApiScenarios([]);
    onChange('');
  };

  const isRefMode = !!selectedApiId;

  const projectData = projectManager.getData();
  const allApis = projectData?.apis || [];
  const groups = projectData?.groups || [];

  const availableApis = allApis.filter(a => {
    if (excludeApiId && a.id === excludeApiId) return false;
    return true;
  });

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

  const groupedApis = {};
  availableApis.forEach(api => {
    const groupId = api.group || 'default';
    const groupName = groupId === 'default' ? '默认' : getGroupPath(groupId);
    if (!groupedApis[groupId]) {
      groupedApis[groupId] = { name: groupName, apis: [] };
    }
    groupedApis[groupId].apis.push(api);
  });

  const selectedApi = allApis.find(a => a.id === selectedApiId);

  return (
    <div className="ref-selector" ref={containerRef}>
      <div className="ref-selector-header">
        {!isRefMode && !value && (
          <button
            className="ref-mode-btn"
            onClick={() => setIsDropdownOpen(true)}
            title="选择引用变量"
          >
            <Zap size={12} />
          </button>
        )}

        <div className={`ref-selector-input ${isRefMode ? 'ref-mode' : ''}`}>
          {isRefMode ? (
            <>
              <span className="ref-api-badge" onClick={() => setIsDropdownOpen(true)}>
                {selectedApi?.name || selectedApiId}
                <X size={10} className="ref-badge-x" onClick={(e) => {
                  e.stopPropagation();
                  handleClearSelection();
                }} />
              </span>
              {selectedScenarioId && apiScenarios.length > 0 && (
                <select
                  className="ref-scenario-select"
                  value={selectedScenarioId}
                  onChange={(e) => handleScenarioSelect(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                >
                  {apiScenarios.map(scn => (
                    <option key={scn.id} value={scn.id}>{scn.name}</option>
                  ))}
                </select>
              )}
              <input
                type="text"
                className="ref-field-input"
                placeholder="输入字段路径 (如 data.token)"
                value={fieldPath}
                onChange={handleFieldPathChange}
              />
            </>
          ) : (
            <input
              type="text"
              className="static-value-input"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="输入值或选择引用"
            />
          )}
        </div>
      </div>

      {isDropdownOpen && (
        <div className="ref-dropdown" ref={dropdownRef}>
          <div className="ref-dropdown-header">
            <span>选择 API 引用</span>
            <X size={12} className="ref-dropdown-close" onClick={() => setIsDropdownOpen(false)} />
          </div>
          <div className="ref-dropdown-list">
            {Object.entries(groupedApis).map(([groupId, group]) => (
              <div key={groupId} className="ref-dropdown-group">
                <div className="ref-dropdown-group-title">{group.name}</div>
                {group.apis.map(api => (
                  <div
                    key={api.id}
                    className={`ref-dropdown-item ${selectedApiId === api.id ? 'selected' : ''}`}
                    onClick={() => handleApiSelect(api.id)}
                    title={`${api.name} (${api.id})`}
                  >
                    <span className="ref-item-name">{api.name}</span>
                    <span className="ref-item-id">{api.id.substring(Math.max(0, api.id.length - 6))}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default RefVariableSelector;
