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

const Registry: React.FC = () => {
    const { invoke: startScan, loading: scanning, error, data: scanData, setData: setScanData } = useIpc<ScanResult>(IPC_CHANNELS.REGISTRY_SCAN);
    const { invoke: rollbackRegistry, loading: rollingBack } = useIpc(IPC_CHANNELS.REGISTRY_ROLLBACK);
    const [cleaning, setCleaning] = useState(false);
    const [cleanSummary, setCleanSummary] = useState<{ itemsRemoved: number } | null>(null);
    const [rollbackMessage, setRollbackMessage] = useState<string | null>(null);

    const handleScan = () => {
        setCleanSummary(null);
        setRollbackMessage(null);
        startScan();
    };

    const handleClean = async () => {
        if (!scanData) return;
        const selected = scanData.items.filter(i => i.selected);
        if (selected.length === 0) return;

        if (confirm(`Clean ${selected.length} registry items? A backup will be created in the recovery folder.`)) {
            setCleaning(true);
            setRollbackMessage(null);
            try {
                const result = await window.api.invoke(IPC_CHANNELS.REGISTRY_CLEAN, selected, scanData.scanId);
                if (result && result.error) {
                    throw new Error(result.error);
                }
                setCleanSummary(result);
                setScanData({
                    ...scanData,
                    items: scanData.items.filter(item => !selected.find(s => s.id === item.id)),
                });
            } catch (e: any) {
                alert('Registry cleanup failed: ' + (e?.message || e));
            } finally {
                setCleaning(false);
            }
        }
    };

    const handleRollback = async () => {
        if (confirm('Restore the most recent registry backup?')) {
            try {
                await rollbackRegistry();
                setRollbackMessage('Latest registry backup was successfully restored.');
                handleScan();
            } catch (e: any) {
                alert('Rollback failed: ' + (e?.message || e));
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

    const selectedCount = scanData?.items.filter(i => i.selected).length || 0;

    return (
        <div className="p-8 h-full flex flex-col overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">System Integrity & Registry</h1>
                    <p className="text-[13px] text-[#86868B] mt-0.5">Repair orphaned application references and invalid system entries</p>
                </div>
                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleRollback}
                        disabled={scanning || cleaning || rollingBack}
                        className="apple-btn-secondary px-3.5 py-2 rounded-xl text-[12px] font-semibold disabled:opacity-50"
                    >
                        {rollingBack ? 'Restoring...' : 'Restore Backup'}
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
                            <span>Scan Registry</span>
                        )}
                    </button>
                    <button
                        onClick={handleClean}
                        disabled={!scanData || selectedCount === 0 || cleaning}
                        className="apple-btn-primary px-5 py-2 rounded-xl text-[13px] font-semibold flex items-center space-x-2 disabled:opacity-50 shadow-md shadow-blue-500/20"
                    >
                        <span>{cleaning ? 'Repairing...' : `Repair (${selectedCount})`}</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3.5 bg-[#FF453A]/10 border border-[#FF453A]/25 rounded-xl text-[#FF453A] text-[13px] flex items-center space-x-2">
                    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>Scan error: {error}</span>
                </div>
            )}

            {rollbackMessage && (
                <div className="mb-4 p-3.5 bg-[#0A84FF]/10 border border-[#0A84FF]/25 rounded-xl text-[#0A84FF] text-[13px] flex items-center space-x-2">
                    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{rollbackMessage}</span>
                </div>
            )}

            {cleanSummary && (
                <div className="mb-4 p-3.5 bg-[#30D158]/10 border border-[#30D158]/25 rounded-xl text-[#30D158] text-[13px] flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>Successfully cleaned {cleanSummary.itemsRemoved} orphaned registry items.</span>
                    </div>
                    <span className="text-[11px] font-medium text-white/70">Automatic rollback snapshot created</span>
                </div>
            )}

            {/* Content Container */}
            <div className="flex-1 apple-glass rounded-2xl overflow-hidden flex flex-col min-h-0">
                {!scanData && !scanning && (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#86868B] p-8">
                        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-[#0A84FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                        </div>
                        <h2 className="text-[17px] font-semibold text-white mb-1">Audit Registry Integrity</h2>
                        <p className="text-[13px] text-[#86868B] max-w-sm text-center">
                            Locate orphaned uninstall strings and missing file associations with automatic safe backups.
                        </p>
                    </div>
                )}

                {scanning && (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#86868B]">
                        <div className="w-10 h-10 border-2 border-white/10 border-t-[#0A84FF] rounded-full animate-spin mb-3" />
                        <p className="text-[14px] font-semibold text-white">Inspecting Windows Registry Hives...</p>
                        <p className="text-[12px] text-[#86868B] mt-1">Cross-referencing disk binaries with registered paths</p>
                    </div>
                )}

                {scanData && !scanning && (
                    <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                        {scanData.items.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-[#30D158]">
                                <svg className="w-10 h-10 mb-2 opacity-80" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <p className="text-[13px] font-semibold">Registry is Clean</p>
                                <p className="text-[11px] text-[#86868B] mt-0.5">No orphaned entries detected.</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {scanData.items.map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => toggleItem(item.id)}
                                        className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-all cursor-pointer group"
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
                                                    item.selected
                                                        ? 'bg-[#0A84FF] border-[#0A84FF]'
                                                        : 'border-white/30 bg-white/[0.05] group-hover:border-white/50'
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
                                                <div className="text-[11px] text-[#86868B] truncate font-mono mt-0.5" title={item.path}>{item.path}</div>
                                            </div>
                                        </div>

                                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.06] text-[#86868B] font-medium shrink-0 uppercase">
                                            {item.category}
                                        </span>
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

export default Registry;
