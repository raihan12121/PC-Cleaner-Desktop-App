import { BaseModule, ScanItem, ScanResult, CleanResult } from './BaseModule';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { quotePowerShell } from '../validation';
import { logRestorePoint } from '../database/queries';
import os from 'os';

const execFileAsync = promisify(execFile);

export class StartupManager extends BaseModule {
    readonly moduleName = 'StartupManager';

    async scan(): Promise<ScanResult> {
        const items: ScanItem[] = [];
        const isWin = os.platform() === 'win32';
        const isMac = os.platform() === 'darwin';

        let idCounter = 1;

        try {
            if (isWin) {
                // Windows: HKCU\Software\Microsoft\Windows\CurrentVersion\Run
                const psScript = `
          $path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"
          if (Test-Path $path) {
              $keys = Get-ItemProperty $path
              $keys.psobject.properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object {
                  [PSCustomObject]@{
                      Name = $_.Name
                      Command = $_.Value
                  }
              } | ConvertTo-Json
          }
        `;
                const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript]);
                if (stdout.trim()) {
                    const parsed = JSON.parse(stdout);
                    const startupItems = Array.isArray(parsed) ? parsed : [parsed];
                    for (const item of startupItems) {
                        if (!item || !item.Name) continue;
                        items.push({
                            id: `startup_${idCounter++}`,
                            name: item.Name,
                            path: item.Command || '',
                            size: 0,
                            category: 'Registry (HKCU Run)',
                            selected: false, // Default to not disable
                        });
                    }
                }
            } else if (isMac) {
                // macOS: launchctl list
                const { stdout } = await execFileAsync('launchctl', ['list']);
                const lines = stdout.split('\n').slice(1);
                for (const line of lines) {
                    if (!line.trim()) continue;
                    const [, , label] = line.split('\t');
                    if (label && !label.startsWith('com.apple.')) {
                        items.push({
                            id: `startup_${idCounter++}`,
                            name: label,
                            path: label,
                            size: 0,
                            category: 'Launch Agents',
                            selected: false,
                        });
                    }
                }
            }
        } catch (e) {
            console.error('StartupManager scan failed:', e);
        }

        return { items, totalBytes: 0 };
    }

    async clean(items: ScanItem[]): Promise<CleanResult> {
        let itemsRemoved = 0;
        let skippedCount = 0;
        const isWin = os.platform() === 'win32';

        if (!isWin) return { itemsRemoved: 0, bytesFreed: 0, success: false, error: 'Startup management is only supported on Windows.' };
        if (items.length === 0) return { itemsRemoved: 0, bytesFreed: 0, success: true };

        // 1. Create a backup of startup items before removing them
        const backupDir = path.join(app.getPath('userData'), 'restore', 'startup');
        if (!fs.existsSync(backupDir)) {
            await fs.promises.mkdir(backupDir, { recursive: true });
        }

        const backupSessionFile = path.join(backupDir, `startup_${Date.now()}.json`);
        try {
            await fs.promises.writeFile(backupSessionFile, JSON.stringify(items, null, 2), 'utf8');
            logRestorePoint({ module: this.moduleName, filePath: backupSessionFile });
        } catch (backupErr) {
            console.warn('Failed to save startup restore backup:', backupErr);
        }

        for (const item of items) {
            try {
                if (item.category === 'Registry (HKCU Run)' && item.name.length > 0) {
                    const psScript = `Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name ${quotePowerShell(item.name)} -Force -ErrorAction Stop`;
                    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript]);
                    itemsRemoved++;
                } else {
                    skippedCount++;
                }
            } catch (e) {
                console.error(`Failed to handle startup item ${item.name}:`, e);
                skippedCount++;
            }
        }

        return {
            itemsRemoved,
            bytesFreed: 0,
            skippedCount,
            success: itemsRemoved > 0 || items.length === 0
        };
    }

    async rollback(): Promise<void> {
        const isWin = os.platform() === 'win32';
        if (!isWin) return;

        const backupDir = path.join(app.getPath('userData'), 'restore', 'startup');
        if (!fs.existsSync(backupDir)) {
            throw new Error('No startup backups found to restore.');
        }

        const files = (await fs.promises.readdir(backupDir))
            .filter(f => f.startsWith('startup_') && f.endsWith('.json'))
            .sort()
            .reverse();

        if (files.length === 0) {
            throw new Error('No startup backup files found.');
        }

        const latestFile = path.join(backupDir, files[0]);
        const content = await fs.promises.readFile(latestFile, 'utf8');
        const items: ScanItem[] = JSON.parse(content);

        for (const item of items) {
            if (item.category === 'Registry (HKCU Run)' && item.name && item.path) {
                const psScript = `Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name ${quotePowerShell(item.name)} -Value ${quotePowerShell(item.path)} -Force`;
                await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript]);
            }
        }
    }
}
