import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import appLogo from './assets/app-icon.png';
import { ThemeProvider, useTheme } from './context/ThemeContext';

import Cleaner from './pages/Cleaner';
import Dashboard from './pages/Dashboard';
import DuplicateFinder from './pages/DuplicateFinder';
import Optimizer from './pages/Optimizer';
import Privacy from './pages/Privacy';
import Registry from './pages/Registry';
import Settings from './pages/Settings';
import SystemMonitor from './pages/SystemMonitor';

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
            `group flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                isActive
                    ? 'bg-[#0A84FF] text-white shadow-md shadow-blue-500/20 font-semibold'
                    : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)] hover:bg-black/[0.05] dark:hover:bg-white/[0.06]'
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

const AppContent: React.FC = () => {
    const [version, setVersion] = useState('1.0.5');
    const { resolvedTheme, toggleTheme } = useTheme();

    useEffect(() => {
        if (window.api?.invoke) {
            window.api.invoke('app:getVersion')
                .then((v: string) => { if (v) setVersion(v); })
                .catch(() => { /* keep default */ });
        }
    }, []);

    return (
        <Router>
            <div className="flex h-screen bg-[var(--apple-bg)] font-sans text-[var(--apple-text-primary)] select-none overflow-hidden transition-colors duration-200">
                {/* Sidebar */}
                <aside className="w-56 bg-[var(--apple-sidebar-bg)] backdrop-blur-2xl border-r border-[var(--apple-sidebar-border)] flex flex-col shrink-0 z-20 transition-colors duration-200">
                    {/* App Header Branding with Drag Region */}
                    <div className="pt-4 px-5 pb-3 flex items-center space-x-2.5 app-region-drag">
                        <img
                            src={appLogo}
                            alt="PC Cleaner Logo"
                            className="w-8 h-8 rounded-xl object-contain shadow-md shadow-blue-500/25 app-region-no-drag"
                        />
                        <div className="app-region-no-drag">
                            <h1 className="text-[13px] font-bold text-[var(--apple-text-primary)] tracking-tight leading-none">PC Cleaner</h1>
                            <span className="text-[10px] text-[var(--apple-text-secondary)] font-medium">System Suite</span>
                        </div>
                    </div>

                    {/* Navigation Menu */}
                    <nav className="flex-1 px-3 space-y-4 mt-4 overflow-y-auto custom-scrollbar">
                        <div>
                            <div className="px-2 mb-1.5 text-[10px] font-bold text-[var(--apple-text-muted)] uppercase tracking-wider">Overview</div>
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
                            <div className="px-2 mb-1.5 text-[10px] font-bold text-[var(--apple-text-muted)] uppercase tracking-wider">Cleaning</div>
                            <div className="space-y-0.5">
                                <NavItem
                                    to="/cleaner"
                                    icon="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    label="System Junk"
                                />
                                <NavItem
                                    to="/duplicates"
                                    icon="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                                    label="Duplicate Files"
                                />
                                <NavItem
                                    to="/registry"
                                    icon="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
                                    label="Registry Fix"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="px-2 mb-1.5 text-[10px] font-bold text-[var(--apple-text-muted)] uppercase tracking-wider">Optimization</div>
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

                    {/* Bottom Status & Quick Theme Toggle */}
                    <div className="p-3 border-t border-[var(--apple-sidebar-border)] bg-black/[0.03] dark:bg-black/10">
                        <div className="px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-[var(--apple-glass-border)] flex items-center justify-between">
                            <div className="flex items-center space-x-2 min-w-0">
                                <span className="w-2 h-2 rounded-full bg-[#30D158] shadow-[0_0_8px_rgba(48,209,88,0.6)]" />
                                <span className="text-[11px] text-[var(--apple-text-primary)] font-medium truncate">Protected</span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                                <button
                                    onClick={toggleTheme}
                                    title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
                                    className="p-1 rounded-md text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] transition-colors cursor-pointer"
                                >
                                    {resolvedTheme === 'dark' ? (
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                        </svg>
                                    )}
                                </button>
                                <span className="text-[10px] text-[var(--apple-text-muted)] font-mono font-medium">v{version}</span>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content Viewport */}
                <main className="flex-1 overflow-hidden relative flex flex-col bg-[var(--apple-bg)] text-[var(--apple-text-primary)] transition-colors duration-200">
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

const App: React.FC = () => (
    <ThemeProvider>
        <AppContent />
    </ThemeProvider>
);

export default App;
