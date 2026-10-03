import React, { useState, useEffect, useMemo } from 'react';
import { useIpc } from '../hooks/useIpc';
import { IPC_CHANNELS } from '../../main/ipc/channels';

interface DriveInfo {
    letter: string;
    mount: string;
    label: string;
    fsType: string;
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usedPercentage: number;
    healthStatus: string;
    driveType: string;
    physicalDiskName?: string;
    physicalDiskType?: string;
}

interface LargeFileInfo {
    id: string;
    path: string;
    name: string;
    size: number;
    extension: string;
    category: 'Video' | 'Archive' | 'Disk Image' | 'Document' | 'Executable' | 'Audio' | 'Other';
    modifiedTime: string;
}

interface FolderSizeInfo {
    path: string;
    name: string;
    size: number;
    fileCount: number;
}

interface LargeSpaceResult {
    targetPath: string;
    totalScannedFiles: number;
    totalScannedBytes: number;
    topFiles: LargeFileInfo[];
    topFolders: FolderSizeInfo[];
}

interface InstalledAppInfo {
    id: string;
    name: string;
    version: string;
    publisher: string;
    location: string;
    size: number;
    installDate: string;
}

const formatBytes = (bytes: number, decimals = 1): string => {
    if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const clamped = Math.min(i, sizes.length - 1);
    return `${parseFloat((bytes / Math.pow(k, clamped)).toFixed(dm))} ${sizes[clamped]}`;
};

const Storage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'drives' | 'analyzer' | 'apps'>('drives');

    // IPC hooks
    const { invoke: getDrives, loading: drivesLoading } = useIpc(IPC_CHANNELS.STORAGE_DRIVES_GET);
    const { invoke: openDrive } = useIpc(IPC_CHANNELS.STORAGE_DRIVE_OPEN);
    const { invoke: scanSpace, loading: scanLoading } = useIpc(IPC_CHANNELS.STORAGE_LARGE_FILES_SCAN);
    const { invoke: scanApps, loading: appsLoading } = useIpc(IPC_CHANNELS.STORAGE_APPS_SCAN);
    const { invoke: revealItem } = useIpc(IPC_CHANNELS.STORAGE_ITEM_REVEAL);
    const { invoke: deleteFile } = useIpc(IPC_CHANNELS.STORAGE_ITEM_DELETE);

    // Drives state
    const [drives, setDrives] = useState<DriveInfo[]>([]);
    
    // Space Analyzer state
    const [selectedDrivePath, setSelectedDrivePath] = useState<string>('C:\\');
    const [analyzerResult, setAnalyzerResult] = useState<LargeSpaceResult | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [fileSearchQuery, setFileSearchQuery] = useState<string>('');

    // Apps state
    const [apps, setApps] = useState<InstalledAppInfo[]>([]);
    const [appSearchQuery, setAppSearchQuery] = useState<string>('');

    // Load drives on mount
    const fetchDrives = async () => {
        try {
            const data = await getDrives();
            if (Array.isArray(data)) {
                setDrives(data);
                if (data.length > 0 && !selectedDrivePath) {
                    setSelectedDrivePath(data[0].mount || `${data[0].letter}\\`);
                }
            }
        } catch (e) {
            console.error('Failed to load drives:', e);
        }
    };

    useEffect(() => {
        fetchDrives();
    }, []);

    // Load apps when apps tab is clicked if not already loaded
    useEffect(() => {
        if (activeTab === 'apps' && apps.length === 0) {
            handleScanApps();
        }
    }, [activeTab]);

    const handleScanSpace = async (target?: string) => {
        const path = target || selectedDrivePath;
        try {
            const result = await scanSpace(path, 6);
            if (result && !result.error) {
                setAnalyzerResult(result);
            }
        } catch (e) {
            console.error('Space scan failed:', e);
        }
    };

    const handleScanApps = async () => {
        try {
            const result = await scanApps();
            if (Array.isArray(result)) {
                setApps(result);
            }
        } catch (e) {
            console.error('Apps scan failed:', e);
        }
    };

    const handleDeleteFile = async (file: LargeFileInfo) => {
        if (!confirm(`Are you sure you want to permanently delete this file?\n\n${file.name}\nSize: ${formatBytes(file.size)}\nPath: ${file.path}`)) {
            return;
        }

        try {
            const res = await deleteFile(file.path);
            if (res && res.success) {
                setAnalyzerResult(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        topFiles: prev.topFiles.filter(f => f.id !== file.id),
                        totalScannedBytes: Math.max(0, prev.totalScannedBytes - file.size)
                    };
                });
                fetchDrives();
            } else {
                alert(`Failed to delete file: ${res?.error || 'Unknown error'}`);
            }
        } catch (e) {
            alert(`Error deleting file: ${e}`);
        }
    };

    // Filtered large files
    const filteredFiles = useMemo(() => {
        if (!analyzerResult?.topFiles) return [];
        return analyzerResult.topFiles.filter(file => {
            const matchesCat = selectedCategory === 'All' || file.category === selectedCategory;
            const matchesSearch = !fileSearchQuery || file.name.toLowerCase().includes(fileSearchQuery.toLowerCase());
            return matchesCat && matchesSearch;
        });
    }, [analyzerResult, selectedCategory, fileSearchQuery]);

    // Filtered apps
    const filteredApps = useMemo(() => {
        if (!apps) return [];
        return apps.filter(app => {
            const q = appSearchQuery.toLowerCase();
            return !q || app.name.toLowerCase().includes(q) || app.publisher.toLowerCase().includes(q);
        });
    }, [apps, appSearchQuery]);

    const totalAppsStorage = useMemo(() => {
        return apps.reduce((acc, app) => acc + (app.size || 0), 0);
    }, [apps]);

    return (
        <div className="p-8 h-full flex flex-col overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--apple-text-primary)]">
                        Storage & Drives
                    </h1>
                    <p className="text-[13px] text-[var(--apple-text-secondary)] mt-0.5">
                        Drive volumes, large files & folders breakdown, and installed application storage
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-black/[0.05] dark:bg-white/[0.05] border border-[var(--apple-glass-border)] rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('drives')}
                        className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                            activeTab === 'drives'
                                ? 'bg-[#0A84FF] text-white shadow-sm'
                                : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
                        }`}
                    >
                        Drives Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('analyzer')}
                        className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                            activeTab === 'analyzer'
                                ? 'bg-[#0A84FF] text-white shadow-sm'
                                : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
                        }`}
                    >
                        Space Analyzer
                    </button>
                    <button
                        onClick={() => setActiveTab('apps')}
                        className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                            activeTab === 'apps'
                                ? 'bg-[#0A84FF] text-white shadow-sm'
                                : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
                        }`}
                    >
                        App Storage
                    </button>
                </div>
            </div>

            {/* TAB 1: DRIVES OVERVIEW */}
            {activeTab === 'drives' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div className="text-[12px] font-bold text-[var(--apple-text-muted)] uppercase tracking-wider">
                            Mounted Volumes ({drives.length})
                        </div>
                        <button
                            onClick={fetchDrives}
                            disabled={drivesLoading}
                            className="text-[12px] text-[#0A84FF] hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
                        >
                            <svg className={`w-3.5 h-3.5 ${drivesLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Refresh</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {drives.map((d) => {
                            const isHigh = d.usedPercentage >= 90;
                            const isWarning = d.usedPercentage >= 80 && !isHigh;
                            const barColor = isHigh ? 'bg-[#FF453A]' : isWarning ? 'bg-[#FF9F0A]' : 'bg-[#30D158]';

                            return (
                                <div
                                    key={d.letter}
                                    className="apple-glass rounded-2xl p-5 border border-[var(--apple-glass-border)] hover:border-black/20 dark:hover:border-white/20 transition-all flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[#0A84FF] flex items-center justify-center font-bold text-base">
                                                    {d.letter.replace(':', '')}
                                                </div>
                                                <div>
                                                    <div className="flex items-center space-x-2">
                                                        <h3 className="text-base font-bold text-[var(--apple-text-primary)]">
                                                            {d.label} ({d.letter})
                                                        </h3>
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[var(--apple-text-secondary)]">
                                                            {d.fsType}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-[var(--apple-text-secondary)] mt-0.5">
                                                        {d.physicalDiskName || 'Physical Disk'} • {d.physicalDiskType || 'Storage'}
                                                    </p>
                                                </div>
                                            </div>

                                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#30D158]/10 text-[#30D158]">
                                                {d.healthStatus}
                                            </span>
                                        </div>

                                        {/* Storage Bar */}
                                        <div className="mt-5 space-y-2">
                                            <div className="flex justify-between text-[12px] font-semibold">
                                                <span className="text-[var(--apple-text-primary)]">
                                                    {formatBytes(d.usedBytes)} occupied
                                                </span>
                                                <span className="text-[var(--apple-text-secondary)]">
                                                    {formatBytes(d.freeBytes)} available
                                                </span>
                                            </div>

                                            <div className="w-full h-3 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden p-0.5">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                                    style={{ width: `${d.usedPercentage}%` }}
                                                />
                                            </div>

                                            <div className="flex justify-between items-center text-[11px] text-[var(--apple-text-secondary)] pt-1">
                                                <span>Capacity: {formatBytes(d.totalBytes)}</span>
                                                <span className="font-semibold text-[var(--apple-text-primary)]">
                                                    {d.usedPercentage.toFixed(1)}% used
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="mt-6 pt-4 border-t border-[var(--apple-glass-border)] flex items-center justify-between gap-3">
                                        <button
                                            onClick={() => openDrive(d.mount || `${d.letter}\\`)}
                                            className="px-3 py-1.5 rounded-xl text-[12px] font-semibold bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] text-[var(--apple-text-primary)] transition-colors cursor-pointer"
                                        >
                                            Open in Explorer
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedDrivePath(d.mount || `${d.letter}\\`);
                                                setActiveTab('analyzer');
                                                handleScanSpace(d.mount || `${d.letter}\\`);
                                            }}
                                            className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold bg-[#0A84FF] hover:bg-blue-600 text-white transition-colors cursor-pointer shadow-sm"
                                        >
                                            Analyze Files
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 2: SPACE ANALYZER (LARGEST FILES & FOLDERS) */}
            {activeTab === 'analyzer' && (
                <div className="space-y-6">
                    {/* Controls Bar */}
                    <div className="apple-glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center space-x-3">
                            <label className="text-[12px] font-bold text-[var(--apple-text-secondary)]">
                                Scan Target:
                            </label>
                            <select
                                value={selectedDrivePath}
                                onChange={(e) => setSelectedDrivePath(e.target.value)}
                                className="px-3 py-1.5 rounded-xl text-[12px] font-semibold bg-black/[0.05] dark:bg-white/[0.08] border border-[var(--apple-glass-border)] text-[var(--apple-text-primary)] focus:outline-none"
                            >
                                {drives.map((d) => (
                                    <option key={d.letter} value={d.mount || `${d.letter}\\`}>
                                        {d.letter} ({d.label}) - {formatBytes(d.totalBytes)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={() => handleScanSpace()}
                            disabled={scanLoading}
                            className="px-4 py-2 rounded-xl text-[12px] font-semibold bg-[#0A84FF] hover:bg-blue-600 disabled:opacity-50 text-white transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center space-x-2"
                        >
                            {scanLoading ? (
                                <>
                                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    <span>Scanning Drive...</span>
                                </>
                            ) : (
                                <span>Scan for Largest Items</span>
                            )}
                        </button>
                    </div>

                    {/* Scan Results */}
                    {analyzerResult && (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="apple-glass rounded-xl p-4">
                                    <div className="text-[11px] font-bold text-[var(--apple-text-muted)] uppercase tracking-wider">
                                        Scanned Files
                                    </div>
                                    <div className="text-xl font-bold text-[var(--apple-text-primary)] mt-1">
                                        {analyzerResult.totalScannedFiles.toLocaleString()}
                                    </div>
                                    <div className="text-[11px] text-[var(--apple-text-secondary)] mt-0.5">
                                        Total inspected items
                                    </div>
                                </div>
                                <div className="apple-glass rounded-xl p-4">
                                    <div className="text-[11px] font-bold text-[var(--apple-text-muted)] uppercase tracking-wider">
                                        Scanned Volume
                                    </div>
                                    <div className="text-xl font-bold text-[#0A84FF] mt-1">
                                        {formatBytes(analyzerResult.totalScannedBytes)}
                                    </div>
                                    <div className="text-[11px] text-[var(--apple-text-secondary)] mt-0.5">
                                        Indexed space footprint
                                    </div>
                                </div>
                                <div className="apple-glass rounded-xl p-4">
                                    <div className="text-[11px] font-bold text-[var(--apple-text-muted)] uppercase tracking-wider">
                                        Top File Size
                                    </div>
                                    <div className="text-xl font-bold text-[#FF9F0A] mt-1">
                                        {analyzerResult.topFiles[0] ? formatBytes(analyzerResult.topFiles[0].size) : '0 B'}
                                    </div>
                                    <div className="text-[11px] text-[var(--apple-text-secondary)] mt-0.5 truncate">
                                        {analyzerResult.topFiles[0]?.name || 'No large files'}
                                    </div>
                                </div>
                            </div>

                            {/* Top Folders Section */}
                            {analyzerResult.topFolders.length > 0 && (
                                <div className="apple-glass rounded-2xl p-5">
                                    <div className="text-[12px] font-bold text-[var(--apple-text-muted)] uppercase tracking-wider mb-4">
                                        Largest Folders on {selectedDrivePath}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {analyzerResult.topFolders.slice(0, 6).map((folder) => (
                                            <div
                                                key={folder.path}
                                                className="p-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-[var(--apple-glass-border)] flex items-center justify-between"
                                            >
                                                <div className="min-w-0 mr-3">
                                                    <div className="text-[13px] font-semibold text-[var(--apple-text-primary)] truncate">
                                                        📁 {folder.name}
                                                    </div>
                                                    <div className="text-[11px] text-[var(--apple-text-secondary)] mt-0.5">
                                                        {folder.fileCount.toLocaleString()} files
                                                    </div>
                                                </div>
                                                <span className="text-[12px] font-bold font-mono text-[#0A84FF] shrink-0">
                                                    {formatBytes(folder.size)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Top Files Table */}
                            <div className="apple-glass rounded-2xl p-5">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                                    <div className="text-[12px] font-bold text-[var(--apple-text-muted)] uppercase tracking-wider">
                                        Top Largest Files ({filteredFiles.length})
                                    </div>

                                    {/* Category filter pills & search */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            type="text"
                                            placeholder="Filter files..."
                                            value={fileSearchQuery}
                                            onChange={(e) => setFileSearchQuery(e.target.value)}
                                            className="px-2.5 py-1 text-[11px] rounded-lg bg-black/[0.05] dark:bg-white/[0.08] border border-[var(--apple-glass-border)] text-[var(--apple-text-primary)] focus:outline-none w-36"
                                        />

                                        {['All', 'Video', 'Archive', 'Disk Image', 'Executable', 'Document'].map((cat) => (
                                            <button
                                                key={cat}
                                                onClick={() => setSelectedCategory(cat)}
                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                                                    selectedCategory === cat
                                                        ? 'bg-[#0A84FF] text-white'
                                                        : 'bg-black/[0.04] dark:bg-white/[0.05] text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
                                                }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-[12px]">
                                        <thead className="text-[10px] uppercase font-bold text-[var(--apple-text-muted)] tracking-wider border-b border-[var(--apple-glass-border)]">
                                            <tr>
                                                <th className="px-3 py-2">Name</th>
                                                <th className="px-3 py-2">Category</th>
                                                <th className="px-3 py-2 text-right">Size</th>
                                                <th className="px-3 py-2 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                                            {filteredFiles.map((file) => (
                                                <tr key={file.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                                                    <td className="px-3 py-2.5 max-w-sm truncate">
                                                        <div className="font-semibold text-[var(--apple-text-primary)] truncate">
                                                            {file.name}
                                                        </div>
                                                        <div className="text-[10px] text-[var(--apple-text-secondary)] truncate">
                                                            {file.path}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[var(--apple-text-secondary)]">
                                                            {file.category}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5 font-mono font-bold text-right text-[var(--apple-text-primary)]">
                                                        {formatBytes(file.size)}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right space-x-2">
                                                        <button
                                                            onClick={() => revealItem(file.path)}
                                                            className="text-[11px] text-[#0A84FF] hover:underline font-semibold cursor-pointer"
                                                        >
                                                            Reveal
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteFile(file)}
                                                            className="text-[11px] text-[#FF453A] hover:underline font-semibold cursor-pointer"
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: APP STORAGE */}
            {activeTab === 'apps' && (
                <div className="space-y-6">
                    {/* Header stats & search */}
                    <div className="apple-glass rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center space-x-4">
                            <div>
                                <div className="text-[11px] font-bold text-[var(--apple-text-muted)] uppercase tracking-wider">
                                    Installed Applications
                                </div>
                                <div className="text-xl font-bold text-[var(--apple-text-primary)] mt-0.5">
                                    {apps.length} Apps • {formatBytes(totalAppsStorage)}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3">
                            <input
                                type="text"
                                placeholder="Search applications..."
                                value={appSearchQuery}
                                onChange={(e) => setAppSearchQuery(e.target.value)}
                                className="px-3 py-1.5 text-[12px] rounded-xl bg-black/[0.05] dark:bg-white/[0.08] border border-[var(--apple-glass-border)] text-[var(--apple-text-primary)] focus:outline-none w-48 md:w-64"
                            />
                            <button
                                onClick={handleScanApps}
                                disabled={appsLoading}
                                className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold bg-[#0A84FF] hover:bg-blue-600 disabled:opacity-50 text-white transition-all shadow-sm cursor-pointer flex items-center space-x-1.5"
                            >
                                <svg className={`w-3.5 h-3.5 ${appsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Refresh</span>
                            </button>
                        </div>
                    </div>

                    {/* Apps list */}
                    <div className="apple-glass rounded-2xl p-5">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-[12px]">
                                <thead className="text-[10px] uppercase font-bold text-[var(--apple-text-muted)] tracking-wider border-b border-[var(--apple-glass-border)]">
                                    <tr>
                                        <th className="px-3 py-2.5">Application</th>
                                        <th className="px-3 py-2.5">Publisher</th>
                                        <th className="px-3 py-2.5">Version</th>
                                        <th className="px-3 py-2.5 text-right">Space Consumed</th>
                                        <th className="px-3 py-2.5 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                                    {filteredApps.map((app) => (
                                        <tr key={app.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                                            <td className="px-3 py-3 max-w-xs truncate">
                                                <div className="font-semibold text-[var(--apple-text-primary)] truncate">
                                                    {app.name}
                                                </div>
                                                {app.location && (
                                                    <div className="text-[10px] text-[var(--apple-text-secondary)] truncate">
                                                        {app.location}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-[var(--apple-text-secondary)] truncate max-w-[180px]">
                                                {app.publisher}
                                            </td>
                                            <td className="px-3 py-3 font-mono text-[var(--apple-text-muted)]">
                                                {app.version}
                                            </td>
                                            <td className="px-3 py-3 font-mono font-bold text-right text-[var(--apple-text-primary)]">
                                                {app.size > 0 ? formatBytes(app.size) : '< 1 MB'}
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                {app.location ? (
                                                    <button
                                                        onClick={() => revealItem(app.location)}
                                                        className="text-[11px] text-[#0A84FF] hover:underline font-semibold cursor-pointer"
                                                    >
                                                        Show Folder
                                                    </button>
                                                ) : (
                                                    <span className="text-[11px] text-[var(--apple-text-muted)]">
                                                        Managed
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Storage;
