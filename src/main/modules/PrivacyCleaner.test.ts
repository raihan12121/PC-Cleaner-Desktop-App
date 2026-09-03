import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tempLocalApp = path.join(os.tmpdir(), `pc-cleaner-privacy-local-${Date.now()}`);
const tempRoaming = path.join(os.tmpdir(), `pc-cleaner-privacy-roam-${Date.now()}`);

vi.stubEnv('LOCALAPPDATA', tempLocalApp);

vi.mock('os', async () => {
    const actual = await vi.importActual<typeof os>('os');
    return {
        ...actual,
        default: {
            ...actual,
            homedir: () => tempRoaming,
            platform: () => 'win32'
        },
        homedir: () => tempRoaming,
        platform: () => 'win32'
    };
});

import { PrivacyCleaner } from './PrivacyCleaner';

describe('PrivacyCleaner Module', () => {
    beforeEach(() => {
        fs.mkdirSync(tempLocalApp, { recursive: true });
        fs.mkdirSync(tempRoaming, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tempLocalApp, { recursive: true, force: true });
        fs.rmSync(tempRoaming, { recursive: true, force: true });
    });

    it('cleans contents of Recent folder without deleting the Recent root directory itself', async () => {
        const recentDir = path.join(tempRoaming, 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Recent');
        fs.mkdirSync(recentDir, { recursive: true });

        const shortcutFile1 = path.join(recentDir, 'doc1.lnk');
        const shortcutFile2 = path.join(recentDir, 'photo.lnk');
        fs.writeFileSync(shortcutFile1, 'shortcut data 1');
        fs.writeFileSync(shortcutFile2, 'shortcut data 2');

        const cleaner = new PrivacyCleaner();
        const scanItem = {
            id: 'recent_docs',
            name: 'Recent Documents',
            path: recentDir,
            size: 100,
            category: 'OS Privacy',
            selected: true
        };

        const result = await cleaner.clean([scanItem]);

        expect(result.success).toBe(true);
        expect(result.itemsRemoved).toBe(1);
        expect(fs.existsSync(recentDir)).toBe(true); // Root Recent directory must still exist
        expect(fs.existsSync(shortcutFile1)).toBe(false); // Interior file deleted
        expect(fs.existsSync(shortcutFile2)).toBe(false); // Interior file deleted
    });

    it('accepts paths regardless of drive letter casing on Windows', async () => {
        const chromeDir = path.join(tempLocalApp, 'Google', 'Chrome', 'User Data', 'Default', 'Network');
        fs.mkdirSync(chromeDir, { recursive: true });
        fs.writeFileSync(path.join(chromeDir, 'Cookies'), 'cookie data');

        const cleaner = new PrivacyCleaner();

        // Invert casing of first character (e.g. C: -> c: or d: -> D:)
        const alteredPath = chromeDir[0] === chromeDir[0].toLowerCase()
            ? chromeDir[0].toUpperCase() + chromeDir.slice(1)
            : chromeDir[0].toLowerCase() + chromeDir.slice(1);

        const scanItem = {
            id: 'chrome_hist',
            name: 'Chrome History & Cookies',
            path: alteredPath,
            size: 200,
            category: 'Browser Privacy',
            selected: true
        };

        const result = await cleaner.clean([scanItem]);
        expect(result.success).toBe(true);
        expect(result.itemsRemoved).toBe(1);
    });

    it('rejects unauthorized paths outside permitted privacy directories', async () => {
        const outsideDir = path.join(os.tmpdir(), 'arbitrary_folder');
        fs.mkdirSync(outsideDir, { recursive: true });

        const cleaner = new PrivacyCleaner();
        const scanItem = {
            id: 'bad_path',
            name: 'Sensitive System Directory',
            path: outsideDir,
            size: 1000,
            category: 'OS Privacy',
            selected: true
        };

        const result = await cleaner.clean([scanItem]);
        expect(result.itemsRemoved).toBe(0);
        expect(result.skippedCount).toBe(1);
    });
});
