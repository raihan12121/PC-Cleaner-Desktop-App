import SQLite from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

let db: SQLite.Database | null = null;

export const getDbPath = () => {
    // Store the DB in the userData path (e.g. AppData/Roaming/pc-cleaner-application on Windows)
    const userDataPath = app.getPath('userData');
    const dbDir = path.join(userDataPath, 'database');

    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    return path.join(dbDir, 'pc-cleaner.sqlite');
};

export const initDatabase = () => {
    if (db) return db;

    const dbPath = getDbPath();
    db = new SQLite(dbPath);

    // Optimizations
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

    createTables();
    return db;
};

export const getDb = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase first.');
    }
    return db;
};

const createTables = () => {
    if (!db) return;

    db.exec(`
    CREATE TABLE IF NOT EXISTS scan_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      items_found INTEGER NOT NULL DEFAULT 0,
      bytes_freed INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS clean_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id INTEGER REFERENCES scan_results(id) ON DELETE CASCADE,
      items_removed INTEGER NOT NULL DEFAULT 0,
      bytes_freed INTEGER NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS restore_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      file_path TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      cron_expr TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run TEXT
    );
  `);
};

export const resetDatabase = () => {
    if (!db) return;
    db.exec(`
    DROP TABLE IF EXISTS clean_history;
    DROP TABLE IF EXISTS scan_results;
    DROP TABLE IF EXISTS restore_points;
    DROP TABLE IF EXISTS schedules;
  `);
    createTables();

    // Clean up physical restore directories so orphaned files do not remain on disk
    try {
        const restoreDir = path.join(app.getPath('userData'), 'restore');
        if (fs.existsSync(restoreDir)) {
            fs.rmSync(restoreDir, { recursive: true, force: true });
        }
    } catch (e) {
        console.warn('Could not remove restore directory during reset:', e);
    }
};
