import React, { useEffect, useState } from 'react';
import { useIpc } from '../hooks/useIpc';
import { IPC_CHANNELS } from '../../main/ipc/channels';
import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts';

interface DataPoint {
    cpu: number;
    ram: number;
}

interface ProcessItem {
    name: string;
    pid: number;
    cpu: number;
    memRss?: number;
    mem?: number;
}

const SystemMonitor: React.FC = () => {
    const { invoke: getInfo } = useIpc(IPC_CHANNELS.SYSTEM_INFO);
    const { invoke: getProcesses } = useIpc(IPC_CHANNELS.SYSTEM_PROCESSES);

    const [dataPoints, setDataPoints] = useState<DataPoint[]>(
        Array.from({ length: 20 }, () => ({ cpu: 0, ram: 0 }))
    );
    const [processes, setProcesses] = useState<ProcessItem[]>([]);

    useEffect(() => {
        const fetchMonitorData = async () => {
            try {
                const info = await getInfo();
                const procList = await getProcesses();

                if (info && !info.error) {
                    const cpuUsage = Number(info.cpu?.currentLoad ?? 0);
                    const totalMem = info.mem?.total || 1;
                    const usedMem = info.mem?.used ?? info.mem?.active ?? 0;
                    const ramUsage = (usedMem / totalMem) * 100;

                    setDataPoints(prev => {
                        const newPoint: DataPoint = {
                            cpu: Math.min(100, Math.max(0, cpuUsage)),
                            ram: Math.min(100, Math.max(0, ramUsage))
                        };
                        return [...prev.slice(1), newPoint];
                    });
                }

                if (procList && Array.isArray(procList.list)) {
                    const sorted = [...procList.list]
                        .sort((a: ProcessItem, b: ProcessItem) => (b.cpu || 0) - (a.cpu || 0))
                        .slice(0, 15);
                    setProcesses(sorted);
                }
            } catch (e) {
                console.error('Monitor update failed:', e);
            }
        };

        const interval = setInterval(fetchMonitorData, 2000);
        fetchMonitorData();
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="p-8 h-full flex flex-col pt-12 overflow-y-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white">System Monitor</h1>
                <p className="text-slate-400">Real-time resource utilization.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col h-64">
                    <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">CPU Usage (%)</h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dataPoints}>
                                <YAxis domain={[0, 100]} hide />
                                <Line type="monotone" dataKey="cpu" stroke="#06b6d4" strokeWidth={2} dot={false} isAnimationActive={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col h-64">
                    <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">RAM Usage (%)</h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dataPoints}>
                                <YAxis domain={[0, 100]} hide />
                                <Line type="monotone" dataKey="ram" stroke="#8b5cf6" strokeWidth={2} dot={false} isAnimationActive={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex-col overflow-hidden flex-1 min-h-[400px]">
                <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-4 shrink-0">Top Processes</h3>
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="text-xs uppercase bg-slate-800/50 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 rounded-tl-lg">Process Name</th>
                                <th className="px-4 py-3">PID</th>
                                <th className="px-4 py-3">CPU %</th>
                                <th className="px-4 py-3 rounded-tr-lg">RAM (MB)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processes.map((proc, i) => (
                                <tr key={`${proc.pid}-${i}`} className="border-b border-slate-800 hover:bg-slate-800/30">
                                    <td className="px-4 py-3 font-medium truncate max-w-[200px]">{proc.name}</td>
                                    <td className="px-4 py-3 font-mono text-slate-400">{proc.pid}</td>
                                    <td className="px-4 py-3 text-cyan-400">{Number(proc.cpu || 0).toFixed(1)}%</td>
                                    <td className="px-4 py-3">{(((proc.memRss || proc.mem || 0)) / 1024).toFixed(1)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SystemMonitor;
