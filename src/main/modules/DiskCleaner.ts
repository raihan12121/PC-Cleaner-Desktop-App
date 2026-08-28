import { BaseModule, ScanItem, ScanResult, CleanResult } from './BaseModule';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { assertSafeFileInRoots, canonicalizePath } from '../validation';

const execFileAsync = promisify(execFile);

export class DiskCleaner extends BaseModule {
    readonly moduleName = 'DiskCleaner';

    private getAllowedRoots(): string[] {
        const roots: string[] = [];
        const isWin = os.platform() === 'win32';

        // User Temp
        try {
            roots.push(app.getPath('temp'));
        } catch { /* ignore */ }
        if (os.tmpdir()) roots.push(os.tmpdir());
        if (process.env.TEMP) roots.push(process.env.TEMP);
        if (process.env.TMP) roots.push(process.env.TMP);

        if (isWin) {
            const systemRoot = process.env.SystemRoot || 'C:\\Windows';
            const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
            const programData = process.env.ProgramData || 'C:\\ProgramData';

            // System Temp
            roots.push(path.join(systemRoot, 'Temp'));

            // Crash Dumps & WER
            roots.push(path.join(localAppData, 'CrashDumps'));
            roots.push(path.join(programData, 'Microsoft', 'Windows', 'WER', 'ReportQueue'));
            roots.push(path.join(programData, 'Microsoft', 'Windows', 'WER', 'ReportArchive'));
            roots.push(path.join(systemRoot, 'Minidump'));

            // Windows Update Downloads
            roots.push(path.join(systemRoot, 'SoftwareDistribution', 'Download'));

            // Shader Caches
            roots.push(path.join(localAppData, 'D3DSCache'));
            roots.push(path.join(localAppData, 'NVIDIA', 'GLCache'));
            roots.push(path.join(localAppData, 'AMD', 'DxCache'));

            // Browser Caches
            roots.push(path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Cache'));
            roots.push(path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Code Cache'));
            roots.push(path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'));
            roots.push(path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Code Cache'));
            roots.push(path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'Cache'));
            roots.push(path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'Code Cache'));
        } else {
            // macOS / Linux caches
            roots.push(path.join(os.homedir(), '.cache'));
            roots.push(path.join(os.homedir(), 'Library', 'Caches'));
        }

        // Return unique, canonicalized roots
        const seen = new Set<string>();
        const validRoots: string[] = [];
        for (const root of roots) {
            try {
                const norm = canonicalizePath(root);
                if (!seen.has(norm)) {
                    seen.add(norm);
                    validRoots.push(root);
                }
            } catch {
                // ignore
            }
        }

        return validRoots;
    }

    private async walkDir(dir: string, category: string, maxDepth = 8, currentDepth = 0): Promise<ScanItem[]> {
        const items: ScanItem[] = [];
        if (currentDepth > maxDepth) return items;

        try {
            if (!fs.existsSync(dir)) return items;

            const entries = await fs.promises.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                try {
                    if (entry.isDirectory()) {
                        const subItems = await this.walkDir(fullPath, category, maxDepth, currentDepth + 1);
                        items.push(...subItems);
                    } else {
                        const stat = await fs.promises.stat(fullPath);
                        items.push({
                            id: Buffer.from(fullPath).toString('base64'),
                            path: fullPath,
                            name: entry.name,
                            size: stat.size,
                            category,
                            selected: true,
                            metadata: { rootDir: dir }
                        });
                    }
                } catch {
                    // Skip files/directories we don't have permission to read
                }
            }
        } catch {
            // Ignore access errors on protected directories
        }
        return items;
    }

    private async scanRecycleBin(): Promise<ScanItem | null> {
        if (os.platform() !== 'win32') return null;

        try {
            const psScript = `
                $rb = (New-Object -ComObject Shell.Application).NameSpace(0xa)
                $count = $rb.Items().Count
                $size = ($rb.Items() | Measure-Object -Property Size -Sum).Sum
                [PSCustomObject]@{ Count = if ($count) { $count } else { 0 }; Size = if ($size) { $size } else { 0 } } | ConvertTo-Json
            `;
            const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript]);
            if (stdout.trim()) {
                const parsed = JSON.parse(stdout);
                const count = Number(parsed.Count) || 0;
                const size = Number(parsed.Size) || 0;

                if (count > 0 || size > 0) {
                    return {
                        id: 'recycle_bin_windows',
                        path: 'RecycleBin://',
                        name: `Windows Recycle Bin (${count} item${count === 1 ? '' : 's'})`,
                        size,
                        category: 'Recycle Bin',
                        selected: true,
                        metadata: { isRecycleBin: true, count }
                    };
                }
            }
        } catch (e) {
            console.warn('Could not query Recycle Bin:', e);
        }
        return null;
    }

    async scan(): Promise<ScanResult> {
        const items: ScanItem[] = [];
        const isWin = os.platform() === 'win32';

        const scanTargets: Array<{ dir: string; category: string }> = [];

        // 1. User Temp
        try {
            const userTemp = app.getPath('temp');
            scanTargets.push({ dir: userTemp, category: 'User Temp Files' });
        } catch {
            scanTargets.push({ dir: os.tmpdir(), category: 'User Temp Files' });
        }

        if (isWin) {
            const systemRoot = process.env.SystemRoot || 'C:\\Windows';
            const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
            const programData = process.env.ProgramData || 'C:\\ProgramData';

            // 2. System Temp
            scanTargets.push({ dir: path.join(systemRoot, 'Temp'), category: 'System Temp Files' });

            // 3. Crash Dumps & Error Reports
            scanTargets.push({ dir: path.join(localAppData, 'CrashDumps'), category: 'Windows Crash Dumps' });
            scanTargets.push({ dir: path.join(programData, 'Microsoft', 'Windows', 'WER', 'ReportQueue'), category: 'Error Reports' });
            scanTargets.push({ dir: path.join(programData, 'Microsoft', 'Windows', 'WER', 'ReportArchive'), category: 'Error Reports' });
            scanTargets.push({ dir: path.join(systemRoot, 'Minidump'), category: 'Memory Dumps' });

            // 4. Windows Update Download Cache
            scanTargets.push({ dir: path.join(systemRoot, 'SoftwareDistribution', 'Download'), category: 'Windows Update Cache' });

            // 5. Shader Caches
            scanTargets.push({ dir: path.join(localAppData, 'D3DSCache'), category: 'DirectX Shader Cache' });
            scanTargets.push({ dir: path.join(localAppData, 'NVIDIA', 'GLCache'), category: 'GPU Shader Cache' });

            // 6. Browser Caches
            scanTargets.push({ dir: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Cache', 'Cache_Data'), category: 'Browser Cache (Chrome)' });
            scanTargets.push({ dir: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Code Cache'), category: 'Browser Cache (Chrome)' });
            scanTargets.push({ dir: path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache', 'Cache_Data'), category: 'Browser Cache (Edge)' });
            scanTargets.push({ dir: path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Code Cache'), category: 'Browser Cache (Edge)' });
            scanTargets.push({ dir: path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'Cache', 'Cache_Data'), category: 'Browser Cache (Brave)' });
        }

        // Run scans in parallel
        const results = await Promise.all(
            scanTargets.map(target => this.walkDir(target.dir, target.category))
        );

        for (const list of results) {
            items.push(...list);
        }

        // Scan Recycle Bin
        const recycleBinItem = await this.scanRecycleBin();
        if (recycleBinItem) {
            items.push(recycleBinItem);
        }

        // Deduplicate items by path
        const uniqueItems: ScanItem[] = [];
        const seenPaths = new Set<string>();
        for (const item of items) {
            const key = item.path.toLowerCase();
            if (!seenPaths.has(key)) {
                seenPaths.add(key);
                uniqueItems.push(item);
            }
        }

        // Calculate total size
        let totalBytes = 0;
        for (const item of uniqueItems) {
            totalBytes += item.size;
        }

        return { items: uniqueItems, totalBytes };
    }

    private async secureDelete(filePath: string): Promise<void> {
        const stat = await fs.promises.stat(filePath);
        await fs.promises.chmod(filePath, 0o666).catch(() => { /* ignore chmod error */ });

        if (stat.size > 0) {
            const chunkSize = Math.min(stat.size, 65536);
            const buffer = crypto.randomBytes(chunkSize);
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
        await fs.promises.unlink(filePath);
    }

    private async cleanSingleFile(item: ScanItem, allowedRoots: string[], shred: boolean): Promise<boolean> {
        try {
            await assertSafeFileInRoots(item.path, allowedRoots);
            if (!fs.existsSync(item.path)) {
                return true; // Already gone
            }

            // Remove read-only attribute on Windows
            await fs.promises.chmod(item.path, 0o666).catch(() => { /* ignore */ });

            if (shred) {
                try {
                    await this.secureDelete(item.path);
                    return true;
                } catch {
                    // Fallback to unlink if shred write fails
                    await fs.promises.chmod(item.path, 0o666).catch(() => { /* ignore */ });
                    await fs.promises.unlink(item.path);
                    return true;
                }
            } else {
                await fs.promises.unlink(item.path);
                return true;
            }
        } catch {
            // File is locked or in-use by an active process
            return false;
        }
    }

    private async pruneEmptyDirs(dir: string, maxDepth = 4, currentDepth = 0): Promise<void> {
        if (currentDepth > maxDepth || !fs.existsSync(dir)) return;
        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const subDir = path.join(dir, entry.name);
                    await this.pruneEmptyDirs(subDir, maxDepth, currentDepth + 1);
                    try {
                        await fs.promises.rmdir(subDir);
                    } catch {
                        // Directory is not empty or locked
                    }
                }
            }
        } catch {
            // ignore
        }
    }

    async clean(items: ScanItem[], options?: { shred?: boolean }): Promise<CleanResult> {
        let itemsRemoved = 0;
        let bytesFreed = 0;
        let skippedCount = 0;
        const removedItemIds: string[] = [];
        const allowedRoots = this.getAllowedRoots();
        const shred = !!options?.shred;

        // Separate Recycle Bin from normal files
        const normalFiles: ScanItem[] = [];
        let hasRecycleBin = false;
        let recycleBinItem: ScanItem | null = null;

        for (const item of items) {
            if (item.metadata?.isRecycleBin || item.path === 'RecycleBin://') {
                hasRecycleBin = true;
                recycleBinItem = item;
            } else {
                normalFiles.push(item);
            }
        }

        // Clean Recycle Bin if selected
        if (hasRecycleBin && recycleBinItem) {
            try {
                if (os.platform() === 'win32') {
                    await execFileAsync('powershell.exe', [
                        '-NoProfile',
                        '-NonInteractive',
                        '-Command',
                        'Clear-RecycleBin -Force -ErrorAction SilentlyContinue'
                    ]);
                }
                itemsRemoved++;
                bytesFreed += recycleBinItem.size;
                removedItemIds.push(recycleBinItem.id);
            } catch (e) {
                console.warn('Failed to empty Recycle Bin:', e);
                skippedCount++;
            }
        }

        // Process files concurrently in batches of 50
        const CONCURRENCY = 50;
        const touchedDirs = new Set<string>();

        for (let i = 0; i < normalFiles.length; i += CONCURRENCY) {
            const batch = normalFiles.slice(i, i + CONCURRENCY);
            const results = await Promise.all(
                batch.map(async item => {
                    const success = await this.cleanSingleFile(item, allowedRoots, shred);
                    return { item, success };
                })
            );

            for (const { item, success } of results) {
                if (success) {
                    itemsRemoved++;
                    bytesFreed += item.size;
                    removedItemIds.push(item.id);
                    touchedDirs.add(path.dirname(item.path));
                } else {
                    skippedCount++;
                }
            }
        }

        // Prune empty subdirectories in cleaned locations asynchronously in the background
        const pruneRoots = [app.getPath('temp'), os.tmpdir()];
        for (const root of pruneRoots) {
            this.pruneEmptyDirs(root).catch(() => { /* ignore */ });
        }

        return {
            itemsRemoved,
            bytesFreed,
            skippedCount,
            removedItemIds,
            success: true
        };
    }

    async rollback(): Promise<void> {
        throw new Error('Deleted junk files cannot be restored.');
    }
}
