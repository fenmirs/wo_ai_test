import React from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import './EmbeddedProgress.css';

function EmbeddedProgress({ status, current = 0, total = 0, message = '', issues = [], actions = [], onDeleteOrphan }) {
  const percent = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;

  const typeLabels = {
    missing_file: '文件缺失',
    orphan_file: '孤儿文件',
    id_mismatch: 'ID 不一致'
  };

  return (
    <div className="embedded-progress">
      {status === 'loading' && (
        <>
          <RefreshCw size={32} className="embedded-progress-spin" />
          <div className="embedded-progress-bar-track">
            <div className="embedded-progress-bar-fill" style={{ width: `${percent}%` }} />
          </div>
          <div className="embedded-progress-message loading">
            {message || '正在加载...'} ({current}/{total})
          </div>
        </>
      )}

      {status === 'done' && (
        <>
          <CheckCircle size={32} style={{ color: 'var(--accent-success, #10b981)' }} />
          <div className="embedded-progress-message">
            {message || '加载完成'}
          </div>
        </>
      )}

      {status === 'issues' && (
        <>
          <AlertTriangle size={32} style={{ color: 'var(--accent-warning, #f59e0b)' }} />
          <div className="embedded-progress-message">
            {message || '加载完成，发现以下问题'}
          </div>
          <div className="embedded-progress-issues">
            {(() => {
              const orphanIssues = issues.filter(i => i.type === 'orphan_file');
              const otherIssues = issues.filter(i => i.type !== 'orphan_file');
              return (
                <>
                  {orphanIssues.length > 0 && (
                    <table className="orphan-table">
                      <thead>
                        <tr>
                          <th className="orphan-th">API名称</th>
                          <th className="orphan-th">文件地址</th>
                          <th className="orphan-th">描述</th>
                          <th className="orphan-th orphan-th-actions">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orphanIssues.map((orphan, oi) => (
                          <tr key={oi} className="orphan-tr">
                            <td className="orphan-td">{orphan.name}</td>
                            <td className="orphan-td orphan-file-name">{orphan.fileName}</td>
                            <td className="orphan-td">{orphan.message}</td>
                            <td className="orphan-td orphan-td-actions">
                              <button
                                className="orphan-delete-btn"
                                onClick={() => onDeleteOrphan?.(orphan)}
                                title="物理删除该文件"
                              ><Trash2 size={14} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {otherIssues.map((issue, idx) => (
                    <div key={idx} className={`embedded-progress-issue-item ${issue.type}`}>
                      <span className="embedded-progress-issue-type">
                        {typeLabels[issue.type] || issue.type}
                      </span>
                      <span className="embedded-progress-issue-text">{issue.message}</span>
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
          {actions.length > 0 && (
            <div className="embedded-progress-actions">
              {actions.map((action, idx) => (
                <button
                  key={idx}
                  className={`embedded-progress-btn ${action.primary ? 'primary' : ''} ${action.warning ? 'warning' : ''}`}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {status === 'error' && (
        <>
          <XCircle size={32} style={{ color: 'var(--accent-danger, #ef4444)' }} />
          <div className="embedded-progress-message error">
            {message || '加载失败'}
          </div>
          {actions.length > 0 && (
            <div className="embedded-progress-actions">
              {actions.map((action, idx) => (
                <button
                  key={idx}
                  className={`embedded-progress-btn ${action.primary ? 'primary' : ''}`}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default EmbeddedProgress;
