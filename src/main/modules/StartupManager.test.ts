import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tempUserData = path.join(os.tmpdir(), `pc-cleaner-startup-test-${Date.now()}`);

vi.mock('electron', () => ({
    app: {
        getPath: (name: string) => {
            if (name === 'userData') return tempUserData;
            return os.tmpdir();
        }
    }
}));

const execCalls: Array<{ file: string; args: string[] }> = [];

vi.mock('child_process', () => ({
    execFile: (file: string, args: string[], callback: (err: Error | null, stdout: string, stderr: string) => void) => {
        execCalls.push({ file, args });
        callback(null, '', '');
    }
}));

vi.mock('../database/queries', () => ({
    logRestorePoint: vi.fn().mockReturnValue(1)
}));

import { StartupManager } from './StartupManager';

describe('StartupManager Module', () => {
    beforeEach(() => {
        execCalls.length = 0;
        if (!fs.existsSync(tempUserData)) {
            fs.mkdirSync(tempUserData, { recursive: true });
        }
    });

    afterEach(() => {
        fs.rmSync(tempUserData, { recursive: true, force: true });
    });

    it('creates a backup before removing startup items from HKCU Run', async () => {
        const manager = new StartupManager();
        const items = [
            {
                id: 'startup_1',
                name: 'Discord',
                path: 'C:\\Users\\User\\AppData\\Local\\Discord\\app.exe',
                size: 0,
                category: 'Registry (HKCU Run)',
                selected: true
            }
        ];

        const result = await manager.clean(items);
        expect(result.success).toBe(true);
        expect(result.itemsRemoved).toBe(1);

        const backupDir = path.join(tempUserData, 'restore', 'startup');
        expect(fs.existsSync(backupDir)).toBe(true);

        const files = fs.readdirSync(backupDir).filter(f => f.startsWith('startup_'));
        expect(files.length).toBe(1);

        const savedData = JSON.parse(fs.readFileSync(path.join(backupDir, files[0]), 'utf8'));
        expect(savedData[0].name).toBe('Discord');

        const removeCommand = execCalls.find(c => c.args.some(a => a.includes('Remove-ItemProperty')));
        expect(removeCommand).toBeDefined();
    });

    it('rollback restores items back to HKCU Run using Set-ItemProperty', async () => {
        const manager = new StartupManager();
        const backupDir = path.join(tempUserData, 'restore', 'startup');
        fs.mkdirSync(backupDir, { recursive: true });

        const backupFile = path.join(backupDir, 'startup_9999.json');
        const backupItems = [
            {
                id: 'startup_1',
                name: 'Spotify',
                path: 'C:\\Users\\User\\AppData\\Roaming\\Spotify\\Spotify.exe',
                size: 0,
                category: 'Registry (HKCU Run)',
                selected: true
            }
        ];
        fs.writeFileSync(backupFile, JSON.stringify(backupItems), 'utf8');

        await manager.rollback();

        const setCommand = execCalls.find(c => c.args.some(a => a.includes('Set-ItemProperty') && a.includes('Spotify')));
        expect(setCommand).toBeDefined();
    });
});
