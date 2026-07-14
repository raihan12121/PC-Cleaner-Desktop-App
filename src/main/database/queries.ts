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
