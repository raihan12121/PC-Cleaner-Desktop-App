export interface ElectronApi {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, callback: (...args: any[]) => void) => () => void;
}

declare global {
    interface Window {
        api: ElectronApi;
    }
}
