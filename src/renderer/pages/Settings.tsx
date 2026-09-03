import React, { useState, useEffect } from 'react';
import { useIpc } from '../hooks/useIpc';
import { IPC_CHANNELS } from '../../main/ipc/channels';

const Settings: React.FC = () => {
    const { invoke: resetData } = useIpc(IPC_CHANNELS.DB_RESET);
    const { invoke: saveSchedule, error: scheduleError } = useIpc(IPC_CHANNELS.DB_SAVE_SCHEDULE);
    const { invoke: getSchedules } = useIpc(IPC_CHANNELS.DB_QUERY_SCHEDULES);

    const [scheduledScan, setScheduledScan] = useState(false);
    const [smartAlerts, setSmartAlerts] = useState(true);
    const [theme, setTheme] = useState('Dark');

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
                    <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-4 pb-2 border-b border-white/[0.06]">
                        Appearance
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-[13px] font-semibold text-white">Color Interface Theme</div>
                            <div className="text-[11px] text-[#86868B] mt-0.5">
                                macOS Sequoia Frosted Graphite
                            </div>
                        </div>
                        <select
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            className="bg-white/[0.06] border border-white/[0.1] text-white text-[12px] rounded-xl px-3 py-1.5 outline-none font-medium focus:border-[#0A84FF] transition-all cursor-pointer"
                        >
                            <option value="Dark" className="bg-[#1C1C1E] text-white">Dark Mode (Graphite)</option>
                            <option value="System" className="bg-[#1C1C1E] text-white">System Synchronized</option>
                        </select>
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
