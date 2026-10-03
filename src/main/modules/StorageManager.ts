import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import si from 'systeminformation';
import { shell } from 'electron';

export interface DriveInfo {
    letter: string;
    mount: string;
    label: string;
    fsType: string;
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usedPercentage: number;
    healthStatus: string;
    driveType: string;
    physicalDiskName?: string;
    physicalDiskType?: string;
}

export interface LargeFileInfo {
    id: string;
    path: string;
    name: string;
    size: number;
    extension: string;
    category: 'Video' | 'Archive' | 'Disk Image' | 'Document' | 'Executable' | 'Audio' | 'Other';
    modifiedTime: string;
}

export interface FolderSizeInfo {
    path: string;
    name: string;
    size: number;
    fileCount: number;
}

export interface LargeSpaceResult {
    targetPath: string;
    totalScannedFiles: number;
    totalScannedBytes: number;
    topFiles: LargeFileInfo[];
    topFolders: FolderSizeInfo[];
}

export interface InstalledAppInfo {
    id: string;
    name: string;
    version: string;
    publisher: string;
    location: string;
    size: number;
    installDate: string;
}

export class StorageManager {
    /**
     * Retrieve all mounted drives with storage usage, labels, and health status
     */
    async getDrives(): Promise<DriveInfo[]> {
        const [fsList, diskLayout] = await Promise.all([
            si.fsSize().catch((): si.Systeminformation.FsSizeData[] => []),
            si.diskLayout().catch((): si.Systeminformation.DiskLayoutData[] => [])
        ]);

        const volumeMap: Record<string, { FileSystemLabel?: string; HealthStatus?: string; DriveType?: string }> = {};

        if (process.platform === 'win32') {
            try {
                const psOutput = await new Promise<any[]>((resolve) => {
                    execFile(
                        'powershell.exe',
                        [
                            '-NoProfile',
                            '-NonInteractive',
                            '-Command',
                            'Get-Volume | Where-Object DriveLetter | Select-Object DriveLetter, FileSystemLabel, HealthStatus, DriveType | ConvertTo-Json'
                        ],
                        { timeout: 5000 },
                        (err, stdout) => {
                            if (err || !stdout) {
                                resolve([]);
                                return;
                            }
                            try {
                                const parsed = JSON.parse(stdout);
                                resolve(Array.isArray(parsed) ? parsed : [parsed]);
                            } catch {
                                resolve([]);
                            }
                        }
                    );
                });

                for (const vol of psOutput) {
                    if (vol?.DriveLetter) {
                        volumeMap[String(vol.DriveLetter).toUpperCase()] = vol;
                    }
                }
            } catch {
                // Ignore volume label fallback failure
            }
        }

        return fsList.map((item) => {
            const letter = (item.mount || item.fs || '').replace(/[/\\:]/g, '').toUpperCase();
            const vol = volumeMap[letter] || {};
            const total = Math.max(0, item.size || 0);
            const used = Math.max(0, item.used || 0);
            const free = Math.max(0, item.available || total - used);
            const calculatedUse = total > 0 ? (used / total) * 100 : 0;

            return {
                letter: letter ? `${letter}:` : item.mount,
                mount: item.mount || `${letter}:\\`,
                label: vol.FileSystemLabel || (letter === 'C' ? 'System' : 'Local Disk'),
                fsType: item.type || 'NTFS',
                totalBytes: total,
                usedBytes: used,
                freeBytes: free,
                usedPercentage: Math.min(100, Math.max(0, Number(item.use || calculatedUse.toFixed(1)))),
                healthStatus: vol.HealthStatus || 'Healthy',
                driveType: vol.DriveType || 'Fixed',
                physicalDiskName: diskLayout[0]?.name || diskLayout[0]?.vendor || 'Internal Storage',
                physicalDiskType: diskLayout[0]?.type || 'SSD'
            };
        });
    }

    /**
     * Categorize file extension into human readable category
     */
    private categorizeFile(ext: string): LargeFileInfo['category'] {
        const e = ext.toLowerCase();
        if (['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'].includes(e)) return 'Video';
        if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'].includes(e)) return 'Archive';
        if (['.iso', '.img', '.vmdk', '.vhd', '.vhdx', '.qcow2'].includes(e)) return 'Disk Image';
        if (['.exe', '.msi', '.dll', '.sys', '.bin'].includes(e)) return 'Executable';
        if (['.pdf', '.docx', '.xlsx', '.pptx', '.doc', '.xls', '.csv', '.txt'].includes(e)) return 'Document';
        if (['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'].includes(e)) return 'Audio';
        return 'Other';
    }

    /**
     * Scan drive or folder for top largest files and directory breakdown
     */
    async scanLargeFilesAndFolders(
        targetPath: string,
        maxDepth = 6,
        onProgress?: (progress: { filesScanned: number; currentDir: string }) => void
    ): Promise<LargeSpaceResult> {
        const resolvedPath = path.resolve(targetPath);
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`Target path does not exist: ${resolvedPath}`);
        }

        const topFiles: LargeFileInfo[] = [];
        const topFoldersMap = new Map<string, { size: number; count: number }>();
        let totalFilesScanned = 0;
        let totalBytesScanned = 0;
        let lastProgressTime = 0;

        const skipDirs = new Set([
            '$recycle.bin',
            'system volume information',
            'recovery',
            'winsxs',
            'msocache'
        ]);

        const walk = async (currentDir: string, depth: number, rootFolderKey?: string): Promise<number> => {
            if (depth > maxDepth) return 0;

            const now = Date.now();
            if (now - lastProgressTime > 250 && onProgress) {
                lastProgressTime = now;
                onProgress({ filesScanned: totalFilesScanned, currentDir });
            }

            let dirSizeBytes = 0;
            let entries: fs.Dirent[] = [];
            try {
                entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
            } catch {
                return 0; // Access denied or locked
            }

            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);

                try {
                    if (entry.isSymbolicLink()) {
                        continue;
                    }

                    if (entry.isDirectory()) {
                        if (skipDirs.has(entry.name.toLowerCase())) {
                            continue;
                        }

                        // Determine top level folder key
                        const key = depth === 0 ? fullPath : (rootFolderKey || fullPath);
                        const subSize = await walk(fullPath, depth + 1, key);
                        dirSizeBytes += subSize;

                        if (depth === 0) {
                            const cur = topFoldersMap.get(fullPath) || { size: 0, count: 0 };
                            cur.size += subSize;
                            topFoldersMap.set(fullPath, cur);
                        }
                    } else if (entry.isFile()) {
                        totalFilesScanned++;
                        try {
                            const stat = await fs.promises.stat(fullPath);
                            const fileSize = stat.size;
                            dirSizeBytes += fileSize;
                            totalBytesScanned += fileSize;

                            if (rootFolderKey) {
                                const cur = topFoldersMap.get(rootFolderKey);
                                if (cur) cur.count++;
                            }

                            // Keep files larger than 10MB or top 100 files
                            if (fileSize > 10 * 1024 * 1024 || topFiles.length < 50) {
                                const ext = path.extname(entry.name);
                                topFiles.push({
                                    id: Buffer.from(fullPath).toString('base64'),
                                    path: fullPath,
                                    name: entry.name,
                                    size: fileSize,
                                    extension: ext,
                                    category: this.categorizeFile(ext),
                                    modifiedTime: stat.mtime.toISOString()
                                });

                                // Maintain top 50 in memory
                                if (topFiles.length > 80) {
                                    topFiles.sort((a, b) => b.size - a.size);
                                    topFiles.splice(50);
                                }
                            }
                        } catch {
                            // File inaccessible
                        }
                    }
                } catch {
                    // Ignore transient entry errors
                }
            }

            return dirSizeBytes;
        };

        await walk(resolvedPath, 0);

        topFiles.sort((a, b) => b.size - a.size);

        const topFolders: FolderSizeInfo[] = Array.from(topFoldersMap.entries())
            .map(([folderPath, info]) => ({
                path: folderPath,
                name: path.basename(folderPath) || folderPath,
                size: info.size,
                fileCount: info.count
            }))
            .sort((a, b) => b.size - a.size)
            .slice(0, 15);

        return {
            targetPath: resolvedPath,
            totalScannedFiles: totalFilesScanned,
            totalScannedBytes: totalBytesScanned,
            topFiles: topFiles.slice(0, 50),
            topFolders
        };
    }

    /**
     * Retrieve list of installed applications and their storage footprint
     */
    async getInstalledApplications(): Promise<InstalledAppInfo[]> {
        if (process.platform !== 'win32') {
            return [];
        }

        const script = `
$paths = @(
    'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
    'HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
    'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
$apps = Get-ItemProperty $paths -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -and -not $_.SystemComponent -and -not $_.ParentKeyName } |
    Select-Object DisplayName, DisplayVersion, Publisher, InstallLocation, EstimatedSize, InstallDate

$appsList = @()
$seen = @{}
foreach ($a in $apps) {
    if ($seen[$a.DisplayName]) { continue }
    $seen[$a.DisplayName] = $true
    
    $sz = 0
    if ($a.EstimatedSize) {
        $sz = [int64]$a.EstimatedSize * 1024
    }
    $appsList += [PSCustomObject]@{
        name = $a.DisplayName
        version = $a.DisplayVersion
        publisher = $a.Publisher
        location = $a.InstallLocation
        size = $sz
        installDate = $a.InstallDate
    }
}
$appsList | ConvertTo-Json -Compress
`;

        return new Promise<InstalledAppInfo[]>((resolve) => {
            execFile(
                'powershell.exe',
                ['-NoProfile', '-NonInteractive', '-Command', script],
                { maxBuffer: 15 * 1024 * 1024, timeout: 12000 },
                (err, stdout) => {
                    if (err || !stdout) {
                        resolve([]);
                        return;
                    }

                    try {
                        const parsed = JSON.parse(stdout);
                        const list = Array.isArray(parsed) ? parsed : [parsed];

                        const results: InstalledAppInfo[] = list
                            .filter((item: any) => item && item.name && typeof item.name === 'string')
                            .map((item: any, index: number) => ({
                                id: `app_${index}_${Buffer.from(item.name).toString('base64').slice(0, 12)}`,
                                name: String(item.name).trim(),
                                version: item.version ? String(item.version).trim() : 'Unknown',
                                publisher: item.publisher ? String(item.publisher).trim() : 'Unknown Publisher',
                                location: item.location ? String(item.location).trim().replace(/^"|"$/g, '') : '',
                                size: Number(item.size || 0),
                                installDate: item.installDate ? String(item.installDate).trim() : ''
                            }))
                            .sort((a, b) => b.size - a.size);

                        resolve(results);
                    } catch {
                        resolve([]);
                    }
                }
            );
        });
    }

    /**
     * Safely reveal file or folder in Windows File Explorer
     */
    revealInExplorer(targetPath: string): boolean {
        if (!fs.existsSync(targetPath)) return false;
        shell.showItemInFolder(targetPath);
        return true;
    }

    /**
     * Open drive or folder in Windows File Explorer
     */
    async openPath(targetPath: string): Promise<string> {
        return shell.openPath(targetPath);
    }

    /**
     * Safely delete a large file requested by the user
     */
    async deleteFile(filePath: string): Promise<{ success: boolean; bytesFreed: number }> {
        const resolved = path.resolve(filePath);
        if (!fs.existsSync(resolved)) {
            throw new Error('File does not exist.');
        }

        const stat = await fs.promises.stat(resolved);
        if (stat.isDirectory()) {
            throw new Error('Directories cannot be deleted via file cleaner.');
        }

        await fs.promises.unlink(resolved);
        return { success: true, bytesFreed: stat.size };
    }
}
