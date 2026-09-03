import { BaseModule, ScanItem, ScanResult, CleanResult } from './BaseModule';
import { execFile } from 'child_process';
import { promisify } from 'util';
import si from 'systeminformation';
import os from 'os';

const execFileAsync = promisify(execFile);

export class RamOptimizer extends BaseModule {
    readonly moduleName = 'RamOptimizer';

    async scan(): Promise<ScanResult> {
        const mem = await si.mem();
        const inUse = mem.used ?? mem.active ?? 0;
        const items: ScanItem[] = [];

        // Abstract item representing the RAM pressure
        items.push({
            id: 'ram_usage',
            name: 'System Memory',
            path: 'RAM',
            size: inUse, // bytes in use
            category: 'Memory',
            selected: true,
            metadata: { total: mem.total }
        });

        return { items, totalBytes: inUse };
    }

    async clean(): Promise<CleanResult> {
        let bytesFreed = 0;

        if (os.platform() === 'win32') {
            try {
                // Measure before
                const memBefore = await si.mem();

                const fullScript = `
          if (-not ([System.Management.Automation.PSTypeName]'psapi').Type) {
              Add-Type -TypeDefinition '
              using System;
              using System.Runtime.InteropServices;
              public class psapi {
                  [DllImport("psapi.dll")]
                  public static extern int EmptyWorkingSet(IntPtr hwProc);
              }'
          }
          Get-Process | Where-Object { $_.Id -ne $PID } | ForEach-Object {
              try {
                  [psapi]::EmptyWorkingSet($_.Handle) | Out-Null
              } catch {}
          }
        `;

                await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', fullScript]);

                // Measure after
                const memAfter = await si.mem();
                const usedBefore = memBefore.used ?? memBefore.active ?? 0;
                const usedAfter = memAfter.used ?? memAfter.active ?? 0;
                const freed = usedBefore - usedAfter;
                bytesFreed = Math.max(0, freed);
            } catch (e) {
                console.error('RAM Optimization failed', e);
                return { itemsRemoved: 0, bytesFreed: 0, success: false, error: String(e) };
            }
        }

        if (os.platform() !== 'win32') {
            return { itemsRemoved: 0, bytesFreed: 0, success: false, error: 'RAM optimization is only supported on Windows.' };
        }
        return { itemsRemoved: 1, bytesFreed, success: true };
    }

    async rollback(): Promise<void> {
        throw new Error('RAM optimization cannot be rolled back.');
    }
}
