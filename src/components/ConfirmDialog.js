import React, { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import './ConfirmDialog.css';

function ConfirmDialog({ isOpen, title, message, options, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-header">
          <div className="confirm-dialog-icon">
            <AlertTriangle size={24} />
          </div>
          <h3>{title}</h3>
          <button className="close-btn" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <div className="confirm-dialog-body">
          <p>{message}</p>
          {options && (
            <div className="confirm-options">
              {options.map((option, index) => (
                <label key={index} className="confirm-option">
                  <input
                    type="radio"
                    name="deleteOption"
                    value={option.value}
                    defaultChecked={index === 0}
                  />
                  <span className="option-label">{option.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="confirm-dialog-footer">
          <button className="btn-secondary" onClick={onCancel}>
            取消
          </button>
          <button className="btn-primary danger" onClick={() => {
            const selectedOption = options?.find(opt => 
              document.querySelector(`input[name="deleteOption"][value="${opt.value}"]`)?.checked
            );
            onConfirm(selectedOption?.value || options?.[0]?.value);
          }}>
            确定
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
