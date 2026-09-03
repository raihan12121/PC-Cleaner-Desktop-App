import React, { useEffect, useState } from 'react';
import { useIpc } from '../hooks/useIpc';
import { IPC_CHANNELS } from '../../main/ipc/channels';

interface StartupItem {
    id: string;
    name: string;
    path: string;
    category: string;
}

const Optimizer: React.FC = () => {
    const { invoke: scanRam, loading: ramScanning } = useIpc(IPC_CHANNELS.RAM_INFO);
    const { invoke: optimizeRam, loading: ramOptimizing } = useIpc(IPC_CHANNELS.RAM_OPTIMIZE);
    const { invoke: getStartup, loading: startupScanning } = useIpc(IPC_CHANNELS.STARTUP_SCAN);
    const { invoke: toggleStartup, error: startupError } = useIpc(IPC_CHANNELS.STARTUP_TOGGLE);

    const [ramUsage, setRamUsage] = useState<number>(0);
    const [ramTotal, setRamTotal] = useState<number>(1);
    const [ramSaved, setRamSaved] = useState<number | null>(null);
    const [startupItems, setStartupItems] = useState<StartupItem[]>([]);
    const [startupScanId, setStartupScanId] = useState<number | null>(null);

    const fetchRam = async () => {
        try {
            const result = await scanRam();
            if (result && result.items && result.items.length > 0) {
                setRamUsage(result.items[0].size);
                setRamTotal(result.items[0].metadata?.total || 1);
            }
        } catch { /* displayed through hook state */ }
    };

    const fetchStartup = async () => {
        try {
            const result = await getStartup();
            if (result && Array.isArray(result.items)) {
                setStartupItems(result.items);
                setStartupScanId(result.scanId ?? null);
            }
        } catch { /* displayed through hook state */ }
    };

    useEffect(() => {
        fetchRam();
        fetchStartup();
    }, []);

    const handleOptimizeRam = async () => {
        try {
            const result = await optimizeRam();
            setRamSaved(result.bytesFreed);
            fetchRam();
        } catch { /* displayed through hook state */ }
    };

    const handleToggleStartup = async (item: StartupItem) => {
        try {
            if (!startupScanId) throw new Error('Please refresh startup items before changing them.');
            await toggleStartup([item], startupScanId);
            fetchStartup();
        } catch { /* displayed through hook state */ }
    };

    const ramPercent = Math.round((ramUsage / ramTotal) * 100) || 0;

    return (
        <div className="p-8 h-full flex flex-col overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="mb-6 flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Performance & Memory</h1>
                    <p className="text-[13px] text-[#86868B] mt-0.5">Manage background login items and flush unneeded volatile RAM</p>
                </div>
            </div>

            {startupError && (
                <div className="mb-4 rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 p-3.5 text-[#FF453A] text-[13px] flex items-center space-x-2">
                    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>{startupError}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0">
                {/* macOS Login Items Section */}
                <div className="apple-glass rounded-2xl p-5 flex flex-col col-span-1 lg:col-span-2 min-h-[400px]">
                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/[0.06]">
                        <div>
                            <h2 className="text-[14px] font-bold text-white tracking-tight">Login Items & Background Tasks</h2>
                            <p className="text-[11px] text-[#86868B]">Apps launched automatically when signing into Windows</p>
                        </div>
                        <button
                            onClick={fetchStartup}
                            className="apple-btn-secondary px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center space-x-1.5"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Refresh</span>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {startupScanning ? (
                            <div className="h-full flex flex-col items-center justify-center text-[#86868B]">
                                <div className="w-8 h-8 border-2 border-white/10 border-t-[#0A84FF] rounded-full animate-spin mb-2" />
                                <span className="text-[12px]">Analyzing startup registry keys...</span>
                            </div>
                        ) : startupItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-[#86868B]">
                                <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="text-[13px] font-medium">No background startup items found.</span>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {startupItems.map(app => (
                                    <div
                                        key={app.id}
                                        className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-all"
                                    >
                                        <div className="flex items-center space-x-3 overflow-hidden mr-3">
                                            <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                                                <svg className="w-4 h-4 text-[#0A84FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                            <div className="truncate">
                                                <div className="text-[13px] font-semibold text-white truncate">{app.name}</div>
                                                <div className="text-[11px] text-[#86868B] truncate font-mono mt-0.5" title={app.path}>{app.path}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleToggleStartup(app)}
                                            className="px-3 py-1 rounded-lg text-[11px] font-semibold text-[#FF453A] bg-[#FF453A]/10 border border-[#FF453A]/20 hover:bg-[#FF453A]/20 transition-all shrink-0"
                                        >
                                            Disable
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Apple Memory Purge & Optimization */}
                <div className="apple-glass rounded-2xl p-5 flex flex-col items-center justify-between">
                    <div className="w-full">
                        <h2 className="text-[14px] font-bold text-white tracking-tight">Memory Pressure</h2>
                        <p className="text-[11px] text-[#86868B]">Real-time volatile RAM usage</p>
                    </div>

                    <div className="relative w-36 h-36 flex items-center justify-center my-6">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="8" />
                            <circle
                                cx="50"
                                cy="50"
                                r="42"
                                fill="none"
                                stroke={ramPercent > 80 ? '#FF453A' : ramPercent > 55 ? '#FF9F0A' : '#AF52DE'}
                                strokeWidth="8"
                                strokeDasharray={`${ramPercent * 2.64} 264`}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                            <span className="text-3xl font-extrabold text-white tracking-tight font-mono">{ramPercent}%</span>
                            <span className="text-[10px] text-[#86868B] uppercase tracking-wider font-semibold">Active</span>
                        </div>
                    </div>

                    <div className="w-full space-y-3">
                        <div className="flex justify-between text-[11px] px-1">
                            <span className="text-[#86868B]">RAM Allocated</span>
                            <span className="text-white font-mono font-medium">
                                {(ramUsage / (1024 ** 3)).toFixed(1)} / {(ramTotal / (1024 ** 3)).toFixed(1)} GB
                            </span>
                        </div>

                        <button
                            onClick={handleOptimizeRam}
                            disabled={ramOptimizing || ramScanning}
                            className="w-full py-2.5 rounded-xl font-semibold text-[13px] text-white bg-gradient-to-b from-[#AF52DE] to-[#5E5CE6] border border-white/20 shadow-lg shadow-purple-500/20 active:scale-[0.99] transition-all disabled:opacity-50"
                        >
                            {ramOptimizing ? 'Purging Memory...' : 'Purge Inactive RAM'}
                        </button>
                    </div>

                    {ramSaved !== null && (
                        <div className="mt-4 p-3 bg-[#30D158]/10 border border-[#30D158]/25 rounded-xl text-center w-full">
                            <div className="text-[11px] text-[#30D158] font-bold uppercase tracking-wider">Memory Freed</div>
                            <div className="text-[15px] font-bold text-white font-mono mt-0.5">
                                +{(ramSaved / (1024 ** 2)).toFixed(0)} MB Reclaimed
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Optimizer;
