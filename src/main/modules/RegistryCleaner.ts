import { BaseModule, ScanItem, ScanResult, CleanResult } from './BaseModule';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import os from 'os';
import { logRestorePoint } from '../database/queries';

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

        // PowerShell script to enumerate HKLM, WOW6432Node, and HKCU Uninstall keys
        // Sanitize path (trim quotes, trailing slashes) and check secondary indicators (UninstallString)
        const psScript = `
      $paths = @(
          "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
          "HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
          "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
      )
      $orphans = @()

      foreach ($rootPath in $paths) {
          if (!(Test-Path -LiteralPath $rootPath)) { continue }
          $keys = Get-ChildItem -LiteralPath $rootPath -ErrorAction SilentlyContinue
          if (!$keys) { continue }

          foreach ($key in $keys) {
              try {
                  $props = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
                  if (!$props) { continue }

                  $installLocation = $props.InstallLocation
                  if ($installLocation -and $installLocation.Trim()) {
                      $cleanLoc = $installLocation.Trim('"', "'", ' ').TrimEnd('\\', '/')
                      if ($cleanLoc.Length -gt 0 -and !(Test-Path -LiteralPath $cleanLoc)) {
                          # Secondary check: verify if UninstallString points to a real executable
                          $hasValidUninstaller = $false
                          $uninstallString = $props.UninstallString
                          if ($uninstallString -and $uninstallString.Trim()) {
                              $cleanUninst = $uninstallString.Trim('"', "'", ' ')
                              if ($cleanUninst -match '^([^"]+?\\.exe)') {
                                  $cleanUninst = $matches[1]
                              }
                              if (Test-Path -LiteralPath $cleanUninst) {
                                  $hasValidUninstaller = $true
                              }
                          }

                          if (!$hasValidUninstaller) {
                              $orphans += [PSCustomObject]@{
                                  Path = $key.Name
                                  DisplayName = $props.DisplayName
                              }
                          }
                      }
                  }
              } catch {
                  # Ignore inaccessible registry keys
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
                const seenPaths = new Set<string>();

                for (const orphan of orphans) {
                    if (!orphan || !orphan.Path) continue;
                    const normalizedPath = String(orphan.Path).trim();
                    if (seenPaths.has(normalizedPath.toLowerCase())) continue;
                    seenPaths.add(normalizedPath.toLowerCase());

                    items.push({
                        id: `reg_${idCounter++}`,
                        path: normalizedPath,
                        name: orphan.DisplayName || path.basename(normalizedPath),
                        size: 0,
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
        let skippedCount = 0;

        // 1. Create a dedicated session directory for this cleanup batch
        const timestamp = Date.now();
        const backupRoot = path.join(app.getPath('userData'), 'restore', 'registry');
        const sessionDir = path.join(backupRoot, `session_${timestamp}`);

        if (!fs.existsSync(sessionDir)) {
            await fs.promises.mkdir(sessionDir, { recursive: true });
        }

        const validPathRegex = /^HKEY_(LOCAL_MACHINE|CURRENT_USER)\\Software\\(WOW6432Node\\)?Microsoft\\Windows\\CurrentVersion\\Uninstall\\[^\\]+$/i;

        for (const item of items) {
            if (!validPathRegex.test(item.path)) {
                console.warn(`Skipping invalid registry cleanup path: ${item.path}`);
                skippedCount++;
                continue;
            }

            const itemBackup = path.join(sessionDir, `${item.id}.reg`);

            // Export registry key backup using reg.exe
            try {
                await execFileAsync('reg.exe', ['export', item.path, itemBackup, '/y']);
            } catch (exportErr) {
                console.warn(`Registry backup warning for ${item.path}:`, exportErr);
            }

            // Delete the registry key using reg.exe delete
            try {
                await execFileAsync('reg.exe', ['delete', item.path, '/f']);
                itemsRemoved++;
            } catch (deleteErr) {
                console.warn(`Failed to delete registry key ${item.path} (may require elevation):`, deleteErr);
                skippedCount++;
            }
        }

        // Save session manifest and log restore point
        if (itemsRemoved > 0) {
            try {
                const manifestPath = path.join(sessionDir, 'manifest.json');
                await fs.promises.writeFile(manifestPath, JSON.stringify({
                    timestamp,
                    itemsCount: itemsRemoved,
                    items: items.map(i => ({ id: i.id, path: i.path, name: i.name }))
                }, null, 2), 'utf8');

                logRestorePoint({ module: this.moduleName, filePath: sessionDir });
            } catch (e) {
                console.warn('Could not save registry restore manifest:', e);
            }
        }

        return {
            itemsRemoved,
            bytesFreed: 0,
            skippedCount,
            success: itemsRemoved > 0 || items.length === 0,
            error: skippedCount > 0 ? `${skippedCount} registry key(s) could not be removed (Administrator rights may be required).` : undefined
        };
    }

    async rollback(): Promise<void> {
        if (!this.isWindows()) return;
        const backupRoot = path.join(app.getPath('userData'), 'restore', 'registry');
        if (!fs.existsSync(backupRoot)) {
            throw new Error('No registry backups found to restore.');
        }

        const entries = await fs.promises.readdir(backupRoot);

        // Find session directories
        const sessionDirs = entries.filter(e => e.startsWith('session_')).sort().reverse();

        if (sessionDirs.length > 0) {
            const latestSessionDir = path.join(backupRoot, sessionDirs[0]);
            const files = (await fs.promises.readdir(latestSessionDir)).filter(f => f.endsWith('.reg'));

            if (files.length === 0) {
                throw new Error('No registry backup files found in latest session.');
            }

            // Restore ALL .reg files in the batch session
            for (const file of files) {
                const regFilePath = path.join(latestSessionDir, file);
                try {
                    await execFileAsync('reg.exe', ['import', regFilePath]);
                } catch (importErr) {
                    console.error(`Failed to import registry backup file ${regFilePath}:`, importErr);
                }
            }
            return;
        }

        // Fallback for older flat backups
        const legacyFiles = entries.filter(f => f.endsWith('.reg')).sort().reverse();
        if (legacyFiles.length === 0) {
            throw new Error('No registry backups found to restore.');
        }

        const latestBackup = path.join(backupRoot, legacyFiles[0]);
        await execFileAsync('reg.exe', ['import', latestBackup]);
    }
}
