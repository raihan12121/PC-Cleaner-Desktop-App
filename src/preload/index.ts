import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../main/ipc/channels';

// Expose safe APIs to renderer
const api = {
    // Window controls
    minimize: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE),
    close: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),

    // API calls mapped to IPC
    invoke: (channel: string, ...args: any[]) => {
        // Basic channel validation
        const validChannels = Object.values(IPC_CHANNELS);
        if ((validChannels as string[]).includes(channel)) {
            return ipcRenderer.invoke(channel, ...args);
        }
        throw new Error(`Unauthorized IPC channel: ${channel}`);
    },

    // Safe event listener for streaming progress updates
    on: (channel: string, callback: (...args: any[]) => void) => {
        const validChannels = Object.values(IPC_CHANNELS);
        if (!(validChannels as string[]).includes(channel)) {
            throw new Error(`Unauthorized IPC channel: ${channel}`);
        }
        const subscription = (_event: Electron.IpcRendererEvent, ...args: any[]) => callback(...args);
        ipcRenderer.on(channel, subscription);
        return () => ipcRenderer.removeListener(channel, subscription);
    }
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronApi = typeof api;
