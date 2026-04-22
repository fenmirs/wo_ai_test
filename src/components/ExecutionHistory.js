import React from 'react';
import { CheckCircle, XCircle, Clock, Play, AlertCircle, Trash2 } from 'lucide-react';
import './ExecutionHistory.css';

function ExecutionHistory({ history, onSelect, onClear }) {
  if (!history || history.length === 0) {
    return (
      <div className="execution-history">
        <div className="empty-state">
          <Clock size={48} className="empty-icon" />
          <h2>暂无执行历史</h2>
          <p>执行 API 测试后，历史记录将显示在这里</p>
        </div>
      </div>
    );
  }

  const getStatusIcon = (entry) => {
    if (entry.error) {
      return <AlertCircle size={20} className="error-icon" />;
    }
    return entry.success ? (
      <CheckCircle size={20} className="success-icon" />
    ) : (
      <XCircle size={20} className="error-icon" />
    );
  };

  const getStatusText = (entry) => {
    if (entry.error) {
      return '请求失败';
    }
    return entry.success ? '通过' : '失败';
  };

  return (
    <div className="execution-history">
      <div className="history-header">
        <h2>执行历史</h2>
        <div className="history-header-actions">
          <span className="history-count">{history.length} 条记录</span>
          {history.length > 0 && (
            <button className="clear-btn" onClick={onClear} title="清空历史">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="history-list">
        {history.map((entry) => (
          <div 
            key={entry.id}
            className="history-item"
          >
            <div className="history-status">
              {getStatusIcon(entry)}
            </div>
            
            <div className="history-info">
              <div className="history-main">
                <span className={`method-badge method-${entry.apiMethod?.toLowerCase()}`}>
                  {entry.apiMethod}
                </span>
                <span className="history-api-name">{entry.apiName}</span>
              </div>
              
              <div className="history-path">{entry.apiPath}</div>
              
              <div className="history-meta">
                <span className={`status-badge ${entry.success ? 'success' : 'error'}`}>
                  {getStatusText(entry)}
                </span>
                {entry.status_code && (
                  <span className="http-code">HTTP {entry.status_code}</span>
                )}
                {entry.assertionResult && (
                  <span className="assert-summary">断言: {entry.assertionResult.summary}</span>
                )}
                <span className="history-time">
                  <Clock size={12} />
                  {entry.elapsedTime}
                </span>
                <span className="history-date">{entry.timestamp}</span>
              </div>
            </div>

            <div className="history-actions">
              <button 
                className="history-btn restore"
                onClick={() => onSelect && onSelect(entry)}
                title="恢复此请求"
              >
                <Play size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ExecutionHistory;