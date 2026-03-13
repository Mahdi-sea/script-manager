# Multi-project dev runner

Run all projects with one command.

## Usage (Windows PowerShell)

- From the repo root:

```powershell
# First time: ensure dependencies are installed per project
# (optional) npm i --prefix .\sea-admin-ui; npm i --prefix .\sea-auth-ui; ...

# Start all in dev mode (ports as defined in each package.json):
powershell -ExecutionPolicy Bypass -File .\run\dev-all.ps1
```

Alternatively, run the Node script directly:

```powershell
node .\run\dev-all.js
```

### Focus one project inline (-p)

Run one project inline in the current terminal and group all others into a single external terminal window:

```powershell
# Example: run Strategy UI inline; others grouped externally
node .\run\dev-all.js -p sea-strategy-ui

# Using the PowerShell wrapper (for convenience)
./run/dev-all.ps1 -p sea-strategy-ui
```

Notes:
- The grouped window is titled "SEA Group" and will keep running; close it to stop grouped processes.
- Inline process stops with Ctrl+C in your current terminal.

## What it starts

- sea-admin-ui (Next.js, port 3002)
- sea-auth-ui (Next.js, port 3001)
- sea-file-manager-microservice (NestJS, watch)
- sea-platform-microservice (NestJS, watch)
- sea-strategy-microservice (NestJS, watch)
- sea-strategy-ui (Next.js, port 3004)

Logs are prefixed with the project name. Press Ctrl+C to stop all.