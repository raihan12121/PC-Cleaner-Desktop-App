import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tempUserData = path.join(os.tmpdir(), `pc-cleaner-dup-test-${Date.now()}`);
const tempTargetDir = path.join(os.tmpdir(), `pc-cleaner-dup-target-${Date.now()}`);

vi.mock('electron', () => ({
    app: {
        getPath: (name: string) => {
            if (name === 'userData') return tempUserData;
            if (name === 'downloads') return tempTargetDir;
            return os.tmpdir();
        }
    }
}));

vi.mock('../database/queries', () => ({
    logRestorePoint: vi.fn().mockReturnValue(1)
}));

import { DuplicateFinder } from './DuplicateFinder';

describe('DuplicateFinder Module', () => {
    beforeEach(() => {
        fs.mkdirSync(tempUserData, { recursive: true });
        fs.mkdirSync(tempTargetDir, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tempUserData, { recursive: true, force: true });
        fs.rmSync(tempTargetDir, { recursive: true, force: true });
    });

    it('clean creates backup with metadata and unlinks original file', async () => {
        const testFile = path.join(tempTargetDir, 'duplicate_sample.txt');
        fs.writeFileSync(testFile, 'identical content for test');
        const stat = fs.statSync(testFile);

        const finder = new DuplicateFinder();
        const scanItem = {
            id: 'dup_1',
            name: 'duplicate_sample.txt',
            path: testFile,
            size: stat.size,
            category: 'Duplicate Set 1',
            selected: true,
            metadata: { rootDir: tempTargetDir }
        };

        const result = await finder.clean([scanItem]);
        expect(result.success).toBe(true);
        expect(result.itemsRemoved).toBe(1);
        expect(fs.existsSync(testFile)).toBe(false);

        const restoreDir = path.join(tempUserData, 'restore', 'duplicates');
        expect(fs.existsSync(restoreDir)).toBe(true);

        const metaFiles = fs.readdirSync(restoreDir).filter(f => f.endsWith('.meta.json'));
        expect(metaFiles.length).toBe(1);

        const meta = JSON.parse(fs.readFileSync(path.join(restoreDir, metaFiles[0]), 'utf8'));
        expect(meta.originalPath).toBe(testFile);
    });

    it('rollback restores the backed up duplicate file to its original path', async () => {
        const testFile = path.join(tempTargetDir, 'restore_me.txt');
        fs.writeFileSync(testFile, 'file content before clean');
        const stat = fs.statSync(testFile);

        const finder = new DuplicateFinder();
        const scanItem = {
            id: 'dup_restore_1',
            name: 'restore_me.txt',
            path: testFile,
            size: stat.size,
            category: 'Duplicate Set 1',
            selected: true,
            metadata: { rootDir: tempTargetDir }
        };

        // Clean to create backup
        await finder.clean([scanItem]);
        expect(fs.existsSync(testFile)).toBe(false);

        // Rollback
        await finder.rollback();
        expect(fs.existsSync(testFile)).toBe(true);
        expect(fs.readFileSync(testFile, 'utf8')).toBe('file content before clean');
    });
});
