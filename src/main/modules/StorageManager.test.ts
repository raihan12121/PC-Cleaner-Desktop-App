import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StorageManager } from './StorageManager';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('electron', () => ({
    shell: {
        showItemInFolder: vi.fn(),
        openPath: vi.fn().mockResolvedValue('')
    }
}));

describe('StorageManager Module', () => {
    let storageManager: StorageManager;

    beforeEach(() => {
        storageManager = new StorageManager();
    });

    it('retrieves drive storage overview with formatted fields', async () => {
        const drives = await storageManager.getDrives();
        expect(Array.isArray(drives)).toBe(true);
        if (drives.length > 0) {
            const drive = drives[0];
            expect(drive).toHaveProperty('letter');
            expect(drive).toHaveProperty('totalBytes');
            expect(drive).toHaveProperty('usedBytes');
            expect(drive).toHaveProperty('freeBytes');
            expect(drive).toHaveProperty('usedPercentage');
            expect(drive.totalBytes).toBeGreaterThanOrEqual(drive.usedBytes);
        }
    }, 15000);

    it('scans large files and folders in a test directory', async () => {
        const tempTestDir = path.join(os.tmpdir(), `pc-cleaner-storage-test-${Date.now()}`);
        fs.mkdirSync(tempTestDir, { recursive: true });

        const subDir = path.join(tempTestDir, 'SubFolder');
        fs.mkdirSync(subDir, { recursive: true });

        const sampleLargeFile = path.join(subDir, 'test-video.mp4');
        fs.writeFileSync(sampleLargeFile, Buffer.alloc(1024 * 1024 * 2, 'a')); // 2MB

        const result = await storageManager.scanLargeFilesAndFolders(tempTestDir, 4);

        expect(result.targetPath).toBe(path.resolve(tempTestDir));
        expect(result.totalScannedFiles).toBeGreaterThanOrEqual(1);
        expect(result.topFiles.length).toBeGreaterThanOrEqual(1);
        expect(result.topFiles[0].category).toBe('Video');
        expect(result.topFiles[0].size).toBe(1024 * 1024 * 2);

        // Cleanup
        fs.rmSync(tempTestDir, { recursive: true, force: true });
    });

    it('safely deletes file and rejects directories', async () => {
        const tempTestDir = path.join(os.tmpdir(), `pc-cleaner-delete-test-${Date.now()}`);
        fs.mkdirSync(tempTestDir, { recursive: true });

        const testFile = path.join(tempTestDir, 'to-delete.tmp');
        fs.writeFileSync(testFile, 'hello storage cleaner');

        const deleteResult = await storageManager.deleteFile(testFile);
        expect(deleteResult.success).toBe(true);
        expect(deleteResult.bytesFreed).toBe(21);
        expect(fs.existsSync(testFile)).toBe(false);

        await expect(storageManager.deleteFile(tempTestDir)).rejects.toThrow(
            'Directories cannot be deleted via file cleaner.'
        );

        fs.rmSync(tempTestDir, { recursive: true, force: true });
    });
});
