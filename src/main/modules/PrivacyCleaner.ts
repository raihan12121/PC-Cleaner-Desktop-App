import { BaseModule, ScanItem, ScanResult, CleanResult } from './BaseModule';
import fs from 'fs';
import path from 'path';
import os from 'os';

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
                } catch (e) { /* ignore */ }
            }
        } catch (e) { /* ignore */ }
        return size;
    }

    async scan(): Promise<ScanResult> {
        const items: ScanItem[] = [];
        const isWin = os.platform() === 'win32';
        let totalBytes = 0;

        // VERY simplified mock logic. Real browser profile parsing requires SQLite readers for History/Cookies
        const pathsToCheck = [];

        if (isWin) {
            const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
            pathsToCheck.push({ id: 'chrome_hist', name: 'Chrome History & Cookies', path: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Network'), category: 'Browser Privacy' });
            pathsToCheck.push({ id: 'edge_hist', name: 'Edge History & Cookies', path: path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Network'), category: 'Browser Privacy' });
            pathsToCheck.push({ id: 'recent_docs', name: 'Recent Documents', path: path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Recent'), category: 'OS Privacy' });
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
        const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
        const allowedRoots = [
            path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Network'),
            path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Network'),
            path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Recent'),
        ];

        for (const item of items) {
            try {
                if (!allowedRoots.some(root => path.resolve(item.path) === path.resolve(root))) throw new Error('Privacy path is not a recognized cleanup target.');
                if (fs.existsSync(item.path)) {
                    await fs.promises.rm(item.path, { recursive: true, force: true });
                    itemsRemoved++;
                    bytesFreed += item.size;
                }
            } catch (e) {
                console.error(`Failed to clean privacy item ${item.name}`, e);
            }
        }

        return { itemsRemoved, bytesFreed, success: items.length === 0 || itemsRemoved === items.length };
    }

    async rollback(): Promise<void> {
        console.log('Rollback PrivacyCleaner');
    }
}
