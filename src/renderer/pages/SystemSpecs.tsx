import React, { useState, useEffect } from 'react';
import { useIpc } from '../hooks/useIpc';
import { IPC_CHANNELS } from '../../main/ipc/channels';

interface SystemSpecsData {
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

const formatBytes = (bytes: number): string => {
    if (!bytes || isNaN(bytes) || bytes <= 0) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1000) return `${(gb / 1024).toFixed(1)} TB`;
    return `${gb.toFixed(1)} GB`;
};

const SystemSpecs: React.FC = () => {
    const { invoke: getSpecs, loading } = useIpc(IPC_CHANNELS.SPECS_GET);
    const [specs, setSpecs] = useState<SystemSpecsData | null>(null);
    const [copied, setCopied] = useState<boolean>(false);

    useEffect(() => {
        getSpecs()
            .then((data: SystemSpecsData & { error?: string }) => {
                if (data && !data.error) {
                    setSpecs(data);
                }
            })
            .catch((e) => console.error('Failed to get specs:', e));
    }, []);

    const copySpecsToClipboard = () => {
        if (!specs) return;

        const summary = [
            `PC Specifications (${specs.os.hostname})`,
            `----------------------------------------`,
            `• Operating System: ${specs.os.distro} (${specs.os.arch}) Build ${specs.os.build}`,
            `• Processor (CPU): ${specs.cpu.brand} (${specs.cpu.cores} Cores, ${specs.cpu.speed} GHz, Socket ${specs.cpu.socket})`,
            `• Graphics (GPU): ${specs.graphics.controllers.map(g => `${g.model} (${g.vram ? `${(g.vram / 1024).toFixed(1)} GB` : 'Integrated'})`).join(', ')}`,
            `• Motherboard: ${specs.motherboard.manufacturer} ${specs.motherboard.model}`,
            `• Memory (RAM): ${formatBytes(specs.memory.totalBytes)} ${specs.memory.modules[0]?.type || 'DDR'} @ ${specs.memory.modules[0]?.clockSpeed || ''} MHz`,
            `• Storage: ${specs.storage.map(s => `${s.name} (${formatBytes(s.size)} ${s.interfaceType} ${s.type})`).join(', ')}`,
            `• BIOS: ${specs.bios.vendor} v${specs.bios.version} (${specs.bios.releaseDate})`,
            `• Displays: ${specs.graphics.displays.map(d => `${d.model || 'Monitor'} ${d.resolutionX}x${d.resolutionY}@${d.currentRefreshRate}Hz`).join(', ')}`
        ].join('\n');

        navigator.clipboard.writeText(summary);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    if (loading && !specs) {
        return (
            <div className="h-full flex items-center justify-center p-8">
                <div className="flex flex-col items-center space-y-3">
                    <div className="w-8 h-8 border-2 border-[#0A84FF] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[13px] text-[var(--apple-text-secondary)] font-medium">
                        Inspecting PC hardware specifications...
                    </span>
                </div>
            </div>
        );
    }

    if (!specs) {
        return (
            <div className="p-8 h-full flex flex-col items-center justify-center">
                <p className="text-[14px] text-[var(--apple-text-secondary)]">Unable to query system specifications.</p>
                <button
                    onClick={() => getSpecs().then(setSpecs)}
                    className="mt-4 px-4 py-2 rounded-xl text-[12px] font-semibold bg-[#0A84FF] text-white"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="p-8 h-full flex flex-col overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--apple-text-primary)]">
                        System Specifications
                    </h1>
                    <p className="text-[13px] text-[var(--apple-text-secondary)] mt-0.5">
                        Hardware components, motherboard architecture, GPU graphics, and memory topology
                    </p>
                </div>

                <button
                    onClick={copySpecsToClipboard}
                    className="px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-[#0A84FF] hover:bg-blue-600 text-white transition-all shadow-sm cursor-pointer flex items-center space-x-2 w-fit"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>{copied ? 'Copied to Clipboard!' : 'Copy System Specs'}</span>
                </button>
            </div>

            {/* Quick Hero Banner */}
            <div className="apple-glass rounded-2xl p-6 mb-6 border border-[var(--apple-glass-border)] bg-gradient-to-r from-blue-500/[0.08] to-purple-500/[0.05]">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A84FF] bg-blue-500/10 px-2 py-0.5 rounded-full">
                            {specs.os.distro} • {specs.os.arch}
                        </span>
                        <h2 className="text-xl font-bold text-[var(--apple-text-primary)] mt-2">
                            {specs.os.hostname}
                        </h2>
                        <p className="text-[12px] text-[var(--apple-text-secondary)] mt-0.5">
                            OS Build {specs.os.build} • {specs.os.uefi ? 'UEFI Boot' : 'Legacy Boot'}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                        <span className="px-3 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[var(--apple-text-primary)] font-semibold">
                            CPU: {specs.cpu.cores} Cores
                        </span>
                        <span className="px-3 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[var(--apple-text-primary)] font-semibold">
                            RAM: {formatBytes(specs.memory.totalBytes)}
                        </span>
                        <span className="px-3 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[var(--apple-text-primary)] font-semibold">
                            Storage: {specs.storage.length} Drives
                        </span>
                    </div>
                </div>
            </div>

            {/* Spec Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-6">
                {/* 1. Processor (CPU) */}
                <div className="apple-glass rounded-2xl p-5 border border-[var(--apple-glass-border)]">
                    <div className="flex items-center space-x-2.5 mb-4 pb-3 border-b border-[var(--apple-glass-border)]">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-[#0A84FF] flex items-center justify-center font-bold">
                            ⚡
                        </div>
                        <div>
                            <h3 className="text-[14px] font-bold text-[var(--apple-text-primary)]">Processor (CPU)</h3>
                            <span className="text-[11px] text-[var(--apple-text-secondary)]">{specs.cpu.manufacturer} Architecture</span>
                        </div>
                    </div>

                    <div className="space-y-2.5 text-[12px]">
                        <div className="flex justify-between py-1">
                            <span className="text-[var(--apple-text-secondary)]">Processor Model</span>
                            <span className="font-semibold text-[var(--apple-text-primary)] text-right">{specs.cpu.brand}</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span className="text-[var(--apple-text-secondary)]">Core Configuration</span>
                            <span className="font-semibold text-[var(--apple-text-primary)]">
                                {specs.cpu.physicalCores} Physical Cores ({specs.cpu.cores} Threads)
                            </span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span className="text-[var(--apple-text-secondary)]">Clock Frequency</span>
                            <span className="font-semibold text-[var(--apple-text-primary)]">
                                {specs.cpu.speed} GHz {specs.cpu.speedMax ? `(Max ${specs.cpu.speedMax} GHz)` : ''}
                            </span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span className="text-[var(--apple-text-secondary)]">Socket</span>
                            <span className="font-mono text-[var(--apple-text-primary)]">{specs.cpu.socket}</span>
                        </div>
                    </div>
                </div>

                {/* 2. Graphics (GPU) */}
                <div className="apple-glass rounded-2xl p-5 border border-[var(--apple-glass-border)]">
                    <div className="flex items-center space-x-2.5 mb-4 pb-3 border-b border-[var(--apple-glass-border)]">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-[#AF52DE] flex items-center justify-center font-bold">
                            🎮
                        </div>
                        <div>
                            <h3 className="text-[14px] font-bold text-[var(--apple-text-primary)]">Graphics (GPU)</h3>
                            <span className="text-[11px] text-[var(--apple-text-secondary)]">Video Adapters & Displays</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {specs.graphics.controllers.map((gpu, idx) => (
                            <div key={idx} className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] text-[12px]">
                                <div className="flex justify-between font-semibold text-[var(--apple-text-primary)]">
                                    <span>{gpu.model}</span>
                                    <span className="text-[#AF52DE]">
                                        {gpu.vram ? `${(gpu.vram / 1024).toFixed(1)} GB VRAM` : 'Shared VRAM'}
                                    </span>
                                </div>
                                <div className="text-[11px] text-[var(--apple-text-secondary)] mt-1 flex justify-between">
                                    <span>Vendor: {gpu.vendor}</span>
                                    {gpu.driverVersion && <span>Driver: {gpu.driverVersion}</span>}
                                </div>
                            </div>
                        ))}

                        {specs.graphics.displays.length > 0 && (
                            <div className="pt-2 text-[12px]">
                                <span className="text-[var(--apple-text-secondary)] font-semibold">Active Displays:</span>
                                <div className="mt-1 space-y-1">
                                    {specs.graphics.displays.map((disp, idx) => (
                                        <div key={idx} className="flex justify-between text-[11px] text-[var(--apple-text-primary)]">
                                            <span>{disp.model || disp.vendor || `Display ${idx + 1}`}</span>
                                            <span className="font-mono text-[#0A84FF]">
                                                {disp.resolutionX}x{disp.resolutionY} @ {disp.currentRefreshRate || 60}Hz
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Motherboard & BIOS */}
                <div className="apple-glass rounded-2xl p-5 border border-[var(--apple-glass-border)]">
                    <div className="flex items-center space-x-2.5 mb-4 pb-3 border-b border-[var(--apple-glass-border)]">
                        <div className="w-8 h-8 rounded-lg bg-green-500/10 text-[#30D158] flex items-center justify-center font-bold">
                            🧩
                        </div>
                        <div>
                            <h3 className="text-[14px] font-bold text-[var(--apple-text-primary)]">Motherboard & BIOS</h3>
                            <span className="text-[11px] text-[var(--apple-text-secondary)]">Baseboard & Firmware Details</span>
                        </div>
                    </div>

                    <div className="space-y-2.5 text-[12px]">
                        <div className="flex justify-between py-1">
                            <span className="text-[var(--apple-text-secondary)]">Motherboard</span>
                            <span className="font-semibold text-[var(--apple-text-primary)] text-right">
                                {specs.motherboard.manufacturer} {specs.motherboard.model}
                            </span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span className="text-[var(--apple-text-secondary)]">Board Version</span>
                            <span className="font-mono text-[var(--apple-text-primary)]">{specs.motherboard.version}</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span className="text-[var(--apple-text-secondary)]">BIOS Vendor</span>
                            <span className="font-semibold text-[var(--apple-text-primary)]">{specs.bios.vendor}</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span className="text-[var(--apple-text-secondary)]">BIOS Version & Date</span>
                            <span className="font-mono text-[var(--apple-text-primary)]">
                                v{specs.bios.version} ({specs.bios.releaseDate})
                            </span>
                        </div>
                    </div>
                </div>

                {/* 4. Memory (RAM) */}
                <div className="apple-glass rounded-2xl p-5 border border-[var(--apple-glass-border)]">
                    <div className="flex items-center space-x-2.5 mb-4 pb-3 border-b border-[var(--apple-glass-border)]">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-[#FF9F0A] flex items-center justify-center font-bold">
                            💾
                        </div>
                        <div>
                            <h3 className="text-[14px] font-bold text-[var(--apple-text-primary)]">Memory (RAM)</h3>
                            <span className="text-[11px] text-[var(--apple-text-secondary)]">Installed System Memory</span>
                        </div>
                    </div>

                    <div className="space-y-2.5 text-[12px]">
                        <div className="flex justify-between py-1">
                            <span className="text-[var(--apple-text-secondary)]">Installed Total</span>
                            <span className="font-bold text-[var(--apple-text-primary)]">
                                {formatBytes(specs.memory.totalBytes)}
                            </span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span className="text-[var(--apple-text-secondary)]">Available / Free</span>
                            <span className="font-semibold text-[#30D158]">
                                {formatBytes(specs.memory.freeBytes)}
                            </span>
                        </div>

                        {specs.memory.modules.length > 0 && (
                            <div className="pt-2">
                                <span className="text-[11px] font-semibold text-[var(--apple-text-secondary)]">
                                    Memory Modules ({specs.memory.modules.length} Installed):
                                </span>
                                <div className="mt-1 space-y-1.5">
                                    {specs.memory.modules.map((mod, idx) => (
                                        <div key={idx} className="p-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] flex justify-between text-[11px]">
                                            <span className="font-semibold text-[var(--apple-text-primary)]">
                                                Slot {idx + 1}: {formatBytes(mod.size)} {mod.type}
                                            </span>
                                            <span className="font-mono text-[#0A84FF]">
                                                {mod.clockSpeed ? `${mod.clockSpeed} MHz` : 'Standard'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 5. Physical Storage Disks */}
                <div className="apple-glass rounded-2xl p-5 border border-[var(--apple-glass-border)] md:col-span-2">
                    <div className="flex items-center space-x-2.5 mb-4 pb-3 border-b border-[var(--apple-glass-border)]">
                        <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-[#64D2FF] flex items-center justify-center font-bold">
                            💽
                        </div>
                        <div>
                            <h3 className="text-[14px] font-bold text-[var(--apple-text-primary)]">Storage Devices</h3>
                            <span className="text-[11px] text-[var(--apple-text-secondary)]">Physical NVMe, SSD, and Hard Drives</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {specs.storage.map((disk, idx) => (
                            <div key={idx} className="p-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-[var(--apple-glass-border)]">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-[13px] text-[var(--apple-text-primary)] truncate">
                                        {disk.name}
                                    </h4>
                                    <span className="font-mono font-bold text-[#0A84FF] text-[13px]">
                                        {formatBytes(disk.size)}
                                    </span>
                                </div>
                                <div className="flex items-center space-x-3 text-[11px] text-[var(--apple-text-secondary)] mt-1.5">
                                    <span className="px-2 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.06] font-semibold">
                                        {disk.type}
                                    </span>
                                    <span>Interface: {disk.interfaceType}</span>
                                    {disk.vendor && <span>Vendor: {disk.vendor}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemSpecs;
