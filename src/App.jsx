import { useState, useEffect } from "react";

function App() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const result = await window.electron.getProjects();
    if (result.success) {
      setProjects(result.projects);
    }
  };

  const handleToggleProject = async (e, projectName) => {
    e.stopPropagation();

    const result = await window.electron.toggleProject(projectName);
    if (result.success) {
      setProjects((prev) =>
        prev.map((p) =>
          p.name === projectName ? { ...p, enabled: result.enabled } : p,
        ),
      );
    }
  };

  const enabledCount = projects.filter((p) => p.enabled).length;

  // Group projects by group attribute
  const groupedProjects = projects.reduce((acc, project) => {
    const groupName = project.group || "Other";
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(project);
    return acc;
  }, {});

  // Sort groups by name
  const sortedGroupNames = Object.keys(groupedProjects).sort();

  const handleRunDevBat = async () => {
    const result = await window.electron.runDevBat();
    if (!result.success) {
      alert(`Failed to run dev command: ${result.error}`);
    }
  };

  const handleOpenCurrentDir = () => {
    window.electron.openVSCode(".");
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Electron Run - Dev Script Manager</h1>
        <div className="header-buttons">
          <button className="run-dev-button" onClick={handleOpenCurrentDir}>
            Open in VS Code
          </button>
          <button className="run-dev-button" onClick={handleRunDevBat}>
            Run Dev
          </button>
        </div>
      </header>

      <div className="main-content">
        <div className="projects-container">
          <div className="sidebar-header">
            <h2>
              Projects ({enabledCount}/{projects.length} enabled)
            </h2>
          </div>

          <div className="projects-list">
            {sortedGroupNames.map((groupName, groupIndex) => (
              <div key={groupName}>
                <div className="group-header">{groupName}</div>
                {groupedProjects[groupName].map((project, index) => (
                  <div
                    key={index}
                    className={`project-item ${
                      selectedProject?.name === project.name ? "selected" : ""
                    } ${!project.enabled ? "disabled" : ""}`}
                    onClick={() => setSelectedProject(project)}
                  >
                    <div className="project-header">
                      <input
                        type="checkbox"
                        className="project-checkbox"
                        checked={project.enabled}
                        onChange={(e) => handleToggleProject(e, project.name)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="project-name">{project.name}</div>
                      <button
                        className="open-link-button cmd-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.electron.openCmdPrompt(
                            project.cwd,
                            project.script || "dev",
                          );
                        }}
                        title={`Open CMD in ${project.cwd} with npm run ${
                          project.script || "dev"
                        }`}
                      >
                        RUN
                      </button>
                      <button
                        className="open-link-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.electron.openVSCode(project.cwd);
                        }}
                        title={project.cwd}
                      >
                        VS Code
                      </button>

                      {project.link && (
                        <button
                          className="open-link-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.electron.openExternal(project.link);
                          }}
                          title={project.link}
                        >
                          Open Browser
                        </button>
                      )}
                    </div>
                    <div className="project-script">
                      Script: {project.script || "dev"}
                    </div>
                  </div>
                ))}
                {groupIndex < sortedGroupNames.length - 1 && (
                  <div className="group-break"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
