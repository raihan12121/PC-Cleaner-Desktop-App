import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { assertScanId, assertScanItems, assertSafeFile, isPathWithin, quotePowerShell } from './validation';

const temporaryPaths: string[] = [];
afterEach(async () => {
    await Promise.all(temporaryPaths.splice(0).map(item => fs.promises.rm(item, { recursive: true, force: true })));
});

describe('IPC validation', () => {
    it('accepts valid scan items and rejects malformed or negative data', () => {
        expect(() => assertScanItems([{ id: '1', path: 'C:\\Temp\\a', name: 'a', size: 0, category: 'Temp', selected: true }])).not.toThrow();
        expect(() => assertScanItems([{ id: '1', path: 'x', name: 'x', size: -1, category: 'Temp', selected: true }])).toThrow();
        expect(() => assertScanItems(null)).toThrow();
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

    it('escapes PowerShell single-quoted strings', () => {
        expect(quotePowerShell("O'Reilly")).toBe("'O''Reilly'");
    });

    it('validates existing directories and rejects invalid paths', async () => {
        const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pc-cleaner-dir-'));
        temporaryPaths.push(root);
        const { assertExistingDirectory } = await import('./validation');
        expect(() => assertExistingDirectory(root)).not.toThrow();
        expect(() => assertExistingDirectory(path.join(root, 'nonexistent'))).toThrow();
        expect(() => assertExistingDirectory('relative/path')).toThrow();
    });
});
