import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// 抑制 ResizeObserver 循环警告（React 18 开发模式下的已知问题，不影响功能）
const _originalError = console.error;
console.error = (...args) => {
  const msg = args.map(a => (typeof a === 'string' ? a : a?.message || '')).join(' ');
  if (msg.includes('ResizeObserver')) return;
  _originalError.call(console, ...args);
};
const _origOnError = window.onerror;
window.onerror = (message, source, lineno, colno, error) => {
  const msg = typeof message === 'string' ? message : (error?.message || '');
  if (msg.includes('ResizeObserver')) return true;
  if (_origOnError) return _origOnError.call(window, message, source, lineno, colno, error);
  return false;
};
window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || (typeof e.reason === 'string' ? e.reason : '');
  if (msg.includes('ResizeObserver')) e.preventDefault();
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);