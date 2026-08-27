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

    return (
        <div className="p-8 h-full flex flex-col pt-12 overflow-y-auto">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Registry Cleaner</h1>
                    <p className="text-slate-400">Optimize system database by removing orphaned application entries.</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={handleRollback}
                        disabled={scanning || cleaning || rollingBack}
                        className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-all border border-slate-700 text-sm"
                    >
                        {rollingBack ? 'Restoring...' : 'Restore Backup'}
                    </button>
                    <button
                        onClick={handleScan}
                        disabled={scanning || cleaning}
                        className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all border border-slate-700"
                    >
                        {scanning ? 'Analyzing Hive...' : 'Scan Registry'}
                    </button>
                    <button
                        onClick={handleClean}
                        disabled={!scanData || scanData.items.filter(i => i.selected).length === 0 || cleaning}
                        className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20"
                    >
                        {cleaning ? 'Optimizing...' : 'Fix Selected'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                    Scan failed: {error}
                </div>
            )}

            {rollbackMessage && (
                <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-300">
                    {rollbackMessage}
                </div>
            )}

            {cleanSummary && (
                <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl animate-in fade-in slide-in-from-top-4">
                    <div className="font-bold text-green-400 text-lg">Registry Optimized</div>
                    <div className="text-sm text-slate-400">Successfully handled {cleanSummary.itemsRemoved} invalid entries.</div>
                </div>
            )}

            <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
                {!scanData && !scanning && (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                        <svg className="w-16 h-16 mb-4 opacity-20" width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                        <p className="text-lg font-medium text-center px-8">Deep scan of the Windows Registry for orphaned data<br /><span className="text-sm text-slate-500 font-normal">This process is safe and includes automatic backups.</span></p>
                    </div>
                )}

                {scanning && (
                    <div className="flex-1 flex flex-col items-center justify-center text-blue-400">
                        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-400 rounded-full animate-spin mb-4"></div>
                        <p className="animate-pulse font-bold tracking-widest uppercase text-xs">Accessing Registry Hives...</p>
                    </div>
                )}

                {scanData && !scanning && (
                    <div className="flex-1 overflow-y-auto">
                        {scanData.items.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900/20">
                                <svg className="w-12 h-12 mb-2 text-green-500/30" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <p className="font-bold text-green-500/50 uppercase tracking-widest text-[10px]">Database Clean</p>
                            </div>
                        ) : (
                            <div className="p-4 space-y-2">
                                {scanData.items.map(item => (
                                    <button
                                        type="button"
                                        key={item.id}
                                        onClick={() => toggleItem(item.id)}
                                        aria-pressed={item.selected}
                                        className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between w-full text-left ${item.selected ? 'bg-blue-500/5 border-blue-500/30' : 'bg-slate-800/10 border-slate-800/50 hover:border-slate-700'}`}
                                    >
                                        <div className="flex items-center space-x-4 overflow-hidden">
                                            <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center ${item.selected ? 'bg-blue-500 border-blue-400' : 'bg-slate-900 border-slate-700'}`}>
                                                {item.selected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                            </div>
                                            <div className="overflow-hidden">
                                                <div className="font-bold text-slate-200 truncate">{item.name}</div>
                                                <div className="text-[10px] text-slate-500 font-mono truncate">{item.path}</div>
                                            </div>
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400 px-2 py-1 bg-slate-800 rounded uppercase shrink-0 ml-4">{item.category}</div>
                                    </button>
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
