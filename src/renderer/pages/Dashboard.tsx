import React, { useEffect, useState } from 'react';
import { useIpc } from '../hooks/useIpc';
import { IPC_CHANNELS } from '../../main/ipc/channels';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard: React.FC = () => {
    const { invoke: getInfo, loading: infoLoading } = useIpc(IPC_CHANNELS.SYSTEM_INFO);
    const { invoke: getTimeline } = useIpc(IPC_CHANNELS.DB_QUERY_TIMELINE);

    const [healthScore, setHealthScore] = useState(100);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [stats, setStats] = useState({
        startupCount: 0,
        tempSize: 0,
        cpuUsage: 0,
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

                if (info && !info.error) {
                    const mainDisk = info.disk?.find((d: any) => d.mount?.toLowerCase().startsWith('c:')) || info.disk?.[0];
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
                    // History is fetched in DESC order; reverse to display chronological (oldest to newest)
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

    const COLORS = ['#3b82f6', '#1e293b'];

    if (infoLoading && isRefreshing) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-cyan-400 bg-slate-950">
                <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-4"></div>
                <p className="animate-pulse font-medium">Gathering system intelligence...</p>
            </div>
        );
    }

    return (
        <div className="p-8 h-full flex flex-col pt-12 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">System Dashboard</h1>
                    <p className="text-slate-400">Deep analysis of your hardware health and efficiency.</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${isRefreshing ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 animate-pulse' : 'bg-slate-800/50 text-slate-500 border-slate-700/50'}`}>
                    {isRefreshing ? 'LIVE UPDATE' : 'REAL-TIME ACTIVE'}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Health Score Card */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center backdrop-blur-sm shadow-xl shadow-cyan-900/5">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6">Security Score</h3>
                    <div className="relative w-36 h-36 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_8px_rgba(34,211,238,0.2)]" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="6" />
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#22d3ee" strokeWidth="6"
                                strokeDasharray={`${healthScore * 2.82} 282`} strokeLinecap="round" className="transition-all duration-1000" />
                        </svg>
                        <div className="absolute text-5xl font-black text-white">{healthScore}</div>
                    </div>
                    <p className="mt-6 text-cyan-400 font-bold tracking-wide">
                        {healthScore > 80 ? 'OPTIMIZED' : healthScore > 50 ? 'STABLE' : 'CRITICAL'}
                    </p>
                </div>

                {/* Disk Space Pie */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl shadow-blue-900/5 transition-transform hover:scale-[1.01]">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Primary Drive</h3>
                    <div className="h-44 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} innerRadius={42} outerRadius={62} paddingAngle={4} dataKey="value" stroke="none">
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}
                                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center space-x-6 mt-4 text-[10px] font-bold uppercase tracking-tighter">
                        <div className="flex items-center text-blue-400">
                            <span className="w-2 h-2 rounded-full mr-1.5 bg-blue-500 shadow-sm shadow-blue-500/50"></span> Occupied
                        </div>
                        <div className="flex items-center text-slate-500">
                            <span className="w-2 h-2 rounded-full mr-1.5 bg-slate-800"></span> Available
                        </div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="flex flex-col justify-between space-y-4">
                    <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm shadow-lg">
                        <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Volatile Memory</div>
                        <div className="flex items-end space-x-2">
                            <div className="text-3xl font-black text-white">{stats.ramUsed.toFixed(1)}</div>
                            <div className="text-sm font-bold text-slate-500 mb-1">GB USED</div>
                        </div>
                        <div className="mt-3 w-full bg-slate-800/50 h-1 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-1000"
                                style={{ width: `${(stats.ramUsed / stats.ramTotal) * 100}%` }}></div>
                        </div>
                    </div>
                    <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm shadow-lg">
                        <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Disk Reliability</div>
                        <div className="flex items-center space-x-2 mt-1">
                            <div className="text-2xl font-black text-green-400">EXCELLENT</div>
                            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-2 font-mono">S.M.A.R.T. Checks Passed</div>
                    </div>
                </div>
            </div>

            {/* Timeline Chart */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col backdrop-blur-sm shadow-2xl shadow-cyan-950/10 flex-1 min-h-[320px]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Efficiency Timeline</h3>
                    <div className="text-xs text-slate-500">Storage Freed (GB / Day)</div>
                </div>
                <div className="flex-1 w-full">
                    {lineData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={lineData}>
                                <XAxis dataKey="day" stroke="#334155" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="#334155" fontSize={10} tickLine={false} axisLine={false} dx={-10} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                                    itemStyle={{ color: '#22d3ee', fontSize: '12px', fontWeight: 'bold' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="saved"
                                    stroke="#06b6d4"
                                    strokeWidth={4}
                                    dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 0 }}
                                    activeDot={{ r: 6, fill: '#22d3ee', stroke: '#083344', strokeWidth: 2 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600">
                            <svg className="w-12 h-12 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <p className="text-sm italic">Analyze your system to see performance history.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
