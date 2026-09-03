import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tempUserData = path.join(os.tmpdir(), `pc-cleaner-db-test-${Date.now()}`);

vi.mock('electron', () => ({
    app: {
        getPath: (name: string) => {
            if (name === 'userData') return tempUserData;
            return os.tmpdir();
        }
    }
}));

const schedulesStore = new Map<string, any>();

vi.mock('better-sqlite3', () => {
    return {
        default: class MockDatabase {
            pragma = vi.fn();
            exec = vi.fn().mockImplementation((sql: string) => {
                if (sql.includes('DROP TABLE')) {
                    schedulesStore.clear();
                }
            });
            prepare = vi.fn().mockImplementation((sql: string) => ({
                run: vi.fn().mockImplementation((...args: any[]) => {
                    if (sql.includes('INSERT INTO schedules')) {
                        const item = { id: schedulesStore.size + 1, module: args[0], cron_expr: args[1], enabled: args[2] };
                        schedulesStore.set(args[0], item);
                        return { lastInsertRowid: item.id };
                    }
                    if (sql.includes('UPDATE schedules')) {
                        const existing = Array.from(schedulesStore.values()).find(s => s.id === args[2]);
                        if (existing) {
                            existing.cron_expr = args[0];
                            existing.enabled = args[1];
                        }
                        return { changes: 1 };
                    }
                    if (sql.includes('DELETE FROM schedules')) {
                        schedulesStore.delete(args[0]);
                        return { changes: 1 };
                    }
                    return { lastInsertRowid: 1 };
                }),
                all: vi.fn().mockImplementation(() => {
                    if (sql.includes('FROM schedules')) {
                        return Array.from(schedulesStore.values());
                    }
                    return [];
                }),
                get: vi.fn().mockImplementation((...args: any[]) => {
                    if (sql.includes('FROM schedules WHERE module = ?')) {
                        return schedulesStore.get(args[0]);
                    }
                    return undefined;
                })
            }));
            close = vi.fn();
        }
    };
});

import { initDatabase, resetDatabase, getDb } from './db';
import { logScanResult, logCleanHistory, logRestorePoint, saveSchedule, getSchedules, deleteSchedule } from './queries';

describe('Database layer', () => {
    beforeEach(() => {
        if (!fs.existsSync(tempUserData)) {
            fs.mkdirSync(tempUserData, { recursive: true });
        }
        initDatabase();
    });

    afterEach(() => {
        try {
            const db = getDb();
            db.close();
        } catch { /* ignore */ }
        fs.rmSync(tempUserData, { recursive: true, force: true });
    });

    it('creates tables and handles scan and clean logs', () => {
        const scanId = logScanResult({ module: 'DiskCleaner', itemsFound: 10, bytesFreed: 5000 });
        expect(scanId).toBeGreaterThan(0);

        const cleanId = logCleanHistory({ scanId, itemsRemoved: 8, bytesFreed: 4000 });
        expect(cleanId).toBeGreaterThan(0);

        const restoreId = logRestorePoint({ module: 'DuplicateFinder', filePath: 'C:\\restore\\file.tmp' });
        expect(restoreId).toBeGreaterThan(0);
    });

    it('saves, retrieves, and deletes schedules', () => {
        const schedId = saveSchedule('DiskCleaner', '0 2 * * *', true);
        expect(schedId).toBeGreaterThan(0);

        const schedules = getSchedules() as Array<{ module: string; cron_expr: string; enabled: number }>;
        const found = schedules.find(s => s.module === 'DiskCleaner');
        expect(found).toBeDefined();
        expect(found?.enabled).toBe(1);

        deleteSchedule('DiskCleaner');
        const afterDelete = getSchedules() as Array<{ module: string }>;
        expect(afterDelete.find(s => s.module === 'DiskCleaner')).toBeUndefined();
    });

    it('resetDatabase clears tables and removes physical restore directory', () => {
        const restoreDir = path.join(tempUserData, 'restore');
        fs.mkdirSync(restoreDir, { recursive: true });
        fs.writeFileSync(path.join(restoreDir, 'test-backup.reg'), 'reg content');
        expect(fs.existsSync(restoreDir)).toBe(true);

        resetDatabase();

        expect(fs.existsSync(restoreDir)).toBe(false);
        const schedules = getSchedules();
        expect(schedules.length).toBe(0);
    });
});
