import os from "os";
import fs from "fs";
import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store database in user config dir so it survives app updates
const dbDir = path.join(os.homedir(), ".config/aether-mail");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
process.env.DATABASE_URL = path.join(dbDir, "mail_tracker.db");

let mainWindow;
let backendProcess;

// Attendre que le backend Express réponde avant de charger le frontend
async function waitForBackend(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch('http://localhost:5000/api/health');
      if (res.ok) {
        console.log(`[Main] Backend prêt après ${i * 200}ms`);
        return true;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  console.error('[Main] Backend toujours pas prêt après 6s');
  return false;
}

function startBackend() {
  // When packaged, backend files are unpacked from the asar archive
  let backendPath = path.join(__dirname, 'backend', 'server.js');
  if (app.isPackaged) {
    backendPath = backendPath.replace('app.asar', 'app.asar.unpacked');
  }

  backendProcess = fork(backendPath, [], {
    env: { ...process.env, PORT: 5000, NODE_ENV: 'production' },
    silent: true
  });

  backendProcess.stdout?.on('data', (data) => {
    console.log(`[Backend Log]: ${data}`);
  });

  backendProcess.stderr?.on('data', (data) => {
    console.error(`[Backend Error]: ${data}`);
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    title: "Aether Mail",
    backgroundColor: '#060913',
    icon: path.join(__dirname, 'frontend', 'public', 'favicon.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.setMenuBarVisibility(false);

  const isDev = !app.isPackaged;

  // Attendre que le backend soit prêt avant de charger le frontend
  await waitForBackend();

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, "frontend", "dist", "index.html"));
  }

  // Ouvrir tous les liens dans le navigateur système (pas dans Electron)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const appUrl = isDev ? 'http://localhost:5173' : `file://`;
    if (!url.startsWith(appUrl)) {
      event.preventDefault();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        shell.openExternal(url);
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
