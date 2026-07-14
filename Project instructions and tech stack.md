# PC Cleaner & Optimization Application

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Electron (Forge + Vite) |
| Language | TypeScript (strict) |
| UI | React 18 + React Router v6 |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Database | better-sqlite3 |
| System Info | systeminformation |
| Scheduling | node-cron |
| Packaging | electron-builder + electron-updater |
| IPC Security | contextBridge + typed channels |

## Architecture

- **Main process** → engine: modules + IPC handlers + SQLite + scheduling
- **Preload** → strict `contextBridge` (no raw Node.js APIs exposed)
- **Renderer** → React SPA with 6 pages via React Router v6

## Modules (`src/main/modules/`)

Each module implements `scan()`, `clean(items)`, `rollback()`:

1. **DiskCleaner** — temp files, browser cache, Recycle Bin, secure shredding
2. **DuplicateFinder** — MD5 → SHA-256 confirmation, grouped duplicates
3. **RegistryCleaner** — Windows only, PowerShell, `.reg` backup
4. **StartupManager** — Registry + Startup folder (Win) / launchctl (Mac)
5. **RamOptimizer** — EmptyWorkingSet (Win) / memory pressure (Mac/Linux)
6. **PrivacyCleaner** — browser history, cookies, passwords, recent files
7. **DriveHealth** — S.M.A.R.T. data via systeminformation
8. **Scheduler** — node-cron + SQLite persistence

## UI Pages

1. Dashboard — health score, donut chart, scan timeline
2. Cleaner — scan → tree → clean → progress
3. Optimizer — startup manager + RAM optimizer + power plan
4. Privacy — browser checklist + preview + confirm
5. System Monitor — real-time charts + process table
6. Settings — scheduler, restore points, theme, factory reset

## Database Tables

- `scan_results` — module, timestamp, items_found, bytes_freed
- `clean_history` — scan_id, items_removed, bytes_freed, timestamp
- `restore_points` — module, file_path, timestamp
- `schedules` — module, cron_expr, enabled, last_run

## Safety Rules

- Preview before every destructive action
- Registry backup (`.reg` file) before modification
- Shred warning (irreversible, 3-pass overwrite)
- No UAC unless required (`sudo-prompt`)
- All IPC inputs validated in main process

## Packaging

- App ID: `com.yourname.pccleaner`
- Windows: NSIS installer
- macOS: DMG
- Linux: AppImage
- Auto-update: GitHub Releases via electron-updater