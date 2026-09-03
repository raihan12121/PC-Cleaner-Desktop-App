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
            } catch { /* displayed below through hook error state */ }
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
        <div className="p-8 h-full flex flex-col pt-12">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Privacy Shield</h1>
                    <p className="text-slate-400">Clear tracking cookies, browser history, and recent document lists.</p>
                </div>
                <div className="flex space-x-4">
                    <button
                        onClick={() => { setCleaned(false); setCleanSummary(null); scan(); }}
                        disabled={scanning || cleaning}
                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium border border-slate-700"
                    >
                        {scanning ? 'Scanning...' : 'Analyze Privacy'}
                    </button>
                </div>
            </div>
            {(scanError || cleanError) && <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">{scanError || cleanError}</div>}

            <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                {!scanData && !scanning && !cleaned && (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                        <svg className="w-16 h-16 mb-4 opacity-50" width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <p className="text-lg">Click Analyze Privacy to find exposed tracks</p>
                    </div>
                )}

                {scanning && (
                    <div className="flex-1 flex items-center justify-center text-cyan-400">
                        <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin"></div>
                    </div>
                )}

                {scanData && !cleaned && (
                    <div className="flex flex-col h-full">
                        <div className="p-4 border-b border-slate-800 text-slate-300 flex justify-between items-center bg-slate-900/40">
                            <div>
                                Found <span className="font-bold text-white">{scanData.items.length}</span> privacy traces ({selectedCount} selected).
                            </div>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => toggleAll(true)}
                                    className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded border border-slate-700 font-medium"
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={() => toggleAll(false)}
                                    className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded border border-slate-700 font-medium"
                                >
                                    Deselect All
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {scanData.items.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => toggleItem(item.id)}
                                    className={`p-4 rounded-lg flex justify-between items-center border cursor-pointer transition-colors ${item.selected ? 'bg-slate-800/60 border-cyan-500/30' : 'bg-slate-900/40 border-slate-800 opacity-60'}`}
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
                                            <h4 className="font-semibold text-white truncate">{item.name}</h4>
                                            <p className="text-xs text-slate-400 font-mono truncate mt-0.5">{item.path}</p>
                                        </div>
                                    </div>
                                    <div className="text-xs px-2 py-1 bg-rose-500/20 text-rose-400 rounded border border-rose-500/30 shrink-0 ml-4">
                                        {item.category}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 border-t border-slate-800 bg-slate-950">
                            <button
                                onClick={handleClean}
                                disabled={cleaning || selectedCount === 0}
                                className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-lg transition-colors shadow-lg shadow-rose-600/20 disabled:opacity-50"
                            >
                                {cleaning ? 'Securing...' : `Wipe Selected Privacy Traces (${selectedCount})`}
                            </button>
                        </div>
                    </div>
                )}

                {cleaned && (
                    <div className="flex-1 flex flex-col items-center justify-center text-green-400 p-8 text-center">
                        <svg className="w-20 h-20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xl font-bold">Privacy traces wiped successfully!</p>
                        {cleanSummary && (
                            <p className="text-sm text-slate-400 mt-2">
                                Wiped {cleanSummary.itemsRemoved} items.
                                {cleanSummary.skippedCount ? ` (${cleanSummary.skippedCount} items were locked by active browsers)` : ''}
                            </p>
                        )}
                        <button
                            onClick={() => { setCleaned(false); scan(); }}
                            className="mt-6 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium border border-slate-700 text-sm"
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
