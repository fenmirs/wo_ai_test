import React, { useState, useCallback, useRef } from 'react';
import { ChevronRight, ChevronDown, Plus, Minus, ArrowRight, X, Settings } from 'lucide-react';
import JSONSchemaConverter from '../utils/JSONSchemaConverter';
import XMLSchemaConverter from '../utils/XMLSchemaConverter';
import RefVariableSelector from './RefVariableSelector';
import './BodyTreeEditor.css';

const VALUE_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'null', label: 'Null' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'Array' },
  { value: 'ref', label: 'Ref Variable' },
];

function BodyTreeNode({
  node,
  level,
  selectedId,
  onSelect,
  onUpdate,
  expandedIds,
  onToggleExpand,
  excludeApiId,
  theme,
  mode = 'json',
  onOpenAttrDialog
}) {
  const [editingKey, setEditingKey] = useState(false);
  const [tempKeyValue, setTempKeyValue] = useState('');

  const isXmlMode = mode === 'xml';

  const attrChildren = isXmlMode && node.children
    ? node.children.filter(c => c.key && String(c.key).startsWith('@'))
    : [];
  const textChild = isXmlMode && node.children
    ? node.children.find(c => c.key === '#text')
    : null;
  const elemChildren = isXmlMode && node.children
    ? node.children.filter(c => !String(c.key || '').startsWith('@') && c.key !== '#text')
    : node.children;

  const visibleChildren = isXmlMode ? elemChildren : (node.children || []);
  const isContainer = node.type === 'object' || node.type === 'array';
  const hasChildren = visibleChildren.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const isRoot = node.key === null || node.key === undefined;

  const handleDoubleClick = (e) => {
    if (isRoot) return;
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
      case 'ref':
        updates.value = '';
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
        {isXmlMode ? (
          <span className="xml-tag-name">&lt;{String(node.key)}&gt;</span>
        ) : (
          <>
            <span className="key-quote">"</span>
            {String(node.key)}
            <span className="key-quote">"</span>
          </>
        )}
      </span>
    );
  };

  const renderAttrButton = () => {
    const attrSummary = attrChildren
      .map(a => `${String(a.key || '').replace(/^@/, '')}="${a.value ?? ''}"`)
      .join(' ');

    return (
      <button
        className="xml-attr-btn"
        onClick={(e) => { e.stopPropagation(); onOpenAttrDialog(node.id); }}
        title="管理属性"
      >
        <Settings size={10} />
        <span className="xml-attr-summary">{attrSummary || '添加属性'}</span>
      </button>
    );
  };

  const renderXmlValue = () => {
    if (textChild) {
      return (
        <input
          type="text"
          value={textChild.value ?? ''}
          onChange={(e) => { onUpdate(textChild.id, { value: e.target.value }); }}
          className="value-input-inline"
          placeholder="文本内容"
          onClick={(e) => e.stopPropagation()}
        />
      );
    }

    if (elemChildren.length > 0) {
      return (
        <span className="tree-value container-value">
          Element <span className="count">({elemChildren.length})</span>
        </span>
      );
    }

    return (
      <input
        type="text"
        value={node.value ?? ''}
        onChange={(e) => { e.stopPropagation(); handleValueChange(e.target.value); }}
        className="value-input-inline"
        placeholder="值"
        onClick={(e) => e.stopPropagation()}
      />
    );
  };

  const renderType = () => {
    if (isXmlMode) return null;
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
    if (isXmlMode) return renderXmlValue();

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
      <RefVariableSelector
        onClick={(e) => e.stopPropagation()}
        value={node.value ?? ''}
        onChange={handleValueChange}
        excludeApiId={excludeApiId}
        theme={theme}
      />
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
    <div className="tree-node" data-node-id={node.id}>
      <div
        className={`tree-node-row ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${levelIndent}px` }}
        onClick={handleRowClick}
      >
        <div className="node-expand-btn" onClick={handleToggle}>
          {isContainer && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
          {!isContainer && <span className="expand-placeholder" />}
        </div>

        <div className="node-content">
          {isXmlMode ? (
            <>
              <div className="node-col col-key-cell">
                {renderKey()}
                {renderAttrButton()}
              </div>
              <div className="node-col col-value-cell">
                {renderXmlValue()}
              </div>
              <div className="node-col col-desc-cell">
                {renderDescription()}
              </div>
            </>
          ) : (
            <>
              <div className="node-col col-key-cell">{renderKey()}</div>
              <div className="node-col col-type-cell">{renderType()}</div>
              <div className="node-col col-desc-cell">{renderDescription()}</div>
              <div className="node-col col-value-cell">{renderValue()}</div>
            </>
          )}
        </div>
      </div>

      {isContainer && isExpanded && visibleChildren && visibleChildren.length > 0 && (
        <div className="tree-children">
          {visibleChildren.map((child) => (
            <BodyTreeNode
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
              mode={mode}
              onOpenAttrDialog={onOpenAttrDialog}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AttributeDialog({ node, onClose, onUpdate }) {
  const [attrs, setAttrs] = useState(() => {
    const existing = (node.children || [])
      .filter(c => c.key && String(c.key).startsWith('@'))
      .map(c => ({
        id: c.id,
        name: String(c.key).replace(/^@/, ''),
        value: c.value ?? ''
      }));
    return existing.length > 0 ? existing : [{ id: JSONSchemaConverter.generateId(), name: '', value: '' }];
  });

  const handleChange = (index, field, value) => {
    const updated = attrs.map((a, i) => i === index ? { ...a, [field]: value } : a);
    setAttrs(updated);
  };

  const handleAdd = () => {
    setAttrs([...attrs, { id: JSONSchemaConverter.generateId(), name: '', value: '' }]);
  };

  const handleRemove = (index) => {
    setAttrs(attrs.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const validAttrs = attrs.filter(a => a.name.trim());
    const attrNodes = validAttrs.map(a => ({
      id: a.id,
      type: 'string',
      key: `@${a.name}`,
      value: a.value,
      description: '',
      children: []
    }));
    const otherChildren = (node.children || []).filter(c => !String(c.key || '').startsWith('@'));
    onUpdate(node.id, { children: [...attrNodes, ...otherChildren] });
    onClose();
  };

  return (
    <div className="attr-dialog-overlay" onClick={onClose}>
      <div className="attr-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="attr-dialog-header">
          <span>属性管理 - &lt;{node.key}&gt;</span>
          <button className="attr-dialog-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="attr-dialog-body">
          <table className="attr-table">
            <thead>
              <tr>
                <th className="attr-col-name">属性名</th>
                <th className="attr-col-value">值</th>
                <th className="attr-col-action"></th>
              </tr>
            </thead>
            <tbody>
              {attrs.map((attr, index) => (
                <tr key={attr.id}>
                  <td>
                    <input
                      type="text"
                      value={attr.name}
                      onChange={(e) => handleChange(index, 'name', e.target.value)}
                      placeholder="属性名"
                      className="attr-input"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={attr.value}
                      onChange={(e) => handleChange(index, 'value', e.target.value)}
                      placeholder="值"
                      className="attr-input"
                    />
                  </td>
                  <td>
                    <button className="attr-del-btn" onClick={() => handleRemove(index)} title="删除属性">
                      <X size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="attr-add-btn" onClick={handleAdd}>
            <Plus size={12} /> 添加属性
          </button>
        </div>
        <div className="attr-dialog-footer">
          <button className="attr-btn-cancel" onClick={onClose}>取消</button>
          <button className="attr-btn-save" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
}

function BodyTreeEditor({
  schema,
  onChange,
  excludeApiId,
  theme = 'dark',
  mode = 'json'
}) {
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [selectedId, setSelectedId] = useState(null);
  const [attrDialogNodeId, setAttrDialogNodeId] = useState(null);
  const [scrollToId, setScrollToId] = useState(null);
  const treeBodyRef = useRef(null);

  const isXmlMode = mode === 'xml';

  React.useEffect(() => {
    if (schema) {
      const ids = new Set();
      collectExpandableIds(schema, ids);
      setExpandedIds(ids);
      setSelectedId(schema.id);
    }
  }, [schema?.id]);

  React.useEffect(() => {
    if (scrollToId && treeBodyRef.current) {
      const el = treeBodyRef.current.querySelector(`[data-node-id="${scrollToId}"]`);
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      setScrollToId(null);
    }
  }, [scrollToId]);

  const collectExpandableIds = (node, ids) => {
    if (!node) return;
    if (node.type === 'object' || node.type === 'array') {
      ids.add(node.id);
      if (node.children) {
        node.children.forEach(child => {
          if (!isXmlMode || (!String(child.key || '').startsWith('@') && child.key !== '#text')) {
            collectExpandableIds(child, ids);
          }
        });
      }
    }
  };

  const handleToggleExpand = useCallback((nodeId) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const handleUpdate = useCallback((nodeId, updates) => {
    if (!schema) return;
    const converter = isXmlMode ? XMLSchemaConverter : JSONSchemaConverter;
    const updated = converter.updateNode(schema, nodeId, updates);
    onChange(updated);
  }, [schema, onChange, isXmlMode]);

  const getParentInfo = useCallback((nodeId) => {
    if (!schema) return { parent: null, index: -1, parentType: null };
    const converter = isXmlMode ? XMLSchemaConverter : JSONSchemaConverter;
    const parent = converter.findParentNode(schema, nodeId);
    if (!parent) {
      const node = converter.findNodeById(schema, nodeId);
      if (node && (node.key === null || node.key === undefined)) {
        return { parent: null, index: -1, parentType: null, isRoot: true };
      }
      return { parent: null, index: -1, parentType: null };
    }
    const index = parent.children ? parent.children.findIndex(c => c.id === nodeId) : -1;
    return { parent, index, parentType: parent.type };
  }, [schema, isXmlMode]);

  const selectedNodeInfo = selectedId
    ? {
        node: (isXmlMode ? XMLSchemaConverter : JSONSchemaConverter).findNodeById(schema, selectedId),
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
    const converter = isXmlMode ? XMLSchemaConverter : JSONSchemaConverter;
    const cloned = converter.cloneSchema(schema);
    const clonedParent = converter.findNodeById(cloned, parent.id);

    if (clonedParent && clonedParent.children) {
      let newNode;
      if (parentType === 'array') {
        const newIndex = index + 1;
        clonedParent.children.forEach((child, i) => {
          if (i >= newIndex && typeof child.key === 'number') child.key = child.key + 1;
        });
        newNode = {
          id: converter.generateId(),
          type: 'string',
          key: newIndex,
          value: '',
          description: '',
          children: []
        };
        clonedParent.children.splice(newIndex, 0, newNode);
      } else {
        newNode = {
          id: converter.generateId(),
          type: isXmlMode ? 'object' : 'string',
          key: `newElement_${Date.now()}`,
          value: null,
          description: '',
          children: isXmlMode ? [{ id: converter.generateId(), type: 'string', key: '#text', value: '', description: '', children: [] }] : undefined
        };
        clonedParent.children.splice(index + 1, 0, newNode);
      }

      setExpandedIds(prev => new Set([...prev, clonedParent.id]));
      setSelectedId(newNode.id);
      setScrollToId(newNode.id);
      onChange(cloned);
    }
  };

  const handleAddChild = () => {
    if (!schema || !canAddChild) return;
    const { node } = selectedNodeInfo;
    const converter = isXmlMode ? XMLSchemaConverter : JSONSchemaConverter;
    const cloned = converter.cloneSchema(schema);
    const clonedNode = converter.findNodeById(cloned, node.id);

    if (clonedNode) {
      if (!clonedNode.children) clonedNode.children = [];

      let newNode;
      if (clonedNode.type === 'array') {
        newNode = {
          id: converter.generateId(),
          type: 'string',
          key: clonedNode.children.length,
          value: '',
          description: '',
          children: []
        };
      } else {
        newNode = {
          id: converter.generateId(),
          type: isXmlMode ? 'object' : 'string',
          key: `newElement_${Date.now()}`,
          value: null,
          description: '',
          children: isXmlMode ? [{ id: converter.generateId(), type: 'string', key: '#text', value: '', description: '', children: [] }] : undefined
        };
      }

      clonedNode.children.push(newNode);
      setExpandedIds(prev => new Set([...prev, clonedNode.id]));
      setSelectedId(newNode.id);
      setScrollToId(newNode.id);
      onChange(cloned);
    }
  };

  const handleDelete = () => {
    if (!schema || !canDelete) return;
    const { node, parent, index, parentType } = selectedNodeInfo;
    const converter = isXmlMode ? XMLSchemaConverter : JSONSchemaConverter;
    const cloned = converter.cloneSchema(schema);
    const clonedParent = converter.findNodeById(cloned, parent.id);

    if (clonedParent && clonedParent.children) {
      clonedParent.children = clonedParent.children.filter(c => c.id !== selectedId);
      if (parentType === 'array') {
        clonedParent.children.forEach((child, i) => {
          if (typeof child.key === 'number') child.key = i;
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

  const attrDialogNode = attrDialogNodeId
    ? (isXmlMode ? XMLSchemaConverter : JSONSchemaConverter).findNodeById(schema, attrDialogNodeId)
    : null;

  if (!schema) {
    return (
      <div className="json-tree-editor empty">
        <div className="empty-message">{isXmlMode ? '无 XML 数据' : '无 JSON 数据'}</div>
      </div>
    );
  }

  return (
    <div className="json-tree-editor">
      <div className="tree-toolbar">
        <div className="toolbar-title">{isXmlMode ? 'XML 编辑器' : 'JSON 编辑器'}</div>
        <div className="toolbar-actions">
          {isXmlMode ? (
            <>
              <button className={`toolbar-btn ${!canAddChild ? 'disabled' : ''}`}
                onClick={handleAddChild} disabled={!canAddChild} title="添加子元素">
                <Plus size={14} /> 子元素
              </button>
              <button className={`toolbar-btn danger ${!canDelete ? 'disabled' : ''}`}
                onClick={handleDelete} disabled={!canDelete} title="删除选中元素">
                <Minus size={14} /> 删除
              </button>
            </>
          ) : (
            <>
              <button className={`toolbar-btn ${!canAddSibling ? 'disabled' : ''}`}
                onClick={handleAddSibling} disabled={!canAddSibling} title="添加同级元素">
                <ArrowRight size={14} /> 同级
              </button>
              <button className={`toolbar-btn ${!canAddChild ? 'disabled' : ''}`}
                onClick={handleAddChild} disabled={!canAddChild} title="添加子元素">
                <Plus size={14} /> 子项
              </button>
              <button className={`toolbar-btn danger ${!canDelete ? 'disabled' : ''}`}
                onClick={handleDelete} disabled={!canDelete} title="删除选中元素">
                <Minus size={14} /> 删除
              </button>
            </>
          )}
        </div>
      </div>

      <div className="tree-header">
        {isXmlMode ? (
          <>
            <div className="tree-header-col col-key" style={{ width: '35%', minWidth: '200px' }}>标签名</div>
            <div className="tree-header-col col-value" style={{ width: '30%' }}>值</div>
            <div className="tree-header-col col-desc" style={{ width: '25%' }}>描述</div>
          </>
        ) : (
          <>
            <div className="tree-header-col col-key">属性名</div>
            <div className="tree-header-col col-type">类型</div>
            <div className="tree-header-col col-desc">描述</div>
            <div className="tree-header-col col-value">值</div>
          </>
        )}
      </div>

      <div className="tree-body" ref={treeBodyRef}>
        <BodyTreeNode
          node={schema}
          level={0}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onUpdate={handleUpdate}
          expandedIds={expandedIds}
          onToggleExpand={handleToggleExpand}
          excludeApiId={excludeApiId}
          theme={theme}
          mode={mode}
          onOpenAttrDialog={setAttrDialogNodeId}
        />
      </div>

      {attrDialogNode && (
        <AttributeDialog
          node={attrDialogNode}
          onClose={() => setAttrDialogNodeId(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}

export default BodyTreeEditor;
