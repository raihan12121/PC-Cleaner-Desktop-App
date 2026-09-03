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
        Array.from({ length: 24 }, () => ({ cpu: 0, ram: 0 }))
    );
    const [processes, setProcesses] = useState<ProcessItem[]>([]);

    useEffect(() => {
        const fetchMonitorData = async () => {
            try {
                const info = await getInfo();
                const procList = await getProcesses();

                if (info && !info.error) {
                    const cpuUsage = Number(info.currentLoad?.currentLoad ?? info.cpu?.currentLoad ?? 0);
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
                        .slice(0, 20);
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

    const latestPoint = dataPoints[dataPoints.length - 1] || { cpu: 0, ram: 0 };

    return (
        <div className="p-8 h-full flex flex-col overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="mb-6 flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Activity Monitor</h1>
                    <p className="text-[13px] text-[#86868B] mt-0.5">Live CPU, unified memory metrics, and active task load</p>
                </div>
                <div className="flex items-center space-x-2 text-[11px] text-[#86868B]">
                    <span className="w-2 h-2 rounded-full bg-[#0A84FF] animate-pulse" />
                    <span>Polling interval: 2.0s</span>
                </div>
            </div>

            {/* Sparkline Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                {/* CPU Monitor */}
                <div className="apple-glass rounded-2xl p-5 flex flex-col h-56">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-[#0A84FF]" />
                            <h2 className="text-[13px] font-bold text-white tracking-tight">CPU Load</h2>
                        </div>
                        <span className="text-[12px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#0A84FF]/15 text-[#0A84FF]">
                            {latestPoint.cpu.toFixed(1)}%
                        </span>
                    </div>
                    <div className="flex-1 w-full min-h-0 pt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dataPoints}>
                                <YAxis domain={[0, 100]} hide />
                                <Line
                                    type="monotone"
                                    dataKey="cpu"
                                    stroke="#0A84FF"
                                    strokeWidth={2.5}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="text-[11px] text-[#86868B] flex justify-between pt-2 border-t border-white/[0.06]">
                        <span>History: 48s window</span>
                        <span>0% - 100% capacity</span>
                    </div>
                </div>

                {/* RAM Monitor */}
                <div className="apple-glass rounded-2xl p-5 flex flex-col h-56">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-[#AF52DE]" />
                            <h2 className="text-[13px] font-bold text-white tracking-tight">Memory Utilization</h2>
                        </div>
                        <span className="text-[12px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#AF52DE]/15 text-[#AF52DE]">
                            {latestPoint.ram.toFixed(1)}%
                        </span>
                    </div>
                    <div className="flex-1 w-full min-h-0 pt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dataPoints}>
                                <YAxis domain={[0, 100]} hide />
                                <Line
                                    type="monotone"
                                    dataKey="ram"
                                    stroke="#AF52DE"
                                    strokeWidth={2.5}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="text-[11px] text-[#86868B] flex justify-between pt-2 border-t border-white/[0.06]">
                        <span>History: 48s window</span>
                        <span>Unified physical RAM</span>
                    </div>
                </div>
            </div>

            {/* macOS Top Processes Table */}
            <div className="apple-glass rounded-2xl p-5 flex flex-col flex-1 min-h-[380px] overflow-hidden">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-[14px] font-bold text-white tracking-tight">Active Processes</h2>
                    <span className="text-[11px] text-[#86868B]">{processes.length} top consumers displayed</span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-[12px]">
                        <thead className="text-[10px] uppercase font-bold text-[#86868B] tracking-wider border-b border-white/[0.06] sticky top-0 bg-[#18181B]/95 backdrop-blur-md">
                            <tr>
                                <th className="px-3 py-2.5">Process Name</th>
                                <th className="px-3 py-2.5">PID</th>
                                <th className="px-3 py-2.5">CPU %</th>
                                <th className="px-3 py-2.5 text-right">Memory (MB)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {processes.map((proc, i) => (
                                <tr key={`${proc.pid}-${i}`} className="hover:bg-white/[0.04] transition-colors">
                                    <td className="px-3 py-2 font-medium text-white truncate max-w-[240px]">
                                        <div className="flex items-center space-x-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                                            <span className="truncate">{proc.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 font-mono text-[#86868B]">{proc.pid}</td>
                                    <td className="px-3 py-2 font-mono font-semibold text-[#0A84FF]">
                                        {Number(proc.cpu || 0).toFixed(1)}%
                                    </td>
                                    <td className="px-3 py-2 font-mono text-right text-[#86868B]">
                                        {(((proc.memRss || proc.mem || 0)) / 1024).toFixed(1)}
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

export default SystemMonitor;
