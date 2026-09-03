import React, { useEffect, useState } from 'react';
import { useIpc } from '../hooks/useIpc';
import { IPC_CHANNELS } from '../../main/ipc/channels';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard: React.FC = () => {
    const { invoke: getInfo, loading: infoLoading } = useIpc(IPC_CHANNELS.SYSTEM_INFO);
    const { invoke: getTimeline } = useIpc(IPC_CHANNELS.DB_QUERY_TIMELINE);
    const { invoke: getDriveHealth } = useIpc(IPC_CHANNELS.DRIVE_HEALTH);

    const [healthScore, setHealthScore] = useState(100);
    const [driveStatus, setDriveStatus] = useState<{ status: string; score: number; name?: string }>({
        status: 'Healthy',
        score: 100,
        name: 'Primary Drive'
    });
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [stats, setStats] = useState({
        ramUsed: 0,
        ramTotal: 16
    });

    const [pieData, setPieData] = useState([
        { name: 'Used', value: 30 },
        { name: 'Free', value: 70 },
    ]);

    const [lineData, setLineData] = useState<Array<{ day: string; saved: number }>>([]);

    useEffect(() => {
        const fetchData = async (firstLoad = false) => {
            if (firstLoad) setIsRefreshing(true);
            try {
                const info = await getInfo();
                const history = await getTimeline();
                const drives = await getDriveHealth().catch((): null => null);

                if (drives && Array.isArray(drives.items) && drives.items.length > 0) {
                    const firstDrive = drives.items[0];
                    const score = firstDrive.metadata?.healthScore ?? 100;
                    const status = firstDrive.metadata?.healthStatus ?? 'Healthy';
                    setDriveStatus({
                        status,
                        score,
                        name: firstDrive.name || 'Primary Drive'
                    });
                }

                if (info && !info.error) {
                    const mainDisk = info.disk?.find((d: { mount?: string; used?: number; size?: number }): boolean => Boolean(d.mount?.toLowerCase().startsWith('c:'))) || info.disk?.[0];
                    if (mainDisk) {
                        setPieData([
                            { name: 'Used', value: Math.max(0, mainDisk.used || 0) },
                            { name: 'Free', value: Math.max(0, (mainDisk.size || 0) - (mainDisk.used || 0)) }
                        ]);

                        const usageRatio = mainDisk.size > 0 ? mainDisk.used / mainDisk.size : 0;
                        setHealthScore(Math.max(20, Math.floor(100 - (usageRatio * 80))));
                    }

                    if (info.mem) {
                        const usedRam = info.mem.used ?? info.mem.active ?? 0;
                        setStats(prev => ({
                            ...prev,
                            ramUsed: usedRam / (1024 ** 3),
                            ramTotal: (info.mem.total || 1) / (1024 ** 3)
                        }));
                    }
                }

                if (Array.isArray(history)) {
                    const chronological = [...history].reverse();
                    setLineData(chronological.map(h => ({
                        day: h.date,
                        saved: Number(((h.saved || 0) / (1024 ** 3)).toFixed(2))
                    })));
                }
            } catch (e) {
                console.error('Dashboard refresh failed:', e);
            } finally {
                setIsRefreshing(false);
            }
        };

        fetchData(true);
        const interval = setInterval(() => fetchData(), 30000);
        return () => clearInterval(interval);
    }, []);

    const COLORS = ['#0A84FF', 'rgba(255, 255, 255, 0.08)'];

    if (infoLoading && isRefreshing) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#161618] text-[#86868B]">
                <div className="w-10 h-10 border-2 border-white/10 border-t-[#0A84FF] rounded-full animate-spin mb-3"></div>
                <p className="text-[13px] font-medium text-[#F5F5F7]">Analyzing System State...</p>
            </div>
        );
    }

    const usedBytes = pieData[0]?.value || 0;
    const freeBytes = pieData[1]?.value || 1;
    const totalBytes = usedBytes + freeBytes;
    const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

    return (
        <div className="p-8 h-full flex flex-col overflow-y-auto custom-scrollbar">
            {/* Apple macOS Top Bar */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Overview</h1>
                    <p className="text-[13px] text-[#86868B] mt-0.5">Real-time hardware status and storage telemetry</p>
                </div>
                <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-[#30D158] animate-pulse"></span>
                    <span className="text-[11px] font-medium text-[#86868B]">System Telemetry Active</span>
                </div>
            </div>

            {/* Apple Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                {/* Health Score Card */}
                <div className="apple-glass rounded-2xl p-5 flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="w-full flex items-center justify-between mb-3">
                        <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Health Index</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${healthScore > 80 ? 'bg-[#30D158]/15 text-[#30D158]' : healthScore > 50 ? 'bg-[#FF9F0A]/15 text-[#FF9F0A]' : 'bg-[#FF453A]/15 text-[#FF453A]'}`}>
                            {healthScore > 80 ? 'Optimal' : healthScore > 50 ? 'Moderate' : 'Action Needed'}
                        </span>
                    </div>

                    <div className="relative w-32 h-32 flex items-center justify-center my-1">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="6" />
                            <circle
                                cx="50"
                                cy="50"
                                r="42"
                                fill="none"
                                stroke={healthScore > 80 ? '#30D158' : healthScore > 50 ? '#FF9F0A' : '#FF453A'}
                                strokeWidth="6"
                                strokeDasharray={`${healthScore * 2.64} 264`}
                                strokeLinecap="round"
                                className="transition-all duration-1000"
                            />
                        </svg>
                        <div className="absolute flex flex-col items-center justify-center">
                            <span className="text-4xl font-extrabold text-white tracking-tight">{healthScore}</span>
                            <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">out of 100</span>
                        </div>
                    </div>

                    <p className="text-[12px] text-[#86868B] text-center mt-2 font-medium">
                        System resources in stable condition
                    </p>
                </div>

                {/* Primary Drive Storage */}
                <div className="apple-glass rounded-2xl p-5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Storage Status</span>
                        <span className="text-[11px] font-semibold text-white">{usedPercent}% Used</span>
                    </div>

                    <div className="h-32 w-full my-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} innerRadius={36} outerRadius={52} paddingAngle={3} dataKey="value" stroke="none">
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(28, 28, 30, 0.95)', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '10px', fontSize: '11px', backdropFilter: 'blur(16px)' }}
                                    itemStyle={{ color: '#F5F5F7' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[12px]">
                        <div className="flex items-center space-x-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#0A84FF]" />
                            <span className="text-[#86868B]">Occupied</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                            <span className="w-2 h-2 rounded-full bg-white/20" />
                            <span className="text-[#86868B]">Available</span>
                        </div>
                    </div>
                </div>

                {/* RAM & Hardware Reliability */}
                <div className="flex flex-col justify-between space-y-3">
                    {/* Memory Gauge */}
                    <div className="apple-glass rounded-2xl p-4 flex-1 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-[#86868B] uppercase tracking-wider">Memory Pressure</span>
                            <span className="font-mono text-white font-medium">{stats.ramUsed.toFixed(1)} / {stats.ramTotal.toFixed(0)} GB</span>
                        </div>
                        <div className="my-2">
                            <div className="w-full bg-white/[0.08] h-2 rounded-full overflow-hidden p-0.5">
                                <div
                                    className="bg-gradient-to-r from-[#0A84FF] to-[#AF52DE] h-full rounded-full transition-all duration-700"
                                    style={{ width: `${Math.min(100, (stats.ramUsed / stats.ramTotal) * 100)}%` }}
                                />
                            </div>
                        </div>
                        <span className="text-[11px] text-[#86868B]">
                            {Math.round((stats.ramUsed / stats.ramTotal) * 100)}% of unified memory active
                        </span>
                    </div>

                    {/* Drive S.M.A.R.T. */}
                    <div className="apple-glass rounded-2xl p-4 flex-1 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-[#86868B] uppercase tracking-wider">Drive Reliability</span>
                            <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${driveStatus.score >= 80 ? 'bg-[#30D158]/15 text-[#30D158]' : 'bg-[#FF9F0A]/15 text-[#FF9F0A]'}`}>
                                {driveStatus.status}
                            </span>
                        </div>
                        <div className="flex items-center space-x-2 my-1">
                            <svg className={`w-5 h-5 ${driveStatus.score >= 80 ? 'text-[#30D158]' : 'text-[#FF9F0A]'}`} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-[13px] font-semibold text-white truncate">{driveStatus.name}</span>
                        </div>
                        <span className="text-[11px] text-[#86868B] font-mono">
                            Diagnostic Rating: {driveStatus.score}/100
                        </span>
                    </div>
                </div>
            </div>

            {/* Apple Clean Efficiency Timeline */}
            <div className="apple-glass rounded-2xl p-6 flex flex-col flex-1 min-h-[280px]">
                <div className="flex justify-between items-center mb-5">
                    <div>
                        <h2 className="text-[15px] font-bold text-white tracking-tight">Cleanup Efficiency Trend</h2>
                        <p className="text-[12px] text-[#86868B]">Daily reclaimed storage volume over time</p>
                    </div>
                    <span className="text-[11px] font-medium text-[#86868B] px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                        Unit: GB Saved
                    </span>
                </div>

                <div className="flex-1 w-full">
                    {lineData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={lineData}>
                                <XAxis dataKey="day" stroke="#48484A" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="#48484A" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(28, 28, 30, 0.95)', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '10px', fontSize: '11px', backdropFilter: 'blur(16px)' }}
                                    itemStyle={{ color: '#0A84FF', fontWeight: 600 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="saved"
                                    stroke="#0A84FF"
                                    strokeWidth={3}
                                    dot={{ r: 3, fill: '#0A84FF', strokeWidth: 0 }}
                                    activeDot={{ r: 5, fill: '#FFFFFF', stroke: '#0A84FF', strokeWidth: 2 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-[#86868B]">
                            <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <p className="text-[13px]">No cleanup history logged yet. Run a scan to see trends.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
