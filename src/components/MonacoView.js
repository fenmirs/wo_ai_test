import React, { useState, useRef, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Copy } from 'lucide-react';
import './MonacoView.css';

const DEFAULT_OPTIONS = {
  fontSize: 11,
  minimap: { enabled: false },
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  wordWrap: 'on',
  tabSize: 2,
  glyphMargin: false,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 3,
  overviewRulerBorder: false,
};

const READONLY_OPTIONS = {
  readOnly: true,
  hideCursorInOverviewRuler: true,
  renderLineHighlight: 'none',
  contextmenu: false,
  folding: true,
};

function MonacoView({
  value,
  onChange,
  language = 'plaintext',
  readOnly = false,
  theme = 'dark',
  height = '300px',
  showCopyButton = true,
  extraOptions = {},
  onMount,
}) {
  const [copied, setCopied] = useState(false);
  const originalRef = useRef(value);
  const editorRef = useRef(null);
  const selfChangeRef = useRef(false);
  const [hasHistory, setHasHistory] = useState(false);

  useEffect(() => {
    if (!selfChangeRef.current) {
      originalRef.current = value;
      setHasHistory(false);
    }
    selfChangeRef.current = false;
  }, [value]);

  const getContent = useCallback(() => {
    return editorRef.current ? editorRef.current.getValue() : (value || '');
  }, [value]);

  const setContent = useCallback((newVal) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setValue(newVal);
    selfChangeRef.current = true;
    if (onChange) onChange(newVal);
    setHasHistory(true);
  }, [onChange]);

  const handleMount = useCallback((editor) => {
    editorRef.current = editor;
    if (onMount) onMount(editor);
  }, [onMount]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(getContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [getContent]);

  const compress = useCallback(() => {
    const current = getContent();
    let result;
    if (language === 'json') {
      try {
        result = JSON.stringify(JSON.parse(current));
      } catch {
        result = current.replace(/[\r\n]+/g, '').replace(/[ \t]+/g, ' ').trim();
      }
    } else {
      result = current.replace(/[\r\n]+/g, '').replace(/[ \t]+/g, ' ').trim();
    }
    setContent(result);
  }, [getContent, setContent, language]);

  const removeNonASCII = useCallback(() => {
    const current = getContent();
    setContent(current.replace(/[^\x00-\x7F]/g, ''));
  }, [getContent, setContent]);

  const formatDocument = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const action = editor.getAction('editor.action.formatDocument');
    if (action) {
      action.run();
      setHasHistory(true);
    }
  }, []);

  const restore = useCallback(() => {
    const orig = originalRef.current;
    if (orig !== null && orig !== undefined) {
      setContent(orig);
      setHasHistory(false);
    }
  }, [setContent]);

  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...(readOnly ? READONLY_OPTIONS : {}),
    ...extraOptions,
  };

  const showActions = showCopyButton;

  return (
    <div className="monaco-view">
      {showActions && (
        <div className="monaco-view-actions" onClick={e => e.stopPropagation()}>
          <span className="monaco-action-btn" onClick={compress} title="去掉换行，折叠为一行">压缩</span>
          <span className="monaco-action-divider" />
          <span className="monaco-action-btn" onClick={removeNonASCII} title="去掉所有非 ASCII 字符">去除非ASCII</span>
          <span className="monaco-action-divider" />
          <span className="monaco-action-btn" onClick={formatDocument} title="根据语言格式化内容">格式化</span>
          <span className="monaco-action-divider" />
          <span className={`monaco-action-btn${hasHistory ? '' : ' disabled'}`} onClick={hasHistory ? restore : undefined} title="还原到处理前的内容">还原</span>
          <span className="monaco-action-divider" />
          <span className="monaco-action-btn" onClick={handleCopy} title="复制全部">
            <Copy size={12} />
            {copied ? '已复制' : '复制'}
          </span>
        </div>
      )}
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={onChange}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        onMount={handleMount}
        options={mergedOptions}
      />
    </div>
  );
}

export default MonacoView;
