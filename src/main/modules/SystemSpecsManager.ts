import si from 'systeminformation';

export interface SystemSpecs {
    cpu: {
        brand: string;
        manufacturer: string;
        speed: number;
        speedMax: number;
        cores: number;
        physicalCores: number;
        socket: string;
    };
    graphics: {
        controllers: Array<{
            vendor: string;
            model: string;
            vram: number;
            driverVersion?: string;
        }>;
        displays: Array<{
            vendor?: string;
            model?: string;
            resolutionX?: number;
            resolutionY?: number;
            currentRefreshRate?: number;
        }>;
    };
    motherboard: {
        manufacturer: string;
        model: string;
        version: string;
        serial?: string;
    };
    bios: {
        vendor: string;
        version: string;
        releaseDate: string;
    };
    memory: {
        totalBytes: number;
        freeBytes: number;
        usedBytes: number;
        modules: Array<{
            size: number;
            type: string;
            clockSpeed?: number;
            manufacturer?: string;
            bank?: string;
        }>;
    };
    os: {
        distro: string;
        release: string;
        build: string;
        arch: string;
        uefi: boolean;
        hostname: string;
    };
    storage: Array<{
        name: string;
        vendor: string;
        type: string;
        interfaceType: string;
        size: number;
    }>;
}

export class SystemSpecsManager {
    /**
     * Retrieve complete PC hardware and software specifications
     */
    async getSpecs(): Promise<SystemSpecs> {
        const [cpu, graphics, baseboard, bios, mem, memLayout, osInfo, diskLayout] = await Promise.all([
            si.cpu().catch(() => ({} as si.Systeminformation.CpuData)),
            si.graphics().catch(() => ({ controllers: [], displays: [] } as si.Systeminformation.GraphicsData)),
            si.baseboard().catch(() => ({} as si.Systeminformation.BaseboardData)),
            si.bios().catch(() => ({} as si.Systeminformation.BiosData)),
            si.mem().catch(() => ({} as si.Systeminformation.MemData)),
            si.memLayout().catch(() => [] as si.Systeminformation.MemLayoutData[]),
            si.osInfo().catch(() => ({} as si.Systeminformation.OsData)),
            si.diskLayout().catch(() => [] as si.Systeminformation.DiskLayoutData[])
        ]);

        const totalMem = Math.max(0, mem.total || 0);
        const freeMem = Math.max(0, mem.free || 0);
        const usedMem = Math.max(0, mem.used || (totalMem - freeMem));

        return {
            cpu: {
                brand: cpu.brand || 'Processor',
                manufacturer: cpu.manufacturer || 'Unknown',
                speed: cpu.speed || 0,
                speedMax: cpu.speedMax || cpu.speed || 0,
                cores: cpu.cores || 1,
                physicalCores: cpu.physicalCores || cpu.cores || 1,
                socket: cpu.socket || 'Integrated'
            },
            graphics: {
                controllers: (graphics.controllers || []).map((c) => ({
                    vendor: c.vendor || 'Unknown',
                    model: c.model || 'Display Adapter',
                    vram: Math.max(0, c.vram || 0),
                    driverVersion: c.driverVersion || undefined
                })),
                displays: (graphics.displays || []).map((d) => ({
                    vendor: d.vendor || undefined,
                    model: d.model || 'Display Monitor',
                    resolutionX: d.resolutionX || undefined,
                    resolutionY: d.resolutionY || undefined,
                    currentRefreshRate: d.currentRefreshRate || undefined
                }))
            },
            motherboard: {
                manufacturer: baseboard.manufacturer || 'Motherboard Manufacturer',
                model: baseboard.model || 'Standard Motherboard',
                version: baseboard.version || '1.0',
                serial: baseboard.serial || undefined
            },
            bios: {
                vendor: bios.vendor || 'Standard BIOS',
                version: bios.version || 'Unknown',
                releaseDate: bios.releaseDate || 'Unknown'
            },
            memory: {
                totalBytes: totalMem,
                freeBytes: freeMem,
                usedBytes: usedMem,
                modules: (memLayout || []).map((m) => ({
                    size: Math.max(0, m.size || 0),
                    type: m.type || 'DDR',
                    clockSpeed: m.clockSpeed || undefined,
                    manufacturer: m.manufacturer && m.manufacturer !== 'Unknown' ? m.manufacturer : undefined,
                    bank: m.bank || undefined
                }))
            },
            os: {
                distro: osInfo.distro || 'Microsoft Windows',
                release: osInfo.release || 'Unknown',
                build: osInfo.build || 'Unknown',
                arch: osInfo.arch || 'x64',
                uefi: Boolean(osInfo.uefi),
                hostname: osInfo.hostname || 'PC'
            },
            storage: (diskLayout || []).map((d) => ({
                name: d.name || d.device || 'Storage Drive',
                vendor: d.vendor || 'Generic',
                type: d.type || 'Drive',
                interfaceType: d.interfaceType || 'SATA',
                size: Math.max(0, d.size || 0)
            }))
        };
    }
}
