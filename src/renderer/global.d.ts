export interface ElectronApi {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
}

declare global {
    interface Window {
        api: ElectronApi;
    }
}
