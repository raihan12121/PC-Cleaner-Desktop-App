import { getDb } from './db';

interface ScanResultLog {
    module: string;
    itemsFound: number;
    bytesFreed: number;
}

export function logScanResult(data: ScanResultLog): number {
    const db = getDb();
    const info = db.prepare(
        'INSERT INTO scan_results (module, items_found, bytes_freed) VALUES (?, ?, ?)'
    ).run(data.module, data.itemsFound, data.bytesFreed);
    return info.lastInsertRowid as number;
}

interface CleanLog {
    scanId: number;
    itemsRemoved: number;
    bytesFreed: number;
}

interface RestorePointLog {
    module: string;
    filePath: string;
}

export function logCleanHistory(data: CleanLog): number {
    const db = getDb();
    const info = db.prepare(
        'INSERT INTO clean_history (scan_id, items_removed, bytes_freed) VALUES (?, ?, ?)'
    ).run(data.scanId, data.itemsRemoved, data.bytesFreed);
    return info.lastInsertRowid as number;
}

export function getScanTimeline() {
    const db = getDb();
    // Get last 7 days of cleaning data
    return db.prepare(`
    SELECT date(timestamp) as date, SUM(bytes_freed) as saved
    FROM clean_history
    GROUP BY date(timestamp)
    ORDER BY date(timestamp) DESC
    LIMIT 7
  `).all();
}

export function getScanResults() {
    return getDb().prepare('SELECT * FROM scan_results ORDER BY timestamp DESC, id DESC LIMIT 100').all();
}

export function logRestorePoint(data: RestorePointLog): number {
    const db = getDb();
    const info = db.prepare(
        'INSERT INTO restore_points (module, file_path) VALUES (?, ?)'
    ).run(data.module, data.filePath);
    return info.lastInsertRowid as number;
}

export function getSchedules() {
    return getDb().prepare('SELECT * FROM schedules ORDER BY id DESC').all();
}

export function saveSchedule(module: string, cronExpr: string, enabled: boolean): number {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM schedules WHERE module = ?').get(module) as { id: number } | undefined;
    if (existing) {
        db.prepare('UPDATE schedules SET cron_expr = ?, enabled = ? WHERE id = ?').run(cronExpr, enabled ? 1 : 0, existing.id);
        return existing.id;
    }
    const result = db.prepare('INSERT INTO schedules (module, cron_expr, enabled) VALUES (?, ?, ?)').run(module, cronExpr, enabled ? 1 : 0);
    return result.lastInsertRowid as number;
}

export function deleteSchedule(module: string): void {
    getDb().prepare('DELETE FROM schedules WHERE module = ?').run(module);
}

export function markScheduleRun(module: string): void {
    getDb().prepare("UPDATE schedules SET last_run = datetime('now', 'localtime') WHERE module = ?").run(module);
}
