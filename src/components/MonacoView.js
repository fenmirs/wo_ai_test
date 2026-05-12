import React, { useState, useRef, useCallback } from 'react';
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
  const editorRef = useRef(null);

  const handleMount = useCallback((editor) => {
    editorRef.current = editor;
    if (onMount) onMount(editor);
  }, [onMount]);

  const handleCopy = useCallback(() => {
    const content = editorRef.current ? editorRef.current.getValue() : (value || '');
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [value]);

  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...(readOnly ? READONLY_OPTIONS : {}),
    ...extraOptions,
  };

  return (
    <div className="monaco-view">
      {showCopyButton && (
        <div
          className="monaco-view-copy-btn"
          onClick={handleCopy}
          title="复制全部"
        >
          <Copy size={12} />
          {copied ? '已复制' : '复制'}
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
