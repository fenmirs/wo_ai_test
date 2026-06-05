import React from 'react';
import { FolderOpen, Zap, Settings, Plus } from 'lucide-react';
import './EmptyState.css';

function EmptyState({ onImportProject, onNewProject }) {
  return (
    <div className="empty-state-container">
      <div className="empty-state-content">
        <div className="empty-icon">
          <FolderOpen size={64} />
        </div>
        <h2>欢迎使用 WoAiTest</h2>
        <p className="empty-description">
          请选择一个空间目录开始使用
        </p>
        
        <div className="empty-features">
          <div className="feature-item">
            <Zap size={24} />
            <div>
              <h3>快速测试</h3>
              <p>一键执行 API 测试，实时查看结果</p>
            </div>
          </div>
          <div className="feature-item">
            <Settings size={24} />
            <div>
              <h3>灵活配置</h3>
              <p>支持多环境、动态参数和调用链</p>
            </div>
          </div>
        </div>

        <div className="button-group">
          <button className="demo-button" onClick={() => { console.log('新增空间 button clicked'); onNewProject && onNewProject(); }}>
            <Plus size={20} />
            新增空间
          </button>
          <button className="import-button" onClick={() => { console.log('导入空间 button clicked'); onImportProject && onImportProject(); }}>
            <FolderOpen size={20} />
            导入空间
          </button>
        </div>
        
        <p className="empty-hint">
          提示：选择包含项目 config.json 文件的空间目录
        </p>
      </div>
    </div>
  );
}

export default EmptyState;