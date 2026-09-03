import { app, BrowserWindow, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import started from 'electron-squirrel-startup';
import { initDatabase } from './database/db';
import { registerIpcHandlers } from './ipc/handlers';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Ensure Windows Taskbar registers the application icon and groups properly
if (process.platform === 'win32') {
  app.setAppUserModelId('com.squirrel.pc_cleaner.PCCleaner');
}

let mainWindow: BrowserWindow | null = null;

const getAppIcon = () => {
  const possiblePaths = [
    path.join(__dirname, '../../assets/icon.png'),
    path.join(__dirname, '../../assets/icon.ico'),
    path.join(process.resourcesPath, 'assets', 'icon.png'),
    path.join(process.resourcesPath, 'assets', 'icon.ico'),
    path.join(process.resourcesPath, 'icon.png'),
    path.join(app.getAppPath(), 'assets', 'icon.png'),
    path.join(app.getAppPath(), 'assets', 'icon.ico'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) {
        return img;
      }
    }
  }
  return undefined;
};

const createWindow = (): void => {
  const appIcon = getAppIcon();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    icon: appIcon,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#18181B',
      symbolColor: '#F5F5F7',
      height: 40,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    backgroundColor: '#121214',
    show: false,
  });

  if (appIcon) {
    mainWindow.setIcon(appIcon);
  }

  // Graceful show after ready
  mainWindow.once('ready-to-show', () => {
    if (appIcon) {
      mainWindow?.setIcon(appIcon);
    }
    mainWindow?.show();
  });

  // Load the renderer
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
};

app.whenReady().then(() => {
  try {
    // Initialize SQLite database
    initDatabase();

    // Register IPC handlers
    registerIpcHandlers();

    createWindow();
  } catch (error) {
    console.error('Failed to initialize application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Type declarations for Vite plugin
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
