import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './InputDialog.css';

function InputDialog({ isOpen, title, placeholder, defaultValue, onConfirm, onCancel, onClose, onValueChange, confirmDisabled, confirmLabel }) {
  const [value, setValue] = useState(defaultValue || '');
  const inputRef = useRef(null);

  useEffect(() => {
    setValue(defaultValue || '');
  }, [defaultValue, isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const v = e.target.value;
    setValue(v);
    if (onValueChange) onValueChange(v);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleConfirm = () => {
    if (confirmDisabled) return;
    if (value.trim() && onConfirm) {
      onConfirm(value.trim());
    }
    if (onClose) {
      onClose();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    if (onClose) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="input-dialog-overlay" onClick={handleCancel}>
      <div className="input-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="input-dialog-header">
          <h3>{title}</h3>
          <button className="close-btn" onClick={handleCancel}>
            <X size={18} />
          </button>
        </div>
        <div className="input-dialog-body">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="input-dialog-input"
          />
        </div>
        <div className="input-dialog-footer">
          <button className="btn-secondary" onClick={handleCancel}>
            取消
          </button>
          <button 
            className="btn-primary" 
            onClick={handleConfirm}
            disabled={!value.trim() || confirmDisabled}
          >
            {confirmLabel || '确定'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InputDialog;
