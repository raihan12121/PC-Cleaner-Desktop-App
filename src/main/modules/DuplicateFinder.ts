import { BaseModule, ScanItem, ScanResult, CleanResult } from './BaseModule';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import { assertSafeFile } from '../validation';
import { logRestorePoint } from '../database/queries';

export class DuplicateFinder extends BaseModule {
    readonly moduleName = 'DuplicateFinder';

    private async getFileHash(filePath: string, algorithm: 'md5' | 'sha256' = 'md5'): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash(algorithm);
            const stream = fs.createReadStream(filePath);

            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', (err) => {
                stream.destroy();
                reject(err);
            });
        });
    }

    private async walkDir(dir: string): Promise<string[]> {
        const files: string[] = [];
        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    files.push(...await this.walkDir(fullPath));
                } else {
                    files.push(fullPath);
                }
            }
        } catch (e) {
            // Skip inaccessible folders
        }
        return files;
    }

    async scan(options?: { directory: string }): Promise<ScanResult> {
        // Default to the user's Downloads folder if none provided
        const targetDir = options?.directory || app.getPath('downloads');
        const allFiles = await this.walkDir(targetDir);

        // 1. Group by size first (fast)
        const sizeGroups = new Map<number, string[]>();
        for (const file of allFiles) {
            try {
                const stat = await fs.promises.stat(file);
                if (stat.size === 0) continue; // ignore empty files
                const group = sizeGroups.get(stat.size) || [];
                group.push(file);
                sizeGroups.set(stat.size, group);
            } catch (e) {
                // ignore
            }
        }

        // 2. Group by MD5 hash
        const md5Groups = new Map<string, string[]>();
        for (const files of sizeGroups.values()) {
            if (files.length < 2) continue; // Only hash if at least 2 files have same size

            for (const file of files) {
                try {
                    const hash = await this.getFileHash(file, 'md5');
                    const group = md5Groups.get(hash) || [];
                    group.push(file);
                    md5Groups.set(hash, group);
                } catch (e) {
                    // ignore
                }
            }
        }

        // 3. Final confirmation with SHA-256 for sets with >1 file
        const items: ScanItem[] = [];
        let totalBytes = 0;
        let groupId = 0;

        for (const files of md5Groups.values()) {
            if (files.length < 2) continue;

            const sha256Groups = new Map<string, string[]>();
            for (const file of files) {
                try {
                    const hash = await this.getFileHash(file, 'sha256');
                    const group = sha256Groups.get(hash) || [];
                    group.push(file);
                    sha256Groups.set(hash, group);
                } catch (e) {
                    // ignore
                }
            }

            for (const exactMatches of sha256Groups.values()) {
                if (exactMatches.length < 2) continue;
                groupId++;

                // Keep the first file (don't select it), mark others for deletion
                for (let i = 0; i < exactMatches.length; i++) {
                    const filePath = exactMatches[i];
                    try {
                        const stat = await fs.promises.stat(filePath);

                        if (i > 0) {
                            totalBytes += stat.size;
                        }

                        items.push({
                            id: Buffer.from(filePath).toString('base64'),
                            path: filePath,
                            name: path.basename(filePath),
                            size: stat.size,
                            category: `Duplicate Set ${groupId}`,
                            selected: i > 0, // Select all but the first one for deletion
                            metadata: { rootDir: targetDir }
                        });
                    } catch (e) {
                        // ignore
                    }
                }
            }
        }

        return { items, totalBytes };
    }

    async clean(items: ScanItem[]): Promise<CleanResult> {
        let itemsRemoved = 0;
        let bytesFreed = 0;

        const restoreDir = path.join(app.getPath('userData'), 'restore', 'duplicates');
        if (!fs.existsSync(restoreDir)) {
            await fs.promises.mkdir(restoreDir, { recursive: true });
        }

        for (const item of items) {
            try {
                if (fs.existsSync(item.path)) {
                    const allowedRoot = (item.metadata && typeof item.metadata.rootDir === 'string')
                        ? item.metadata.rootDir
                        : app.getPath('downloads');
                    await assertSafeFile(item.path, allowedRoot);

                    const fileId = `${Date.now()}_${crypto.randomUUID()}`;
                    const backupPath = path.join(restoreDir, `${fileId}_${item.name}`);
                    const metaPath = path.join(restoreDir, `${fileId}_${item.name}.meta.json`);

                    await fs.promises.copyFile(item.path, backupPath);
                    await fs.promises.writeFile(metaPath, JSON.stringify({
                        originalPath: item.path,
                        name: item.name,
                        size: item.size,
                        timestamp: Date.now()
                    }, null, 2), 'utf8');

                    logRestorePoint({ module: this.moduleName, filePath: backupPath });

                    // Delete original
                    await fs.promises.unlink(item.path);
                    itemsRemoved++;
                    bytesFreed += item.size;
                }
            } catch (e) {
                console.error(`Failed to delete duplicate ${item.path}:`, e);
            }
        }

        return {
            itemsRemoved,
            bytesFreed,
            success: items.length === 0 || itemsRemoved === items.length,
        };
    }

    async rollback(): Promise<void> {
        const restoreDir = path.join(app.getPath('userData'), 'restore', 'duplicates');
        if (!fs.existsSync(restoreDir)) {
            throw new Error('No duplicate backups found to restore.');
        }

        const entries = await fs.promises.readdir(restoreDir);
        const metaFiles = entries.filter(f => f.endsWith('.meta.json'));

        if (metaFiles.length === 0) {
            throw new Error('No duplicate restore points found.');
        }

        for (const metaFile of metaFiles) {
            try {
                const metaPath = path.join(restoreDir, metaFile);
                const meta = JSON.parse(await fs.promises.readFile(metaPath, 'utf8'));
                const backupFile = metaPath.replace(/\.meta\.json$/, '');

                if (fs.existsSync(backupFile) && meta.originalPath) {
                    const parentDir = path.dirname(meta.originalPath);
                    if (!fs.existsSync(parentDir)) {
                        await fs.promises.mkdir(parentDir, { recursive: true });
                    }

                    // Restore to original location if not currently existing
                    if (!fs.existsSync(meta.originalPath)) {
                        await fs.promises.copyFile(backupFile, meta.originalPath);
                    }

                    // Clean up restore file
                    await fs.promises.unlink(backupFile).catch(() => { /* ignore */ });
                    await fs.promises.unlink(metaPath).catch(() => { /* ignore */ });
                }
            } catch (err) {
                console.warn(`Failed to restore duplicate backup ${metaFile}:`, err);
            }
        }
    }
}
