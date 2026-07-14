import React, { useState } from 'react';
import { useIpc } from '../hooks/useIpc';
import { IPC_CHANNELS } from '../../main/ipc/channels';

const Settings: React.FC = () => {
    const { invoke: resetData } = useIpc(IPC_CHANNELS.DB_RESET);
    const [scheduledScan, setScheduledScan] = useState(false);
    const [smartAlerts, setSmartAlerts] = useState(true);
    const [theme, setTheme] = useState('Dark');

    const handleReset = async () => {
        if (confirm('Are you sure you want to clear all history and statistics? This cannot be undone.')) {
            try {
                await resetData();
                alert('Statistics and history have been cleared.');
            } catch (e) {
                alert('Reset failed: ' + e);
            }
        }
    };

    return (
        <div className="p-8 h-full flex flex-col pt-12 overflow-y-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
                <p className="text-slate-400">Configure application behavior, scheduling, and notifications.</p>
            </div>

            <div className="space-y-6 max-w-4xl">
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-slate-200 text-lg font-semibold mb-6 border-b border-slate-800 pb-2">Automation & Schedules</h3>

                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <div className="font-medium text-slate-300">Daily Quick Clean</div>
                            <div className="text-sm text-slate-500">Automatically clean temp files and browser cache at 2:00 AM</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                value=""
                                className="sr-only peer"
                                checked={scheduledScan}
                                onChange={() => setScheduledScan(!scheduledScan)}
                            />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-slate-300">S.M.A.R.T. Drive Alerts</div>
                            <div className="text-sm text-slate-500">Notify me if drive health falls below safe levels</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                value=""
                                className="sr-only peer"
                                checked={smartAlerts}
                                onChange={() => setSmartAlerts(!smartAlerts)}
                            />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                        </label>
                    </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-slate-200 text-lg font-semibold mb-6 border-b border-slate-800 pb-2">Appearance</h3>

                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-slate-300">App Theme</div>
                            <div className="text-sm text-slate-500">Choose between light, dark, or system default</div>
                        </div>
                        <select
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block p-2.5 outline-none font-medium"
                        >
                            <option>System Default</option>
                            <option>Light</option>
                            <option>Dark</option>
                        </select>
                    </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-rose-400 text-lg font-semibold mb-6 border-b border-slate-800 pb-2">Maintenance</h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-slate-300">Reset Application Data</div>
                            <div className="text-sm text-slate-500">Wipe all cleaning history and reset statistics to zero.</div>
                        </div>
                        <button
                            onClick={handleReset}
                            className="px-6 py-2 bg-rose-600/10 text-rose-500 border border-rose-600/20 hover:bg-rose-600 hover:text-white rounded-lg font-bold transition-all"
                        >
                            Reset Data
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
