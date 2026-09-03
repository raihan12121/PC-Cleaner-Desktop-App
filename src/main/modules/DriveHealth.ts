import { BaseModule, ScanItem, ScanResult, CleanResult } from './BaseModule';
import si from 'systeminformation';

export class DriveHealth extends BaseModule {
    readonly moduleName = 'DriveHealth';

    async scan(): Promise<ScanResult> {
        const items: ScanItem[] = [];

        try {
            const diskLayout = await si.diskLayout();

            let idCounter = 1;
            for (const disk of diskLayout) {
                let healthScore = 100;
                let healthStatus = 'Healthy';

                const status = (disk.smartStatus || 'Ok').toLowerCase();
                if (status === 'failing' || status === 'bad' || status === 'error') {
                    healthScore = 20;
                    healthStatus = 'Failing';
                } else if (status === 'warning' || (disk.temperature && disk.temperature > 60)) {
                    healthScore = 60;
                    healthStatus = 'Watch';
                }

                items.push({
                    id: `disk_${idCounter++}`,
                    name: `${disk.vendor || 'Drive'} (${disk.name || disk.device})`,
                    path: disk.device,
                    size: Math.max(0, disk.size || 0),
                    category: 'SMART Status',
                    selected: false,
                    metadata: {
                        type: disk.type,
                        interfaceType: disk.interfaceType,
                        healthScore,
                        healthStatus,
                        temperature: disk.temperature ? `${disk.temperature}°C` : 'Normal'
                    }
                });
            }
        } catch (e) {
            console.error('DriveHealth scan failed:', e);
        }

        return { items, totalBytes: 0 };
    }

    async clean(): Promise<CleanResult> {
        throw new Error('DriveHealth module is read-only operations.');
    }

    async rollback(): Promise<void> {
        throw new Error('Drive health is read-only and cannot be rolled back.');
    }
}
