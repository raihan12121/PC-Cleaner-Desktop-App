import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, NavLink } from 'react-router-dom';

import Cleaner from './pages/Cleaner';
import Dashboard from './pages/Dashboard';
import SystemMonitor from './pages/SystemMonitor';
import Optimizer from './pages/Optimizer';
import Privacy from './pages/Privacy';
import Settings from './pages/Settings';
import Registry from './pages/Registry';
import DuplicateFinder from './pages/DuplicateFinder';

interface NavItemProps {
    to: string;
    icon: string;
    label: string;
    badge?: string;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, badge }) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            `group flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                isActive
                    ? 'bg-[#0A84FF] text-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] shadow-blue-500/20 font-semibold'
                    : 'text-[#98989D] hover:text-[#F5F5F7] hover:bg-white/[0.06]'
            }`
        }
    >
        <div className="flex items-center space-x-2.5 truncate">
            <svg
                className="w-4 h-4 flex-shrink-0 transition-transform duration-150 group-hover:scale-105"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
            </svg>
            <span className="truncate">{label}</span>
        </div>
        {badge && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/20 text-white leading-none">
                {badge}
            </span>
        )}
    </NavLink>
);

const App: React.FC = () => {
    const [version, setVersion] = useState('1.0.5');

    useEffect(() => {
        if (window.api?.invoke) {
            window.api.invoke('app:getVersion')
                .then((v: string) => { if (v) setVersion(v); })
                .catch(() => { /* keep default */ });
        }
    }, []);

    return (
        <Router>
            <div className="flex h-screen bg-[#121214] font-sans text-[#F5F5F7] select-none overflow-hidden">
                {/* Sidebar */}
                <aside className="w-56 bg-[#18181B]/80 backdrop-blur-2xl border-r border-white/[0.06] flex flex-col shrink-0 z-20">
                    {/* App Header Branding with Drag Region */}
                    <div className="pt-4 px-5 pb-3 flex items-center space-x-2.5 app-region-drag">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#0A84FF] to-[#AF52DE] p-0.5 shadow-md shadow-blue-500/20 flex items-center justify-center app-region-no-drag">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div className="app-region-no-drag">
                            <h1 className="text-[13px] font-bold text-white tracking-tight leading-none">PC Cleaner</h1>
                            <span className="text-[10px] text-[#86868B] font-medium">System Suite</span>
                        </div>
                    </div>

                    {/* Navigation Menu */}
                    <nav className="flex-1 px-3 space-y-4 mt-4 overflow-y-auto custom-scrollbar">
                        <div>
                            <div className="px-2 mb-1.5 text-[10px] font-bold text-[#86868B] uppercase tracking-wider">Overview</div>
                            <div className="space-y-0.5">
                                <NavItem
                                    to="/"
                                    icon="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                                    label="Dashboard"
                                />
                                <NavItem
                                    to="/monitor"
                                    icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                    label="Activity Monitor"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="px-2 mb-1.5 text-[10px] font-bold text-[#86868B] uppercase tracking-wider">Cleaning</div>
                            <div className="space-y-0.5">
                                <NavItem
                                    to="/cleaner"
                                    icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                                    label="System Junk"
                                />
                                <NavItem
                                    to="/duplicates"
                                    icon="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                                    label="Duplicate Files"
                                />
                                <NavItem
                                    to="/registry"
                                    icon="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                                    label="Registry Fix"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="px-2 mb-1.5 text-[10px] font-bold text-[#86868B] uppercase tracking-wider">Optimization</div>
                            <div className="space-y-0.5">
                                <NavItem
                                    to="/optimizer"
                                    icon="M13 10V3L4 14h7v7l9-11h-7z"
                                    label="Performance"
                                />
                                <NavItem
                                    to="/privacy"
                                    icon="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                    label="Privacy & Security"
                                />
                                <NavItem
                                    to="/settings"
                                    icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                    label="Settings"
                                />
                            </div>
                        </div>
                    </nav>

                    {/* Bottom Status Capsule */}
                    <div className="p-3 border-t border-white/[0.06] bg-black/10">
                        <div className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-between">
                            <div className="flex items-center space-x-2 min-w-0">
                                <span className="w-2 h-2 rounded-full bg-[#30D158] shadow-[0_0_8px_rgba(48,209,88,0.6)]" />
                                <span className="text-[11px] text-[#F5F5F7] font-medium truncate">Protected</span>
                            </div>
                            <span className="text-[10px] text-[#86868B] font-mono font-medium">v{version}</span>
                        </div>
                    </div>
                </aside>

                {/* Main Content Viewport */}
                <main className="flex-1 overflow-hidden relative flex flex-col bg-[#161618]">
                    {/* Subtle Apple Top Vignette Glow */}
                    <div className="absolute top-0 right-0 left-0 h-64 bg-gradient-to-b from-blue-500/[0.03] to-transparent pointer-events-none" />

                    <div className="flex-1 overflow-hidden relative">
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/cleaner" element={<Cleaner />} />
                            <Route path="/registry" element={<Registry />} />
                            <Route path="/duplicates" element={<DuplicateFinder />} />
                            <Route path="/optimizer" element={<Optimizer />} />
                            <Route path="/privacy" element={<Privacy />} />
                            <Route path="/monitor" element={<SystemMonitor />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </div>
                </main>
            </div>
        </Router>
    );
};

export default App;
