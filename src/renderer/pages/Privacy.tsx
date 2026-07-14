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
    const { invoke: scan, loading: scanning, data: scanData } = useIpc<{ items: ScanItem[], totalBytes: number }>('privacy:scan');
    const { invoke: clean, loading: cleaning } = useIpc('privacy:clean');

    const [cleaned, setCleaned] = useState(false);

    const handleClean = async () => {
        if (!scanData || !scanData.items) return;

        if (confirm('Are you sure you want to delete these privacy items? This will sign you out of websites and delete history.')) {
            try {
                await clean(scanData.items, 0);
                setCleaned(true);
            } catch (e) { }
        }
    };

    return (
        <div className="p-8 h-full flex flex-col pt-12">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Privacy Shield</h1>
                    <p className="text-slate-400">Clear tracking cookies, browser history, and recent document lists.</p>
                </div>
                <div className="flex space-x-4">
                    <button
                        onClick={scan}
                        disabled={scanning || cleaning}
                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium border border-slate-700"
                    >
                        {scanning ? 'Scanning...' : 'Analyze Privacy'}
                    </button>
                </div>
            </div>

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
                        <div className="p-6 border-b border-slate-800 text-slate-300">
                            Found <span className="font-bold text-white">{scanData.items.length}</span> privacy traces.
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {scanData.items.map(item => (
                                <div key={item.id} className="p-4 bg-slate-800/40 rounded-lg flex justify-between items-center border border-slate-700/50">
                                    <div>
                                        <h4 className="font-semibold text-white">{item.name}</h4>
                                        <p className="text-xs text-slate-400 mt-1">{item.path}</p>
                                    </div>
                                    <div className="text-xs px-2 py-1 bg-rose-500/20 text-rose-400 rounded border border-rose-500/30">
                                        High Risk
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 border-t border-slate-800 bg-slate-950">
                            <button
                                onClick={handleClean}
                                disabled={cleaning}
                                className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-lg transition-colors shadow-lg shadow-rose-600/20 disabled:opacity-50"
                            >
                                {cleaning ? 'Securing...' : 'Wipe All Privacy Traces'}
                            </button>
                        </div>
                    </div>
                )}

                {cleaned && (
                    <div className="flex-1 flex flex-col items-center justify-center text-green-400">
                        <svg className="w-20 h-20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xl font-bold">Privacy traces wiped successfully!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Privacy;
