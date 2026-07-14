import { ipcMain, app, BrowserWindow } from 'electron';
import si from 'systeminformation';
import { IPC_CHANNELS } from './channels';
import { resetDatabase } from '../database/db';
import { DiskCleaner } from '../modules/DiskCleaner';
import { DuplicateFinder } from '../modules/DuplicateFinder';
import { RegistryCleaner } from '../modules/RegistryCleaner';
import { StartupManager } from '../modules/StartupManager';
import { RamOptimizer } from '../modules/RamOptimizer';
import { PrivacyCleaner } from '../modules/PrivacyCleaner';
import { DriveHealth } from '../modules/DriveHealth';
import { Scheduler } from '../modules/Scheduler';
import { logScanResult, logCleanHistory, getScanTimeline } from '../database/queries';
import { ScanItem } from '../modules/BaseModule';

export function registerIpcHandlers() {
    ipcMain.handle(IPC_CHANNELS.DB_RESET, async (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) {
            resetDatabase();
            return { success: true };
        }
        return { error: 'Window not found' };
    });

    ipcMain.handle(IPC_CHANNELS.SYSTEM_INFO, async () => {
        try {
            const [cpu, os, mem, disk] = await Promise.all([
                si.cpu(),
                si.osInfo(),
                si.mem(),
                si.fsSize()
            ]);
            return { cpu, os, mem, disk };
        } catch (e) {
            return { error: String(e) };
        }
    });

    ipcMain.handle(IPC_CHANNELS.SYSTEM_PROCESSES, async () => {
        try {
            return await si.processes();
        } catch (e) {
            return { error: String(e) };
        }
    });

    ipcMain.handle(IPC_CHANNELS.DB_QUERY_TIMELINE, async () => {
        try {
            return getScanTimeline();
        } catch (e) {
            return { error: String(e) };
        }
    });

    const diskCleaner = new DiskCleaner();

    ipcMain.handle(IPC_CHANNELS.DISK_SCAN, async () => {
        try {
            const result = await diskCleaner.scan();
            const scanId = logScanResult({
                module: diskCleaner.moduleName,
                itemsFound: result.items.length,
                bytesFreed: result.totalBytes
            });
            return { ...result, scanId };
        } catch (e) {
            console.error('Disk scan failed:', e);
            return { error: String(e) };
        }
    });

    ipcMain.handle(IPC_CHANNELS.DISK_CLEAN, async (_, items: ScanItem[], scanId: number) => {
        try {
            const result = await diskCleaner.clean(items);
            logCleanHistory({
                scanId: scanId || 0,
                itemsRemoved: result.itemsRemoved,
                bytesFreed: result.bytesFreed
            });
            return result;
        } catch (e) {
            console.error('Disk clean failed:', e);
            return { error: String(e) };
        }
    });

    const duplicateFinder = new DuplicateFinder();
    ipcMain.handle(IPC_CHANNELS.DUPLICATE_SCAN, async (_, options: any) => {
        try {
            const result = await duplicateFinder.scan(options);
            const scanId = logScanResult({
                module: duplicateFinder.moduleName,
                itemsFound: result.items.length,
                bytesFreed: result.totalBytes
            });
            return { ...result, scanId };
        } catch (e) {
            return { error: String(e) };
        }
    });

    ipcMain.handle(IPC_CHANNELS.DUPLICATE_CLEAN, async (_, items: ScanItem[], scanId: number) => {
        try {
            const result = await duplicateFinder.clean(items);
            logCleanHistory({ scanId: scanId || 0, itemsRemoved: result.itemsRemoved, bytesFreed: result.bytesFreed });
            return result;
        } catch (e) {
            return { error: String(e) };
        }
    });

    const registryCleaner = new RegistryCleaner();
    ipcMain.handle(IPC_CHANNELS.REGISTRY_SCAN, async () => {
        try {
            const result = await registryCleaner.scan();
            const scanId = logScanResult({ module: registryCleaner.moduleName, itemsFound: result.items.length, bytesFreed: result.totalBytes });
            return { ...result, scanId };
        } catch (e) {
            return { error: String(e) };
        }
    });

    ipcMain.handle(IPC_CHANNELS.REGISTRY_CLEAN, async (_, items: ScanItem[], scanId: number) => {
        try {
            const result = await registryCleaner.clean(items);
            logCleanHistory({ scanId: scanId || 0, itemsRemoved: result.itemsRemoved, bytesFreed: result.bytesFreed });
            return result;
        } catch (e) {
            return { error: String(e) };
        }
    });

    const startupManager = new StartupManager();
    ipcMain.handle(IPC_CHANNELS.STARTUP_SCAN, async () => {
        try {
            const result = await startupManager.scan();
            return { ...result };
        } catch (e) {
            return { error: String(e) };
        }
    });

    ipcMain.handle(IPC_CHANNELS.STARTUP_TOGGLE, async (_, items: ScanItem[]) => {
        try {
            const result = await startupManager.clean(items);
            return result;
        } catch (e) {
            return { error: String(e) };
        }
    });

    const ramOptimizer = new RamOptimizer();
    ipcMain.handle(IPC_CHANNELS.RAM_INFO, async () => {
        try {
            return await ramOptimizer.scan();
        } catch (e) {
            return { error: String(e) };
        }
    });

    ipcMain.handle(IPC_CHANNELS.RAM_OPTIMIZE, async () => {
        try {
            return await ramOptimizer.clean();
        } catch (e) {
            return { error: String(e) };
        }
    });

    const privacyCleaner = new PrivacyCleaner();
    ipcMain.handle(IPC_CHANNELS.PRIVACY_SCAN, async () => {
        try {
            const result = await privacyCleaner.scan();
            const scanId = logScanResult({ module: privacyCleaner.moduleName, itemsFound: result.items.length, bytesFreed: result.totalBytes });
            return { ...result, scanId };
        } catch (e) {
            return { error: String(e) };
        }
    });

    ipcMain.handle(IPC_CHANNELS.PRIVACY_CLEAN, async (_, items: ScanItem[], scanId: number) => {
        try {
            const result = await privacyCleaner.clean(items);
            logCleanHistory({ scanId: scanId || 0, itemsRemoved: result.itemsRemoved, bytesFreed: result.bytesFreed });
            return result;
        } catch (e) {
            return { error: String(e) };
        }
    });

    const driveHealth = new DriveHealth();
    ipcMain.handle(IPC_CHANNELS.DRIVE_HEALTH, async () => {
        try {
            return await driveHealth.scan();
        } catch (e) {
            return { error: String(e) };
        }
    });

    const scheduler = new Scheduler();
    scheduler.loadSchedules();
}
