import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, FileText, Play, Trash2, Clock } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { projectManager } from '../utils/ProjectManager';
import './ResponsePanel.css';

function ResponsePanel({ executionResult, theme }) {
  const [selectedCardIdx, setSelectedCardIdx] = useState(0);
  const [responseTab, setResponseTab] = useState('request');
  const [showSyntaxHighlighter, setShowSyntaxHighlighter] = useState(false);

  useEffect(() => {
    if (executionResult) {
      const timer = requestAnimationFrame(() => setShowSyntaxHighlighter(true));
      return () => cancelAnimationFrame(timer);
    } else {
      setShowSyntaxHighlighter(false);
    }
  }, [executionResult]);

  const getMethodColor = (method) => {
    const colors = { 'GET': '#10b981', 'POST': '#3b82f6', 'PUT': '#f59e0b', 'DELETE': '#ef4444', 'PATCH': '#8b5cf6', 'HEAD': '#6b7280', 'OPTIONS': '#6b7280' };
    return colors[method] || '#64748b';
  };

  const codeTheme = theme === 'light' ? oneLight : vscDarkPlus;

  const selectedCard = executionResult?.resultCards?.[selectedCardIdx];

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

  return (
    <div className="response-panel response-panel-full">
      {executionResult.resultCards && executionResult.resultCards.length > 0 && (
        <div className="response-card-bar">
          {executionResult.resultCards.map((card, idx) => (
            <button
              key={card.apiId}
              className={`response-card-tab ${selectedCardIdx === idx ? 'active' : ''} ${card.result?.success ? 'card-ok' : 'card-fail'}`}
              onClick={() => setSelectedCardIdx(idx)}
            >
              {card.isTarget ? '🎯 ' : ''}{card.name}
              <span className={`card-status-dot ${card.result?.success ? 'dot-ok' : 'dot-fail'}`}>
                {card.result?.success ? '✓' : '✗'}
              </span>
            </button>
          ))}
        </div>
      )}

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
      </div>

      <div className="response-body">
            {executionResult.resultCards && executionResult.resultCards.length > 0 ? (() => {
              const currentCard = executionResult.resultCards[selectedCardIdx];
              if (!currentCard) return null;
              const cardResult = currentCard.result;

              if (cardResult?.errorType === 'chain_break') {
                return (
                  <div className="response-info">
                    <div className="request-section">
                      <div className="error-info-chain">
                        <AlertCircle size={14} className="error-icon" />
                        <span>{cardResult.error || '前置依赖API未执行成功，中断本请求'}</span>
                      </div>
                    </div>
                    {cardResult.refParams && cardResult.refParams.length > 0 && (
                      <div className="request-section">
                        <div className="request-section-title">引用该 API 的参数</div>
                        <div className="kv-list">
                          {cardResult.refParams.map((ref, idx) => (
                            <div key={idx} className="kv-item">
                              <span className="kv-key">{ref.section}</span>
                              <span className="kv-value">{ref.key}: {`{{ref:${ref.ref}}}`}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              if (cardResult?.errorType === 'ref_resolve_fail') {
                const refs = cardResult._refs || [];
                return (
                  <div className="response-info">
                    <div className="request-section">
                      <div className="request-section-title">无法获取的参数</div>
                      <div className="error-info-chain">
                        <AlertCircle size={14} className="error-icon" />
                        <span>{cardResult.error}</span>
                      </div>
                    </div>
                    {refs.length > 0 && (
                      <div className="request-section">
                        <div className="request-section-title">引用详情</div>
                        <div className="kv-list">
                          {refs.map((ref, idx) => (
                            <div key={idx} className="kv-item">
                              <span className="kv-key">{ref.section}</span>
                              <span className="kv-value">{ref.key}: {`{{ref:${ref.ref}}}`}</span>
                            </div>
                          ))}
                        </div>
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
                        const reqConfig = currentCard.isTarget ? executionResult.requestInfo : cardResult?.requestConfig;
                        if (!reqConfig) {
                          return <div className="response-empty">无请求信息</div>;
                        }
                        const isLegacy = currentCard.isTarget;
                        return (
                          <>
                            <div className="request-section">
                              <div className="request-section-title">基本信息</div>
                              <div className="request-info-row">
                                <span className="info-label">URL</span>
                                <code className="info-value">{isLegacy ? reqConfig.url : reqConfig.url}</code>
                              </div>
                              <div className="request-info-row">
                                <span className="info-label">Method</span>
                                <span className="info-value method">{isLegacy ? reqConfig.method : reqConfig.method}</span>
                              </div>
                            </div>

                            {isLegacy ? (
                              <>
                                {reqConfig.header && reqConfig.header.length > 0 && (
                                  <div className="request-section">
                                    <div className="request-section-title">请求 Headers</div>
                                    <div className="kv-list">
                                      {reqConfig.header.map((h, idx) => (
                                        <div key={idx} className="kv-item">
                                          <span className="kv-key">{h.key}</span>
                                          <span className="kv-value">{h.default || ''}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {reqConfig.param && reqConfig.param.length > 0 && (
                                  <div className="request-section">
                                    <div className="request-section-title">Query Parameters</div>
                                    <div className="kv-list">
                                      {reqConfig.param.map((p, idx) => (
                                        <div key={idx} className="kv-item">
                                          <span className="kv-key">{p.key}</span>
                                          <span className="kv-value">{p.default || ''}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {reqConfig.bodyType && reqConfig.bodyType !== 'none' && (
                                  <div className="request-section">
                                    <div className="request-section-title">请求 Body ({reqConfig.bodyType})</div>
                                    <div className="request-body-content">
                                      {reqConfig.bodyType === 'raw' && (
                                        <pre className="body-text">{reqConfig.body?.content || ''}</pre>
                                      )}
                                      {(reqConfig.bodyType === 'form-data' || reqConfig.bodyType === 'x-www-form-urlencoded') && (
                                        <div className="kv-list">
                                          {(reqConfig.bodyType === 'form-data' ? reqConfig.body.formData : reqConfig.body.xwwwFormUrlencoded)
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
                              </>
                            ) : (
                              <>
                                {reqConfig.headers && Object.keys(reqConfig.headers).length > 0 && (
                                  <div className="request-section">
                                    <div className="request-section-title">请求 Headers</div>
                                    <div className="kv-list">
                                      {Object.entries(reqConfig.headers).map(([key, value]) => (
                                        <div key={key} className="kv-item">
                                          <span className="kv-key">{key}</span>
                                          <span className="kv-value">{String(value)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {reqConfig.params && Object.keys(reqConfig.params).length > 0 && (
                                  <div className="request-section">
                                    <div className="request-section-title">Query Parameters</div>
                                    <div className="kv-list">
                                      {Object.entries(reqConfig.params).map(([key, value]) => (
                                        <div key={key} className="kv-item">
                                          <span className="kv-key">{key}</span>
                                          <span className="kv-value">{String(value)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {reqConfig.bodyType && reqConfig.bodyType !== 'none' && (
                                  <div className="request-section">
                                    <div className="request-section-title">请求 Body ({reqConfig.bodyType})</div>
                                    <div className="request-body-content">
                                      {typeof reqConfig.body === 'string' ? (
                                        <pre className="body-text">{reqConfig.body}</pre>
                                      ) : typeof reqConfig.body === 'object' && reqConfig.body !== null ? (
                                        <pre className="body-text">{JSON.stringify(reqConfig.body, null, 2)}</pre>
                                      ) : reqConfig.body ? (
                                        <pre className="body-text">{String(reqConfig.body)}</pre>
                                      ) : null}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {responseTab === 'response' && (
                    <div className="response-info">
                      {cardResult?.headers && Object.keys(cardResult.headers).length > 0 && (
                        <div className="request-section">
                          <div className="request-section-title">响应 Headers</div>
                          <div className="kv-list">
                            {Object.entries(cardResult.headers).map(([key, value]) => (
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
                          {cardResult?.data !== undefined ? (
                            showSyntaxHighlighter ? (
                              <SyntaxHighlighter language="json" style={codeTheme} customStyle={{ margin: 0, fontSize: '11px', maxHeight: '250px' }}>
                                {JSON.stringify(cardResult.data, null, 2)}
                              </SyntaxHighlighter>
                            ) : (
                              <pre className="body-text">{JSON.stringify(cardResult.data, null, 2)}</pre>
                            )
                          ) : (
                            <div className="response-empty">无响应体</div>
                          )}
                        </div>
                      </div>

                      {cardResult?.assertionResult && (
                        <div className="request-section">
                          <div className="request-section-title">断言结果</div>
                          <div className="assert-results">
                            {cardResult.assertionResult.results.map((r, idx) => (
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
                </>
              );
            })()
          : (
          <div className="response-info">
            {executionResult.error && (
              <div className="request-section">
                <div className="request-section-title">错误信息</div>
                <div className="error-info" style={{ padding: '12px' }}>
                  <span className="error-text">{executionResult.error}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ResponsePanel;
