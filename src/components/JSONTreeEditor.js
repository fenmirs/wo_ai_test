import React, { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Plus, Minus, ArrowRight, Layout } from 'lucide-react';
import JSONSchemaConverter from '../utils/JSONSchemaConverter';
import RefVariableSelector from './RefVariableSelector';
import './JSONTreeEditor.css';

const VALUE_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'null', label: 'Null' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'Array' },
];

function JSONTreeNode({ 
  node, 
  level, 
  selectedId, 
  onSelect,
  onUpdate, 
  expandedIds, 
  onToggleExpand,
  excludeApiId,
  theme 
}) {
  const [editingKey, setEditingKey] = useState(false);
  const [tempKeyValue, setTempKeyValue] = useState('');

  const isContainer = node.type === 'object' || node.type === 'array';
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const isArrayItem = Number.isInteger(node.key);
  const isRoot = node.key === null || node.key === undefined;

  const handleDoubleClick = (e) => {
    if (isRoot || isArrayItem) return;
    e.stopPropagation();
    setEditingKey(true);
    setTempKeyValue(String(node.key || ''));
  };

  const handleKeyEditBlur = () => {
    if (tempKeyValue && tempKeyValue !== String(node.key || '')) {
      onUpdate(node.id, { key: tempKeyValue });
    }
    setEditingKey(false);
  };

  const handleKeyEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleKeyEditBlur();
    } else if (e.key === 'Escape') {
      setEditingKey(false);
    }
  };

  const handleToggle = useCallback((e) => {
    e.stopPropagation();
    if (isContainer) {
      onToggleExpand(node.id);
    }
  }, [node.id, isContainer, onToggleExpand]);

  const handleRowClick = (e) => {
    if (editingKey) return;
    onSelect(node.id);
  };

  const handleTypeChange = useCallback((e) => {
    e.stopPropagation();
    const newType = e.target.value;
    const updates = { type: newType };
    
    switch (newType) {
      case 'string':
        updates.value = '';
        updates.children = undefined;
        break;
      case 'number':
        updates.value = 0;
        updates.children = undefined;
        break;
      case 'boolean':
        updates.value = false;
        updates.children = undefined;
        break;
      case 'null':
        updates.value = null;
        updates.children = undefined;
        break;
      case 'object':
        updates.children = [{
          id: JSONSchemaConverter.generateId(),
          type: 'string',
          key: 'newKey',
          value: '',
          description: '',
          children: []
        }];
        break;
      case 'array':
        updates.children = [{
          id: JSONSchemaConverter.generateId(),
          type: 'string',
          key: 0,
          value: '',
          description: '',
          children: []
        }];
        break;
    }
    
    onUpdate(node.id, updates);
  }, [node.id, onUpdate]);

  const handleValueChange = useCallback((newValue) => {
    let parsedValue = newValue;
    if (node.type === 'number') {
      parsedValue = Number(newValue) || 0;
    } else if (node.type === 'boolean') {
      parsedValue = newValue === true || newValue === 'true';
    }
    onUpdate(node.id, { value: parsedValue });
  }, [node.id, node.type, onUpdate]);

  const renderKey = () => {
    if (isRoot) {
      return <span className="tree-key root-key">root</span>;
    }
    
    if (isArrayItem) {
      return <span className="tree-key array-index">[{node.key}]</span>;
    }

    if (editingKey) {
      return (
        <input
          type="text"
          value={tempKeyValue}
          onChange={(e) => setTempKeyValue(e.target.value)}
          onBlur={handleKeyEditBlur}
          onKeyDown={handleKeyEditKeyDown}
          className="key-edit-input"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      );
    }

    return (
      <span className="tree-key" onDoubleClick={handleDoubleClick}>
        <span className="key-quote">"</span>
        {String(node.key)}
        <span className="key-quote">"</span>
      </span>
    );
  };

  const renderType = () => {
    return (
      <select
        value={node.type}
        onChange={handleTypeChange}
        className="type-select-inline"
        onClick={(e) => e.stopPropagation()}
      >
        {VALUE_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
    );
  };

  const renderValue = () => {
    if (node.type === 'object') {
      return (
        <span className="tree-value container-value">
          Object <span className="count">({node.children?.length || 0})</span>
        </span>
      );
    }
    
    if (node.type === 'array') {
      return (
        <span className="tree-value container-value">
          Array <span className="count">({node.children?.length || 0})</span>
        </span>
      );
    }
    
    if (node.type === 'null') {
      return <span className="tree-value type-null">null</span>;
    }
    
    if (node.type === 'boolean') {
      return (
        <select 
          value={node.value ? 'true' : 'false'}
          onChange={(e) => { e.stopPropagation(); handleValueChange(e.target.value === 'true'); }}
          className="boolean-select-inline"
          onClick={(e) => e.stopPropagation()}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }
    
    if (node.type === 'number') {
      return (
        <input
          type="number"
          value={node.value ?? ''}
          onChange={(e) => { e.stopPropagation(); handleValueChange(e.target.value); }}
          className="value-input-inline type-number"
          onClick={(e) => e.stopPropagation()}
        />
      );
    }
    
    return (
      // <div onClick={(e) => e.stopPropagation()}>
        <RefVariableSelector
         onClick={(e) => e.stopPropagation()}
          value={node.value ?? ''}
          onChange={handleValueChange}
          excludeApiId={excludeApiId}
          theme={theme}
        />
      // </div>
    );
  };

  const renderDescription = () => {
    return (
      <input
        type="text"
        value={node.description || ''}
        onChange={(e) => { e.stopPropagation(); onUpdate(node.id, { description: e.target.value }); }}
        placeholder="备注..."
        className="desc-input-inline"
        onClick={(e) => e.stopPropagation()}
      />
    );
  };

  const levelIndent = level * 24;

  return (
    <div className="tree-node">
      <div 
        className={`tree-node-row ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${levelIndent}px` }}
        onClick={handleRowClick}
      >
        <div className="node-expand-btn" onClick={handleToggle}>
          {isContainer && (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          )}
          {!isContainer && <span className="expand-placeholder" />}
        </div>
        
        <div className="node-content">
          <div className="node-col col-key-cell">
            {renderKey()}
          </div>
          
          <div className="node-col col-type-cell">
            {renderType()}
          </div>
          
          <div className="node-col col-desc-cell">
            {renderDescription()}
          </div>
          
          <div className="node-col col-value-cell">
            {renderValue()}
          </div>
        </div>
      </div>
      
      {isContainer && isExpanded && hasChildren && (
        <div className="tree-children">
          {node.children.map((child) => (
            <JSONTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onUpdate={onUpdate}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              excludeApiId={excludeApiId}
              theme={theme}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JSONTreeEditor({ 
  schema, 
  onChange, 
  excludeApiId, 
  theme = 'dark' 
}) {
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [selectedId, setSelectedId] = useState(null);

  React.useEffect(() => {
    if (schema) {
      const ids = new Set();
      collectExpandableIds(schema, ids);
      setExpandedIds(ids);
      setSelectedId(schema.id);
    }
  }, [schema?.id]);

  const collectExpandableIds = (node, ids) => {
    if (!node) return;
    if (node.type === 'object' || node.type === 'array') {
      ids.add(node.id);
      if (node.children) {
        node.children.forEach(child => collectExpandableIds(child, ids));
      }
    }
  };

  const handleToggleExpand = useCallback((nodeId) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleUpdate = useCallback((nodeId, updates) => {
    if (!schema) return;
    
    const updated = JSONSchemaConverter.updateNode(schema, nodeId, updates);
    onChange(updated);
  }, [schema, onChange]);

  const getParentInfo = useCallback((nodeId) => {
    if (!schema) return { parent: null, index: -1, parentType: null };
    
    const parent = JSONSchemaConverter.findParentNode(schema, nodeId);
    if (!parent) {
      const node = JSONSchemaConverter.findNodeById(schema, nodeId);
      if (node && (node.key === null || node.key === undefined)) {
        return { parent: null, index: -1, parentType: null, isRoot: true };
      }
      return { parent: null, index: -1, parentType: null };
    }
    
    const index = parent.children ? parent.children.findIndex(c => c.id === nodeId) : -1;
    return { parent, index, parentType: parent.type };
  }, [schema]);

  const selectedNodeInfo = selectedId 
    ? { 
        node: JSONSchemaConverter.findNodeById(schema, selectedId),
        ...getParentInfo(selectedId)
      }
    : null;

  const canAddSibling = selectedNodeInfo && selectedNodeInfo.parent !== null;
  const canAddChild = selectedNodeInfo && selectedNodeInfo.node && 
    (selectedNodeInfo.node.type === 'object' || selectedNodeInfo.node.type === 'array');
  const canDelete = selectedNodeInfo && selectedNodeInfo.parent !== null;

  const handleAddSibling = () => {
    if (!schema || !canAddSibling) return;
    
    const { parent, index, parentType } = selectedNodeInfo;
    const cloned = JSONSchemaConverter.cloneSchema(schema);
    const clonedParent = JSONSchemaConverter.findNodeById(cloned, parent.id);
    
    if (clonedParent && clonedParent.children) {
      let newNode;
      if (parentType === 'array') {
        const newIndex = index + 1;
        clonedParent.children.forEach((child, i) => {
          if (i >= newIndex && typeof child.key === 'number') {
            child.key = child.key + 1;
          }
        });
        
        newNode = {
          id: JSONSchemaConverter.generateId(),
          type: 'string',
          key: newIndex,
          value: '',
          description: '',
          children: []
        };
        
        clonedParent.children.splice(newIndex, 0, newNode);
      } else {
        newNode = {
          id: JSONSchemaConverter.generateId(),
          type: 'string',
          key: `newKey_${Date.now()}`,
          value: '',
          description: '',
          children: []
        };
        
        clonedParent.children.splice(index + 1, 0, newNode);
      }
      
      setExpandedIds(prev => new Set([...prev, clonedParent.id]));
      setSelectedId(newNode.id);
      onChange(cloned);
    }
  };

  const handleAddChild = () => {
    if (!schema || !canAddChild) return;
    
    const { node } = selectedNodeInfo;
    const cloned = JSONSchemaConverter.cloneSchema(schema);
    const clonedNode = JSONSchemaConverter.findNodeById(cloned, node.id);
    
    if (clonedNode) {
      if (!clonedNode.children) {
        clonedNode.children = [];
      }
      
      let newNode;
      if (clonedNode.type === 'array') {
        newNode = {
          id: JSONSchemaConverter.generateId(),
          type: 'string',
          key: clonedNode.children.length,
          value: '',
          description: '',
          children: []
        };
      } else {
        newNode = {
          id: JSONSchemaConverter.generateId(),
          type: 'string',
          key: `newKey_${Date.now()}`,
          value: '',
          description: '',
          children: []
        };
      }
      
      clonedNode.children.push(newNode);
      setExpandedIds(prev => new Set([...prev, clonedNode.id]));
      setSelectedId(newNode.id);
      onChange(cloned);
    }
  };

  const handleDelete = () => {
    if (!schema || !canDelete) return;
    
    const { node, parent, index, parentType } = selectedNodeInfo;
    const cloned = JSONSchemaConverter.cloneSchema(schema);
    const clonedParent = JSONSchemaConverter.findNodeById(cloned, parent.id);
    
    if (clonedParent && clonedParent.children) {
      clonedParent.children = clonedParent.children.filter(c => c.id !== selectedId);
      
      if (parentType === 'array') {
        clonedParent.children.forEach((child, i) => {
          if (typeof child.key === 'number') {
            child.key = i;
          }
        });
      }
      
      let newSelectedId = clonedParent.id;
      if (clonedParent.children.length > 0) {
        const newIndex = Math.min(index, clonedParent.children.length - 1);
        newSelectedId = clonedParent.children[newIndex].id;
      }
      setSelectedId(newSelectedId);
      onChange(cloned);
    }
  };

  if (!schema) {
    return (
      <div className="json-tree-editor empty">
        <div className="empty-message">无 JSON 数据</div>
      </div>
    );
  }

  return (
    <div className="json-tree-editor">
      <div className="tree-toolbar">
        <div className="toolbar-title">JSON 编辑器</div>
        <div className="toolbar-actions">
          <button
            className={`toolbar-btn ${!canAddSibling ? 'disabled' : ''}`}
            onClick={handleAddSibling}
            disabled={!canAddSibling}
            title="添加同级元素"
          >
            <ArrowRight size={14} />
            同级
          </button>
          <button
            className={`toolbar-btn ${!canAddChild ? 'disabled' : ''}`}
            onClick={handleAddChild}
            disabled={!canAddChild}
            title="添加子元素"
          >
            <Plus size={14} />
            子项
          </button>
          <button
            className={`toolbar-btn danger ${!canDelete ? 'disabled' : ''}`}
            onClick={handleDelete}
            disabled={!canDelete}
            title="删除选中元素"
          >
            <Minus size={14} />
            删除
          </button>
        </div>
      </div>
      
      <div className="tree-header">
        <div className="tree-header-col col-key">属性名</div>
        <div className="tree-header-col col-type">类型</div>
        <div className="tree-header-col col-desc">描述</div>
        <div className="tree-header-col col-value">值</div>
      </div>
      
      <div className="tree-body">
        <JSONTreeNode
          node={schema}
          level={0}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onUpdate={handleUpdate}
          expandedIds={expandedIds}
          onToggleExpand={handleToggleExpand}
          excludeApiId={excludeApiId}
          theme={theme}
        />
      </div>
    </div>
  );
}

export default JSONTreeEditor;
