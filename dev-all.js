#!/usr/bin/env node
/*
 * Start all SEA projects in dev mode concurrently with prefixed logs.
 */
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Load projects from JSON file
const envProjectsPath = process.env.ELECTRON_RUN_PROJECTS_PATH;
const projectsPath =
  envProjectsPath && fs.existsSync(envProjectsPath)
    ? envProjectsPath
    : path.join(__dirname, "projects.json");
let projects = [];
try {
  const projectsData = fs.readFileSync(projectsPath, "utf8");
  projects = JSON.parse(projectsData);
  // Resolve relative paths
  const root = path.resolve(__dirname, "..");
  projects = projects.map((p) => ({
    ...p,
    cwd: path.resolve(__dirname, p.cwd),
  }));
} catch (error) {
  console.error("Failed to load projects.json:", error.message);
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm" : "npm";

// Parse -p <projectName> or -p=<projectName>
const argv = process.argv.slice(2);
function getInlineNameArg() {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-p" && i + 1 < argv.length) return argv[i + 1];
    if (a.startsWith("-p=")) return a.slice(3);
  }
  return undefined;
}
const inlineNameRaw = getInlineNameArg();
const inlineName = inlineNameRaw ? inlineNameRaw.toLowerCase() : undefined;

const children = [];

function prefixWrite(prefix, data, isErr = false) {
  const text = data.toString().replace(/\r\n/g, "\n");
  const lines = text.split("\n").filter((l) => l.length > 0);
  for (const line of lines) {
    const out = `[${prefix}] ${line}`;
    if (isErr) process.stderr.write(out + "\n");
    else process.stdout.write(out + "\n");
  }
}

function startProject(p) {
  if (!fs.existsSync(p.cwd)) {
    prefixWrite(p.name, `directory not found: ${p.cwd}`, true);
    return;
  }
  const script = p.script || "dev";
  const child = spawn(npmCmd, ["run", script], {
    cwd: p.cwd,
    env: { ...process.env, FORCE_COLOR: "1" },
    shell: isWin, // Use shell on Windows to avoid spawn EINVAL issues
    windowsHide: false,
  });
  children.push(child);

  child.stdout.on("data", (d) => prefixWrite(p.name, d));
  child.stderr.on("data", (d) => prefixWrite(p.name, d, true));
  child.on("error", (err) => {
    prefixWrite(
      p.name,
      `failed to start: ${err && err.message ? err.message : String(err)}`,
      true
    );
  });
  child.on("close", (code) => {
    prefixWrite(p.name, `exited with code ${code ?? "null"}`);
  });
}

function startGroupedExternal(others) {
  if (!others || others.length === 0) return;
  const groupScript = path.join(__dirname, "dev-group.js");
  const csv = others.map((p) => p.name).join(",");
  if (isWin) {
    // Open a new terminal window that keeps running and shows all grouped logs
    // Equivalent command: start "SEA Group" cmd /k node dev-group.js --projects=csv
    const args = [
      "/c",
      "start",
      '"SEA Group"',
      "cmd",
      "/k",
      `node "${groupScript}" --projects=${csv}`,
    ];
    spawn("cmd", args, { shell: true, windowsHide: false });
  } else {
    // Non-Windows: run detached in background (best effort)
    const child = spawn("node", [groupScript, `--projects=${csv}`], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  }
}

function shutdown() {
  console.log("\nShutting down child processes...");
  for (const child of children) {
    try {
      child.kill();
    } catch {}
  }
  // Give a brief grace period
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

if (inlineName) {
  const inlineProj = projects.find((p) => p.name.toLowerCase() === inlineName);
  if (!inlineProj) {
    console.error(`Project not found for -p: ${inlineNameRaw}`);
    process.exit(1);
  }
  const others = projects.filter((p) => p !== inlineProj && p.enabled);
  console.log(`Starting inline: ${inlineProj.name}`);
  console.log(
    `Starting grouped external: ${others.map((p) => p.name).join(", ")}`
  );
  startGroupedExternal(others);
  startProject(inlineProj);
  console.log(
    "All processes started. Ctrl+C stops inline project. Close the other window to stop grouped ones."
  );
} else {
  console.log("Starting all enabled projects in dev mode...");
  const enabledProjects = projects.filter((p) => p.enabled);
  console.log(
    `Enabled projects (${enabledProjects.length}): ${enabledProjects
      .map((p) => p.name)
      .join(", ")}`
  );
  for (const p of enabledProjects) startProject(p);
  console.log("All processes started. Press Ctrl+C to stop.");
}
