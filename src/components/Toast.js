import React, { useState, useEffect } from 'react';
import './Toast.css';

let toastId = 0;
let listeners = [];

const toast = {
  show(message, options = {}) {
    const { type = 'info', duration = 3000 } = options;
    const id = ++toastId;
    listeners.forEach(fn => fn({ id, message, type, duration }));
    return id;
  },
  success(message, duration) {
    return this.show(message, { type: 'success', duration });
  },
  error(message, duration) {
    return this.show(message, { type: 'error', duration });
  },
  warning(message, duration) {
    return this.show(message, { type: 'warning', duration });
  },
  info(message, duration) {
    return this.show(message, { type: 'info', duration });
  },
  _subscribe(fn) {
    listeners.push(fn);
    return () => {
      listeners = listeners.filter(f => f !== fn);
    };
  }
};

function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return toast._subscribe((item) => {
      setToasts(prev => [...prev, { ...item, exiting: false }]);
      setTimeout(() => {
        setToasts(prev => prev.map(t => t.id === item.id ? { ...t, exiting: true } : t));
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== item.id));
        }, 300);
      }, item.duration);
    });
  }, []);

  const remove = (id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  };

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast-item toast-${t.type}${t.exiting ? ' toast-exit' : ''}`}
          onClick={() => remove(t.id)}
        >
          <span className="toast-message">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

export { toast, ToastContainer };
