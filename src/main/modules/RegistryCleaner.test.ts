import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tempUserData = path.join(os.tmpdir(), `pc-cleaner-reg-test-${Date.now()}`);

vi.mock('electron', () => ({
    app: {
        getPath: (name: string) => {
            if (name === 'userData') return tempUserData;
            return os.tmpdir();
        }
    }
}));

const execHistory: Array<{ file: string; args: string[] }> = [];

vi.mock('child_process', () => ({
    execFile: (file: string, args: string[], callback: (err: Error | null, stdout: string, stderr: string) => void) => {
        execHistory.push({ file, args });
        callback(null, '', '');
    }
}));

vi.mock('../database/queries', () => ({
    logRestorePoint: vi.fn().mockReturnValue(1)
}));

import { RegistryCleaner } from './RegistryCleaner';

describe('RegistryCleaner Module', () => {
    beforeEach(() => {
        execHistory.length = 0;
        if (!fs.existsSync(tempUserData)) {
            fs.mkdirSync(tempUserData, { recursive: true });
        }
    });

    afterEach(() => {
        fs.rmSync(tempUserData, { recursive: true, force: true });
    });

    it('cleans multiple valid registry keys and groups them in a session backup with manifest', async () => {
        const cleaner = new RegistryCleaner();
        vi.spyOn(cleaner as any, 'isWindows').mockReturnValue(true);

        const items = [
            {
                id: 'reg_1',
                path: 'HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\AppOne',
                name: 'AppOne',
                size: 0,
                category: 'Orphaned Installers',
                selected: true
            },
            {
                id: 'reg_2',
                path: 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\AppTwo',
                name: 'AppTwo',
                size: 0,
                category: 'Orphaned Installers',
                selected: true
            },
            {
                id: 'reg_3',
                path: 'HKEY_LOCAL_MACHINE\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\AppThree',
                name: 'AppThree',
                size: 0,
                category: 'Orphaned Installers',
                selected: true
            }
        ];

        const result = await cleaner.clean(items);
        expect(result.success).toBe(true);
        expect(result.itemsRemoved).toBe(3);

        const restoreDir = path.join(tempUserData, 'restore', 'registry');
        expect(fs.existsSync(restoreDir)).toBe(true);

        const sessionDirs = fs.readdirSync(restoreDir).filter(d => d.startsWith('session_'));
        expect(sessionDirs.length).toBe(1);

        const sessionPath = path.join(restoreDir, sessionDirs[0]);
        const manifestPath = path.join(sessionPath, 'manifest.json');
        expect(fs.existsSync(manifestPath)).toBe(true);

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        expect(manifest.itemsCount).toBe(3);
    });

    it('rollback restores ALL registry files within the latest session', async () => {
        const cleaner = new RegistryCleaner();
        vi.spyOn(cleaner as any, 'isWindows').mockReturnValue(true);

        const restoreDir = path.join(tempUserData, 'restore', 'registry');
        const sessionPath = path.join(restoreDir, 'session_1000');
        fs.mkdirSync(sessionPath, { recursive: true });

        // Simulate 3 exported registry files in the session
        fs.writeFileSync(path.join(sessionPath, 'reg_1.reg'), 'Windows Registry Editor Version 5.00');
        fs.writeFileSync(path.join(sessionPath, 'reg_2.reg'), 'Windows Registry Editor Version 5.00');
        fs.writeFileSync(path.join(sessionPath, 'reg_3.reg'), 'Windows Registry Editor Version 5.00');

        await cleaner.rollback();

        const importCalls = execHistory.filter(h => h.file === 'reg.exe' && h.args[0] === 'import');
        expect(importCalls.length).toBe(3);
    });

    it('skips dangerous or invalid registry paths outside permitted uninstall keys', async () => {
        const cleaner = new RegistryCleaner();
        vi.spyOn(cleaner as any, 'isWindows').mockReturnValue(true);

        const maliciousItem = {
            id: 'bad_reg',
            path: 'HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Services',
            name: 'Critical Service',
            size: 0,
            category: 'Orphaned Installers',
            selected: true
        };

        const result = await cleaner.clean([maliciousItem]);
        expect(result.itemsRemoved).toBe(0);
        expect(result.skippedCount).toBe(1);
    });
});
