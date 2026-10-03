import { describe, expect, it, beforeEach } from 'vitest';
import { ProcessManager } from './ProcessManager';

describe('ProcessManager Module', () => {
    let processManager: ProcessManager;

    beforeEach(() => {
        processManager = new ProcessManager();
    });

    it('retrieves running processes with memory and cpu stats', async () => {
        const processes = await processManager.getProcesses();
        expect(Array.isArray(processes)).toBe(true);
        expect(processes.length).toBeGreaterThan(0);

        const first = processes[0];
        expect(first.pid).toBeGreaterThan(0);
        expect(typeof first.name).toBe('string');
        expect(typeof first.memMb).toBe('number');
        expect(typeof first.cpu).toBe('number');
    }, 15000);

    it('rejects terminating invalid or protected system PIDs', async () => {
        await expect(processManager.killProcess(0)).rejects.toThrow('Cannot terminate critical system process.');
        await expect(processManager.killProcess(4)).rejects.toThrow('Cannot terminate critical system process.');
        await expect(processManager.killProcess(process.pid)).rejects.toThrow('Cannot terminate the current application process.');
    });
});
