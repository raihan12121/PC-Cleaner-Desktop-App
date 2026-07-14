export interface ScanItem {
    id: string; // Unique identifier for the item (e.g. hash or file path)
    path: string;
    name: string;
    size: number; // in bytes
    category: string; // e.g. "Cache", "Temp Files", "Logs"
    selected: boolean; // default selection state
    metadata?: any; // any extra data specific to the module
}

export interface ScanResult {
    items: ScanItem[];
    totalBytes: number;
}

export interface CleanResult {
    itemsRemoved: number;
    bytesFreed: number;
    success: boolean;
    error?: string;
}

export abstract class BaseModule {
    /**
     * The display name of the module
     */
    abstract readonly moduleName: string;

    /**
     * Scans the system for optimization targets
     * @param options Optional configuration for the scan
     * @returns A preview of what can be cleaned
     */
    abstract scan(options?: any): Promise<ScanResult>;

    /**
     * Performs the cleanup action on the provided items
     * No deletion should happen without being passed explicitly here
     * @param items The specific items chosen by the user to clean
     * @returns Stats about the cleanup operation
     */
    abstract clean(items: ScanItem[]): Promise<CleanResult>;

    /**
     * Restores the system to the state before the last clean() operation
     * If a module does not support rollback, it should throw an error or do nothing
     */
    abstract rollback(): Promise<void>;
}
