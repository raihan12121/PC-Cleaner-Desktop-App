import React, { useState } from 'react';
import { useIpc } from '../hooks/useIpc';

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

const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const Cleaner: React.FC = () => {
    const { invoke, loading: scanning, error, data: scanData, setData: setScanData } = useIpc<ScanResult>('disk:scan');
    const [cleaning, setCleaning] = useState(false);
    const [cleanSummary, setCleanSummary] = useState<{ itemsRemoved: number, bytesFreed: number } | null>(null);

    const handleScan = () => {
        setCleanSummary(null);
        invoke();
    };

    const handleClean = async () => {
        if (!scanData || !scanData.items) return;

        const itemsToClean = scanData.items.filter(item => item.selected);
        if (itemsToClean.length === 0) return;

        if (!confirm(`Are you sure you want to securely delete ${itemsToClean.length} items? This action is IRREVERSIBLE as items will be shredded with 3 random passes.`)) {
            return;
        }

        setCleaning(true);
        try {
            const result = await window.api.invoke('disk:clean', itemsToClean, scanData.scanId);
            setCleanSummary(result);
            // Remove cleaned items from view
            setScanData({
                ...scanData,
                items: scanData.items.filter(item => !itemsToClean.find(i => i.id === item.id)),
                totalBytes: scanData.totalBytes - result.bytesFreed
            });
        } catch (e: unknown) {
            const err = e as Error;
            console.error('Clean failed:', err);
            alert('Clean failed: ' + (err?.message || String(e)));
        } finally {
            setCleaning(false);
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
        <div className="p-8 h-full flex flex-col">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Disk Cleaner</h1>
                    <p className="text-slate-400">Securely shred temporary files, cache, and left-over junk.</p>
                </div>
                <div className="flex space-x-4">
                    <button
                        onClick={handleScan}
                        disabled={scanning || cleaning}
                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 border border-slate-700 shadow-sm"
                    >
                        {scanning ? 'Scanning...' : 'Scan System'}
                    </button>
                    <button
                        onClick={handleClean}
                        disabled={!scanData || scanData.items.filter(i => i.selected).length === 0 || cleaning || scanning}
                        className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-cyan-600/20 disabled:opacity-50 disabled:shadow-none"
                    >
                        {cleaning ? 'Cleaning & Shredding...' : 'Clean Selected'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-lg mb-6">
                    <p>Scan failed: {error}</p>
                </div>
            )}

            {cleanSummary && (
                <div className={`border p-4 rounded-lg mb-6 flex justify-between items-center ${cleanSummary.itemsRemoved > 0 ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                    <div>
                        <h3 className="font-bold text-lg mb-1">{cleanSummary.itemsRemoved > 0 ? 'Cleanup Complete' : 'Files in Use'}</h3>
                        <p>{cleanSummary.itemsRemoved > 0 ? `Successfully securely shredded ${cleanSummary.itemsRemoved} items.` : 'Selected files are currently in-use or locked by active applications and were skipped.'}</p>
                    </div>
                    <div className="text-3xl font-bold text-green-300">
                        {formatBytes(cleanSummary.bytesFreed)} Freed
                    </div>
                </div>
            )}

            <div className="flex-1 bg-slate-900/40 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
                {!scanData && !scanning && (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                        <svg className="w-16 h-16 mb-4 opacity-50" width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <p className="text-lg">Click Scan System to locate junk files</p>
                    </div>
                )}

                {scanning && (
                    <div className="flex-1 flex flex-col items-center justify-center text-cyan-400">
                        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-4"></div>
                        <p>Deep scanning file system...</p>
                    </div>
                )}

                {scanData && !scanning && (
                    <>
                        <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex justify-between items-center shrink-0">
                            <div className="text-slate-300">
                                <span className="font-semibold text-white">{scanData.items.length}</span> items found
                            </div>
                            <div className="text-xl font-bold text-cyan-400">
                                {formatBytes(scanData.totalBytes)} exactly
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {scanData.items.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-green-400/70">
                                    <p>Your system is clean! No junk files found.</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {scanData.items.map(item => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between p-3 hover:bg-slate-800/60 rounded-lg transition-colors group cursor-pointer"
                                            onClick={() => toggleItem(item.id)}
                                        >
                                            <div className="flex items-center gap-4 overflow-hidden">
                                                <div className="relative flex items-center justify-center w-5 h-5 shrink-0 transition-opacity">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.selected}
                                                        onChange={(e) => { e.stopPropagation(); toggleItem(item.id); }}
                                                        className="w-full h-full opacity-0 absolute z-10 cursor-pointer"
                                                    />
                                                    <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors ${item.selected ? 'bg-cyan-500 border-cyan-500' : 'border-slate-600 bg-slate-900/50 group-hover:border-slate-500'}`}>
                                                        {item.selected && (
                                                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="truncate">
                                                    <p className="font-medium text-slate-200 truncate">{item.name}</p>
                                                    <p className="text-xs text-slate-500 truncate" title={item.path}>{item.path}</p>
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right pl-4">
                                                <span className="text-sm font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded badge">
                                                    {formatBytes(item.size)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Cleaner;
