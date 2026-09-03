import { BaseModule, ScanItem, ScanResult, CleanResult } from './BaseModule';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { canonicalizePath } from '../validation';

export class PrivacyCleaner extends BaseModule {
    readonly moduleName = 'PrivacyCleaner';

    private async getDirectorySize(dir: string): Promise<number> {
        let size = 0;
        try {
            if (!fs.existsSync(dir)) return size;
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                try {
                    if (entry.isDirectory()) {
                        size += await this.getDirectorySize(fullPath);
                    } else {
                        const stat = await fs.promises.stat(fullPath);
                        size += stat.size;
                    }
                } catch { /* ignore */ }
            }
        } catch { /* ignore */ }
        return size;
    }

    async scan(): Promise<ScanResult> {
        const items: ScanItem[] = [];
        const isWin = os.platform() === 'win32';
        let totalBytes = 0;

        const pathsToCheck: Array<{ id: string; name: string; path: string; category: string }> = [];

        if (isWin) {
            const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
            pathsToCheck.push({ id: 'chrome_hist', name: 'Chrome History & Cookies', path: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Network'), category: 'Browser Privacy' });
            pathsToCheck.push({ id: 'edge_hist', name: 'Edge History & Cookies', path: path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Network'), category: 'Browser Privacy' });
            pathsToCheck.push({ id: 'recent_docs', name: 'Recent Documents', path: path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Recent'), category: 'OS Privacy' });
        } else {
            // macOS / Linux browser network caches
            pathsToCheck.push({ id: 'chrome_hist', name: 'Chrome History & Cookies', path: path.join(os.homedir(), '.config', 'google-chrome', 'Default', 'Network'), category: 'Browser Privacy' });
        }

        for (const p of pathsToCheck) {
            if (fs.existsSync(p.path)) {
                const size = await this.getDirectorySize(p.path);
                items.push({
                    id: p.id,
                    name: p.name,
                    path: p.path,
                    size,
                    category: p.category,
                    selected: true
                });
                totalBytes += size;
            }
        }

        return { items, totalBytes };
    }

    async clean(items: ScanItem[]): Promise<CleanResult> {
        let itemsRemoved = 0;
        let bytesFreed = 0;
        let skippedCount = 0;

        const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
        const allowedRoots = [
            path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Network'),
            path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Network'),
            path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Recent'),
            path.join(os.homedir(), '.config', 'google-chrome', 'Default', 'Network')
        ];

        for (const item of items) {
            try {
                const normItem = canonicalizePath(item.path);
                const isAllowed = allowedRoots.some(root => canonicalizePath(root) === normItem);
                if (!isAllowed) throw new Error('Privacy path is not a recognized cleanup target.');

                if (!fs.existsSync(item.path)) {
                    continue;
                }

                // If cleaning Recent Documents, clean only the files INSIDE the directory,
                // do NOT delete the Recent folder itself to avoid breaking Explorer Quick Access
                if (path.basename(item.path).toLowerCase() === 'recent') {
                    const entries = await fs.promises.readdir(item.path, { withFileTypes: true });
                    for (const entry of entries) {
                        const full = path.join(item.path, entry.name);
                        try {
                            if (entry.isDirectory()) {
                                await fs.promises.rm(full, { recursive: true, force: true });
                            } else {
                                await fs.promises.unlink(full);
                            }
                        } catch {
                            // File locked or in-use
                        }
                    }
                    itemsRemoved++;
                    bytesFreed += item.size;
                    continue;
                }

                // Normal privacy target: remove directory contents or directory
                try {
                    await fs.promises.rm(item.path, { recursive: true, force: true });
                    itemsRemoved++;
                    bytesFreed += item.size;
                } catch (rmErr) {
                    console.warn(`Could not clean locked privacy path ${item.path} (app may be open):`, rmErr);
                    skippedCount++;
                }
            } catch (e) {
                console.error(`Failed to clean privacy item ${item.name}:`, e);
                skippedCount++;
            }
        }

        return {
            itemsRemoved,
            bytesFreed,
            skippedCount,
            success: items.length === 0 || itemsRemoved > 0
        };
    }

    async rollback(): Promise<void> {
        console.log('Rollback PrivacyCleaner');
    }
}
