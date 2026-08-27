import React, { useState } from 'react';
import { useIpc } from '../hooks/useIpc';
import { IPC_CHANNELS } from '../../main/ipc/channels';

interface ScanItem {
    id: string;
    path: string;
    name: string;
    size: number;
    category: string;
    selected: boolean;
}

interface ScanResult {
    items: ScanItem[];
    totalBytes: number;
    scanId: number;
}

interface CleanSummary {
    itemsRemoved: number;
    bytesFreed: number;
    success: boolean;
}

const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const DuplicateFinder: React.FC = () => {
    const { invoke: startScan, loading: scanning, error, data: scanData, setData: setScanData } = useIpc<ScanResult>(IPC_CHANNELS.DUPLICATE_SCAN);
    const [cleaning, setCleaning] = useState(false);
    const [cleanSummary, setCleanSummary] = useState<CleanSummary | null>(null);

    const handleScan = () => {
        setCleanSummary(null);
        startScan();
    };

    const handleClean = async () => {
        if (!scanData) return;
        const selected = scanData.items.filter(i => i.selected);
        if (selected.length === 0) return;

        if (confirm(`Remove ${selected.length} duplicate files? They will be backed up to the recovery folder first.`)) {
            setCleaning(true);
            try {
                const result = await window.api.invoke(IPC_CHANNELS.DUPLICATE_CLEAN, selected, scanData.scanId);
                setCleanSummary(result);
                setScanData({
                    ...scanData,
                    items: scanData.items.filter(item => !selected.find(s => s.id === item.id)),
                    totalBytes: scanData.totalBytes - result.bytesFreed
                });
            } catch (e: any) {
                alert('Deduplication failed: ' + (e?.message || e));
            } finally {
                setCleaning(false);
            }
        }
    };

    const toggleItem = (id: string) => {
        if (!scanData) return;
        setScanData({
            ...scanData,
            items: scanData.items.map(item => item.id === id ? { ...item, selected: !item.selected } : item)
        });
    };

    return (
        <div className="p-8 h-full flex flex-col pt-12 overflow-y-auto">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Duplicate Finder</h1>
                    <p className="text-slate-400">Detect identical files using SHA-256 binary verification.</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={handleScan}
                        disabled={scanning || cleaning}
                        className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all border border-slate-700"
                    >
                        {scanning ? 'Analyzing...' : 'Scan Downloads'}
                    </button>
                    <button
                        onClick={handleClean}
                        disabled={!scanData || scanData.items.filter(i => i.selected).length === 0 || cleaning}
                        className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-cyan-900/20"
                    >
                        {cleaning ? 'Removing...' : 'Delete Selected'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                    Scan failed: {error}
                </div>
            )}

            {cleanSummary && (
                <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex justify-between items-center animate-in fade-in slide-in-from-top-4">
                    <div>
                        <div className="font-bold text-green-400 text-lg">De-duplication Successful</div>
                        <div className="text-sm text-slate-400">Moved {cleanSummary.itemsRemoved} files to recovery.</div>
                    </div>
                    <div className="text-2xl font-black text-white">{formatBytes(cleanSummary.bytesFreed)} saved</div>
                </div>
            )}

            <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
                {!scanData && !scanning && (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                        <svg className="w-16 h-16 mb-4 opacity-20" width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        <p className="text-lg font-medium">Verify file identity across your system</p>
                    </div>
                )}

                {scanning && (
                    <div className="flex-1 flex flex-col items-center justify-center text-cyan-400">
                        <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-4"></div>
                        <p className="animate-pulse font-bold tracking-widest uppercase text-xs">Computing Binary Hashes...</p>
                    </div>
                )}

                {scanData && !scanning && (
                    <div className="flex-1 overflow-y-auto">
                        {scanData.items.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-500">No duplicates found.</div>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-800/50 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Verify</th>
                                        <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-[10px]">File Name</th>
                                        <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Path</th>
                                        <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-[10px] text-right">Size</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {scanData.items.map(item => (
                                        <tr
                                            key={item.id}
                                            onClick={() => toggleItem(item.id)}
                                            className={`hover:bg-slate-800/30 cursor-pointer transition-colors ${item.selected ? 'bg-cyan-500/5' : ''}`}
                                        >
                                            <td className="px-6 py-4">
                                                <div className={`w-5 h-5 border rounded flex items-center justify-center transition-all ${item.selected ? 'bg-cyan-500 border-cyan-400 shadow-sm' : 'border-slate-700 bg-slate-900'}`}>
                                                    {item.selected && (
                                                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-semibold text-slate-200">{item.name}</td>
                                            <td className="px-6 py-4 text-xs text-slate-500 truncate max-w-xs">{item.path}</td>
                                            <td className="px-6 py-4 text-right font-mono text-slate-400">{formatBytes(item.size)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DuplicateFinder;
