import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Save, Edit, ChevronDown, ChevronRight, Variable, ArrowLeft, Code, Layout } from 'lucide-react';
import { projectManager } from '../utils/ProjectManager';
import { toast } from './Toast';
import KVTable from './KVTable';
import KVBottomPanel from './KVBottomPanel';
import CodeEditor from './CodeEditor';
import BodyTreeEditor from './BodyTreeEditor';
import JSONSchemaConverter from '../utils/JSONSchemaConverter';
import XMLSchemaConverter from '../utils/XMLSchemaConverter';
import './TemplateManager.css';

function createEmptyTemplate() {
  return {
    id: null,
    name: '',
    sections: {
      header: [],
      param: [],
      body: null
    }
  };
}

const EMPTY_CONTENTS = {
  json: { content: '', schema: null },
  xml: { content: '', schema: null },
  text: { content: '', schema: null },
  html: { content: '', schema: null }
};

function TemplateManager({ onBack, theme }) {
  const rootRef = useRef(null);
  const [panelRect, setPanelRect] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [expandedTpl, setExpandedTpl] = useState(null);
  const [editName, setEditName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [bpSection, setBpSection] = useState(null);
  const [bpRowIndex, setBpRowIndex] = useState(null);
  const [bpField, setBpField] = useState(null);
  const [jsonEditMode, setJsonEditMode] = useState('code');
  const [xmlEditMode, setXmlEditMode] = useState('code');

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setPanelRect({ left: rect.left, width: rect.width });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const loadTemplates = () => {
    setTemplates([...projectManager.getTemplates()]);
  };

  const handleAdd = () => {
    setEditingTemplate(createEmptyTemplate());
    setIsNew(true);
    setEditName('');
    setExpandedTpl(null);
  };

  const handleEdit = (tpl) => {
    setEditingTemplate(JSON.parse(JSON.stringify(tpl)));
    setIsNew(false);
    setEditName(tpl.name);
  };

  const handleDelete = (tplId) => {
    setShowDeleteConfirm(tplId);
  };

  const confirmDelete = () => {
    if (!showDeleteConfirm) return;
    projectManager.deleteTemplate(showDeleteConfirm);
    setShowDeleteConfirm(null);
    loadTemplates();
    toast.success('模板已删除');
  };

  const handleSave = () => {
    if (!editName.trim()) {
      toast.error('请输入模板名称');
      return;
    }
    const tpl = { ...editingTemplate, name: editName.trim() };
    if (isNew) {
      projectManager.addTemplate(tpl);
    } else {
      projectManager.updateTemplate(tpl.id, tpl);
    }
    setEditingTemplate(null);
    setIsNew(false);
    loadTemplates();
    toast.success(isNew ? '模板已创建' : '模板已保存');
  };

  const handleCancel = () => {
    setEditingTemplate(null);
    setIsNew(false);
    setBpSection(null);
    setBpRowIndex(null);
    setBpField(null);
  };

  const updateSectionItems = (section, items) => {
    setEditingTemplate(prev => ({
      ...prev,
      sections: { ...prev.sections, [section]: items }
    }));
  };

  const toggleBody = () => {
    setEditingTemplate(prev => {
      if (prev.sections.body) {
        return { ...prev, sections: { ...prev.sections, body: null } };
      }
      return {
        ...prev,
        sections: {
          ...prev.sections,
          body: { type: 'raw', activeContentType: 'json', contentType: 'json', content: '', contents: { ...EMPTY_CONTENTS } }
        }
      };
    });
  };

  const handleBpValueClick = (section, idx) => {
    setBpSection(section);
    setBpRowIndex(idx);
    setBpField('value');
  };

  const handleBpDescClick = (section, idx) => {
    setBpSection(section);
    setBpRowIndex(idx);
    setBpField('description');
  };

  const handleBpClose = () => {
    setBpSection(null);
    setBpRowIndex(null);
    setBpField(null);
  };

  const handleBpItemsChange = (items) => {
    if (bpSection) updateSectionItems(bpSection, items);
  };

  const toggleExpand = (tplId) => {
    setExpandedTpl(expandedTpl === tplId ? null : tplId);
  };

  const countEnabled = (items) => (items || []).filter(i => i.enabled !== false).length;

  const getSummary = (tpl) => {
    const parts = [];
    const h = countEnabled(tpl.sections.header);
    const p = countEnabled(tpl.sections.param);
    if (h > 0) parts.push(`${h} 个请求头`);
    if (p > 0) parts.push(`${p} 个参数`);
    if (tpl.sections.body) parts.push('含 Body');
    return parts.length > 0 ? parts.join('，') : '无内容';
  };

  const getBodyContent = () => {
    if (!editingTemplate?.sections.body) return '';
    const body = editingTemplate.sections.body;
    const ct = body.activeContentType || 'json';
    return body.contents?.[ct]?.content ?? body.content ?? '';
  };

  const setBodyContent = (newContent) => {
    setEditingTemplate(prev => {
      const body = prev.sections.body;
      if (!body) return prev;
      const ct = body.activeContentType || 'json';
      return {
        ...prev,
        sections: {
          ...prev.sections,
          body: {
            ...body,
            content: newContent,
            contents: { ...body.contents, [ct]: { ...body.contents?.[ct], content: newContent } }
          }
        }
      };
    });
  };

  const getBodySchema = () => {
    if (!editingTemplate?.sections.body) return null;
    const body = editingTemplate.sections.body;
    const ct = body.activeContentType || 'json';
    return body.contents?.[ct]?.schema ?? null;
  };

  const setBodySchema = (newSchema) => {
    setEditingTemplate(prev => {
      const body = prev.sections.body;
      if (!body) return prev;
      const ct = body.activeContentType || 'json';
      const isXml = ct === 'xml';
      const contentStr = isXml
        ? XMLSchemaConverter.schemaToXml(newSchema, true)
        : JSONSchemaConverter.schemaToJson(newSchema, true);
      return {
        ...prev,
        sections: {
          ...prev.sections,
          body: {
            ...body,
            content: contentStr,
            contents: {
              ...body.contents,
              [ct]: { content: contentStr, schema: newSchema }
            }
          }
        }
      };
    });
  };

  const switchToUIMode = () => {
    const body = editingTemplate?.sections.body;
    if (!body) return;
    const ct = body.activeContentType || 'json';
    const content = getBodyContent();
    const isXml = ct === 'xml';
    let schema;
    try {
      schema = isXml
        ? XMLSchemaConverter.xmlToSchema(content || '<root></root>', null)
        : JSONSchemaConverter.jsonToSchema(content || '{}', null);
    } catch {
      schema = isXml
        ? XMLSchemaConverter.xmlToSchema('<root></root>', null)
        : JSONSchemaConverter.jsonToSchema('{}', null);
    }
    setEditingTemplate(prev => {
      if (!prev.sections.body) return prev;
      return {
        ...prev,
        sections: {
          ...prev.sections,
          body: {
            ...prev.sections.body,
            content: content,
            contents: {
              ...prev.sections.body.contents,
              [ct]: { content: content, schema }
            }
          }
        }
      };
    });
    if (isXml) setXmlEditMode('ui');
    else setJsonEditMode('ui');
  };

  const switchToCodeMode = () => {
    const body = editingTemplate?.sections.body;
    if (!body) return;
    const ct = body.activeContentType || 'json';
    const schema = getBodySchema();
    if (schema) {
      const isXml = ct === 'xml';
      const contentStr = isXml
        ? XMLSchemaConverter.schemaToXml(schema, true)
        : JSONSchemaConverter.schemaToJson(schema, true);
      setEditingTemplate(prev => {
        if (!prev.sections.body) return prev;
        return {
          ...prev,
          sections: {
            ...prev.sections,
            body: {
              ...prev.sections.body,
              content: contentStr,
              contents: {
                ...prev.sections.body.contents,
                [ct]: { content: contentStr, schema }
              }
            }
          }
        };
      });
    }
    if (ct === 'xml') setXmlEditMode('code');
    else setJsonEditMode('code');
  };

  const handleContentTypeChange = (ct) => {
    const oldCt = editingTemplate?.sections.body?.activeContentType || 'json';
    if (ct === oldCt) return;
    setEditingTemplate(prev => {
      if (!prev.sections.body) return prev;
      const oldContents = prev.sections.body.contents?.[oldCt];
      const targetContents = prev.sections.body.contents?.[ct];
      return {
        ...prev,
        sections: {
          ...prev.sections,
          body: {
            ...prev.sections.body,
            activeContentType: ct,
            contentType: ct,
            content: targetContents?.content ?? oldContents?.content ?? '',
            contents: {
              ...prev.sections.body.contents,
              [ct]: targetContents ?? { content: oldContents?.content ?? '', schema: null }
            }
          }
        }
      };
    });
    if (ct === 'xml') setXmlEditMode('code');
    else setJsonEditMode('code');
  };

  if (editingTemplate) {
    const body = editingTemplate.sections.body;
    const bodyCT = body?.activeContentType || 'json';
    const isJsonUI = body && bodyCT === 'json' && jsonEditMode === 'ui';
    const isXmlUI = body && bodyCT === 'xml' && xmlEditMode === 'ui';

    return (
      <div className="tpl-manager" ref={rootRef}>
        <div className="tpl-editor">
          <div className="tpl-editor-header">
            <span className="tpl-editor-title">{isNew ? '新建模板' : '编辑模板'}</span>
            <div className="tpl-editor-actions">
              <button className="tpl-btn-primary" onClick={handleSave}>
                <Save size={14} /> 保存
              </button>
              <button className="tpl-btn-cancel" onClick={handleCancel}>
                取消
              </button>
            </div>
          </div>

          <div className={`tpl-editor-body ${bpSection ? 'has-bottom-panel' : ''}`}>
            <div className="tpl-field">
              <label className="tpl-field-label">模板名称</label>
              <input
                type="text" className="tpl-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="例如：JWT 认证"
                autoFocus
              />
            </div>

            <div className="tpl-section">
              <div className="tpl-section-header">
                <span className="tpl-section-label">Headers</span>
              </div>
              <KVTable
                items={editingTemplate.sections.header}
                onItemsChange={(items) => updateSectionItems('header', items)}
                section="header"
                showType={true}
                onValueClick={(idx) => handleBpValueClick('header', idx)}
                onDescClick={(idx) => handleBpDescClick('header', idx)}
                excludeApiId={null}
                theme={theme}
                hideTypes={['ref']}
              />
            </div>

            <div className="tpl-section">
              <div className="tpl-section-header">
                <span className="tpl-section-label">Params</span>
              </div>
              <KVTable
                items={editingTemplate.sections.param}
                onItemsChange={(items) => updateSectionItems('param', items)}
                section="param"
                showType={true}
                onValueClick={(idx) => handleBpValueClick('param', idx)}
                onDescClick={(idx) => handleBpDescClick('param', idx)}
                excludeApiId={null}
                theme={theme}
                hideTypes={['ref']}
              />
            </div>

            <div className="tpl-section">
              <div className="tpl-section-header">
                <span className="tpl-section-label">Body</span>
                <label className="tpl-toggle">
                  <input type="checkbox" checked={!!body} onChange={toggleBody} />
                  <span className="tpl-toggle-track">
                    <span className="tpl-toggle-thumb" />
                  </span>
                </label>
              </div>
              {body && (
                <div className="tpl-body-editor">
                  <div className="body-types">
                    {['text', 'json', 'xml', 'html'].map(ct => (
                      <label key={ct} className={`body-type ${bodyCT === ct ? 'active' : ''}`}>
                        <input type="radio" name="bodyCt" value={ct}
                          checked={bodyCT === ct}
                          onChange={() => handleContentTypeChange(ct)}
                        />
                        {ct.toUpperCase()}
                      </label>
                    ))}
                  </div>
                  {['json', 'xml'].includes(bodyCT) && (
                    <div className="raw-toolbar">
                      <span className="body-hint">编辑模式</span>
                      <button
                        className={`edit-mode-btn ${(bodyCT === 'json' ? jsonEditMode : xmlEditMode) === 'code' ? 'active' : ''}`}
                        onClick={switchToCodeMode}
                      >
                        <Code size={12} /> 代码
                      </button>
                      <button
                        className={`edit-mode-btn ${(bodyCT === 'json' ? jsonEditMode : xmlEditMode) === 'ui' ? 'active' : ''}`}
                        onClick={switchToUIMode}
                      >
                        <Layout size={12} /> UI
                      </button>
                    </div>
                  )}
                  {bodyCT === 'json' && jsonEditMode === 'ui' ? (
                    <div className="tpl-body-tree-wrap">
                      <BodyTreeEditor
                        schema={getBodySchema()}
                        onChange={setBodySchema}
                        excludeApiId={null}
                        theme={theme}
                        mode="json"
                      />
                    </div>
                  ) : bodyCT === 'xml' && xmlEditMode === 'ui' ? (
                    <div className="tpl-body-tree-wrap">
                      <BodyTreeEditor
                        schema={getBodySchema()}
                        onChange={setBodySchema}
                        excludeApiId={null}
                        theme={theme}
                        mode="xml"
                      />
                    </div>
                  ) : (
                    <div className="tpl-body-code-wrap">
                      <CodeEditor
                        value={getBodyContent()}
                        onChange={setBodyContent}
                        contentType={bodyCT}
                        theme={theme}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <KVBottomPanel
            visible={bpSection !== null && !editingTemplate.sections.body}
            section={bpSection}
            rowIndex={bpRowIndex}
            field={bpField}
            items={bpSection === 'header' ? editingTemplate.sections.header : editingTemplate.sections.param}
            onItemsChange={handleBpItemsChange}
            onClose={handleBpClose}
            theme={theme}
            excludeApiId={null}
            bottomOffset={36}
            panelRect={panelRect}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="tpl-manager" ref={rootRef}>
      <div className="tpl-header-bar">
        <button className="tpl-back-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>返回</span>
        </button>
        <span className="tpl-header-title">参数模板管理</span>
      </div>
      <div className="tpl-content">
        <div className="tpl-toolbar">
          <button className="toolbar-btn" onClick={handleAdd}>
            <Plus size={16} /> 新建模板
          </button>
          <span className="tpl-count">{templates.length} 个模板</span>
        </div>

        {templates.length === 0 ? (
          <div className="tpl-empty-state">
            <Variable size={48} className="empty-icon" />
            <h2>暂无参数模板</h2>
            <p>创建模板后，新建或编辑 API 时可快速应用通用参数</p>
          </div>
        ) : (
          <div className="tpl-list">
            {templates.map(tpl => (
              <div key={tpl.id} className="tpl-card">
                <div className="tpl-card-header" onClick={() => toggleExpand(tpl.id)}>
                  <div className="tpl-card-info">
                    <span className="tpl-expand-icon">
                      {expandedTpl === tpl.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <span className="tpl-card-name">{tpl.name}</span>
                    <span className="tpl-card-summary">{getSummary(tpl)}</span>
                  </div>
                  <div className="tpl-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="tpl-btn-icon" onClick={() => handleEdit(tpl)} title="编辑">
                      <Edit size={14} />
                    </button>
                    <button className="tpl-btn-icon danger" onClick={() => handleDelete(tpl.id)} title="删除">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {expandedTpl === tpl.id && (
                  <div className="tpl-card-detail">
                    {tpl.sections.header.length > 0 && (
                      <div className="tpl-detail-section">
                        <span className="tpl-detail-label">Headers ({countEnabled(tpl.sections.header)} 项)</span>
                        <div className="tpl-detail-items">
                          {tpl.sections.header.map((h, i) => (
                            <span key={i} className={`tpl-detail-tag ${h.enabled === false ? 'disabled' : ''}`}>
                              {h.key}: {h.default}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {tpl.sections.param.length > 0 && (
                      <div className="tpl-detail-section">
                        <span className="tpl-detail-label">Params ({countEnabled(tpl.sections.param)} 项)</span>
                        <div className="tpl-detail-items">
                          {tpl.sections.param.map((p, i) => (
                            <span key={i} className={`tpl-detail-tag ${p.enabled === false ? 'disabled' : ''}`}>
                              {p.key}: {p.default}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {tpl.sections.body && (
                      <div className="tpl-detail-section">
                        <span className="tpl-detail-label">Body ({tpl.sections.body.activeContentType || 'json'})</span>
                        <pre className="tpl-detail-body">{tpl.sections.body.content || '(空)'}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>确认删除</h3>
            </div>
            <div className="modal-body">
              <p>确定要删除此模板吗？</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(null)}>取消</button>
              <button className="btn-danger" onClick={confirmDelete}>删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplateManager;
