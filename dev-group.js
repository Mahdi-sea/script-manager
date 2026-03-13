#!/usr/bin/env node
/*
 * Run a subset of SEA projects inline in a single console (used by dev-all to group others).
 */
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { projects } = require("./projects");

const root = path.resolve(__dirname, "..");
const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm" : "npm";

// Parse args: --projects=comma,separated,names
const argv = process.argv.slice(2);
function getArgValue(keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const eqIndex = a.indexOf("=");
    if (eqIndex !== -1) {
      const k = a.slice(0, eqIndex);
      const v = a.slice(eqIndex + 1);
      if (list.includes(k)) return v;
    } else if (list.includes(a) && i + 1 < argv.length) {
      return argv[i + 1];
    }
  }
  return undefined;
}

const projectsCsv = getArgValue("--projects") || "";
const wantNames = projectsCsv
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => s.toLowerCase());

// const projects = [
//   // Libraries (watch build)
//   {
//     name: "sea-platform-helpers",
//     cwd: path.join(root, "sea-platform-helpers"),
//     script: "watch",
//   },
//   {
//     name: "sea-backend-helpers",
//     cwd: path.join(root, "sea-backend-helpers"),
//     script: "watch",
//   },
//   {
//     name: "sea-react-components",
//     cwd: path.join(root, "sea-react-components"),
//     script: "watch",
//   },

//   // Apps/services (dev)
//   {
//     name: "sea-common-microservice",
//     cwd: path.join(root, "sea-common-microservice"),
//   },

//   {
//     name: "sea-file-manager-microservice",
//     cwd: path.join(root, "sea-file-manager-microservice"),
//   },
//   {
//     name: "sea-platform-microservice",
//     cwd: path.join(root, "sea-platform-microservice"),
//   },
//   {
//     name: "sea-strategy-microservice",
//     cwd: path.join(root, "sea-strategy-microservice"),
//   },

//   // UI (dev)
//   { name: "sea-strategy-ui", cwd: path.join(root, "sea-strategy-ui") },
//   { name: "sea-admin-ui", cwd: path.join(root, "sea-admin-ui") },
//   { name: "sea-auth-ui", cwd: path.join(root, "sea-auth-ui") },
// ];

const subset = projects.filter((p) => wantNames.includes(p.name.toLowerCase()));
if (subset.length === 0) {
  console.error("dev-group: No matching projects for --projects:", projectsCsv);
  process.exit(1);
}

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
    shell: isWin,
    windowsHide: false,
  });
  children.push(child);
  child.stdout.on("data", (d) => prefixWrite(p.name, d));
  child.stderr.on("data", (d) => prefixWrite(p.name, d, true));
  child.on("error", (err) =>
    prefixWrite(p.name, `failed to start: ${err?.message || String(err)}`, true)
  );
  child.on("close", (code) =>
    prefixWrite(p.name, `exited with code ${code ?? "null"}`)
  );
}

function shutdown() {
  console.log("\n[dev-group] Shutting down child processes...");
  for (const child of children) {
    try {
      child.kill();
    } catch {}
  }
  setTimeout(() => process.exit(0), 500);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(
  `[dev-group] Starting ${subset.length} project(s): ${subset
    .map((p) => p.name)
    .join(", ")}`
);
for (const p of subset) startProject(p);
console.log("[dev-group] All processes started. Close this window to stop.");
