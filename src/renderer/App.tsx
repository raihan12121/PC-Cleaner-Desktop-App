import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, NavLink } from 'react-router-dom';

import Cleaner from './pages/Cleaner';
import Dashboard from './pages/Dashboard';
import SystemMonitor from './pages/SystemMonitor';
import Optimizer from './pages/Optimizer';
import Privacy from './pages/Privacy';
import Settings from './pages/Settings';
import Registry from './pages/Registry';
import DuplicateFinder from './pages/DuplicateFinder';

const NavItem = ({ to, icon, label }: { to: string; icon: string; label: string }) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`
        }
    >
        <svg className="w-5 h-5 flex-shrink-0" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
        </svg>
        <span className="font-medium truncate">{label}</span>
    </NavLink>
);

const App = () => {
    return (
        <Router>
            <div className="flex h-screen bg-slate-950 font-sans text-slate-200">
                {/* Sidebar */}
                <div className="w-64 bg-slate-900/80 border-r border-slate-800/60 flex flex-col shadow-xl z-10 backdrop-blur-md shrink-0">
                    <div className="p-6">
                        <h1 className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent tracking-tight">PC Optimizer</h1>
                    </div>
                    <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto custom-scrollbar pr-2">
                        <NavItem to="/" icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" label="Dashboard" />
                        <NavItem to="/cleaner" icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" label="Junk Cleaner" />
                        <NavItem to="/registry" icon="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" label="Registry Fix" />
                        <NavItem to="/duplicates" icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" label="Duplicate Finder" />
                        <NavItem to="/optimizer" icon="M13 10V3L4 14h7v7l9-11h-7z" label="Performance" />
                        <NavItem to="/privacy" icon="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" label="Privacy Shield" />
                        <NavItem to="/monitor" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" label="System Monitor" />
                        <NavItem to="/settings" icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" label="Settings" />
                    </nav>
                    <div className="p-6 border-t border-slate-800/60 bg-slate-900/40 shrink-0">
                        <div className="flex items-center space-x-3 mb-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-lg shadow-green-500/50"></div>
                            <span className="text-xs text-slate-300 font-medium tracking-tight">System Protected</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.2em] opacity-50">v1.0.0 Stable</div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-hidden relative border-l border-white/5">
                    <div className="absolute inset-0 bg-slate-950 shadow-2xl rounded-l-3xl overflow-hidden border-l border-slate-800/40">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.05),transparent_60%)] pointer-events-none"></div>
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/cleaner" element={<Cleaner />} />
                            <Route path="/registry" element={<Registry />} />
                            <Route path="/duplicates" element={<DuplicateFinder />} />
                            <Route path="/optimizer" element={<Optimizer />} />
                            <Route path="/privacy" element={<Privacy />} />
                            <Route path="/monitor" element={<SystemMonitor />} />
                            <Route path="/settings" element={<Settings />} />
                        </Routes>
                    </div>
                </div>
            </div>
        </Router>
    );
};

export default App;
