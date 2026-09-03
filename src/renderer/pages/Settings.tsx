import React, { useState, useEffect } from 'react';
import { useIpc } from '../hooks/useIpc';
import { IPC_CHANNELS } from '../../main/ipc/channels';
import appLogo from '../assets/app-icon.png';
import { useTheme } from '../context/ThemeContext';

const Settings: React.FC = () => {
    const { invoke: resetData } = useIpc(IPC_CHANNELS.DB_RESET);
    const { invoke: saveSchedule, error: scheduleError } = useIpc(IPC_CHANNELS.DB_SAVE_SCHEDULE);
    const { invoke: getSchedules } = useIpc(IPC_CHANNELS.DB_QUERY_SCHEDULES);

    const { theme, setTheme } = useTheme();
    const [scheduledScan, setScheduledScan] = useState(false);
    const [smartAlerts, setSmartAlerts] = useState(true);

    useEffect(() => {
        getSchedules().then((schedules: any) => {
            if (Array.isArray(schedules)) {
                const diskSched = schedules.find((s: any) => s.module === 'DiskCleaner');
                if (diskSched) {
                    setScheduledScan(Boolean(diskSched.enabled));
                }
            }
        }).catch(() => { /* keep defaults */ });
    }, []);

    const handleReset = async () => {
        if (confirm('Are you sure you want to clear all history and statistics? This cannot be undone.')) {
            try {
                await resetData();
                setScheduledScan(false);
                alert('Statistics and history have been cleared.');
            } catch (e) {
                alert('Reset failed: ' + e);
            }
        }
    };

    return (
        <div className="p-8 h-full flex flex-col overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="mb-6 shrink-0">
                <h1 className="text-2xl font-bold text-white tracking-tight">System Settings</h1>
                <p className="text-[13px] text-[#86868B] mt-0.5">Preferences, automated maintenance tasks, and diagnostic telemetry</p>
            </div>

            <div className="space-y-5 max-w-3xl">
                {/* Automation & Schedules */}
                <div className="apple-glass rounded-2xl p-5">
                    <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-4 pb-2 border-b border-white/[0.06]">
                        Automation & Background Maintenance
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="mr-4">
                                <div className="text-[13px] font-semibold text-white">Daily Automatic Maintenance</div>
                                <div className="text-[11px] text-[#86868B] mt-0.5">
                                    Silently purge system and user caches at 2:00 AM (Recycle Bin is safely excluded)
                                </div>
                            </div>
                            <div
                                onClick={async () => {
                                    const next = !scheduledScan;
                                    setScheduledScan(next);
                                    try {
                                        await saveSchedule('DiskCleaner', '0 2 * * *', next);
                                    } catch {
                                        setScheduledScan(!next);
                                    }
                                }}
                                className={`w-10 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 shrink-0 ${
                                    scheduledScan ? 'bg-[#30D158]' : 'bg-white/20'
                                }`}
                            >
                                <div
                                    className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ${
                                        scheduledScan ? 'translate-x-4' : 'translate-x-0'
                                    }`}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                            <div className="mr-4">
                                <div className="text-[13px] font-semibold text-white">S.M.A.R.T. Drive Health Watch</div>
                                <div className="text-[11px] text-[#86868B] mt-0.5">
                                    Display background notifications if storage device health drops below threshold
                                </div>
                            </div>
                            <div
                                onClick={() => setSmartAlerts(!smartAlerts)}
                                className={`w-10 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 shrink-0 ${
                                    smartAlerts ? 'bg-[#30D158]' : 'bg-white/20'
                                }`}
                            >
                                <div
                                    className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ${
                                        smartAlerts ? 'translate-x-4' : 'translate-x-0'
                                    }`}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Appearance */}
                <div className="apple-glass rounded-2xl p-5">
                    <div className="text-[11px] font-bold text-[var(--apple-text-secondary)] uppercase tracking-wider mb-4 pb-2 border-b border-[var(--apple-sidebar-border)]">
                        Appearance & Color Theme
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        {/* Light Mode Tile */}
                        <div
                            onClick={() => setTheme('light')}
                            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col items-center text-center ${
                                theme === 'light'
                                    ? 'bg-[#0A84FF]/10 border-[#0A84FF] shadow-sm'
                                    : 'bg-black/[0.02] dark:bg-white/[0.02] border-[var(--apple-glass-border)] hover:border-black/20 dark:hover:border-white/20'
                            }`}
                        >
                            <div className="w-full h-16 rounded-lg bg-[#F6F6F8] border border-black/10 p-1.5 flex flex-col justify-between mb-2 shadow-inner overflow-hidden">
                                <div className="flex items-center space-x-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                </div>
                                <div className="w-3/4 h-2 bg-black/10 rounded-sm" />
                                <div className="w-1/2 h-2 bg-blue-500/20 rounded-sm" />
                            </div>
                            <div className="flex items-center space-x-1.5">
                                <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                <span className={`text-[12px] font-semibold ${theme === 'light' ? 'text-[#0A84FF]' : 'text-[var(--apple-text-primary)]'}`}>
                                    Light
                                </span>
                            </div>
                        </div>

                        {/* Dark Mode Tile */}
                        <div
                            onClick={() => setTheme('dark')}
                            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col items-center text-center ${
                                theme === 'dark'
                                    ? 'bg-[#0A84FF]/10 border-[#0A84FF] shadow-sm'
                                    : 'bg-black/[0.02] dark:bg-white/[0.02] border-[var(--apple-glass-border)] hover:border-black/20 dark:hover:border-white/20'
                            }`}
                        >
                            <div className="w-full h-16 rounded-lg bg-[#121214] border border-white/10 p-1.5 flex flex-col justify-between mb-2 shadow-inner overflow-hidden">
                                <div className="flex items-center space-x-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                </div>
                                <div className="w-3/4 h-2 bg-white/10 rounded-sm" />
                                <div className="w-1/2 h-2 bg-blue-500/20 rounded-sm" />
                            </div>
                            <div className="flex items-center space-x-1.5">
                                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                </svg>
                                <span className={`text-[12px] font-semibold ${theme === 'dark' ? 'text-[#0A84FF]' : 'text-[var(--apple-text-primary)]'}`}>
                                    Dark
                                </span>
                            </div>
                        </div>

                        {/* System Auto Tile */}
                        <div
                            onClick={() => setTheme('system')}
                            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col items-center text-center ${
                                theme === 'system'
                                    ? 'bg-[#0A84FF]/10 border-[#0A84FF] shadow-sm'
                                    : 'bg-black/[0.02] dark:bg-white/[0.02] border-[var(--apple-glass-border)] hover:border-black/20 dark:hover:border-white/20'
                            }`}
                        >
                            <div className="w-full h-16 rounded-lg border border-black/10 dark:border-white/10 p-1.5 flex flex-col justify-between mb-2 shadow-inner overflow-hidden relative">
                                <div className="absolute inset-0 flex">
                                    <div className="w-1/2 bg-[#F6F6F8]" />
                                    <div className="w-1/2 bg-[#121214]" />
                                </div>
                                <div className="relative z-10 flex items-center space-x-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                </div>
                                <div className="relative z-10 w-3/4 h-2 bg-black/20 dark:bg-white/20 rounded-sm" />
                                <div className="relative z-10 w-1/2 h-2 bg-blue-500/30 rounded-sm" />
                            </div>
                            <div className="flex items-center space-x-1.5">
                                <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                <span className={`text-[12px] font-semibold ${theme === 'system' ? 'text-[#0A84FF]' : 'text-[var(--apple-text-primary)]'}`}>
                                    Auto
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Maintenance & Reset */}
                <div className="apple-glass rounded-2xl p-5 border border-[#FF453A]/20">
                    <div className="text-[11px] font-bold text-[#FF453A] uppercase tracking-wider mb-4 pb-2 border-b border-white/[0.06]">
                        Diagnostics & Storage Reset
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="mr-4">
                            <div className="text-[13px] font-semibold text-white">Reset Telemetry Database</div>
                            <div className="text-[11px] text-[#86868B] mt-0.5">
                                Clear stored cleanup logs and reset performance statistics back to baseline
                            </div>
                        </div>
                        <button
                            onClick={handleReset}
                            className="px-4 py-2 bg-[#FF453A]/10 text-[#FF453A] border border-[#FF453A]/25 hover:bg-[#FF453A]/20 rounded-xl text-[12px] font-semibold transition-all shrink-0"
                        >
                            Reset Data
                        </button>
                    </div>
                </div>

                {/* About PC Cleaner Card */}
                <div className="apple-glass rounded-2xl p-5 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <img
                            src={appLogo}
                            alt="PC Cleaner"
                            className="w-12 h-12 rounded-2xl shadow-lg shadow-blue-500/20 object-contain"
                        />
                        <div>
                            <div className="text-[14px] font-bold text-white tracking-tight">PC Cleaner</div>
                            <div className="text-[11px] text-[#86868B] mt-0.5">System Optimization & Maintenance Suite</div>
                            <div className="text-[10px] text-white/40 mt-1 font-mono">Version 1.0.5 (Windows x64)</div>
                        </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-[11px] font-medium text-[#30D158]">
                        Up to date
                    </span>
                </div>
            </div>

            {scheduleError && (
                <div className="max-w-3xl rounded-xl border border-[#FF453A]/25 bg-[#FF453A]/10 p-3.5 text-[#FF453A] text-[13px] mt-4">
                    {scheduleError}
                </div>
            )}
        </div>
    );
};

export default Settings;
