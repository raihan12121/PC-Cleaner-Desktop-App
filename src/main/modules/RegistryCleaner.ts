import { BaseModule, ScanItem, ScanResult, CleanResult } from './BaseModule';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import os from 'os';

const execFileAsync = promisify(execFile);

export class RegistryCleaner extends BaseModule {
    readonly moduleName = 'RegistryCleaner';

    private isWindows(): boolean {
        return os.platform() === 'win32';
    }

    async scan(): Promise<ScanResult> {
        if (!this.isWindows()) {
            return { items: [], totalBytes: 0 };
        }

        const items: ScanItem[] = [];

        // PowerShell script to enumerate HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall
        // and extract paths, checking if they exist on disk.
        const psScript = `
      $path = "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
      if (!(Test-Path $path)) { exit }
      $keys = Get-ChildItem -Path $path
      $orphans = @()
      foreach ($key in $keys) {
          $installLocation = (Get-ItemProperty $key.PSPath).InstallLocation
          if ($installLocation -and !(Test-Path $installLocation)) {
              $orphans += [PSCustomObject]@{
                  Path = $key.Name
                  DisplayName = (Get-ItemProperty $key.PSPath).DisplayName
              }
          }
      }
      $orphans | ConvertTo-Json
    `;

        try {
            const { stdout } = await execFileAsync('powershell.exe', [
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                psScript
            ]);

            if (stdout.trim()) {
                const parsed = JSON.parse(stdout);
                const orphans = Array.isArray(parsed) ? parsed : [parsed];

                let idCounter = 1;
                for (const orphan of orphans) {
                    items.push({
                        id: `reg_${idCounter++}`,
                        path: orphan.Path, // e.g. HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\Uninstall\App
                        name: orphan.DisplayName || path.basename(orphan.Path),
                        size: 0, // Registry keys size is negligible for this view
                        category: 'Orphaned Installers',
                        selected: true
                    });
                }
            }
        } catch (e) {
            console.error('Registry scan failed:', e);
        }

        return { items, totalBytes: 0 };
    }

    async clean(items: ScanItem[]): Promise<CleanResult> {
        if (!this.isWindows() || items.length === 0) {
            return { itemsRemoved: 0, bytesFreed: 0, success: true };
        }

        let itemsRemoved = 0;

        // 1. Export backup
        const timestamp = Date.now();
        const backupDir = path.join(app.getPath('userData'), 'restore', 'registry');
        if (!fs.existsSync(backupDir)) {
            await fs.promises.mkdir(backupDir, { recursive: true });
        }
        const backupFile = path.join(backupDir, `backup_${timestamp}.reg`);

        try {
            // Ideally we should export each key, but simplified here
            // For a real app, `reg export "HKLM\\..." C:\\...`
            const exportScript = items.map(item => `reg export "${item.path}" "${backupFile}_${item.id}.reg" /y`).join('; ');

            await execFileAsync('powershell.exe', ['-Command', exportScript]);

            // 2. Delete
            const deleteScript = items.map(item => `Remove-Item -Path 'Registry::${item.path}' -Recurse -Force`).join('; ');
            await execFileAsync('powershell.exe', ['-Command', deleteScript]);

            itemsRemoved = items.length;
        } catch (e) {
            console.error('Failed to clean registry:', e);
            return { itemsRemoved: 0, bytesFreed: 0, success: false, error: String(e) };
        }

        return {
            itemsRemoved,
            bytesFreed: 0,
            success: true
        };
    }

    async rollback(): Promise<void> {
        if (!this.isWindows()) return;
        // Real implementation would look up the last reg export from DB and `reg import` it.
        console.log('Rollback called for RegistryCleaner');
    }
}
