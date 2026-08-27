import { BaseModule, ScanResult, CleanResult } from './BaseModule';
import { DiskCleaner } from './DiskCleaner';
import { PrivacyCleaner } from './PrivacyCleaner';
import * as cron from 'node-cron';
import { getDb } from '../database/db';
import { markScheduleRun } from '../database/queries';

interface ScheduleRow {
    id: number;
    module: string;
    cron_expr: string;
    enabled: number;
    last_run?: string;
}

export class Scheduler extends BaseModule {
    readonly moduleName = 'Scheduler';
    private jobs: Map<string, cron.ScheduledTask> = new Map();

    // Load schedules from SQLite and start them
    public async loadSchedules(): Promise<void> {
        const db = getDb();
        const schedules = db.prepare('SELECT * FROM schedules WHERE enabled = 1').all() as ScheduleRow[];

        // Stop existing
        this.jobs.forEach(job => job.stop());
        this.jobs.clear();

        for (const schedule of schedules) {
            if (cron.validate(schedule.cron_expr)) {
                const task = cron.schedule(schedule.cron_expr, () => {
                    this.executeScheduledTask(schedule.module);
                });
                this.jobs.set(schedule.module, task);
            }
        }
    }

    private async executeScheduledTask(moduleName: string) {
        console.log(`[Scheduler] Executing scheduled task for ${moduleName}`);
        try {
            let cleaner: BaseModule | null = null;
            if (moduleName === 'DiskCleaner') cleaner = new DiskCleaner();
            if (moduleName === 'PrivacyCleaner') cleaner = new PrivacyCleaner();

            if (cleaner) {
                const scan = await cleaner.scan();
                if (scan.items.length > 0) {
                    const result = await cleaner.clean(scan.items);
                    console.log(`[Scheduler] ${moduleName} freed ${(result.bytesFreed / 1024 / 1024).toFixed(2)} MB`);
                }
                markScheduleRun(moduleName);
            }
        } catch (e) {
            console.error(`[Scheduler] Failed to execute ${moduleName}`, e);
        }
    }

    async scan(): Promise<ScanResult> {
        const db = getDb();
        const schedules = db.prepare('SELECT * FROM schedules').all() as ScheduleRow[];

        return {
            items: schedules.map(s => ({
                id: `schedule_${s.id}`,
                name: `${s.module} Schedule`,
                path: s.cron_expr,
                size: 0,
                category: 'Schedules',
                selected: s.enabled === 1
            })),
            totalBytes: 0,
        };
    }

    async clean(): Promise<CleanResult> {
        // Treat clean as save / update
        throw new Error('Scheduler configuration is handled via dedicated DB_SAVE_SCHEDULE IPC channels in settings.');
    }

    async rollback(): Promise<void> {
        throw new Error('Scheduler changes are restored by updating the schedule.');
    }
}
