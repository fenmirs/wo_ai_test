import React from 'react';
import { ChevronRight } from 'lucide-react';
import './ProjectSelector.css';

function ProjectSelector({ projects, currentProject, onSelect }) {
  return (
    <div className="project-selector">
      {projects.length === 0 ? (
        <div className="empty-message">
          未找到项目
        </div>
      ) : (
        <div className="project-list">
          {projects.map((project) => (
            <div
              key={project.name}
              className={`project-item ${currentProject?.name === project.name ? 'active' : ''}`}
              onClick={() => onSelect(project)}
            >
              <span className="project-name">{project.name}</span>
              {currentProject?.name === project.name && (
                <ChevronRight size={16} className="active-icon" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectSelector;