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
        const items: ScanItem[] = [];

        // Abstract item representing the RAM pressure
        items.push({
            id: 'ram_usage',
            name: 'System Memory',
            path: 'RAM',
            size: mem.active, // bytes in use
            category: 'Memory',
            selected: true,
            metadata: { total: mem.total }
        });

        return { items, totalBytes: mem.active };
    }

    async clean(): Promise<CleanResult> {
        let bytesFreed = 0;

        if (os.platform() === 'win32') {
            try {
                // Measure before
                const memBefore = await si.mem();

                // EmptyWorkingSet for all processes (Needs Admin/UAC technically, but we run as is for demo)
                const psScript = `
          [DllImport("psapi.dll")]
          public static extern int EmptyWorkingSet(IntPtr hwProc);
          
          Get-Process | ForEach-Object {
              try {
                  [psapi]::EmptyWorkingSet($_.Handle) | Out-Null
              } catch {}
          }
        `;

                // Add-Type requires compilation so it might be slow, but this is a standard PS way
                const fullScript = `
          Add-Type -TypeDefinition '
          using System;
          using System.Runtime.InteropServices;
          public class psapi {
              [DllImport("psapi.dll")]
              public static extern int EmptyWorkingSet(IntPtr hwProc);
          }'
          Get-Process | ForEach-Object {
              try {
                  [psapi]::EmptyWorkingSet($_.Handle) | Out-Null
              } catch {}
          }
        `;

                await execFileAsync('powershell.exe', ['-Command', fullScript]);

                // Measure after
                const memAfter = await si.mem();
                bytesFreed = Math.max(0, memBefore.active - memAfter.active);
            } catch (e) {
                console.error('RAM Optimization failed', e);
                return { itemsRemoved: 0, bytesFreed: 0, success: false, error: String(e) };
            }
        }

        return { itemsRemoved: 1, bytesFreed, success: true };
    }

    async rollback(): Promise<void> {
        throw new Error('RAM optimization cannot be rolled back.');
    }
}
