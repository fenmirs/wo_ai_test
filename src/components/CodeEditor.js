import React, { useState, useRef, useEffect } from 'react';
import { Play, XCircle, Search, ChevronDown, ChevronRight, Minus, Plus, Copy, ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './CodeEditor.css';

const CONTENT_TYPES = [
  { value: 'text', label: 'Text', language: 'text' },
  { value: 'json', label: 'JSON', language: 'json' },
  { value: 'xml', label: 'XML', language: 'xml' },
  { value: 'html', label: 'HTML', language: 'html' },
  { value: 'javascript', label: 'JavaScript', language: 'javascript' },
];

function CodeEditor({ value, onChange, contentType = 'text', onTypeChange }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [isFormatted, setIsFormatted] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [mode, setMode] = useState('edit');
  const textareaRef = useRef(null);
  const highlightingRef = useRef(null);

  useEffect(() => {
    if (searchQuery) {
      performSearch(searchQuery);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, value]);

  const performSearch = (query) => {
    if (!query || !value) {
      setSearchResults([]);
      return;
    }
    const results = [];
    const lines = value.split('\n');
    const regex = new RegExp(query, 'gi');
    lines.forEach((line, idx) => {
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(line)) !== null) {
        results.push({ line: idx, match: match[0], index: match.index });
      }
    });
    setSearchResults(results);
    setCurrentResultIndex(0);
  };

  const formatContent = () => {
    if (contentType === 'json') {
      try {
        const parsed = JSON.parse(value);
        onChange(JSON.stringify(parsed, null, 2));
        setIsFormatted(true);
      } catch (e) {
        setIsFormatted(false);
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(value || '');
  };

  const goToNextResult = () => {
    if (searchResults.length > 0) {
      const nextIndex = (currentResultIndex + 1) % searchResults.length;
      setCurrentResultIndex(nextIndex);
      scrollToLine(searchResults[nextIndex].line);
    }
  };

  const goToPrevResult = () => {
    if (searchResults.length > 0) {
      const prevIndex = (currentResultIndex - 1 + searchResults.length) % searchResults.length;
      setCurrentResultIndex(prevIndex);
      scrollToLine(searchResults[prevIndex].line);
    }
  };

  const scrollToLine = (lineNumber) => {
    const lineHeight = 20;
    if (highlightingRef.current) {
      highlightingRef.current.scrollTop = lineNumber * lineHeight;
    }
  };

  const toggleNode = (nodePath) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodePath)) {
      newExpanded.delete(nodePath);
    } else {
      newExpanded.add(nodePath);
    }
    setExpandedNodes(newExpanded);
  };

  const expandAll = () => {
    if (contentType === 'json') {
      try {
        const parsed = JSON.parse(value);
        const paths = new Set();
        const traverse = (obj, path = '') => {
          if (Array.isArray(obj)) {
            obj.forEach((item, idx) => traverse(item, `${path}[${idx}]`));
          } else if (obj && typeof obj === 'object') {
            Object.keys(obj).forEach(key => {
              paths.add(path ? `${path}.${key}` : key);
              traverse(obj[key], path ? `${path}.${key}` : key);
            });
          }
        };
        traverse(parsed);
        setExpandedNodes(paths);
      } catch (e) {}
    }
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const getLanguage = () => {
    const type = CONTENT_TYPES.find(t => t.value === contentType);
    return type ? type.language : 'text';
  };

  const renderFoldableContent = () => {
    if (contentType === 'json' && !isFormatted) {
      return value;
    }
    
    if (contentType === 'json' && value) {
      try {
        const parsed = JSON.parse(value);
        return renderJsonTree(parsed, '', 0);
      } catch {
        return value;
      }
    }
    
    return null;
  };

  const renderJsonTree = (obj, path, indent) => {
    if (obj === null) return 'null';
    if (typeof obj === 'undefined') return 'undefined';
    
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      return `{...}`;
    }
    
    if (typeof obj === 'object') {
      if (Object.keys(obj).length === 0) return '{}';
      const entries = Object.entries(obj);
      return entries.map(([key, val]) => {
        const currentPath = path ? `${path}.${key}` : key;
        const isExpanded = expandedNodes.has(currentPath);
        const displayVal = typeof val === 'object' ? (isExpanded ? renderJsonTree(val, currentPath, indent + 2) : '{...}') : JSON.stringify(val);
        return `${key}: ${displayVal}`;
      }).join('\n');
    }
    
    return JSON.stringify(obj);
  };

  return (
    <div className="code-editor">
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <select
            value={contentType}
            onChange={(e) => onTypeChange && onTypeChange(e.target.value)}
            className="type-select"
          >
            {CONTENT_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          {contentType === 'json' && (
            <button className="toolbar-btn" onClick={formatContent} title="格式化">
              格式化
            </button>
          )}
        </div>
        
        <div className="toolbar-center">
          <button
            className={`toolbar-btn ${mode === 'edit' ? 'active' : ''}`}
            onClick={() => setMode('edit')}
          >
            编辑
          </button>
          <button
            className={`toolbar-btn ${mode === 'view' ? 'active' : ''}`}
            onClick={() => setMode('view')}
          >
            预览
          </button>
          {contentType === 'json' && mode === 'view' && (
            <>
              <button className="toolbar-btn" onClick={expandAll} title="展开全部">
                <ArrowDown size={12} />
              </button>
              <button className="toolbar-btn" onClick={collapseAll} title="折叠全部">
                <ArrowUp size={12} />
              </button>
            </>
          )}
        </div>
        
        <div className="toolbar-right">
          <button
            className={`toolbar-btn ${showSearch ? 'active' : ''}`}
            onClick={() => setShowSearch(!showSearch)}
            title="搜索"
          >
            <Search size={12} />
          </button>
          <button className="toolbar-btn" onClick={handleCopy} title="复制">
            <Copy size={12} />
          </button>
        </div>
      </div>
      
      {showSearch && (
        <div className="search-bar">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索..."
            className="search-input"
          />
          {searchResults.length > 0 && (
            <>
              <span className="search-info">
                {currentResultIndex + 1} / {searchResults.length}
              </span>
              <button className="toolbar-btn" onClick={goToPrevResult} title="上一个">
                <ChevronRight size={12} style={{ transform: 'rotate(180deg)' }} />
              </button>
              <button className="toolbar-btn" onClick={goToNextResult} title="下一个">
                <ChevronRight size={12} />
              </button>
            </>
          )}
        </div>
      )}
      
      <div className="editor-content">
        {mode === 'edit' ? (
          <textarea
            ref={textareaRef}
            value={value || ''}
            onChange={(e) => onChange && onChange(e.target.value)}
            placeholder="输入内容..."
            className="code-textarea"
          />
        ) : (
          <div className="code-viewer" ref={highlightingRef}>
            {value ? (
              <SyntaxHighlighter
                language={getLanguage()}
                style={vscDarkPlus}
                customStyle={{ margin: 0, fontSize: '12px', minHeight: '100%' }}
                showLineNumbers
                wrapLines
              >
                {contentType === 'json' && !isFormatted ? value : value}
              </SyntaxHighlighter>
            ) : (
              <div className="empty-content">无内容</div>
            )}
          </div>
        )}
      </div>
      
      {contentType === 'json' && !isFormatted && (
        <div className="format-warning">
          <XCircle size={12} />
          JSON 格式不正确，无法解析
        </div>
      )}
    </div>
  );
}

export default CodeEditor;