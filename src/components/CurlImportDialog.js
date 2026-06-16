import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Check, Terminal } from 'lucide-react';
import CurlParser from '../utils/CurlParser';
import './CurlImportDialog.css';

function CurlImportDialog({ onConfirm, onClose }) {
  const [rawText, setRawText] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const parseResult = useMemo(() => {
    if (!rawText.trim()) return null;
    try {
      return CurlParser.parse(rawText);
    } catch (e) {
      return { error: e.message };
    }
  }, [rawText]);

  const isValid = parseResult && !parseResult.error && parseResult.url;
  const getMethodColor = (method) => {
    const colors = { 'GET': '#10b981', 'POST': '#3b82f6', 'PUT': '#f59e0b', 'DELETE': '#ef4444', 'PATCH': '#8b5cf6', 'HEAD': '#6b7280', 'OPTIONS': '#6b7280' };
    return colors[method] || '#64748b';
  };

  return (
    <div className="curl-import-overlay" onClick={onClose}>
      <div className="curl-import-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="curl-import-header">
          <span className="curl-import-title"><Terminal size={14} /> 导入 cURL</span>
          <button className="curl-import-close" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="curl-import-body">
          <textarea
            ref={textareaRef}
            className="curl-textarea"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="在此粘贴 cURL 命令...&#10;&#10;例如:&#10;curl -X POST https://api.example.com/login \&#10;  -H 'Content-Type: application/json' \&#10;  -d '{&quot;username&quot;:&quot;admin&quot;,&quot;password&quot;:&quot;123456&quot;}'"
            spellCheck={false}
          />

          {parseResult && !parseResult.error && parseResult.url && (
            <div className="curl-preview">
              <div className="curl-preview-header">
                <span className="curl-preview-title">解析结果</span>
              </div>

              <div className="curl-preview-row">
                <span className="curl-preview-label">方法</span>
                <span className="curl-preview-method" style={{ color: getMethodColor(parseResult.method) }}>
                  {parseResult.method}
                </span>
              </div>

              <div className="curl-preview-row">
                <span className="curl-preview-label">URL</span>
                <code className="curl-preview-url">{parseResult.url}</code>
              </div>

              {parseResult.params.length > 0 && (
                <div className="curl-preview-row">
                  <span className="curl-preview-label">Params</span>
                  <span className="curl-preview-count">{parseResult.params.length} 项</span>
                </div>
              )}

              <div className="curl-preview-row">
                <span className="curl-preview-label">Headers</span>
                <span className="curl-preview-count">{parseResult.headers.length} 项</span>
              </div>

              {parseResult.body && (
                <div className="curl-preview-row">
                  <span className="curl-preview-label">Body</span>
                  <span className="curl-preview-count">
                    {parseResult.bodyType === 'raw' ? 'raw' : parseResult.bodyType}
                    {parseResult.bodyType === 'raw' && typeof parseResult.body === 'string' ? ` (${parseResult.body.length} 字符)` : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {parseResult?.error && (
            <div className="curl-error">
              解析失败：{parseResult.error}
            </div>
          )}

          {rawText.trim() && !parseResult && (
            <div className="curl-error">
              无法解析，请检查 cURL 命令格式
            </div>
          )}
        </div>

        <div className="curl-import-footer">
          <button className="curl-btn-cancel" onClick={onClose}>取消</button>
          <button
            className="curl-btn-confirm"
            onClick={() => onConfirm(parseResult)}
            disabled={!isValid}
          >
            <Check size={12} /> 创建 API
          </button>
        </div>
      </div>
    </div>
  );
}

export default CurlImportDialog;
