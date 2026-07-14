export const IPC_CHANNELS = {
    // Application lifecycle
    GET_VERSION: 'app:getVersion',

    // OS/System
    SYSTEM_INFO: 'system:info',
    SYSTEM_PROCESSES: 'system:processes',

    // Database Operations
    DB_QUERY_SCANS: 'db:queryScans',
    DB_QUERY_TIMELINE: 'db:queryTimeline',
    DB_QUERY_SCHEDULES: 'db:querySchedules',
    DB_SAVE_SCHEDULE: 'db:saveSchedule',
    DB_DELETE_SCHEDULE: 'db:deleteSchedule',
    DB_RESET: 'db:reset',

    // Disk Cleaner Module
    DISK_SCAN: 'disk:scan',
    DISK_CLEAN: 'disk:clean',

    // Duplicate Finder Module
    DUPLICATE_SCAN: 'duplicate:scan',
    DUPLICATE_CLEAN: 'duplicate:clean',

    // Registry Cleaner Module (Win)
    REGISTRY_SCAN: 'registry:scan',
    REGISTRY_CLEAN: 'registry:clean',
    REGISTRY_ROLLBACK: 'registry:rollback',

    // Startup Manager Module
    STARTUP_SCAN: 'startup:scan',
    STARTUP_TOGGLE: 'startup:toggle',

    // RAM Optimizer Module
    RAM_INFO: 'ram:info',
    RAM_OPTIMIZE: 'ram:optimize',

    // Privacy Cleaner Module
    PRIVACY_SCAN: 'privacy:scan',
    PRIVACY_CLEAN: 'privacy:clean',

    // Window controls
    WINDOW_MINIMIZE: 'window:minimize',
    WINDOW_MAXIMIZE: 'window:maximize',
    WINDOW_CLOSE: 'window:close',

    // Drive Health
    DRIVE_HEALTH: 'drive:health'
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
