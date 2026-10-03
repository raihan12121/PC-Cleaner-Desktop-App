import React, { useState, useEffect, useMemo } from 'react';
import { useIpc } from '../hooks/useIpc';
import { IPC_CHANNELS } from '../../main/ipc/channels';

interface ProcessDetails {
    pid: number;
    name: string;
    windowTitle?: string;
    cpu: number;
    memRss: number;
    memMb: number;
    user?: string;
    path?: string;
    isApp: boolean;
    status: string;
}

const RunningApps: React.FC = () => {
    const { invoke: getProcesses, loading } = useIpc(IPC_CHANNELS.PROCESSES_GET);
    const { invoke: killProcess } = useIpc(IPC_CHANNELS.PROCESS_KILL);

    const [processes, setProcesses] = useState<ProcessDetails[]>([]);
    const [viewMode, setViewMode] = useState<'apps' | 'all'>('apps');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [sortBy, setSortBy] = useState<'mem' | 'cpu'>('mem');
    const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

    const fetchProcesses = async () => {
        try {
            const data = await getProcesses();
            if (Array.isArray(data)) {
                setProcesses(data);
            }
        } catch (e) {
            console.error('Failed to query processes:', e);
        }
    };

    useEffect(() => {
        fetchProcesses();
    }, []);

    // Auto-refresh interval
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchProcesses, 3000);
        return () => clearInterval(interval);
    }, [autoRefresh]);

    const handleEndTask = async (proc: ProcessDetails) => {
        const displayName = proc.windowTitle || proc.name;
        if (!confirm(`Are you sure you want to terminate "${displayName}" (PID: ${proc.pid})?`)) {
            return;
        }

        try {
            const res = await killProcess(proc.pid);
            if (res && res.success) {
                setProcesses(prev => prev.filter(p => p.pid !== proc.pid));
                setFeedbackMessage(`Terminated "${displayName}" (PID: ${proc.pid})`);
                setTimeout(() => setFeedbackMessage(null), 3000);
            } else {
                alert(`Could not terminate process: ${res?.error || 'Access denied'}`);
            }
        } catch (e) {
            alert(`Failed to end process: ${e}`);
        }
    };

    const filteredProcesses = useMemo(() => {
        return processes
            .filter((p) => {
                if (viewMode === 'apps' && !p.isApp) return false;
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                    p.name.toLowerCase().includes(q) ||
                    (p.windowTitle && p.windowTitle.toLowerCase().includes(q)) ||
                    String(p.pid).includes(q) ||
                    (p.user && p.user.toLowerCase().includes(q))
                );
            })
            .sort((a, b) => {
                if (sortBy === 'cpu') return b.cpu - a.cpu;
                return b.memMb - a.memMb;
            });
    }, [processes, viewMode, searchQuery, sortBy]);

    const activeAppsCount = useMemo(() => {
        return processes.filter(p => p.isApp).length;
    }, [processes]);

    const totalRamMb = useMemo(() => {
        return processes.reduce((acc, p) => acc + (p.memMb || 0), 0);
    }, [processes]);

    return (
        <div className="p-8 h-full flex flex-col overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--apple-text-primary)]">
                        Running Applications
                    </h1>
                    <p className="text-[13px] text-[var(--apple-text-secondary)] mt-0.5">
                        Inspect active desktop apps, system processes, and terminate unresponsive tasks
                    </p>
                </div>

                {/* View Mode Toggle */}
                <div className="flex p-1 bg-black/[0.05] dark:bg-white/[0.05] border border-[var(--apple-glass-border)] rounded-xl w-fit">
                    <button
                        onClick={() => setViewMode('apps')}
                        className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                            viewMode === 'apps'
                                ? 'bg-[#0A84FF] text-white shadow-sm'
                                : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
                        }`}
                    >
                        Active Apps ({activeAppsCount})
                    </button>
                    <button
                        onClick={() => setViewMode('all')}
                        className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                            viewMode === 'all'
                                ? 'bg-[#0A84FF] text-white shadow-sm'
                                : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
                        }`}
                    >
                        All Processes ({processes.length})
                    </button>
                </div>
            </div>

            {/* Notification Banner */}
            {feedbackMessage && (
                <div className="mb-4 p-3 rounded-xl bg-[#30D158]/10 border border-[#30D158]/20 text-[#30D158] text-[12px] font-semibold flex items-center justify-between">
                    <span>✓ {feedbackMessage}</span>
                    <button onClick={() => setFeedbackMessage(null)} className="text-[#30D158] hover:opacity-80">✕</button>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 shrink-0">
                <div className="apple-glass rounded-xl p-4">
                    <div className="text-[11px] font-bold text-[var(--apple-text-muted)] uppercase tracking-wider">
                        Active Applications
                    </div>
                    <div className="text-2xl font-bold text-[var(--apple-text-primary)] mt-1">
                        {activeAppsCount} Apps
                    </div>
                    <div className="text-[11px] text-[var(--apple-text-secondary)] mt-0.5">
                        Interactive windows open
                    </div>
                </div>

                <div className="apple-glass rounded-xl p-4">
                    <div className="text-[11px] font-bold text-[var(--apple-text-muted)] uppercase tracking-wider">
                        Total Process Memory
                    </div>
                    <div className="text-2xl font-bold text-[#0A84FF] mt-1">
                        {(totalRamMb / 1024).toFixed(1)} GB
                    </div>
                    <div className="text-[11px] text-[var(--apple-text-secondary)] mt-0.5">
                        {processes.length} tracked processes
                    </div>
                </div>

                <div className="apple-glass rounded-xl p-4">
                    <div className="text-[11px] font-bold text-[var(--apple-text-muted)] uppercase tracking-wider">
                        Auto-Refresh
                    </div>
                    <div className="flex items-center justify-between mt-1">
                        <span className={`text-base font-bold ${autoRefresh ? 'text-[#30D158]' : 'text-[var(--apple-text-muted)]'}`}>
                            {autoRefresh ? 'Live (3s)' : 'Paused'}
                        </span>
                        <button
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] text-[var(--apple-text-primary)] transition-colors cursor-pointer"
                        >
                            {autoRefresh ? 'Pause' : 'Resume'}
                        </button>
                    </div>
                    <div className="text-[11px] text-[var(--apple-text-secondary)] mt-0.5">
                        Telemetry update interval
                    </div>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="apple-glass rounded-2xl p-4 mb-5 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center space-x-3">
                    <input
                        type="text"
                        placeholder="Search processes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-3 py-1.5 text-[12px] rounded-xl bg-black/[0.05] dark:bg-white/[0.08] border border-[var(--apple-glass-border)] text-[var(--apple-text-primary)] focus:outline-none w-48 md:w-64"
                    />

                    <div className="flex items-center space-x-1">
                        <span className="text-[11px] font-bold text-[var(--apple-text-secondary)] mr-1">Sort:</span>
                        <button
                            onClick={() => setSortBy('mem')}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                                sortBy === 'mem'
                                    ? 'bg-[#0A84FF] text-white'
                                    : 'bg-black/[0.04] dark:bg-white/[0.05] text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
                            }`}
                        >
                            RAM (MB)
                        </button>
                        <button
                            onClick={() => setSortBy('cpu')}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                                sortBy === 'cpu'
                                    ? 'bg-[#0A84FF] text-white'
                                    : 'bg-black/[0.04] dark:bg-white/[0.05] text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
                            }`}
                        >
                            CPU %
                        </button>
                    </div>
                </div>

                <button
                    onClick={fetchProcesses}
                    disabled={loading}
                    className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold bg-[#0A84FF] hover:bg-blue-600 disabled:opacity-50 text-white transition-all shadow-sm cursor-pointer flex items-center space-x-1.5"
                >
                    <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Refresh</span>
                </button>
            </div>

            {/* Processes Table */}
            <div className="apple-glass rounded-2xl p-5 flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-[12px]">
                        <thead className="text-[10px] uppercase font-bold text-[var(--apple-text-muted)] tracking-wider border-b border-[var(--apple-glass-border)] sticky top-0 bg-[var(--apple-card-bg)] backdrop-blur-md">
                            <tr>
                                <th className="px-3 py-2.5">Application Name</th>
                                <th className="px-3 py-2.5">PID</th>
                                <th className="px-3 py-2.5 text-right">CPU Usage</th>
                                <th className="px-3 py-2.5 text-right">Memory (MB)</th>
                                <th className="px-3 py-2.5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                            {filteredProcesses.map((proc) => (
                                <tr key={proc.pid} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                                    <td className="px-3 py-3 max-w-sm truncate">
                                        <div className="flex items-center space-x-2.5">
                                            <div className="w-2 h-2 rounded-full bg-[#30D158]" />
                                            <div className="min-w-0">
                                                <div className="font-semibold text-[var(--apple-text-primary)] truncate">
                                                    {proc.windowTitle || proc.name}
                                                </div>
                                                {proc.windowTitle && (
                                                    <div className="text-[10px] text-[var(--apple-text-secondary)] font-mono truncate">
                                                        {proc.name}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 font-mono text-[var(--apple-text-secondary)]">
                                        {proc.pid}
                                    </td>
                                    <td className="px-3 py-3 font-mono font-semibold text-right text-[#0A84FF]">
                                        {proc.cpu.toFixed(1)}%
                                    </td>
                                    <td className="px-3 py-3 font-mono font-semibold text-right text-[var(--apple-text-primary)]">
                                        {proc.memMb.toFixed(1)} MB
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                        <button
                                            onClick={() => handleEndTask(proc)}
                                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#FF453A]/10 hover:bg-[#FF453A] text-[#FF453A] hover:text-white transition-colors cursor-pointer"
                                        >
                                            End Task
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RunningApps;
