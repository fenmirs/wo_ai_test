import React, { useState, useCallback, useRef, useLayoutEffect, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, FileText, Play, Trash2, Clock, ChevronRight, ChevronDown, Loader, Info } from 'lucide-react';
import MonacoView from './MonacoView';
import './ResponsePanel.css';

function KVItemRow({ label, value, showEncodeToggle }) {
  const [expanded, setExpanded] = useState(false);
  const [showDecoded, setShowDecoded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedValue, setCopiedValue] = useState(false);
  const valueRef = useRef(null);

  const rawValue = String(value ?? '');
  const displayValue = showEncodeToggle && showDecoded ? decodeURIComponent(rawValue) : rawValue;

  useLayoutEffect(() => {
    const el = valueRef.current;
    if (el) {
      setIsOverflowing(el.scrollWidth > el.clientWidth);
    }
  }, [displayValue]);

  const needsTruncation = isOverflowing !== false && !expanded;
  const canExpand = isOverflowing === true;

  const copyText = (text, type) => {
    navigator.clipboard.writeText(text).catch(() => {});
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 1500);
    } else {
      setCopiedValue(true);
      setTimeout(() => setCopiedValue(false), 1500);
    }
  };

  return (
    <div className={`kv-item${expanded ? ' expanded' : ''}`}>
      <span className="kv-key">{label}</span>
      <span
        ref={valueRef}
        className={`kv-value${needsTruncation ? ' truncated' : ''}${canExpand ? ' kv-overflow' : ''}`}
        onClick={() => canExpand && setExpanded(e => !e)}
        title={canExpand ? (expanded ? '点击收缩' : '点击展开') : undefined}
      >
        {displayValue}
      </span>
      <span className="kv-actions" onClick={e => e.stopPropagation()}>
        {showEncodeToggle && (
          <button
            className="kv-action-btn"
            onClick={() => setShowDecoded(s => !s)}
            title={showDecoded ? '显示编码后' : '显示解码后'}
          >
            {showDecoded ? '原码' : '解码'}
          </button>
        )}
        <button className={`kv-action-btn${copiedKey ? ' copied' : ''}`} onClick={() => copyText(label, 'key')} title="复制 Key">
          {copiedKey ? '✓' : 'K'}
        </button>
        <button className={`kv-action-btn${copiedValue ? ' copied' : ''}`} onClick={() => copyText(displayValue, 'value')} title="复制值">
          {copiedValue ? '✓' : 'V'}
        </button>
      </span>
    </div>
  );
}

const formatTime = (ts) => {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
};

function ResponsePanel({ executionResult, isExecuting, theme }) {
  const [selectedCardIdx, setSelectedCardIdx] = useState(0);
  const [responseTab, setResponseTab] = useState('request');
  const [collapsedSections, setCollapsedSections] = useState({});
  const [infoPopup, setInfoPopup] = useState(null);
  const userSelectedRef = useRef(false);

  useEffect(() => {
    if (executionResult?.resultCards?.length && !userSelectedRef.current) {
      const targetIdx = executionResult.resultCards.findIndex(c => c.isTarget);
      if (targetIdx >= 0) setSelectedCardIdx(targetIdx);
    }
    userSelectedRef.current = false;
  }, [executionResult]);

  const toggleSection = useCallback((key) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const renderSection = useCallback((title, content) => {
    const isCollapsed = collapsedSections[title];
    return (
      <div className="detail-section">
        <div className="detail-section-title" onClick={() => toggleSection(title)}>
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          {title}
        </div>
        {!isCollapsed && <div className="detail-section-content">{content}</div>}
      </div>
    );
  }, [collapsedSections, toggleSection]);

  const selectedCard = executionResult?.resultCards?.[selectedCardIdx];

  // Loading state
  if (isExecuting && (!executionResult || !executionResult.resultCards)) {
    return (
      <div className="response-panel response-panel-full">
        <div className="response-loading">
          <Loader size={28} className="spin" />
          <p>正在发送请求...</p>
        </div>
      </div>
    );
  }

  if (!executionResult) {
    return (
      <div className="response-panel response-panel-full">
        <div className="response-empty-state">
          <Play size={32} className="empty-icon" />
          <h3>暂无执行结果</h3>
          <p>发送 API 请求后，响应将显示在此处</p>
        </div>
      </div>
    );
  }

  const cards = executionResult.resultCards || [];

  return (
    <div className="response-panel response-panel-full">
      {/* Pipeline */}
      {cards.length > 0 && (
        <div className="pipeline">
          <button className="pipe-info-btn-global" onClick={() => setInfoPopup(executionResult)} title="执行详情">
            <Info size={16} />
          </button>
          <div className="pipe-sep" />
          {cards.map((card, idx) => (
            <div
              key={card.apiId}
              className={`pipe-item ${selectedCardIdx === idx ? 'active' : ''}`}
              onClick={() => { userSelectedRef.current = true; setSelectedCardIdx(idx); }}
              title={`${card.name}${card.isTarget ? ' (目标)' : ''}\n开始: ${formatTime(card.result?._startTime)}\n结束: ${formatTime(card.result?._endTime)}\n耗时: ${card.result?.elapsedTime || '-'}${card.result?.error ? '\n错误: ' + card.result.error : ''}${card.result?.assertionResult?.results?.length ? '\n断言: ' + card.result.assertionResult.results.filter(r => r.passed).length + '/' + card.result.assertionResult.results.length : ''}`}
            >
              <div className="pipe-top">
                {cards.length > 1 && idx > 0 && <div className="pipe-conn"><div className="pipe-line" /></div>}
                <div className="pipe-node-wrap">
                  <div className={`pipe-node ${card.isTarget ? 'pipe-star' : 'pipe-dot'} ${card.result?.success ? 'success' : 'error'}`}>
                    {card.isTarget ? '★' : idx + 1}
                  </div>
                  <div className="pipe-time">{card.result?.elapsedTime || ''}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="response-summary">
        <div className="summary-left">
          <span className="summary-label">HTTP</span>
          {selectedCard ? (
            (() => {
              const cr = selectedCard.result;
              return cr?.status_code ? (
                <span className={`http-status ${cr.httpSuccess ? 'success' : 'error'}`}>{cr.status_code}</span>
              ) : cr?.error ? (
                <span className="http-status error">错误</span>
              ) : (
                <span className="http-status error">请求失败</span>
              );
            })()
          ) : executionResult.error ? (
            <span className="http-status error">错误</span>
          ) : (
            <span className="http-status error">请求失败</span>
          )}
        </div>

        <div className="summary-divider"></div>

        <div className="summary-left">
          <span className="summary-label">耗时</span>
          <span className="meta-value">{selectedCard?.result?.elapsedTime || '-'}</span>
        </div>

        <div className="summary-divider"></div>

        <div className="summary-left">
          <span className="summary-label">大小</span>
          <span className="meta-value">{selectedCard?.result?.responseSize || '-'}</span>
        </div>

        {selectedCard?.result?.assertionResult && (() => {
          const results = selectedCard.result.assertionResult.results || [];
          const passed = results.filter(r => r.passed).length;
          const total = results.length;
          const allPassed = passed === total;
          return (
            <>
              <div className="summary-divider"></div>
              <div className="summary-left">
                <span className="summary-label">断言</span>
                <span className={`meta-value ${allPassed ? 'text-success' : 'text-error'}`}>
                  {passed}/{total}
                </span>
              </div>
            </>
          );
        })()}
      </div>

      {/* Assertion bar */}
      {selectedCard?.result?.assertionResult && (
        <div className="assertion-results-bar">
          <div className="assertion-results-header">断言结果</div>
          {selectedCard.result.assertionResult.results.map((r, idx) => (
            <div key={idx} className={`assert-item ${r.passed ? 'passed' : 'failed'}`}>
              <span className="assert-icon">{r.passed ? <CheckCircle size={14} /> : <XCircle size={14} />}</span>
              <span className="assert-expr">{r.expression}</span>
              <span className="assert-actual">实际值: {r.actual}</span>
            </div>
          ))}
        </div>
      )}

      {/* Response body */}
      <div className="response-body">
            {cards.length > 0 ? (() => {
              const currentCard = cards[selectedCardIdx];
              if (!currentCard) return null;
              const cardResult = currentCard.result;

              if (cardResult?.errorType === 'chain_break') {
                return (
                  <div className="response-info">
                    <div className="detail-section">
                      <div className="error-info-chain">
                        <AlertCircle size={14} className="error-icon" />
                        <span>{cardResult.error || '前置依赖API未执行成功，中断本请求'}</span>
                      </div>
                    </div>
                    {cardResult.refParams && cardResult.refParams.length > 0 && renderSection('引用该 API 的参数',
                      <div className="kv-list">
                        {cardResult.refParams.map((ref, idx) => (
                          <KVItemRow key={idx} label={ref.section} value={`${ref.key}: {{ref:${ref.ref}}}`} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              if (cardResult?.errorType === 'ref_resolve_fail') {
                const refs = cardResult._refs || [];
                return (
                  <div className="response-info">
                    {renderSection('无法获取的参数',
                      <div className="error-info-chain">
                        <AlertCircle size={14} className="error-icon" />
                        <span>{cardResult.error}</span>
                      </div>
                    )}
                    {refs.length > 0 && renderSection('引用详情',
                      <div className="kv-list">
                        {refs.map((ref, idx) => (
                          <KVItemRow key={idx} label={ref.section} value={`${ref.key}: {{ref:${ref.ref}}}`} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <>
                  <div className="response-tabs">
                    <button className={`response-tab ${responseTab === 'request' ? 'active' : ''}`} onClick={() => setResponseTab('request')}>请求</button>
                    <button className={`response-tab ${responseTab === 'response' ? 'active' : ''}`} onClick={() => setResponseTab('response')}>响应</button>
                  </div>

                  {responseTab === 'request' && (
                    <div className="request-info">
                      {(() => {
                        const reqConfig = cardResult?.requestConfig || executionResult.requestInfo;
                        if (!reqConfig) {
                          return <div className="response-empty">无请求信息</div>;
                        }
                        const isLegacy = !cardResult?.requestConfig && !!executionResult.requestInfo;
                        return (
                          <>
                            {renderSection('基本信息',
                          <>
                            <div className="request-info-row">
                              <span className="info-label">URL</span>
                              <code className="info-value">{isLegacy ? reqConfig.url : reqConfig.url}</code>
                            </div>
                            <div className="request-info-row">
                              <span className="info-label">Method</span>
                              <span className="info-value method">{isLegacy ? reqConfig.method : reqConfig.method}</span>
                            </div>
                          </>
                        )}

                            {isLegacy ? (
                              <>
                                {reqConfig.header && reqConfig.header.length > 0 && renderSection('请求 Headers',
                                  <div className="kv-list">
                                    {reqConfig.header.map((h, idx) => (
                                      <KVItemRow key={idx} label={h.key} value={h.default || ''} />
                                    ))}
                                  </div>
                                )}
                                {reqConfig.param && reqConfig.param.length > 0 && renderSection('Query Parameters',
                                  <div className="kv-list">
                                    {reqConfig.param.map((p, idx) => (
                                      <KVItemRow key={idx} label={p.key} value={p.default || ''} showEncodeToggle />
                                    ))}
                                  </div>
                                )}
                                {reqConfig.bodyType && reqConfig.bodyType !== 'none' && renderSection(`请求 Body (${reqConfig.bodyType})`,
                                  <div className="request-body-content">
                                    {reqConfig.bodyType === 'raw' && (
                                      <MonacoView
                                        height="200px"
                                        language="plaintext"
                                        value={reqConfig.body?.content || ''}
                                        theme={theme}
                                        readOnly={true}
                                      />
                                    )}
                                    {(reqConfig.bodyType === 'form-data' || reqConfig.bodyType === 'x-www-form-urlencoded') && (
                                      <div className="kv-list">
                                        {(reqConfig.bodyType === 'form-data' ? reqConfig.body.formData : reqConfig.body.xwwwFormUrlencoded)
                                          .filter(p => p.enabled && p.key)
                                          .map((p, idx) => (
                                            <KVItemRow key={idx} label={p.key} value={p.default || ''} />
                                          ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                {reqConfig.headers && Object.keys(reqConfig.headers).length > 0 && renderSection('请求 Headers',
                                  <div className="kv-list">
                                    {Object.entries(reqConfig.headers).map(([key, value]) => (
                                      <KVItemRow key={key} label={key} value={String(value)} />
                                    ))}
                                  </div>
                                )}
                                {reqConfig.params && Object.keys(reqConfig.params).length > 0 && renderSection('Query Parameters',
                                  <div className="kv-list">
                                    {Object.entries(reqConfig.params).map(([key, value]) => (
                                      <KVItemRow key={key} label={key} value={String(value)} showEncodeToggle />
                                    ))}
                                  </div>
                                )}
                                {reqConfig.bodyType && reqConfig.bodyType !== 'none' && (() => {
                                  const ctKey = Object.keys(reqConfig.headers || {}).find(k => k.toLowerCase() === 'content-type');
                                  const ct = ctKey ? reqConfig.headers[ctKey] : '';
                                  const isUrlEncoded = ct.includes('x-www-form-urlencoded');
                                  const isFormData = ct.includes('multipart/form-data');
                                  const isStructuredForm = (isUrlEncoded || isFormData) && typeof reqConfig.body === 'object' && reqConfig.body !== null;

                                  if (isStructuredForm) {
                                    const entries = Object.entries(reqConfig.body);
                                    const label = isUrlEncoded ? 'x-www-form-urlencoded' : 'form-data';
                                    return renderSection(`请求 Body (${label})`,
                                      <div className="request-body-content">
                                        <div className="kv-list">
                                          {entries.length > 0 ? entries.map(([key, value], idx) => (
                                            <KVItemRow key={idx} label={key} value={String(value ?? '')} />
                                          )) : (
                                            <div className="response-empty">无表单字段</div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }

                                  return renderSection(`请求 Body (${reqConfig.bodyType})`,
                                    <div className="request-body-content">
                                      {(() => {
                                        if (!reqConfig.body) return null;
                                        const bodyVal = typeof reqConfig.body === 'string'
                                          ? reqConfig.body
                                          : typeof reqConfig.body === 'object' && reqConfig.body !== null
                                            ? JSON.stringify(reqConfig.body, null, 2)
                                            : String(reqConfig.body);
                                        const bodyLang = typeof reqConfig.body === 'object' && reqConfig.body !== null ? 'json' : 'plaintext';
                                        return (
                                          <MonacoView
                                            height="200px"
                                            language={bodyLang}
                                            value={bodyVal}
                                            theme={theme}
                                            readOnly={true}
                                          />
                                        );
                                      })()}
                                    </div>
                                  );
                                })()}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {responseTab === 'response' && (
                    <div className="response-info">
                      {cardResult?.headers && Object.keys(cardResult.headers).length > 0 && renderSection('响应 Headers',
                        <div className="kv-list">
                          {Object.entries(cardResult.headers).map(([key, value]) => (
                            <KVItemRow key={key} label={key} value={Array.isArray(value) ? value.join(', ') : String(value)} />
                          ))}
                        </div>
                      )}

                      {renderSection('响应 Body',
                        <div className="response-body-editor">
                          {cardResult?.data !== undefined ? (
                            <MonacoView
                              height="460px"
                              language="json"
                              value={JSON.stringify(cardResult.data, null, 2)}
                              theme={theme}
                              readOnly={true}
                              showCopyButton={true}
                            />
                          ) : (
                            <div className="response-empty">无响应体</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()
          : (
          <div className="response-info">
            {executionResult.error && (
              <div className="detail-section">
                <div className="detail-section-title">
                  <AlertCircle size={12} />
                  错误信息
                </div>
                <div className="detail-section-content">
                  <div className="error-info" style={{ padding: '12px' }}>
                    <span className="error-text">{executionResult.error}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info popup — 整条链的全部详情 */}
      {infoPopup && (
        <div className="pipe-popup-overlay" onClick={() => setInfoPopup(null)}>
          <div className="pipe-popup" onClick={(e) => e.stopPropagation()}>
            <div className="pipe-popup-header">
              <span>全部执行详情 ({(infoPopup.resultCards || []).length} 个步骤)</span>
              <button className="pipe-popup-close" onClick={() => setInfoPopup(null)}>✕</button>
            </div>
            <div className="pipe-popup-body">
              {(infoPopup.resultCards || []).map((card, idx) => (
                <div key={card.apiId} className={`pipe-popup-step ${idx > 0 ? 'pipe-popup-step-with-gap' : ''}`}>
                  <div className="pipe-popup-step-title">
                    {card.isTarget ? '★' : (idx + 1) + '.'} {card.name}
                    {card.isTarget && <span className="pipe-popup-step-badge">目标</span>}
                    <span className={`pipe-popup-step-status ${card.result?.success ? 'success' : 'error'}`}>
                      {card.result?.success ? ' ✓ 成功' : ' ✗ 失败'}
                    </span>
                  </div>
                  <div className="pipe-popup-step-detail">
                    <div className="pipe-popup-row">
                      <span className="pipe-popup-label">HTTP</span>
                      <span className="pipe-popup-value">{card.result?.status_code || '-'}</span>
                    </div>
                    <div className="pipe-popup-row">
                      <span className="pipe-popup-label">开始时间</span>
                      <span className="pipe-popup-value">{formatTime(card.result?._startTime)}</span>
                    </div>
                    <div className="pipe-popup-row">
                      <span className="pipe-popup-label">结束时间</span>
                      <span className="pipe-popup-value">{formatTime(card.result?._endTime)}</span>
                    </div>
                    <div className="pipe-popup-row">
                      <span className="pipe-popup-label">耗时</span>
                      <span className="pipe-popup-value">{card.result?.elapsedTime || '-'}</span>
                    </div>
                    {card.result?.responseSize && (
                      <div className="pipe-popup-row">
                        <span className="pipe-popup-label">大小</span>
                        <span className="pipe-popup-value">{card.result.responseSize}</span>
                      </div>
                    )}
                    {card.result?.error && (
                      <div className="pipe-popup-row">
                        <span className="pipe-popup-label">错误</span>
                        <span className="pipe-popup-value pipe-popup-error">{card.result.error}</span>
                      </div>
                    )}
                    {card.result?.assertionResult?.results?.length > 0 && (
                      <div className="pipe-popup-assert-list">
                        {card.result.assertionResult.results.map((r, i) => (
                          <div key={i} className={`pipe-popup-assert ${r.passed ? 'passed' : 'failed'}`}>
                            <span>{r.passed ? '✓' : '✗'}</span>
                            <span className="pipe-popup-assert-expr">{r.expression}</span>
                            <span className="pipe-popup-assert-actual">实际: {r.actual}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResponsePanel;
