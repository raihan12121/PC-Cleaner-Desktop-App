import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    assertScanId,
    assertScanItems,
    assertSafeFile,
    assertSafeFileInRoots,
    isPathWithin,
    quotePowerShell,
    assertExistingDirectory
} from './validation';
import { ScanItem } from './modules/BaseModule';

const temporaryPaths: string[] = [];
afterEach(async () => {
    await Promise.all(temporaryPaths.splice(0).map(item => fs.promises.rm(item, { recursive: true, force: true })));
});

describe('IPC validation', () => {
    it('accepts valid scan items, clamps negative size overflows, and rejects malformed data', () => {
        expect(() => assertScanItems([{ id: '1', path: 'C:\\Temp\\a', name: 'a', size: 0, category: 'Temp', selected: true }])).not.toThrow();
        const overflowItem = [{ id: '1', path: 'C:\\Temp\\b', name: 'b', size: -512638641, category: 'Temp', selected: true }];
        assertScanItems(overflowItem);
        expect(overflowItem[0].size).toBe(0);
        expect(() => assertScanItems([{ id: '', path: 'x', name: 'x', size: 10, category: 'Temp', selected: true }])).toThrow();
        expect(() => assertScanItems(null)).toThrow();
    });

    it('accepts large item sets beyond 10,000 items', () => {
        const largeSet: ScanItem[] = [];
        for (let i = 0; i < 35000; i++) {
            largeSet.push({
                id: `item_${i}`,
                path: `C:\\Temp\\file_${i}.tmp`,
                name: `file_${i}.tmp`,
                size: 1024,
                category: 'Temp',
                selected: true
            });
        }
        expect(() => assertScanItems(largeSet)).not.toThrow();
    });

    it('requires a positive safe integer scan id', () => {
        expect(() => assertScanId(1)).not.toThrow();
        expect(() => assertScanId(0)).toThrow();
        expect(() => assertScanId('1')).toThrow();
    });

    it('recognizes containment without allowing parent traversal', () => {
        const root = path.join(os.tmpdir(), 'pc-cleaner-root');
        expect(isPathWithin(path.join(root, 'child.txt'), root)).toBe(true);
        expect(isPathWithin(path.join(root, '..', 'outside.txt'), root)).toBe(false);
    });

    it('only permits regular files under the allowed root', async () => {
        const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pc-cleaner-test-'));
        temporaryPaths.push(root);
        const file = path.join(root, 'safe.txt');
        await fs.promises.writeFile(file, 'safe');
        await expect(assertSafeFile(file, root)).resolves.toBeUndefined();
        await expect(assertSafeFile(path.join(root, 'missing.txt'), root)).rejects.toThrow();
        await expect(assertSafeFile(root, root)).rejects.toThrow();
    });

    it('supports assertSafeFileInRoots with multiple root directories', async () => {
        const root1 = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pc-cleaner-root1-'));
        const root2 = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pc-cleaner-root2-'));
        temporaryPaths.push(root1, root2);

        const file1 = path.join(root1, 'file1.txt');
        const file2 = path.join(root2, 'file2.txt');
        await fs.promises.writeFile(file1, 'data1');
        await fs.promises.writeFile(file2, 'data2');

        await expect(assertSafeFileInRoots(file1, [root1, root2])).resolves.toBeUndefined();
        await expect(assertSafeFileInRoots(file2, [root1, root2])).resolves.toBeUndefined();

        const outside = path.join(os.tmpdir(), 'outside.txt');
        await expect(assertSafeFileInRoots(outside, [root1, root2])).rejects.toThrow();
    });

    it('escapes PowerShell single-quoted strings', () => {
        expect(quotePowerShell("O'Reilly")).toBe("'O''Reilly'");
    });

    it('validates existing directories and rejects invalid paths', async () => {
        const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pc-cleaner-dir-'));
        temporaryPaths.push(root);
        expect(() => assertExistingDirectory(root)).not.toThrow();
        expect(() => assertExistingDirectory(path.join(root, 'nonexistent'))).toThrow();
        expect(() => assertExistingDirectory('relative/path')).toThrow();
    });
});
