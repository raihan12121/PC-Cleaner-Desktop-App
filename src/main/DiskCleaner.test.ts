import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DiskCleaner } from './modules/DiskCleaner';

// Mock electron app.getPath
vi.mock('electron', () => ({
    app: {
        getPath: (name: string) => {
            if (name === 'temp') return os.tmpdir();
            return os.tmpdir();
        }
    }
}));

const temporaryPaths: string[] = [];
afterEach(async () => {
    await Promise.all(temporaryPaths.splice(0).map(item => fs.promises.rm(item, { recursive: true, force: true }).catch(() => { /* ignore */ })));
});

describe('DiskCleaner Module', () => {
    it('scans and locates junk files in temp directories', async () => {
        const testDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pc-cleaner-disk-scan-'));
        temporaryPaths.push(testDir);

        const testFile1 = path.join(testDir, 'junk1.tmp');
        const testFile2 = path.join(testDir, 'junk2.tmp');
        await fs.promises.writeFile(testFile1, 'temporary content 1');
        await fs.promises.writeFile(testFile2, 'temporary content 2222');

        const cleaner = new DiskCleaner();
        const result = await cleaner.scan();

        expect(result.items.length).toBeGreaterThan(0);
        expect(result.totalBytes).toBeGreaterThan(0);

        const foundFile1 = result.items.find(i => path.resolve(i.path) === path.resolve(testFile1));
        const foundFile2 = result.items.find(i => path.resolve(i.path) === path.resolve(testFile2));

        expect(foundFile1).toBeDefined();
        expect(foundFile2).toBeDefined();
    });

    it('successfully deletes selected junk files from disk and returns removedItemIds', async () => {
        const testDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pc-cleaner-disk-clean-'));
        temporaryPaths.push(testDir);

        const testFile = path.join(testDir, 'deleteme.tmp');
        await fs.promises.writeFile(testFile, 'junk data to clean');
        const stat = await fs.promises.stat(testFile);

        const cleaner = new DiskCleaner();
        const scanItem = {
            id: Buffer.from(testFile).toString('base64'),
            path: testFile,
            name: 'deleteme.tmp',
            size: stat.size,
            category: 'User Temp Files',
            selected: true,
            metadata: { rootDir: testDir }
        };

        expect(fs.existsSync(testFile)).toBe(true);

        const cleanResult = await cleaner.clean([scanItem], { shred: false });

        expect(cleanResult.success).toBe(true);
        expect(cleanResult.itemsRemoved).toBe(1);
        expect(cleanResult.bytesFreed).toBe(stat.size);
        expect(cleanResult.removedItemIds).toContain(scanItem.id);
        expect(fs.existsSync(testFile)).toBe(false);
    });

    it('handles locked files gracefully without failing the entire cleanup', async () => {
        const testDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pc-cleaner-disk-lock-'));
        temporaryPaths.push(testDir);

        const safeFile = path.join(testDir, 'safe.tmp');
        await fs.promises.writeFile(safeFile, 'normal junk');
        const safeStat = await fs.promises.stat(safeFile);

        const cleaner = new DiskCleaner();
        const safeItem = {
            id: 'safe_item',
            path: safeFile,
            name: 'safe.tmp',
            size: safeStat.size,
            category: 'User Temp Files',
            selected: true,
            metadata: { rootDir: testDir }
        };

        const nonexistentItem = {
            id: 'nonexistent_item',
            path: path.join(testDir, 'does_not_exist.tmp'),
            name: 'does_not_exist.tmp',
            size: 500,
            category: 'User Temp Files',
            selected: true,
            metadata: { rootDir: testDir }
        };

        const cleanResult = await cleaner.clean([safeItem, nonexistentItem]);
        expect(cleanResult.success).toBe(true);
        expect(cleanResult.itemsRemoved).toBeGreaterThanOrEqual(1);
        expect(cleanResult.removedItemIds).toContain(safeItem.id);
        expect(fs.existsSync(safeFile)).toBe(false);
    });
});
