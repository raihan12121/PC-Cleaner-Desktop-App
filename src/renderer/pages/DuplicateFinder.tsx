import React, { useState } from 'react';
import { useIpc } from '../hooks/useIpc';
import { ScanResult, CleanResult } from '../../main/modules/BaseModule';
import { IPC_CHANNELS } from '../../main/ipc/channels';

interface DuplicateScanResult extends ScanResult {
    scanId?: number;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const DuplicateFinder: React.FC = () => {
    const { invoke: startScan, loading: scanning, error, data: scanData, setData: setScanData } = useIpc<DuplicateScanResult>(IPC_CHANNELS.DUPLICATE_SCAN);
    const [cleaning, setCleaning] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [cleanSummary, setCleanSummary] = useState<CleanResult | null>(null);
    const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

    const handleScan = () => {
        setCleanSummary(null);
        setRestoreStatus(null);
        startScan();
    };

    const handleClean = async () => {
        if (!scanData) return;
        const selected = scanData.items.filter(i => i.selected);
        if (selected.length === 0) return;

        // Group check to warn if user selected 100% of copies in a group
        const groupMap = new Map<string, typeof scanData.items>();
        for (const item of scanData.items) {
            const list = groupMap.get(item.category) || [];
            list.push(item);
            groupMap.set(item.category, list);
        }

        let allCopiesSelected = false;
        for (const [, groupItems] of groupMap.entries()) {
            if (groupItems.length > 1 && groupItems.every(i => i.selected)) {
                allCopiesSelected = true;
                break;
            }
        }

        const confirmMsg = allCopiesSelected
            ? `Warning: You have selected ALL copies of one or more duplicate groups. This will delete every copy of that file (backed up in restore folder). Proceed with deleting ${selected.length} files?`
            : `Remove ${selected.length} duplicate files? Copies will be backed up safely before removal.`;

        if (confirm(confirmMsg)) {
            setCleaning(true);
            try {
                const result = await window.api.invoke(IPC_CHANNELS.DUPLICATE_CLEAN, selected, scanData.scanId);
                if (result && result.error) {
                    throw new Error(result.error);
                }
                setCleanSummary(result);
                setScanData({
                    ...scanData,
                    items: scanData.items.filter(item => !selected.find(s => s.id === item.id)),
                    totalBytes: Math.max(0, scanData.totalBytes - (result.bytesFreed || 0))
                });
            } catch (e: any) {
                alert('Deduplication failed: ' + (e?.message || e));
            } finally {
                setCleaning(false);
            }
        }
    };

    const handleRestore = async () => {
        if (confirm('Restore recently removed duplicate files from backup?')) {
            setRestoring(true);
            setRestoreStatus(null);
            try {
                const res = await window.api.invoke(IPC_CHANNELS.DUPLICATE_ROLLBACK);
                if (res && res.error) {
                    throw new Error(res.error);
                }
                setRestoreStatus('Files restored successfully to their original locations.');
            } catch (e: any) {
                setRestoreStatus('Restore failed: ' + (e?.message || e));
            } finally {
                setRestoring(false);
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

    // Group items by category
    const groupedItems: Array<{ groupName: string; items: typeof scanData.items }> = [];
    if (scanData && scanData.items) {
        const map = new Map<string, typeof scanData.items>();
        for (const item of scanData.items) {
            const list = map.get(item.category) || [];
            list.push(item);
            map.set(item.category, list);
        }
        for (const [groupName, items] of map.entries()) {
            groupedItems.push({ groupName, items });
        }
    }

    return (
        <div className="p-8 h-full flex flex-col pt-12 overflow-y-auto">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Duplicate Finder</h1>
                    <p className="text-slate-400">Detect identical files using SHA-256 binary verification.</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={handleRestore}
                        disabled={scanning || cleaning || restoring}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-all border border-slate-700 text-xs"
                    >
                        {restoring ? 'Restoring...' : 'Restore Backups'}
                    </button>
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

            {restoreStatus && (
                <div className={`mb-6 p-4 rounded-xl border ${restoreStatus.includes('failed') ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'}`}>
                    {restoreStatus}
                </div>
            )}

            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                    Scan failed: {error}
                </div>
            )}

            {cleanSummary && (
                <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 flex items-center justify-between">
                    <div>
                        <div className="font-bold">Cleanup Complete</div>
                        <div className="text-xs text-emerald-500 mt-0.5">Removed {cleanSummary.itemsRemoved} duplicate files and safely freed {formatBytes(cleanSummary.bytesFreed)}.</div>
                    </div>
                </div>
            )}

            {/* Results Table */}
            <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col overflow-hidden backdrop-blur-sm">
                {!scanData && !scanning && (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                        <svg className="w-12 h-12 mb-4 opacity-50 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        <p>Click "Scan Downloads" to analyze disk blocks for exact duplicates.</p>
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
                            <div className="h-full flex items-center justify-center text-slate-500">No duplicates found in Downloads folder.</div>
                        ) : (
                            <div className="divide-y divide-slate-800">
                                {groupedItems.map(group => (
                                    <div key={group.groupName} className="p-4">
                                        <div className="flex items-center justify-between mb-2 px-2">
                                            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">{group.groupName}</span>
                                            <span className="text-[10px] text-slate-500 font-mono">{group.items.length} copies</span>
                                        </div>
                                        <div className="space-y-1">
                                            {group.items.map(item => (
                                                <div
                                                    key={item.id}
                                                    onClick={() => toggleItem(item.id)}
                                                    className={`flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-800/60 cursor-pointer transition-colors ${item.selected ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-slate-950/40'}`}
                                                >
                                                    <div className="flex items-center space-x-3 overflow-hidden min-w-0">
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${item.selected ? 'bg-cyan-500 border-cyan-400' : 'border-slate-700 bg-slate-900'}`}>
                                                            {item.selected && (
                                                                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                        <div className="truncate min-w-0">
                                                            <div className="text-sm font-semibold text-slate-200 truncate">{item.name}</div>
                                                            <div className="text-xs text-slate-500 font-mono truncate">{item.path}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0 pl-4 font-mono text-xs text-slate-400">
                                                        {formatBytes(item.size)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DuplicateFinder;
