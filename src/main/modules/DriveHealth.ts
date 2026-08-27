import { BaseModule, ScanItem, ScanResult, CleanResult } from './BaseModule';
import si from 'systeminformation';

export class DriveHealth extends BaseModule {
    readonly moduleName = 'DriveHealth';

    async scan(): Promise<ScanResult> {
        const items: ScanItem[] = [];

        try {
            const diskLayout = await si.diskLayout();
            const smartData = (await (si as any).smart().catch((): any[] => [])) as any[]; // Handle potential missing or access denied

            let idCounter = 1;
            for (const disk of diskLayout) {
                // Find matching SMART data if available
                const smart = smartData?.find((d: any) => d.device === disk.device);

                let healthScore = 100;
                let healthStatus = 'Healthy';

                // Very basic mock logic to classify based on SMART or defaults
                if (smart) {
                    if (smart.smartStatus?.toLowerCase() === 'failing') {
                        healthScore = 20;
                        healthStatus = 'Failing';
                    } else if (smart.temperature && smart.temperature > 50) {
                        healthScore = 60;
                        healthStatus = 'Watch (High Temp)';
                    }
                }

                items.push({
                    id: `disk_${idCounter++}`,
                    name: `${disk.vendor || 'Drive'} (${disk.name})`,
                    path: disk.device,
                    size: disk.size,
                    category: 'SMART Status',
                    selected: false,
                    metadata: {
                        type: disk.type,
                        interfaceType: disk.interfaceType,
                        healthScore,
                        healthStatus,
                        temperature: smart?.temperature || 'N/A'
                    }
                });
            }
        } catch (e) {
            console.error('DriveHealth scan failed:', e);
        }

        return { items, totalBytes: 0 };
    }

    async clean(): Promise<CleanResult> {
        // Drive Health is read-only monitoring
        throw new Error('DriveHealth module is read-only operations.');
    }

    async rollback(): Promise<void> {
        throw new Error('Drive health is read-only and cannot be rolled back.');
    }
}
