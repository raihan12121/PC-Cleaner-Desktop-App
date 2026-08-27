import { BaseModule, ScanItem, ScanResult, CleanResult } from './BaseModule';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { assertSafeFile } from '../validation';

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
                            metadata: { rootDir: dir }
                        });
                    }
                } catch {
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

        // Calculate total size
        let totalBytes = 0;
        for (const item of items) {
            totalBytes += item.size;
        }

        return { items, totalBytes };
    }

    private async secureDelete(filePath: string): Promise<void> {
        const stat = await fs.promises.stat(filePath);

        // Reset read-only attribute if present
        await fs.promises.chmod(filePath, 0o666).catch(() => {});

        // 3-pass wipe if non-empty
        if (stat.size > 0) {
            for (let i = 0; i < 3; i++) {
                const buffer = crypto.randomBytes(4096);
                const fd = await fs.promises.open(filePath, 'r+');
                try {
                    let written = 0;
                    while (written < stat.size) {
                        const toWrite = Math.min(buffer.length, stat.size - written);
                        const { bytesWritten } = await fd.write(buffer, 0, toWrite, written);
                        if (bytesWritten === 0) break;
                        written += bytesWritten;
                    }
                    await fd.sync();
                } finally {
                    await fd.close();
                }
            }
        }
        await fs.promises.unlink(filePath);
    }

    async clean(items: ScanItem[]): Promise<CleanResult> {
        let itemsRemoved = 0;
        let bytesFreed = 0;
        const tempDir = app.getPath('temp');

        for (const item of items) {
            try {
                await assertSafeFile(item.path, tempDir);
                if (fs.existsSync(item.path)) {
                    try {
                        await this.secureDelete(item.path);
                    } catch {
                        // Fallback to direct unlink if shredding write fails (e.g. read-only or in-use wipe restriction)
                        await fs.promises.chmod(item.path, 0o666).catch(() => {});
                        await fs.promises.unlink(item.path);
                    }
                    itemsRemoved++;
                    bytesFreed += item.size;
                }
            } catch (e) {
                // File may be locked by a running process in the OS
                console.warn(`Skipped locked/inaccessible file ${item.path}:`, e);
            }
        }

        return {
            itemsRemoved,
            bytesFreed,
            success: items.length === 0 || itemsRemoved === items.length,
        };
    }

    async rollback(): Promise<void> {
        throw new Error('Shredded files are irreversible. Rollback is not supported for DiskCleaner.');
    }
}
