import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// 抑制 ResizeObserver 循环警告（React 18 开发模式下的已知问题，不影响功能）
const _originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('ResizeObserver loop')) return;
  _originalError.call(console, ...args);
};
window.addEventListener('error', (e) => {
  if (e.message && (e.message.includes('ResizeObserver loop') || e.message.includes('ResizeObserver'))) {
    e.stopImmediatePropagation();
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);