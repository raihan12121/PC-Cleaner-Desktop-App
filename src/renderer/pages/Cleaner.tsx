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
    const [visibleCount, setVisibleCount] = useState(250);

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
        setVisibleCount(250);
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
        <div className="p-8 h-full flex flex-col overflow-hidden relative">
            {/* Header section */}
            <div className="flex justify-between items-center mb-5 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">System Junk</h1>
                    <p className="text-[13px] text-[#86868B] mt-0.5">Remove application caches, system logs, crash dumps, and Recycle Bin items</p>
                </div>
                <div className="flex items-center space-x-3">
                    {/* Apple Style Toggle */}
                    <label className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] cursor-pointer hover:bg-white/[0.07] transition-all">
                        <span className="text-[12px] font-medium text-[#86868B]">Secure Shred</span>
                        <div
                            onClick={() => setSecureShred(!secureShred)}
                            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                                secureShred ? 'bg-[#30D158]' : 'bg-white/20'
                            }`}
                        >
                            <div
                                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                                    secureShred ? 'translate-x-4' : 'translate-x-0'
                                }`}
                            />
                        </div>
                    </label>

                    <button
                        onClick={handleScan}
                        disabled={scanning || cleaning}
                        className="apple-btn-secondary px-4 py-2 rounded-xl text-[13px] font-semibold flex items-center space-x-2 disabled:opacity-50"
                    >
                        {scanning ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Scanning...</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <span>Scan System</span>
                            </>
                        )}
                    </button>

                    <button
                        onClick={handleClean}
                        disabled={!scanData || selectedCount === 0 || cleaning || scanning}
                        className="apple-btn-primary px-5 py-2 rounded-xl text-[13px] font-semibold flex items-center space-x-2 disabled:opacity-50 shadow-md shadow-blue-500/25"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>{cleaning ? 'Cleaning...' : `Clean (${selectedCount.toLocaleString()})`}</span>
                    </button>
                </div>
            </div>

            {/* Error notifications */}
            {(error || cleanError) && (
                <div className="bg-[#FF453A]/10 border border-[#FF453A]/25 text-[#FF453A] px-4 py-3 rounded-xl mb-4 shrink-0 flex items-center space-x-2.5">
                    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-[13px] font-medium">{error ? `Scan failed: ${error}` : `Clean error: ${cleanError}`}</p>
                </div>
            )}

            {/* Success / Summary Banner */}
            {cleanSummary && !cleaning && (
                <div className={`px-4 py-3 rounded-xl mb-4 shrink-0 flex justify-between items-center border ${
                    cleanSummary.itemsRemoved > 0
                        ? 'bg-[#30D158]/10 border-[#30D158]/25 text-[#30D158]'
                        : 'bg-[#FF9F0A]/10 border-[#FF9F0A]/25 text-[#FF9F0A]'
                }`}>
                    <div className="flex items-center space-x-2.5">
                        <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <div>
                            <h3 className="font-semibold text-[13px]">
                                {cleanSummary.itemsRemoved > 0 ? 'Cleanup Completed' : 'Files Safely Skipped'}
                            </h3>
                            <p className="text-[11px] opacity-90">
                                {cleanSummary.itemsRemoved > 0
                                    ? `Reclaimed ${formatBytes(cleanSummary.bytesFreed)} across ${cleanSummary.itemsRemoved.toLocaleString()} items.${cleanSummary.skippedCount ? ` (${cleanSummary.skippedCount.toLocaleString()} locked files currently open were preserved).` : ''}`
                                    : 'Selected items are locked by running software and were left untouched for safety.'}
                            </p>
                        </div>
                    </div>
                    <div className="text-[15px] font-bold font-mono">
                        {formatBytes(cleanSummary.bytesFreed)} Reclaimed
                    </div>
                </div>
            )}

            {/* Main content view */}
            <div className="flex-1 apple-glass rounded-2xl overflow-hidden flex flex-col min-h-0 relative">
                {/* Empty initial state */}
                {!scanData && !scanning && !cleaning && (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#86868B] p-8">
                        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-[#0A84FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <h2 className="text-[17px] font-semibold text-white mb-1">Clean System Storage</h2>
                        <p className="text-[13px] text-[#86868B] max-w-sm text-center">
                            Scan to inspect user temporary files, crash traces, browser cache hierarchies, and empty the Recycle Bin.
                        </p>
                    </div>
                )}

                {/* Scanning Animation */}
                {scanning && (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#86868B]">
                        <div className="w-10 h-10 border-2 border-white/10 border-t-[#0A84FF] rounded-full animate-spin mb-3" />
                        <p className="text-[14px] font-semibold text-white">Inspecting Storage Structures...</p>
                        <p className="text-[12px] text-[#86868B] mt-1">Analyzing cache trees and system logs</p>
                    </div>
                )}

                {/* Scan Results View */}
                {scanData && !scanning && !cleaning && (
                    <>
                        {/* Apple CleanMyMac Hero Stats Bar */}
                        <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] flex justify-between items-center shrink-0">
                            <div className="flex items-baseline space-x-3">
                                <span className="text-2xl font-extrabold text-white tracking-tight font-mono">
                                    {formatBytes(selectedBytes)}
                                </span>
                                <span className="text-[13px] text-[#86868B] font-medium">
                                    selected of {formatBytes(scanData.totalBytes)} ({scanData.items.length.toLocaleString()} total files)
                                </span>
                            </div>
                            <div className="flex items-center space-x-3">
                                <button
                                    onClick={() => handleSelectAll(true)}
                                    className="text-[12px] font-semibold text-[#0A84FF] hover:underline"
                                >
                                    Select All
                                </button>
                                <span className="text-white/20">|</span>
                                <button
                                    onClick={() => handleSelectAll(false)}
                                    className="text-[12px] font-semibold text-[#86868B] hover:text-white transition-colors"
                                >
                                    Deselect All
                                </button>
                            </div>
                        </div>

                        {/* Apple Capsule Segmented Category Filter */}
                        {categories.length > 1 && (
                            <div className="px-5 py-2.5 border-b border-white/[0.06] bg-black/10 flex items-center gap-1.5 overflow-x-auto shrink-0 custom-scrollbar">
                                <button
                                    onClick={() => setSelectedCategory('All')}
                                    className={`px-3 py-1 rounded-lg text-[12px] font-medium transition-all shrink-0 ${
                                        selectedCategory === 'All'
                                            ? 'bg-white/15 text-white font-semibold shadow-sm'
                                            : 'text-[#86868B] hover:text-white hover:bg-white/[0.05]'
                                    }`}
                                >
                                    All ({scanData.items.length.toLocaleString()})
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat.name}
                                        onClick={() => setSelectedCategory(cat.name)}
                                        className={`px-3 py-1 rounded-lg text-[12px] font-medium transition-all shrink-0 ${
                                            selectedCategory === cat.name
                                                ? 'bg-white/15 text-white font-semibold shadow-sm'
                                                : 'text-[#86868B] hover:text-white hover:bg-white/[0.05]'
                                        }`}
                                    >
                                        {cat.name} · {formatBytes(cat.bytes)}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Items list */}
                        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                            {displayedItems.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-[#30D158]">
                                    <p className="text-[13px] font-medium">No junk files found in this category.</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {displayedItems.slice(0, visibleCount).map(item => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between px-3 py-2 hover:bg-white/[0.05] rounded-xl transition-all group cursor-pointer border border-transparent hover:border-white/[0.04]"
                                            onClick={() => toggleItem(item.id)}
                                        >
                                            <div className="flex items-center space-x-3 overflow-hidden min-w-0">
                                                {/* Apple Styled Checkbox */}
                                                <div className="relative flex items-center justify-center w-4 h-4 shrink-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.selected}
                                                        onChange={(e) => { e.stopPropagation(); toggleItem(item.id); }}
                                                        className="w-full h-full opacity-0 absolute z-10 cursor-pointer"
                                                    />
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                                        item.selected
                                                            ? 'bg-[#0A84FF] border-[#0A84FF] shadow-sm'
                                                            : 'border-white/30 bg-white/[0.05] group-hover:border-white/50'
                                                    }`}>
                                                        {item.selected && (
                                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="truncate min-w-0">
                                                    <div className="flex items-center space-x-2">
                                                        <span className="font-medium text-[#F5F5F7] truncate text-[13px]">{item.name}</span>
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-[#86868B] font-medium shrink-0">
                                                            {item.category}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-[#86868B] truncate font-mono mt-0.5" title={item.path}>
                                                        {item.path}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="shrink-0 text-right pl-3">
                                                <span className="text-[12px] font-mono text-[#86868B] px-2 py-0.5 rounded-md bg-white/[0.03]">
                                                    {formatBytes(item.size)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}

                                    {displayedItems.length > visibleCount && (
                                        <div className="p-3 text-center">
                                            <button
                                                onClick={() => setVisibleCount(prev => prev + 250)}
                                                className="apple-btn-secondary px-4 py-1.5 rounded-xl text-[12px] font-semibold"
                                            >
                                                Load More ({visibleCount} of {displayedItems.length.toLocaleString()} displayed)
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Frosted Progress & Cleaning Animation Modal */}
                {cleaning && (
                    <div className="absolute inset-0 bg-[#161618]/90 backdrop-blur-2xl flex flex-col items-center justify-center p-8 z-30">
                        <div className="w-full max-w-xl apple-glass rounded-2xl p-8 flex flex-col items-center border border-white/10 shadow-2xl">
                            {/* Mode badge */}
                            <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-white text-[11px] font-semibold mb-6">
                                <span className="w-2 h-2 rounded-full bg-[#0A84FF] animate-pulse"></span>
                                <span>{secureShred ? '3-Pass Cryptographic Shredding' : 'Purging System Junk'}</span>
                            </div>

                            {/* Apple Circular Progress */}
                            <div className="relative w-32 h-32 flex items-center justify-center mb-6">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="6" />
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="42"
                                        fill="none"
                                        stroke="#0A84FF"
                                        strokeWidth="6"
                                        strokeDasharray={`${((cleanProgress?.percentage ?? 0) * 2.64).toFixed(1)} 264`}
                                        strokeLinecap="round"
                                        className="transition-all duration-300 ease-out"
                                    />
                                </svg>
                                <div className="absolute flex flex-col items-center justify-center">
                                    <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
                                        {cleanProgress?.percentage ?? 0}%
                                    </span>
                                    <span className="text-[10px] font-medium text-[#86868B] uppercase tracking-wider">Completed</span>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-white/[0.08] h-2 rounded-full overflow-hidden p-0.5 mb-6">
                                <div
                                    className="bg-gradient-to-r from-[#0A84FF] to-[#30D158] h-full rounded-full transition-all duration-300"
                                    style={{ width: `${Math.max(2, cleanProgress?.percentage ?? 0)}%` }}
                                />
                            </div>

                            {/* Dual Stats Grid: Cleaned vs Remaining */}
                            <div className="grid grid-cols-2 gap-3 w-full mb-5">
                                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5">
                                    <div className="text-[11px] text-[#30D158] font-semibold uppercase tracking-wider mb-1">
                                        Reclaimed
                                    </div>
                                    <div className="text-lg font-bold text-white font-mono">
                                        {formatBytes(cleanProgress?.bytesFreed ?? 0)}
                                    </div>
                                    <div className="text-[11px] text-[#86868B] mt-0.5">
                                        {(cleanProgress?.itemsRemoved ?? 0).toLocaleString()} files removed
                                    </div>
                                </div>

                                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5">
                                    <div className="text-[11px] text-[#0A84FF] font-semibold uppercase tracking-wider mb-1">
                                        Remaining
                                    </div>
                                    <div className="text-lg font-bold text-white font-mono">
                                        {formatBytes(cleanProgress?.remainingBytes ?? 0)}
                                    </div>
                                    <div className="text-[11px] text-[#86868B] mt-0.5">
                                        {(cleanProgress?.remainingItems ?? 0).toLocaleString()} files queued
                                    </div>
                                </div>
                            </div>

                            {/* Current File Activity Ticker */}
                            <div className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center space-x-2.5 text-[11px]">
                                <div className="w-2 h-2 rounded-full bg-[#0A84FF] animate-ping shrink-0" />
                                <span className="text-[#86868B] truncate font-mono">
                                    {cleanProgress?.currentItemName || 'Processing files...'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Cleaner;
