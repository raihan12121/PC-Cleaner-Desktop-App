import React, { useEffect, useState } from 'react';
import { useIpc } from '../hooks/useIpc';
import { IPC_CHANNELS } from '../../main/ipc/channels';

const Optimizer: React.FC = () => {
    const { invoke: scanRam, loading: ramScanning } = useIpc(IPC_CHANNELS.RAM_INFO);
    const { invoke: optimizeRam, loading: ramOptimizing } = useIpc(IPC_CHANNELS.RAM_OPTIMIZE);
    const { invoke: getStartup, loading: startupScanning } = useIpc(IPC_CHANNELS.STARTUP_SCAN);
    const { invoke: toggleStartup } = useIpc(IPC_CHANNELS.STARTUP_TOGGLE);

    const [ramUsage, setRamUsage] = useState<number>(0);
    const [ramTotal, setRamTotal] = useState<number>(1);
    const [ramSaved, setRamSaved] = useState<number | null>(null);
    const [startupItems, setStartupItems] = useState<any[]>([]);

    const fetchRam = async () => {
        try {
            const result = await scanRam();
            if (result && result.items && result.items.length > 0) {
                setRamUsage(result.items[0].size);
                setRamTotal(result.items[0].metadata.total || 1);
            }
        } catch (e) { }
    };

    const fetchStartup = async () => {
        try {
            const result = await getStartup();
            if (result && Array.isArray(result.items)) {
                setStartupItems(result.items);
            }
        } catch (e) { }
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
        } catch (e) { }
    };

    const handleToggleStartup = async (item: any) => {
        try {
            // In our current implementation, "clean" deletes it from registry
            // So we just call the toggle IPC with the selected item
            await toggleStartup([item]);
            fetchStartup();
        } catch (e) { }
    };

    const ramPercent = Math.round((ramUsage / ramTotal) * 100) || 0;

    return (
        <div className="p-8 h-full flex flex-col pt-12 overflow-y-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Optimizer</h1>
                <p className="text-slate-400">Speed up your system by managing startup apps and RAM.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Startup Manager */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col col-span-1 lg:col-span-2 min-h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Startup Apps</h3>
                        <button onClick={fetchStartup} className="text-xs text-cyan-400 hover:text-cyan-300">Refresh</button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2">
                        {startupScanning ? (
                            <div className="h-full flex items-center justify-center text-slate-500 italic">Scanning...</div>
                        ) : startupItems.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-500 italic">No startup items found.</div>
                        ) : (
                            <div className="space-y-2">
                                {startupItems.map(app => (
                                    <div key={app.id} className="flex items-center justify-between p-4 bg-slate-800/20 border border-slate-800/50 rounded-lg hover:bg-slate-800/40 hover:border-slate-700/50 transition-all">
                                        <div className="overflow-hidden mr-4">
                                            <div className="font-semibold text-slate-200 truncate">{app.name}</div>
                                            <div className="text-xs text-slate-500 truncate" title={app.path}>{app.path}</div>
                                        </div>
                                        <div>
                                            <button
                                                onClick={() => handleToggleStartup(app)}
                                                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                                            >
                                                REMOVE
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* RAM Optimizer */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col items-center h-fit sticky top-0">
                    <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider w-full mb-6 text-left">RAM Optimizer</h3>

                    <div className="relative w-40 h-40 flex items-center justify-center mb-8">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="10" />
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#8b5cf6" strokeWidth="10"
                                strokeDasharray={`${ramPercent * 2.82} 282`} strokeLinecap="round"
                                className="transition-all duration-1000 ease-out" />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                            <span className="text-3xl font-bold text-white">{ramPercent}%</span>
                            <span className="text-xs text-slate-400 uppercase tracking-wider">Used</span>
                        </div>
                    </div>

                    <div className="w-full space-y-4">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">Memory Status</span>
                            <span className="text-slate-200">{(ramUsage / (1024 ** 3)).toFixed(1)} GB / {(ramTotal / (1024 ** 3)).toFixed(1)} GB</span>
                        </div>

                        <button
                            onClick={handleOptimizeRam}
                            disabled={ramOptimizing || ramScanning}
                            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold transition-all transform active:scale-[0.98] shadow-lg shadow-purple-900/20 disabled:opacity-50"
                        >
                            {ramOptimizing ? 'Flushing Memory...' : 'Optimize Now'}
                        </button>
                    </div>

                    {ramSaved !== null && (
                        <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-center w-full animate-in fade-in slide-in-from-top-2 duration-700">
                            <div className="text-xs text-green-500 font-bold uppercase tracking-wider mb-1">Success</div>
                            <div className="text-green-400 font-bold text-lg">Freed {(ramSaved / (1024 ** 2)).toFixed(0)} MB</div>
                            <div className="text-[10px] text-slate-500 mt-1">System responsiveness improved</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Optimizer;
