import { BaseModule, ScanItem, ScanResult, CleanResult } from './BaseModule';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';

export class DuplicateFinder extends BaseModule {
    readonly moduleName = 'DuplicateFinder';

    private async getFileHash(filePath: string, algorithm: 'md5' | 'sha256' = 'md5'): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash(algorithm);
            const stream = fs.createReadStream(filePath);

            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
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
        // Default to the user's Downloads or Documents folder if none provided
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
        for (const [size, files] of sizeGroups.entries()) {
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
                const hash = await this.getFileHash(file, 'sha256');
                const group = sha256Groups.get(hash) || [];
                group.push(file);
                sha256Groups.set(hash, group);
            }

            for (const exactMatches of sha256Groups.values()) {
                if (exactMatches.length < 2) continue;
                groupId++;

                // Keep the first file (don't select it), mark others for deletion
                for (let i = 0; i < exactMatches.length; i++) {
                    const filePath = exactMatches[i];
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
                    });
                }
            }
        }

        return { items, totalBytes };
    }

    async clean(items: ScanItem[]): Promise<CleanResult> {
        let itemsRemoved = 0;
        let bytesFreed = 0;

        // TODO: Copy to a restore folder before deletion? The instructions say "Back up to restore folder"
        const restoreDir = path.join(app.getPath('userData'), 'restore', 'duplicates');
        if (!fs.existsSync(restoreDir)) {
            await fs.promises.mkdir(restoreDir, { recursive: true });
        }

        for (const item of items) {
            try {
                if (fs.existsSync(item.path)) {
                    // Copy to restore dir
                    const backupPath = path.join(restoreDir, `${Date.now()}_${item.name}`);
                    await fs.promises.copyFile(item.path, backupPath);

                    // Log to restore_points DB table (todo)

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
            success: itemsRemoved === items.length,
        };
    }

    async rollback(): Promise<void> {
        // Actually implementing complete rollback would require restoring everything from the restore directory based on db records
        // This is a stub for the interface requirements.
        console.log('Rollback called for DuplicateFinder');
    }
}
