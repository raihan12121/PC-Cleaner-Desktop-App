# PC Cleaner & Optimization Application

A modern, high-performance desktop application built with **Electron, React, and TypeScript** designed to clean, monitor, and optimize your operating system. It features disk cleanup, registry cleaning (Windows-specific), duplicate file finding, startup management, memory optimization, system monitoring, and automated scheduling.

---

## 🚀 Key Features

*   **System Dashboard**: Real-time overview of system health score, disk usage (via donut charts), and scan history timelines.
*   **Disk Cleaner**: Safely scans and cleans temporary files, browser cache, Recycle Bin, and provides secure file shredding (3-pass overwrite).
*   **Registry Cleaner (Windows)**: Safely identifies invalid registry keys using PowerShell and automatically creates a `.reg` backup before any changes are made.
*   **Duplicate Finder**: Scans and groups duplicate files using MD5 hashes with SHA-256 confirmation to prevent false positives.
*   **Startup Manager**: Inspects and controls startup programs (via Registry on Windows / launchctl on macOS) to speed up boot times.
*   **RAM Optimizer**: Frees up memory usage instantly using Windows `EmptyWorkingSet` API or macOS/Linux memory pressure triggers.
*   **Privacy Cleaner**: Cleans browser history, cookies, saved passwords, and recent file records.
*   **Drive Health**: Monitors S.M.A.R.T. status and drive temperature metrics.
*   **Scheduler**: Set up automatic cleaning schedules powered by `node-cron` with SQLite persistence.
*   **Restore Points**: Review and restore files or registry states from previous cleanups.

---

## 🛠️ Tech Stack

*   **Framework**: Electron (Forge + Vite)
*   **Language**: TypeScript (strict mode)
*   **Frontend**: React 19 + React Router v7
*   **Styling**: Tailwind CSS v4
*   **Charts**: Recharts
*   **Database**: `better-sqlite3` (SQLite)
*   **System Info**: `systeminformation`
*   **Scheduling**: `node-cron`
*   **Packaging**: `electron-builder` + `electron-updater`

---

## 🏗️ Architecture

```
├── src
│   ├── main
│   │   ├── database        # SQLite connection and migration scripts
│   │   ├── ipc             # Typed contextBridge IPC handlers
│   │   ├── modules         # Optimization engine (Disk, Registry, RAM, etc.)
│   │   └── index.ts        # Electron main entry point
│   ├── preload
│   │   └── index.ts        # Secure Electron context bridge definition
│   └── renderer
│       ├── App.tsx         # React app container and router
│       ├── pages           # UI Pages (Dashboard, Cleaner, SystemMonitor, etc.)
│       └── main.tsx        # React entry point
```

### IPC Security
The application strictly enforces Electron security best practices. No Node.js APIs are exposed to the renderer process. Communication between the React UI and the Node.js main process is facilitated through a strict, typed `contextBridge` layer (`src/preload/index.ts`).

---

## 🔒 Safety Measures

1.  **Registry Backups**: The application generates a `.reg` file containing the selected keys before performing any registry deletion.
2.  **Destructive Action Previews**: Users are presented with a detailed file list/tree of what will be deleted prior to confirmation.
3.  **Secure Shredding**: Securely deletes files using a 3-pass overwrite process, making recovery extremely difficult.
4.  **Least Privilege**: The application runs under standard user permissions, prompting for Administrator privileges via `sudo-prompt` only when absolutely necessary.
5.  **IPC Validation**: All arguments sent via IPC are validated on the main process side before execution.

---

## 💻 Getting Started

### Prerequisites

*   **Node.js**: v18 or later
*   **npm**: v9 or later
*   **Git**

### Installation

1.  Clone the repository:
    ```bash
    git clone <your-repository-url>
    cd pc-cleaner
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

### Development

To start the application in development mode with hot-reloading:

```bash
npm start
```

### Building & Packaging

To compile the application and package it for your current operating system:

```bash
# Package the application (builds Electron binaries)
npm run package

# Create installers (e.g., .exe for Windows, .dmg for macOS, .AppImage for Linux)
npm run make
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
