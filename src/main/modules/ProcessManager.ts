import { exec } from 'child_process';
import si from 'systeminformation';

export interface ProcessDetails {
    pid: number;
    name: string;
    windowTitle?: string;
    cpu: number;
    memRss: number; // in KB
    memMb: number;  // in MB
    user?: string;
    path?: string;
    isApp: boolean;
    status: string;
}

export class ProcessManager {
    /**
     * Retrieve all running processes, tagging interactive desktop applications
     */
    async getProcesses(): Promise<ProcessDetails[]> {
        const [siProcesses, windowTitlesMap] = await Promise.all([
            si.processes().catch((): si.Systeminformation.ProcessesData => ({ all: 0, running: 0, blocked: 0, sleeping: 0, unknown: 0, list: [] })),
            this.getWindowsTasklist()
        ]);

        const results: ProcessDetails[] = [];

        for (const proc of siProcesses.list) {
            // Ignore System Idle Process (PID 0) and invalid PIDs
            if (proc.pid <= 0) continue;

            const winInfo = windowTitlesMap.get(proc.pid);
            const hasWindow = Boolean(winInfo?.windowTitle && winInfo.windowTitle !== 'N/A' && winInfo.windowTitle.trim().length > 0);
            
            // Interactive apps: has window title or is running under interactive user session
            const isUserApp = hasWindow || (
                proc.user && 
                !proc.user.includes('SYSTEM') && 
                !proc.user.includes('LOCAL SERVICE') && 
                !proc.user.includes('NETWORK SERVICE') &&
                !proc.name.toLowerCase().startsWith('svchost')
            );

            const memKb = Math.max(0, proc.memRss || 0);
            const memMb = Number((memKb / 1024).toFixed(1));

            results.push({
                pid: proc.pid,
                name: proc.name,
                windowTitle: winInfo?.windowTitle && winInfo.windowTitle !== 'N/A' ? winInfo.windowTitle : undefined,
                cpu: Number(Math.max(0, proc.cpu || 0).toFixed(1)),
                memRss: memKb,
                memMb,
                user: winInfo?.user || proc.user || undefined,
                path: proc.path || undefined,
                isApp: Boolean(isUserApp),
                status: winInfo?.status || proc.state || 'running'
            });
        }

        // Sort by memory usage descending by default
        return results.sort((a, b) => b.memMb - a.memMb);
    }

    /**
     * Parse tasklist /V /FO CSV on Windows to correlate window titles and users
     */
    private async getWindowsTasklist(): Promise<Map<number, { windowTitle?: string; user?: string; status?: string }>> {
        const map = new Map<number, { windowTitle?: string; user?: string; status?: string }>();
        if (process.platform !== 'win32') {
            return map;
        }

        return new Promise((resolve) => {
            exec('tasklist /V /FO CSV', { maxBuffer: 10 * 1024 * 1024, timeout: 4000 }, (err, stdout) => {
                if (err || !stdout) {
                    resolve(map);
                    return;
                }

                try {
                    const lines = stdout.split(/\r?\n/);
                    // Skip header
                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line) continue;

                        // Basic CSV parser for quoted fields
                        const parts = line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g);
                        if (parts && parts.length >= 9) {
                            const clean = parts.map(p => p.replace(/^,?"?|"$/g, '').replace(/""/g, '"').trim());
                            const pid = parseInt(clean[1], 10);
                            if (!isNaN(pid)) {
                                map.set(pid, {
                                    status: clean[5],
                                    user: clean[6],
                                    windowTitle: clean[8]
                                });
                            }
                        }
                    }
                } catch {
                    // Ignore CSV parsing error
                }

                resolve(map);
            });
        });
    }

    /**
     * Terminate / End task a specific process by PID
     */
    async killProcess(pid: number): Promise<{ success: boolean }> {
        if (!pid || pid <= 4) {
            throw new Error('Cannot terminate critical system process.');
        }

        // Safety check: protect current Electron application process
        if (pid === process.pid) {
            throw new Error('Cannot terminate the current application process.');
        }

        if (process.platform === 'win32') {
            return new Promise((resolve, reject) => {
                exec(`taskkill /F /T /PID ${pid}`, { timeout: 5000 }, (err) => {
                    if (err) {
                        try {
                            process.kill(pid, 'SIGKILL');
                            resolve({ success: true });
                        } catch (killErr) {
                            reject(new Error(`Failed to terminate process ${pid}: ${err.message || killErr}`));
                        }
                    } else {
                        resolve({ success: true });
                    }
                });
            });
        } else {
            process.kill(pid, 'SIGTERM');
            return { success: true };
        }
    }
}
