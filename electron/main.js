const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

let mainWindow;

// Get the projects.json path - use userData directory in production
function getProjectsPath() {
  if (app.isPackaged) {
    const userDataPath = path.join(app.getPath("userData"), "projects.json");
    // Copy from app if not exists in userData
    if (!fs.existsSync(userDataPath)) {
      const defaultPath = path.join(app.getAppPath(), "projects.json");
      if (fs.existsSync(defaultPath)) {
        fs.copyFileSync(defaultPath, userDataPath);
      }
    }
    return userDataPath;
  }
  return path.join(__dirname, "..", "projects.json");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  // Processes run in external terminals, so just quit
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.handle("get-projects", async () => {
  try {
    const projectsPath = getProjectsPath();
    const projectsData = fs.readFileSync(projectsPath, "utf8");
    const projects = JSON.parse(projectsData);
    return { success: true, projects };
  } catch (error) {
    return {
      success: false,
      error: `Failed to load projects: ${error.message}`,
      projects: [],
    };
  }
});

ipcMain.handle("toggle-project", async (event, projectName) => {
  try {
    const projectsPath = getProjectsPath();
    const projectsData = fs.readFileSync(projectsPath, "utf8");
    const projects = JSON.parse(projectsData);

    const project = projects.find((p) => p.name === projectName);
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    project.enabled = !project.enabled;

    fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2), "utf8");

    return { success: true, enabled: project.enabled };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("run-dev-bat", async () => {
  try {
    const batPath = path.join(__dirname, "..", "run-dev.bat");

    const child = spawn("cmd.exe", ["/c", "start", "cmd.exe", "/k", batPath], {
      detached: true,
      stdio: "ignore",
    });

    child.unref();

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("open-external", async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("open-vscode", async (event, projectPath) => {
  try {
    const absolutePath = path.resolve(__dirname, "..", projectPath);

    // On Windows, use cmd.exe to run code command
    const child = spawn("cmd.exe", ["/c", "code", absolutePath], {
      detached: true,
      stdio: "ignore",
      shell: true,
    });

    child.unref();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("open-cmd-prompt", async (event, projectPath, script) => {
  try {
    const absolutePath = path.resolve(__dirname, "..", projectPath);
    const command = `npm run ${script}`;

    // Open cmd.exe in the project directory with the command ready but not executed
    const child = spawn(
      "cmd.exe",
      [
        "/c",
        "start",
        "/d",
        absolutePath,
        "cmd.exe",
        "/k",
        `echo. && echo ============================================= && echo Ready to run: ${command} && echo ============================================= && echo. && echo Just press UP ARROW and ENTER to run && echo. && ${command} || echo.`,
      ],
      {
        detached: true,
        stdio: "ignore",
      }
    );

    child.unref();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
