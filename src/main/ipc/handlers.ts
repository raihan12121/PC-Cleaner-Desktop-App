import { ipcMain, BrowserWindow } from 'electron';
import si from 'systeminformation';
import * as cron from 'node-cron';
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
import { ScanItem } from '../modules/BaseModule';
import { getScanResults, getScanTimeline, getSchedules, deleteSchedule, logCleanHistory, logScanResult, saveSchedule } from '../database/queries';
import { assertExistingDirectory, assertScanId, assertScanItems } from '../validation';

const scanRegistry = new Map<number, { module: string; items: ScanItem[] }>();
function registerScan(module: string, items: ScanItem[], scanId: number): void {
    scanRegistry.set(scanId, { module, items: items.map(item => ({ ...item })) });
    if (scanRegistry.size > 100) scanRegistry.delete(scanRegistry.keys().next().value as number);
}
function validateCleanup(module: string, items: unknown, scanId: unknown): ScanItem[] {
    assertScanItems(items); assertScanId(scanId);
    const scan = scanRegistry.get(scanId);
    if (!scan || scan.module !== module) throw new Error('Scan has expired. Please scan again.');
    const valid = new Map(scan.items.map(item => [item.id, item]));
    for (const item of items) {
        const original = valid.get(item.id);
        if (!original || original.path !== item.path || original.name !== item.name || original.category !== item.category) throw new Error('Cleanup item was not produced by the requested scan.');
    }
    return items;
}

export function registerIpcHandlers() {
    const scheduler = new Scheduler();
    const diskCleaner = new DiskCleaner(); const duplicateFinder = new DuplicateFinder();
    const registryCleaner = new RegistryCleaner(); const startupManager = new StartupManager();
    const ramOptimizer = new RamOptimizer(); const privacyCleaner = new PrivacyCleaner(); const driveHealth = new DriveHealth();

    ipcMain.handle(IPC_CHANNELS.DB_RESET, async event => {
        if (!BrowserWindow.fromWebContents(event.sender)) return { error: 'Window not found' };
        resetDatabase(); scanRegistry.clear(); await scheduler.loadSchedules(); return { success: true };
    });
    ipcMain.handle(IPC_CHANNELS.GET_VERSION, () => process.env.npm_package_version || '1.0.0');
    ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, event => BrowserWindow.fromWebContents(event.sender)?.minimize());
    ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, event => { const win = BrowserWindow.fromWebContents(event.sender); if (win?.isMaximized()) win.unmaximize(); else win?.maximize(); });
    ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, event => BrowserWindow.fromWebContents(event.sender)?.close());

    ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, event => BrowserWindow.fromWebContents(event.sender)?.minimize());
    ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, event => { const win = BrowserWindow.fromWebContents(event.sender); if (win?.isMaximized()) win.unmaximize(); else win?.maximize(); });
    ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, event => BrowserWindow.fromWebContents(event.sender)?.close());

    ipcMain.handle(IPC_CHANNELS.SYSTEM_INFO, async () => {
        try {
            const [cpu, osInfo, mem, disk, currentLoad] = await Promise.all([
                si.cpu(),
                si.osInfo(),
                si.mem(),
                si.fsSize(),
                si.currentLoad()
            ]);
            return { cpu: { ...cpu, currentLoad: currentLoad.currentLoad }, os: osInfo, mem, disk };
        } catch (e) {
            return { error: String(e) };
        }
    });
    ipcMain.handle(IPC_CHANNELS.SYSTEM_PROCESSES, async () => { try { return await si.processes(); } catch (e) { return { error: String(e) }; } });
    ipcMain.handle(IPC_CHANNELS.DB_QUERY_TIMELINE, async () => { try { return getScanTimeline(); } catch (e) { return { error: String(e) }; } });
    ipcMain.handle(IPC_CHANNELS.DB_QUERY_SCANS, () => getScanResults());
    ipcMain.handle(IPC_CHANNELS.DB_QUERY_SCHEDULES, () => getSchedules());
    ipcMain.handle(IPC_CHANNELS.DB_SAVE_SCHEDULE, async (_, module: unknown, cronExpr: unknown, enabled: unknown) => {
        if (typeof module !== 'string' || !['DiskCleaner', 'PrivacyCleaner'].includes(module) || typeof cronExpr !== 'string' || !cron.validate(cronExpr) || typeof enabled !== 'boolean') return { error: 'Invalid schedule.' };
        const id = saveSchedule(module, cronExpr, enabled); await scheduler.loadSchedules(); return { success: true, id };
    });
    ipcMain.handle(IPC_CHANNELS.DB_DELETE_SCHEDULE, async (_, module: unknown) => { if (typeof module !== 'string' || !['DiskCleaner', 'PrivacyCleaner'].includes(module)) return { error: 'Invalid schedule.' }; deleteSchedule(module); await scheduler.loadSchedules(); return { success: true }; });

    ipcMain.handle(IPC_CHANNELS.DISK_SCAN, async () => { try { const result = await diskCleaner.scan(); const scanId = logScanResult({ module: diskCleaner.moduleName, itemsFound: result.items.length, bytesFreed: result.totalBytes }); registerScan(diskCleaner.moduleName, result.items, scanId); return { ...result, scanId }; } catch (e) { return { error: String(e) }; } });
    ipcMain.handle(IPC_CHANNELS.DISK_CLEAN, async (_, items: unknown, scanId: unknown) => { try { const result = await diskCleaner.clean(validateCleanup(diskCleaner.moduleName, items, scanId)); logCleanHistory({ scanId: scanId as number, itemsRemoved: result.itemsRemoved, bytesFreed: result.bytesFreed }); return result; } catch (e) { return { error: String(e) }; } });
    ipcMain.handle(IPC_CHANNELS.DUPLICATE_SCAN, async (_, options: unknown) => { try { if (options !== undefined && (!options || typeof options !== 'object' || typeof (options as { directory?: unknown }).directory !== 'string')) return { error: 'Invalid duplicate scan options.' }; if (options && typeof (options as { directory?: unknown }).directory === 'string') assertExistingDirectory((options as { directory: string }).directory); const result = await duplicateFinder.scan(options as { directory: string } | undefined); const scanId = logScanResult({ module: duplicateFinder.moduleName, itemsFound: result.items.length, bytesFreed: result.totalBytes }); registerScan(duplicateFinder.moduleName, result.items, scanId); return { ...result, scanId }; } catch (e) { return { error: String(e) }; } });
    ipcMain.handle(IPC_CHANNELS.DUPLICATE_CLEAN, async (_, items: unknown, scanId: unknown) => { try { const result = await duplicateFinder.clean(validateCleanup(duplicateFinder.moduleName, items, scanId)); logCleanHistory({ scanId: scanId as number, itemsRemoved: result.itemsRemoved, bytesFreed: result.bytesFreed }); return result; } catch (e) { return { error: String(e) }; } });
    ipcMain.handle(IPC_CHANNELS.REGISTRY_SCAN, async () => { try { const result = await registryCleaner.scan(); const scanId = logScanResult({ module: registryCleaner.moduleName, itemsFound: result.items.length, bytesFreed: result.totalBytes }); registerScan(registryCleaner.moduleName, result.items, scanId); return { ...result, scanId }; } catch (e) { return { error: String(e) }; } });
    ipcMain.handle(IPC_CHANNELS.REGISTRY_CLEAN, async (_, items: unknown, scanId: unknown) => { try { const result = await registryCleaner.clean(validateCleanup(registryCleaner.moduleName, items, scanId)); logCleanHistory({ scanId: scanId as number, itemsRemoved: result.itemsRemoved, bytesFreed: result.bytesFreed }); return result; } catch (e) { return { error: String(e) }; } });
    ipcMain.handle(IPC_CHANNELS.REGISTRY_ROLLBACK, async () => { try { await registryCleaner.rollback(); return { success: true }; } catch (e) { return { error: String(e) }; } });
    ipcMain.handle(IPC_CHANNELS.STARTUP_SCAN, async () => { try { const result = await startupManager.scan(); const scanId = logScanResult({ module: startupManager.moduleName, itemsFound: result.items.length, bytesFreed: result.totalBytes }); registerScan(startupManager.moduleName, result.items, scanId); return { ...result, scanId }; } catch (e) { return { error: String(e) }; } });
    ipcMain.handle(IPC_CHANNELS.STARTUP_TOGGLE, async (_, items: unknown, scanId: unknown) => { try { return await startupManager.clean(validateCleanup(startupManager.moduleName, items, scanId)); } catch (e) { return { error: String(e) }; } });
    ipcMain.handle(IPC_CHANNELS.RAM_INFO, async () => { try { return await ramOptimizer.scan(); } catch (e) { return { error: String(e) }; } });
    ipcMain.handle(IPC_CHANNELS.RAM_OPTIMIZE, async () => { try { return await ramOptimizer.clean(); } catch (e) { return { error: String(e) }; } });
    ipcMain.handle(IPC_CHANNELS.PRIVACY_SCAN, async () => { try { const result = await privacyCleaner.scan(); const scanId = logScanResult({ module: privacyCleaner.moduleName, itemsFound: result.items.length, bytesFreed: result.totalBytes }); registerScan(privacyCleaner.moduleName, result.items, scanId); return { ...result, scanId }; } catch (e) { return { error: String(e) }; } });
    ipcMain.handle(IPC_CHANNELS.PRIVACY_CLEAN, async (_, items: unknown, scanId: unknown) => { try { const result = await privacyCleaner.clean(validateCleanup(privacyCleaner.moduleName, items, scanId)); logCleanHistory({ scanId: scanId as number, itemsRemoved: result.itemsRemoved, bytesFreed: result.bytesFreed }); return result; } catch (e) { return { error: String(e) }; } });
    ipcMain.handle(IPC_CHANNELS.DRIVE_HEALTH, async () => { try { return await driveHealth.scan(); } catch (e) { return { error: String(e) }; } });
    void scheduler.loadSchedules();
}
