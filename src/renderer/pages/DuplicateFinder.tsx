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

    const selectedCount = scanData?.items.filter(i => i.selected).length || 0;

    return (
        <div className="p-8 h-full flex flex-col overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Duplicate Files</h1>
                    <p className="text-[13px] text-[#86868B] mt-0.5">Detect redundant copies across storage using cryptographic binary hashing</p>
                </div>
                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleRestore}
                        disabled={scanning || cleaning || restoring}
                        className="apple-btn-secondary px-3.5 py-2 rounded-xl text-[12px] font-semibold disabled:opacity-50"
                    >
                        {restoring ? 'Restoring...' : 'Restore Backups'}
                    </button>
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
                            <span>Scan Downloads</span>
                        )}
                    </button>
                    <button
                        onClick={handleClean}
                        disabled={!scanData || selectedCount === 0 || cleaning}
                        className="apple-btn-primary px-5 py-2 rounded-xl text-[13px] font-semibold flex items-center space-x-2 disabled:opacity-50 shadow-md shadow-blue-500/20"
                    >
                        <span>{cleaning ? 'Removing...' : `Delete Selected (${selectedCount})`}</span>
                    </button>
                </div>
            </div>

            {restoreStatus && (
                <div className={`mb-4 p-3.5 rounded-xl text-[13px] flex items-center space-x-2 border ${
                    restoreStatus.includes('failed')
                        ? 'bg-[#FF453A]/10 border-[#FF453A]/25 text-[#FF453A]'
                        : 'bg-[#30D158]/10 border-[#30D158]/25 text-[#30D158]'
                }`}>
                    <span>{restoreStatus}</span>
                </div>
            )}

            {error && (
                <div className="mb-4 p-3.5 bg-[#FF453A]/10 border border-[#FF453A]/25 rounded-xl text-[#FF453A] text-[13px] flex items-center space-x-2">
                    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>Scan failed: {error}</span>
                </div>
            )}

            {cleanSummary && (
                <div className="mb-4 p-3.5 bg-[#30D158]/10 border border-[#30D158]/25 rounded-xl text-[#30D158] text-[13px] flex items-center justify-between">
                    <div>
                        <span className="font-semibold">Duplicates Removed: </span>
                        <span>Freed {formatBytes(cleanSummary.bytesFreed)} across {cleanSummary.itemsRemoved} redundant files.</span>
                    </div>
                    <span className="text-[11px] text-white/70">Reconstructable via rollback</span>
                </div>
            )}

            {/* Content Container */}
            <div className="flex-1 apple-glass rounded-2xl overflow-hidden flex flex-col min-h-0">
                {!scanData && !scanning && (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#86868B] p-8">
                        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-[#0A84FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                        </div>
                        <h2 className="text-[17px] font-semibold text-white mb-1">Find Duplicate Files</h2>
                        <p className="text-[13px] text-[#86868B] max-w-sm text-center">
                            Scan user directories to locate redundant clones and free valuable storage space.
                        </p>
                    </div>
                )}

                {scanning && (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#86868B]">
                        <div className="w-10 h-10 border-2 border-white/10 border-t-[#0A84FF] rounded-full animate-spin mb-3" />
                        <p className="text-[14px] font-semibold text-white">Calculating File Checksums...</p>
                        <p className="text-[12px] text-[#86868B] mt-1">Comparing SHA-256 binary fingerprints</p>
                    </div>
                )}

                {scanData && !scanning && (
                    <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                        {scanData.items.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-[#30D158]">
                                <svg className="w-10 h-10 mb-2 opacity-80" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <p className="text-[13px] font-semibold">No Duplicates Found</p>
                                <p className="text-[11px] text-[#86868B] mt-0.5">Your downloads and documents are organized.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {groupedItems.map(group => (
                                    <div key={group.groupName} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                                        <div className="flex items-center justify-between mb-2.5 px-1">
                                            <span className="text-[11px] font-bold text-[#0A84FF] uppercase tracking-wider">{group.groupName}</span>
                                            <span className="text-[10px] text-[#86868B] font-mono">{group.items.length} identical copies</span>
                                        </div>
                                        <div className="space-y-1">
                                            {group.items.map(item => (
                                                <div
                                                    key={item.id}
                                                    onClick={() => toggleItem(item.id)}
                                                    className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all border ${
                                                        item.selected
                                                            ? 'bg-[#0A84FF]/10 border-[#0A84FF]/30'
                                                            : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.05]'
                                                    }`}
                                                >
                                                    <div className="flex items-center space-x-3 overflow-hidden min-w-0">
                                                        <div className="relative flex items-center justify-center w-4 h-4 shrink-0">
                                                            <input
                                                                type="checkbox"
                                                                checked={item.selected}
                                                                onChange={(e) => { e.stopPropagation(); toggleItem(item.id); }}
                                                                className="w-full h-full opacity-0 absolute z-10 cursor-pointer"
                                                            />
                                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                                                item.selected ? 'bg-[#0A84FF] border-[#0A84FF]' : 'border-white/30 bg-white/[0.05]'
                                                            }`}>
                                                                {item.selected && (
                                                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="truncate min-w-0">
                                                            <div className="text-[13px] font-semibold text-white truncate">{item.name}</div>
                                                            <div className="text-[11px] text-[#86868B] font-mono truncate mt-0.5" title={item.path}>{item.path}</div>
                                                        </div>
                                                    </div>

                                                    <div className="text-right shrink-0 pl-3 font-mono text-[12px] text-[#86868B]">
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
