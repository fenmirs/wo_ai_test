import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { RefreshCw } from 'lucide-react';
import './ProgressOverlay.css';

const ProgressContext = createContext(null);

const SHOW_DELAY_MS = 100;
const MIN_DISPLAY_MS = 300;

export function ProgressProvider({ children }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const showTimeRef = useRef(0);
  const showTimerRef = useRef(null);
  const hideTimerRef = useRef(null);

  const showProgress = useCallback((msg = '正在处理...') => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    setMessage(msg);

    if (visible) {
      showTimeRef.current = Date.now();
      return;
    }

    showTimerRef.current = setTimeout(() => {
      setVisible(true);
      showTimeRef.current = Date.now();
      showTimerRef.current = null;
    }, SHOW_DELAY_MS);
  }, [visible]);

  const hideProgress = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
      setMessage('');
      return;
    }

    const elapsed = Date.now() - showTimeRef.current;
    if (elapsed < MIN_DISPLAY_MS) {
      hideTimerRef.current = setTimeout(() => {
        setVisible(false);
        setMessage('');
        hideTimerRef.current = null;
      }, MIN_DISPLAY_MS - elapsed);
    } else {
      setVisible(false);
      setMessage('');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return (
    <ProgressContext.Provider value={{ showProgress, hideProgress }}>
      {children}
      {visible && ReactDOM.createPortal(
        <div className="global-progress-overlay">
          <RefreshCw size={32} className="global-progress-spin" />
          <span className="global-progress-text">{message}</span>
        </div>,
        document.body
      )}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used within ProgressProvider');
  return ctx;
}
