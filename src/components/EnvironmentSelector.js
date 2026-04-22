import React from 'react';
import { Check, Globe } from 'lucide-react';
import './EnvironmentSelector.css';

function EnvironmentSelector({ profiles, currentProfile, onSelect }) {
  if (!profiles || profiles.length === 0) {
    return (
      <div className="environment-selector">
        <div className="empty-message">未配置环境</div>
      </div>
    );
  }

  return (
    <div className="environment-selector">
      {profiles.map((profile) => (
        <div
          key={profile.name}
          className={`env-item ${currentProfile?.name === profile.name ? 'active' : ''}`}
          onClick={() => onSelect(profile)}
        >
          <div className="env-info">
            <div className="env-name">
              {profile.name}
              {profile.activate && (
                <span className="activate-badge">默认</span>
              )}
            </div>
            <div className="env-domain">{profile.domain}</div>
          </div>
          {currentProfile?.name === profile.name && (
            <Check size={16} className="check-icon" />
          )}
        </div>
      ))}
    </div>
  );
}

export default EnvironmentSelector;