import React, { useState, useMemo, useEffect } from 'react';
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

interface CleanSummary {
    itemsRemoved: number;
    bytesFreed: number;
    skippedCount?: number;
    removedItemIds?: string[];
    success: boolean;
    error?: string;
}

interface CleanProgress {
    processed: number;
    total: number;
    percentage: number;
    currentItemName?: string;
    currentPath?: string;
    currentCategory?: string;
    bytesFreed: number;
    totalBytes: number;
    remainingItems: number;
    remainingBytes: number;
    itemsRemoved: number;
    skippedCount: number;
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
    const [cleanProgress, setCleanProgress] = useState<CleanProgress | null>(null);
    const [cleanSummary, setCleanSummary] = useState<CleanSummary | null>(null);
    const [cleanError, setCleanError] = useState<string | null>(null);
    const [secureShred, setSecureShred] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');

    // Subscribe to real-time progress events from the main process
    useEffect(() => {
        if (!cleaning) return;
        const unsubscribe = window.api.on('disk:clean:progress', (data: CleanProgress) => {
            setCleanProgress(data);
        });
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [cleaning]);

    const handleScan = () => {
        setCleanSummary(null);
        setCleanError(null);
        setCleanProgress(null);
        setSelectedCategory('All');
        invoke();
    };

    const handleClean = async () => {
        if (!scanData || !scanData.items) return;

        const itemsToClean = scanData.items.filter(item => item.selected);
        if (itemsToClean.length === 0) return;

        const confirmMsg = secureShred
            ? `Are you sure you want to securely shred ${itemsToClean.length.toLocaleString()} items? This action will overwrite files with 3 random passes and is IRREVERSIBLE.`
            : `Are you sure you want to clean ${itemsToClean.length.toLocaleString()} junk items?`;

        if (!confirm(confirmMsg)) {
            return;
        }

        setCleaning(true);
        setCleanError(null);
        setCleanProgress({
            processed: 0,
            total: itemsToClean.length,
            percentage: 0,
            bytesFreed: 0,
            totalBytes: itemsToClean.reduce((acc, i) => acc + (i.size || 0), 0),
            remainingItems: itemsToClean.length,
            remainingBytes: itemsToClean.reduce((acc, i) => acc + (i.size || 0), 0),
            itemsRemoved: 0,
            skippedCount: 0,
            currentItemName: 'Starting cleanup sequence...'
        });

        try {
            const result = await window.api.invoke('disk:clean', itemsToClean, scanData.scanId, { shred: secureShred });

            if (result && result.error) {
                setCleanError(result.error);
                return;
            }

            setCleanSummary(result);

            // Only remove items from the view that were ACTUALLY removed from disk
            const removedSet = new Set(result?.removedItemIds || []);
            const remainingItems = scanData.items.filter(item => !removedSet.has(item.id));
            const newTotalBytes = Math.max(0, scanData.totalBytes - (result?.bytesFreed || 0));

            setScanData({
                ...scanData,
                items: remainingItems,
                totalBytes: newTotalBytes
            });
        } catch (e: unknown) {
            const err = e as Error;
            console.error('Clean failed:', err);
            setCleanError(err?.message || String(e));
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

    const handleSelectAll = (select: boolean) => {
        if (!scanData) return;
        setScanData({
            ...scanData,
            items: scanData.items.map(item => {
                if (selectedCategory === 'All' || item.category === selectedCategory) {
                    return { ...item, selected: select };
                }
                return item;
            })
        });
    };

    // Group categories with stats
    const categories = useMemo(() => {
        if (!scanData?.items) return [];
        const catMap = new Map<string, { count: number; bytes: number }>();
        for (const item of scanData.items) {
            const cur = catMap.get(item.category) || { count: 0, bytes: 0 };
            cur.count++;
            cur.bytes += item.size;
            catMap.set(item.category, cur);
        }
        return Array.from(catMap.entries()).map(([name, stats]) => ({
            name,
            count: stats.count,
            bytes: stats.bytes
        }));
    }, [scanData]);

    const displayedItems = useMemo(() => {
        if (!scanData?.items) return [];
        if (selectedCategory === 'All') return scanData.items;
        return scanData.items.filter(i => i.category === selectedCategory);
    }, [scanData, selectedCategory]);

    const selectedCount = useMemo(() => {
        return scanData?.items.filter(i => i.selected).length || 0;
    }, [scanData]);

    const selectedBytes = useMemo(() => {
        return scanData?.items.filter(i => i.selected).reduce((acc, i) => acc + i.size, 0) || 0;
    }, [scanData]);

    return (
        <div className="p-8 h-full flex flex-col pt-12 overflow-hidden relative">
            {/* Header section */}
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">Disk Cleaner</h1>
                    <p className="text-slate-400 text-sm">Clean temporary files, system caches, browser junk, and empty Recycle Bin.</p>
                </div>
                <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer bg-slate-900/60 border border-slate-800 px-3 py-2 rounded-lg hover:border-slate-700 transition-colors">
                        <input
                            type="checkbox"
                            checked={secureShred}
                            disabled={cleaning || scanning}
                            onChange={(e) => setSecureShred(e.target.checked)}
                            className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 bg-slate-800"
                        />
                        <span className="font-medium">3-Pass Secure Shred</span>
                    </label>

                    <button
                        onClick={handleScan}
                        disabled={scanning || cleaning}
                        className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 border border-slate-700 shadow-sm"
                    >
                        {scanning ? 'Scanning...' : 'Scan System'}
                    </button>
                    <button
                        onClick={handleClean}
                        disabled={!scanData || selectedCount === 0 || cleaning || scanning}
                        className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-bold transition-all shadow-lg shadow-cyan-600/20 disabled:opacity-50 disabled:shadow-none"
                    >
                        {cleaning ? (secureShred ? 'Shredding...' : 'Cleaning...') : `Clean Selected (${selectedCount.toLocaleString()})`}
                    </button>
                </div>
            </div>

            {/* Error notifications */}
            {(error || cleanError) && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-lg mb-4 shrink-0">
                    <p className="font-semibold">{error ? `Scan failed: ${error}` : `Clean error: ${cleanError}`}</p>
                </div>
            )}

            {/* Success / Summary banner after cleanup */}
            {cleanSummary && !cleaning && (
                <div className={`border p-4 rounded-lg mb-4 shrink-0 flex justify-between items-center ${
                    cleanSummary.itemsRemoved > 0
                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}>
                    <div>
                        <h3 className="font-bold text-base mb-0.5">
                            {cleanSummary.itemsRemoved > 0 ? 'Cleanup Completed' : 'Files Skipped'}
                        </h3>
                        <p className="text-xs">
                            {cleanSummary.itemsRemoved > 0
                                ? `Successfully deleted ${cleanSummary.itemsRemoved.toLocaleString()} items.${cleanSummary.skippedCount ? ` (${cleanSummary.skippedCount.toLocaleString()} locked files currently in-use by open apps were safely skipped).` : ''}`
                                : 'All selected items are currently in-use by active applications (e.g. Chrome, IDE, Windows) and were skipped.'}
                        </p>
                    </div>
                    <div className="text-2xl font-bold text-green-300">
                        {formatBytes(cleanSummary.bytesFreed)} Freed
                    </div>
                </div>
            )}

            {/* Main content view */}
            <div className="flex-1 bg-slate-900/40 rounded-xl border border-slate-800 overflow-hidden flex flex-col min-h-0 relative">
                {/* Empty initial state */}
                {!scanData && !scanning && !cleaning && (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                        <svg className="w-16 h-16 mb-4 opacity-50" width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <p className="text-lg font-medium">Click Scan System to locate junk files</p>
                        <p className="text-xs text-slate-600 mt-1">Scans Windows Temp, System Caches, Browser Caches, Crash Dumps & Recycle Bin</p>
                    </div>
                )}

                {/* Scanning Animation */}
                {scanning && (
                    <div className="flex-1 flex flex-col items-center justify-center text-cyan-400">
                        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-4"></div>
                        <p className="font-semibold text-lg">Deep scanning file system...</p>
                        <p className="text-xs text-slate-400 mt-1">Checking temporary folders, browser caches, and system dumps</p>
                    </div>
                )}

                {/* Scan Results View */}
                {scanData && !scanning && !cleaning && (
                    <>
                        {/* Header stats & select buttons */}
                        <div className="bg-slate-900 px-6 py-3 border-b border-slate-800 flex justify-between items-center shrink-0">
                            <div className="flex items-center space-x-6 text-sm">
                                <div className="text-slate-300">
                                    <span className="font-bold text-white">{scanData.items.length.toLocaleString()}</span> items found
                                </div>
                                <div className="text-slate-400">
                                    Selected: <span className="text-cyan-400 font-semibold">{selectedCount.toLocaleString()}</span> ({formatBytes(selectedBytes)})
                                </div>
                            </div>
                            <div className="flex items-center space-x-4">
                                <button
                                    onClick={() => handleSelectAll(true)}
                                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                                >
                                    Select All
                                </button>
                                <span className="text-slate-700">|</span>
                                <button
                                    onClick={() => handleSelectAll(false)}
                                    className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                                >
                                    Deselect All
                                </button>
                                <div className="text-lg font-bold text-cyan-400 pl-4 border-l border-slate-800 font-mono">
                                    {formatBytes(scanData.totalBytes)} total
                                </div>
                            </div>
                        </div>

                        {/* Category filter pills */}
                        {categories.length > 1 && (
                            <div className="bg-slate-900/70 px-4 py-2 border-b border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0 custom-scrollbar">
                                <button
                                    onClick={() => setSelectedCategory('All')}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                                        selectedCategory === 'All'
                                            ? 'bg-cyan-500 text-slate-950 font-bold'
                                            : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                                    }`}
                                >
                                    All ({scanData.items.length.toLocaleString()})
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat.name}
                                        onClick={() => setSelectedCategory(cat.name)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                                            selectedCategory === cat.name
                                                ? 'bg-cyan-500 text-slate-950 font-bold'
                                                : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                                        }`}
                                    >
                                        {cat.name} ({cat.count.toLocaleString()}) · {formatBytes(cat.bytes)}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Items list */}
                        <div className="flex-1 overflow-y-auto p-2">
                            {displayedItems.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-green-400/70">
                                    <p>No junk files found in this category.</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {displayedItems.map(item => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between p-2.5 hover:bg-slate-800/60 rounded-lg transition-colors group cursor-pointer"
                                            onClick={() => toggleItem(item.id)}
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden min-w-0">
                                                <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
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
                                                <div className="truncate min-w-0">
                                                    <div className="flex items-center space-x-2">
                                                        <span className="font-medium text-slate-200 truncate text-sm">{item.name}</span>
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold shrink-0">{item.category}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 truncate font-mono mt-0.5" title={item.path}>{item.path}</p>
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right pl-4">
                                                <span className="text-xs font-mono text-slate-300 bg-slate-900/80 border border-slate-800 px-2 py-1 rounded">
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

                {/* Real-time Dynamic Progress & Cleaning Animation Overlay */}
                {cleaning && (
                    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-8 z-30 animate-in fade-in duration-300">
                        <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-cyan-950/30 flex flex-col items-center">
                            
                            {/* Mode badge */}
                            <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-6">
                                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                                <span>{secureShred ? '3-Pass Cryptographic Shredding' : 'Turbo Cleaning Engine'}</span>
                            </div>

                            {/* Circular progress visual and percentage */}
                            <div className="relative w-36 h-36 flex items-center justify-center mb-6">
                                <svg className="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_12px_rgba(6,182,212,0.3)]" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="44" fill="none" stroke="#1e293b" strokeWidth="7" />
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="44"
                                        fill="none"
                                        stroke="url(#progressGradient)"
                                        strokeWidth="7"
                                        strokeDasharray={`${((cleanProgress?.percentage ?? 0) * 2.76).toFixed(1)} 276`}
                                        strokeLinecap="round"
                                        className="transition-all duration-300 ease-out"
                                    />
                                    <defs>
                                        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#06b6d4" />
                                            <stop offset="50%" stopColor="#3b82f6" />
                                            <stop offset="100%" stopColor="#8b5cf6" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className="absolute flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-white font-mono tracking-tight">
                                        {cleanProgress?.percentage ?? 0}%
                                    </span>
                                    <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400">Complete</span>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-800/80 h-3 rounded-full overflow-hidden p-0.5 border border-slate-700/50 mb-6 relative">
                                <div
                                    className="bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300 shadow-md shadow-cyan-500/50 relative overflow-hidden"
                                    style={{ width: `${Math.max(2, cleanProgress?.percentage ?? 0)}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                </div>
                            </div>

                            {/* Live Dual Comparison Grid: Done vs Left */}
                            <div className="grid grid-cols-2 gap-4 w-full mb-6">
                                {/* Done Card */}
                                <div className="bg-slate-950/60 border border-green-500/20 rounded-xl p-4 flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-green-400 uppercase tracking-wider flex items-center">
                                            <svg className="w-3.5 h-3.5 mr-1.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                            Cleaning Done
                                        </span>
                                        <span className="text-xs font-mono font-bold text-green-300 bg-green-500/10 px-2 py-0.5 rounded">
                                            {formatBytes(cleanProgress?.bytesFreed ?? 0)} Freed
                                        </span>
                                    </div>
                                    <div className="text-xl font-black text-white font-mono">
                                        {(cleanProgress?.itemsRemoved ?? 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">files deleted</span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-1">
                                        Processed {(cleanProgress?.processed ?? 0).toLocaleString()} of {(cleanProgress?.total ?? 0).toLocaleString()} items
                                    </div>
                                </div>

                                {/* Left Card */}
                                <div className="bg-slate-950/60 border border-cyan-500/20 rounded-xl p-4 flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center">
                                            <svg className="w-3.5 h-3.5 mr-1.5 text-cyan-400 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Left to Clean
                                        </span>
                                        <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded">
                                            {formatBytes(cleanProgress?.remainingBytes ?? 0)} Left
                                        </span>
                                    </div>
                                    <div className="text-xl font-black text-white font-mono">
                                        {(cleanProgress?.remainingItems ?? 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">files remaining</span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-1">
                                        {cleanProgress?.skippedCount ? `${cleanProgress.skippedCount.toLocaleString()} locked files skipped` : 'Purging unneeded disk cache'}
                                    </div>
                                </div>
                            </div>

                            {/* Current File Activity Ticker */}
                            <div className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                                    <svg className="w-4 h-4 text-cyan-400 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="overflow-hidden min-w-0 flex-1">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xs font-semibold text-slate-200 truncate">
                                            {cleanProgress?.currentItemName || 'Processing junk files...'}
                                        </span>
                                        {cleanProgress?.currentCategory && (
                                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-400 font-bold shrink-0">
                                                {cleanProgress.currentCategory}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                                        {cleanProgress?.currentPath || 'Optimizing storage blocks and directories'}
                                    </p>
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Cleaner;
