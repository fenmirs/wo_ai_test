import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { X, CheckCircle, XCircle, Clock } from 'lucide-react';
import './HistoryDetailDialog.css';

function HistoryDetailDialog({ entry, onClose }) {
  if (!entry) return null;

  const { apiConfig, requestInfo, targetResult, success, status_code, elapsedTime, timestamp } = entry;

  const getBodyContent = () => {
    if (!requestInfo) return null;
    const { bodyType, body } = requestInfo;
    const content = body?.content;
    if (bodyType === 'none') return null;
    
    if (bodyType === 'raw') {
      return <pre className="body-text">{content || ''}</pre>;
    }
    
    if (bodyType === 'form-data' || bodyType === 'x-www-form-urlencoded') {
      return (
        <div className="kv-list">
          {(bodyType === 'form-data' ? body?.formData : body?.xwwwFormUrlencoded || [])
            .filter(p => p.enabled && p.key)
            .map((p, idx) => (
              <div key={idx} className="kv-item">
                <span className="kv-key">{p.key}</span>
                <span className="kv-value">{p.default || ''}</span>
              </div>
            ))}
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="history-detail-overlay" onClick={onClose}>
      <div className="history-detail-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="history-detail-header">
          <h3>{entry.apiName} - 请求详情</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        
        <div className="history-detail-body">
          <div className="detail-section">
            <div className="detail-section-title">基本信息</div>
            <div className="detail-info-row">
              <span className="info-label">API 名称</span>
              <span className="info-value">{apiConfig?.name || entry.apiName}</span>
            </div>
            <div className="detail-info-row">
              <span className="info-label">方法</span>
              <span className="info-value method">{apiConfig?.method || entry.apiMethod}</span>
            </div>
            <div className="detail-info-row">
              <span className="info-label">时间</span>
              <span className="info-value">{timestamp}</span>
            </div>
            <div className="detail-info-row">
              <span className="info-label">状态</span>
              <span className={`info-value ${success ? 'success' : 'error'}`}>
                {success ? <><CheckCircle size={14} /> 成功</> : <><XCircle size={14} /> 失败</>}
              </span>
            </div>
            {status_code && (
              <div className="detail-info-row">
                <span className="info-label">HTTP 状态</span>
                <span className={`info-value ${status_code < 400 ? 'success' : 'error'}`}>{status_code}</span>
              </div>
            )}
            {elapsedTime && (
              <div className="detail-info-row">
                <span className="info-label">耗时</span>
                <span className="info-value"><Clock size={12} /> {elapsedTime}</span>
              </div>
            )}
          </div>

          {requestInfo && (
            <>
              <div className="detail-section">
                <div className="detail-section-title">请求地址</div>
                <code className="detail-url">{requestInfo.url}</code>
              </div>

              {requestInfo.header?.length > 0 && (
                <div className="detail-section">
                  <div className="detail-section-title">请求 Headers</div>
                  <div className="kv-list">
                    {requestInfo.header.map((h, idx) => (
                      <div key={idx} className="kv-item">
                        <span className="kv-key">{h.key}</span>
                        <span className="kv-value">{h.default || ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {requestInfo.param?.length > 0 && (
                <div className="detail-section">
                  <div className="detail-section-title">Query Parameters</div>
                  <div className="kv-list">
                    {requestInfo.param.map((p, idx) => (
                      <div key={idx} className="kv-item">
                        <span className="kv-key">{p.key}</span>
                        <span className="kv-value">{p.default || ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {requestInfo.bodyType !== 'none' && (
                <div className="detail-section">
                  <div className="detail-section-title">请求 Body ({requestInfo.bodyType})</div>
                  {getBodyContent()}
                </div>
              )}
            </>
          )}

          {targetResult && (
            <>
              <div className="detail-section">
                <div className="detail-section-title">响应 Headers</div>
                {targetResult.headers && Object.keys(targetResult.headers).length > 0 ? (
                  <div className="kv-list">
                    {Object.entries(targetResult.headers).map(([key, value]) => (
                      <div key={key} className="kv-item">
                        <span className="kv-key">{key}</span>
                        <span className="kv-value">{Array.isArray(value) ? value.join(', ') : value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-data">无响应头</div>
                )}
              </div>

              <div className="detail-section">
                <div className="detail-section-title">响应 Body</div>
                {targetResult.data !== undefined ? (
                  <div className="response-body">
                    <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ margin: 0, fontSize: '11px', maxHeight: '300px' }}>
                      {JSON.stringify(targetResult.data, null, 2)}
                    </SyntaxHighlighter>
                  </div>
                ) : (
                  <div className="no-data">无响应体</div>
                )}
              </div>

              {targetResult.error && (
                <div className="detail-section error-section">
                  <div className="detail-section-title">错误信息</div>
                  <pre className="error-message">{targetResult.error}</pre>
                </div>
              )}

              {entry.assertionResult && (
                <div className="detail-section">
                  <div className="detail-section-title">断言结果</div>
                  <div className="assert-results">
                    {entry.assertionResult.results?.map((r, idx) => (
                      <div key={idx} className={`assert-item ${r.passed ? 'passed' : 'failed'}`}>
                        <span className="assert-icon">{r.passed ? <CheckCircle size={14} /> : <XCircle size={14} />}</span>
                        <span className="assert-expr">{r.expression}</span>
                        <span className="assert-actual">实际值: {r.actual}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default HistoryDetailDialog;