import { BaseModule, ScanItem, ScanResult, CleanResult } from './BaseModule';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export class DiskCleaner extends BaseModule {
    readonly moduleName = 'DiskCleaner';

    private async walkDir(dir: string, category: string): Promise<ScanItem[]> {
        const items: ScanItem[] = [];
        try {
            if (!fs.existsSync(dir)) return items;

            const entries = await fs.promises.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                try {
                    if (entry.isDirectory()) {
                        const subItems = await this.walkDir(fullPath, category);
                        items.push(...subItems);
                    } else {
                        const stat = await fs.promises.stat(fullPath);
                        items.push({
                            id: Buffer.from(fullPath).toString('base64'),
                            path: fullPath,
                            name: entry.name,
                            size: stat.size,
                            category,
                            selected: true, // Default to selected
                        });
                    }
                } catch (e) {
                    // Ignore files we don't have permission to read
                }
            }
        } catch (e) {
            console.error(`Error walking directory ${dir}:`, e);
        }
        return items;
    }

    async scan(): Promise<ScanResult> {
        const items: ScanItem[] = [];

        // System Temp Files
        const tempDir = app.getPath('temp');
        const tempItems = await this.walkDir(tempDir, 'System Temp Files');
        items.push(...tempItems);

        // Recycle Bin abstraction (Windows typically, simplified here)
        // Actual Recycle Bin reading requires native modules or powershell,
        // so we'll stick to basic temp files and app cache for now as a primary example.

        // Calculate total size
        let totalBytes = 0;
        for (const item of items) {
            totalBytes += item.size;
        }

        return { items, totalBytes };
    }

    private async secureDelete(filePath: string): Promise<void> {
        const stat = await fs.promises.stat(filePath);

        // 3-pass wipe
        for (let i = 0; i < 3; i++) {
            const buffer = crypto.randomBytes(4096);
            const fd = await fs.promises.open(filePath, 'r+');
            let written = 0;
            while (written < stat.size) {
                const toWrite = Math.min(buffer.length, stat.size - written);
                await fd.write(buffer, 0, toWrite, written);
                written += toWrite;
            }
            await fd.sync();
            await fd.close();
        }
        await fs.promises.unlink(filePath);
    }

    async clean(items: ScanItem[]): Promise<CleanResult> {
        let itemsRemoved = 0;
        let bytesFreed = 0;

        for (const item of items) {
            try {
                if (fs.existsSync(item.path)) {
                    // Always use secure delete per safety rules
                    await this.secureDelete(item.path);
                    itemsRemoved++;
                    bytesFreed += item.size;
                }
            } catch (e) {
                console.error(`Failed to delete ${item.path}:`, e);
            }
        }

        // TODO: log to database clean_history

        return {
            itemsRemoved,
            bytesFreed,
            success: itemsRemoved === items.length,
        };
    }

    async rollback(): Promise<void> {
        throw new Error('Shredded files are irreversible. Rollback is not supported for DiskCleaner.');
    }
}
