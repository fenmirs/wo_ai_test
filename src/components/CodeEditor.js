import React, { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';

const LANGUAGE_MAP = {
  text: 'plaintext',
  json: 'json',
  xml: 'xml',
  html: 'html',
  javascript: 'javascript',
};

function CodeEditor({ value, onChange, contentType = 'text', readOnly = false, theme = 'dark' }) {
  const editorRef = useRef(null);

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
  };

  const handleChange = (newValue) => {
    onChange && onChange(newValue || '');
  };

  const formatJSON = () => {
    if (!editorRef.current || contentType !== 'json') return;
    try {
      const currentValue = editorRef.current.getValue();
      const parsed = JSON.parse(currentValue);
      editorRef.current.setValue(JSON.stringify(parsed, null, 2));
      onChange && onChange(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.error('Format JSON error:', e);
    }
  };

  useEffect(() => {
    if (editorRef.current && contentType === 'json' && value) {
      try {
        JSON.parse(value);
      } catch (e) {
        // Invalid JSON, don't auto-format
      }
    }
  }, [value, contentType]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="editor-toolbar" style={{ 
        padding: '4px 8px', 
        borderBottom: theme === 'dark' ? '1px solid #3e3e3e' : '1px solid #e5e5e5', 
        display: 'flex', 
        gap: '8px', 
        alignItems: 'center', 
        background: theme === 'dark' ? '#252526' : '#f5f5f5', 
        flexShrink: 0 
      }}>
        {contentType === 'json' && (
          <button
            onClick={formatJSON}
            style={{ 
              padding: '4px 8px', 
              border: theme === 'dark' ? '1px solid #555' : '1px solid #ccc', 
              borderRadius: '4px', 
              cursor: 'pointer', 
              fontSize: '12px', 
              background: theme === 'dark' ? '#3c3c3c' : '#fff',
              color: theme === 'dark' ? '#ccc' : '#333'
            }}
          >
            格式化
          </button>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          key={contentType}
          height="100%"
          language={LANGUAGE_MAP[contentType] || 'plaintext'}
          value={value || ''}
          onChange={handleChange}
          onMount={handleEditorDidMount}
          theme={theme === 'dark' ? 'vs-dark' : 'vs'}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            tabSize: 2,
            formatOnPaste: true,
            formatOnType: true,
          }}
        />
      </div>
    </div>
  );
}

export default CodeEditor;