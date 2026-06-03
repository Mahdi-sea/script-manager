const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

let mainWindow;
const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function escapeAppleScript(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function openMacTerminal(command, cwd) {
  const cdPart = cwd ? `cd ${shellQuote(cwd)}; ` : "";
  const fullCommand = `${cdPart}${command}`;
  const escapedCommand = escapeAppleScript(fullCommand);

  const child = spawn(
    "osascript",
    [
      "-e",
      `tell application \"Terminal\" to do script \"${escapedCommand}\"`,
      "-e",
      'tell application "Terminal" to activate',
    ],
    {
      detached: true,
      stdio: "ignore",
    }
  );

  child.unref();
}

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
    const rootPath = path.join(__dirname, "..");
    const devAllPath = path.join(rootPath, "dev-all.js");
    const projectsPath = getProjectsPath();

    if (isWindows) {
      const command = `set \"ELECTRON_RUN_PROJECTS_PATH=${projectsPath}\" && node \"${devAllPath}\"`;
      const child = spawn(
        "cmd.exe",
        ["/c", "start", "Dev Runner", "cmd.exe", "/k", command],
        {
          detached: true,
          stdio: "ignore",
        }
      );
      child.unref();
    } else if (isMac) {
      const command = `ELECTRON_RUN_PROJECTS_PATH=${shellQuote(
        projectsPath
      )} node ${shellQuote(devAllPath)}`;
      openMacTerminal(command, rootPath);
    } else {
      const child = spawn("node", [devAllPath], {
        cwd: rootPath,
        env: { ...process.env, ELECTRON_RUN_PROJECTS_PATH: projectsPath },
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    }

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

    const child = isWindows
      ? spawn("cmd.exe", ["/c", "code", absolutePath], {
        detached: true,
        stdio: "ignore",
        shell: true,
      })
      : spawn("code", [absolutePath], {
        detached: true,
        stdio: "ignore",
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

    if (isWindows) {
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
    } else if (isMac) {
      const macCommand = `echo; echo \"=============================================\"; echo \"Running: ${command}\"; echo \"=============================================\"; echo; ${command}`;
      openMacTerminal(macCommand, absolutePath);
    } else {
      const child = spawn("x-terminal-emulator", ["-e", command], {
        cwd: absolutePath,
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
