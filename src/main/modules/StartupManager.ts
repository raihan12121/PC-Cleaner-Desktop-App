import { BaseModule, ScanItem, ScanResult, CleanResult } from './BaseModule';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { quotePowerShell } from '../validation';
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
                        items.push({
                            id: `startup_${idCounter++}`,
                            name: item.Name,
                            path: item.Command,
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
        const isWin = os.platform() === 'win32';

        if (!isWin) return { itemsRemoved: 0, bytesFreed: 0, success: false, error: 'Startup management is only supported on Windows.' };

        for (const item of items) {
            try {
                if (item.category === 'Registry (HKCU Run)' && item.name.length > 0) {
                    // To disable, we typically move it to a different registry key or delete it
                    // For simplicity in this demo, we'll just delete it from Run.
                    const psScript = `Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name ${quotePowerShell(item.name)} -Force`;
                    await execFileAsync('powershell.exe', ['-Command', psScript]);
                    itemsRemoved++;
                }
            } catch (e) {
                console.error(`Failed to handle startup item ${item.name}`, e);
            }
        }

        return { itemsRemoved, bytesFreed: 0, success: items.length === 0 || itemsRemoved === items.length };
    }

    async rollback(): Promise<void> {
        console.log('Rollback called for StartupManager');
    }
}
