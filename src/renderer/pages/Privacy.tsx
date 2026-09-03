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

const Privacy: React.FC = () => {
    const { invoke: scan, loading: scanning, error: scanError, data: scanData, setData: setScanData } = useIpc<{ items: ScanItem[], totalBytes: number, scanId: number }>('privacy:scan');
    const { invoke: clean, loading: cleaning, error: cleanError } = useIpc('privacy:clean');

    const [cleaned, setCleaned] = useState(false);
    const [cleanSummary, setCleanSummary] = useState<{ itemsRemoved: number; skippedCount?: number } | null>(null);

    const handleClean = async () => {
        if (!scanData || !scanData.items) return;
        const selected = scanData.items.filter(i => i.selected);
        if (selected.length === 0) return;

        if (confirm(`Are you sure you want to clean ${selected.length} privacy items? This may sign you out of websites or clear history.`)) {
            try {
                const result = await clean(selected, scanData.scanId);
                if (!result?.success) throw new Error(result?.error || 'Some privacy items could not be cleaned.');
                setCleanSummary({ itemsRemoved: result.itemsRemoved, skippedCount: result.skippedCount });
                setCleaned(true);
            } catch { /* displayed through hook error state */ }
        }
    };

    const toggleItem = (id: string) => {
        if (!scanData) return;
        setScanData({
            ...scanData,
            items: scanData.items.map(item => item.id === id ? { ...item, selected: !item.selected } : item)
        });
    };

    const toggleAll = (select: boolean) => {
        if (!scanData) return;
        setScanData({
            ...scanData,
            items: scanData.items.map(item => ({ ...item, selected: select }))
        });
    };

    const selectedCount = scanData?.items.filter(i => i.selected).length || 0;

    return (
        <div className="p-8 h-full flex flex-col overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Privacy & Security</h1>
                    <p className="text-[13px] text-[#86868B] mt-0.5">Purge tracking cookies, web history, and recent file activity records</p>
                </div>
                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => { setCleaned(false); setCleanSummary(null); scan(); }}
                        disabled={scanning || cleaning}
                        className="apple-btn-secondary px-4 py-2 rounded-xl text-[13px] font-semibold flex items-center space-x-2 disabled:opacity-50"
                    >
                        {scanning ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Scanning...</span>
                            </>
                        ) : (
                            <span>Analyze Privacy</span>
                        )}
                    </button>
                    {scanData && !cleaned && (
                        <button
                            onClick={handleClean}
                            disabled={cleaning || selectedCount === 0}
                            className="apple-btn-primary px-5 py-2 rounded-xl text-[13px] font-semibold flex items-center space-x-2 disabled:opacity-50 shadow-md shadow-blue-500/20"
                        >
                            <span>{cleaning ? 'Clearing...' : `Wipe Selected (${selectedCount})`}</span>
                        </button>
                    )}
                </div>
            </div>

            {(scanError || cleanError) && (
                <div className="mb-4 p-3.5 bg-[#FF453A]/10 border border-[#FF453A]/25 rounded-xl text-[#FF453A] text-[13px] flex items-center space-x-2">
                    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>{scanError || cleanError}</span>
                </div>
            )}

            {/* Content Container */}
            <div className="flex-1 apple-glass rounded-2xl overflow-hidden flex flex-col min-h-0">
                {!scanData && !scanning && !cleaned && (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#86868B] p-8">
                        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-[#0A84FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h2 className="text-[17px] font-semibold text-white mb-1">Audit Privacy Footprint</h2>
                        <p className="text-[13px] text-[#86868B] max-w-sm text-center">
                            Scan your browsers and Windows recent activity lists to eliminate tracking traces.
                        </p>
                    </div>
                )}

                {scanning && (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#86868B]">
                        <div className="w-10 h-10 border-2 border-white/10 border-t-[#0A84FF] rounded-full animate-spin mb-3" />
                        <p className="text-[14px] font-semibold text-white">Inspecting Privacy Artifacts...</p>
                        <p className="text-[12px] text-[#86868B] mt-1">Locating cookies, session files, and recent documents</p>
                    </div>
                )}

                {scanData && !cleaned && (
                    <div className="flex flex-col h-full">
                        {/* Subheader Toolbar */}
                        <div className="px-6 py-3 border-b border-white/[0.06] bg-white/[0.02] flex justify-between items-center shrink-0">
                            <div className="text-[13px] text-white">
                                Found <span className="font-bold">{scanData.items.length}</span> privacy traces ({selectedCount} selected).
                            </div>
                            <div className="flex items-center space-x-3">
                                <button
                                    onClick={() => toggleAll(true)}
                                    className="text-[12px] font-semibold text-[#0A84FF] hover:underline"
                                >
                                    Select All
                                </button>
                                <span className="text-white/20">|</span>
                                <button
                                    onClick={() => toggleAll(false)}
                                    className="text-[12px] font-semibold text-[#86868B] hover:text-white transition-colors"
                                >
                                    Deselect All
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-1.5">
                            {scanData.items.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => toggleItem(item.id)}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                                        item.selected
                                            ? 'bg-white/[0.05] border-white/[0.08]'
                                            : 'bg-white/[0.01] border-white/[0.03] opacity-50'
                                    }`}
                                >
                                    <div className="flex items-center space-x-3 overflow-hidden mr-3">
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

                                        <div className="truncate">
                                            <div className="text-[13px] font-semibold text-white truncate">{item.name}</div>
                                            <div className="text-[11px] text-[#86868B] font-mono truncate mt-0.5" title={item.path}>{item.path}</div>
                                        </div>
                                    </div>

                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.06] text-[#86868B] font-medium shrink-0 uppercase">
                                        {item.category}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {cleaned && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-[#30D158]/15 border border-[#30D158]/30 flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-[#30D158]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-1">Privacy Footprint Secured</h2>
                        {cleanSummary && (
                            <p className="text-[13px] text-[#86868B] max-w-sm">
                                Cleared {cleanSummary.itemsRemoved} privacy artifacts.
                                {cleanSummary.skippedCount ? ` (${cleanSummary.skippedCount} items in active use by browsers were preserved).` : ''}
                            </p>
                        )}
                        <button
                            onClick={() => { setCleaned(false); scan(); }}
                            className="mt-6 apple-btn-secondary px-5 py-2 rounded-xl text-[13px] font-semibold"
                        >
                            Scan Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Privacy;
