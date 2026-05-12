import React from 'react';
import MonacoView from './MonacoView';

const LANGUAGE_MAP = {
  text: 'plaintext',
  json: 'json',
  xml: 'xml',
  html: 'html',
  javascript: 'javascript',
};

function CodeEditor({ value, onChange, contentType = 'text', readOnly = false, theme = 'dark' }) {
  const handleChange = (newValue) => {
    onChange && onChange(newValue || '');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <MonacoView
          key={contentType}
          value={value || ''}
          onChange={handleChange}
          language={LANGUAGE_MAP[contentType] || 'plaintext'}
          theme={theme}
          height="100%"
          readOnly={readOnly}
          extraOptions={{
            formatOnPaste: true,
            formatOnType: true,
            fontSize: 13,
          }}
        />
      </div>
    </div>
  );
}

export default CodeEditor;