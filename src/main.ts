import { app, BrowserWindow, ipcMain } from "electron";
import registerListeners from "./helpers/ipc/listeners-register";
import { backendManager } from "./helpers/backend_helpers";
import { mainGrpcClient } from "./main/grpc-client";
// "electron-squirrel-startup" seems broken when packaging with vite
//import started from "electron-squirrel-startup";
import path from "path";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";

const inDevelopment = process.env.NODE_ENV === "development";

async function createWindow() {
  const preload = path.join(__dirname, "preload.js");
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      devTools: inDevelopment,
      contextIsolation: true,
      nodeIntegration: true,
      nodeIntegrationInSubFrames: false,
      preload: preload,
    },
    titleBarStyle: "default",
    show: false, // Don't show until backend is ready
  });
  
  registerListeners(mainWindow);

  // Load the frontend first - don't wait for backend
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Show window immediately
  mainWindow.show();

  // Start gRPC backend in background (non-blocking)
  console.log('Starting gRPC backend in background...');
  backendManager.startBackend()
    .then(() => {
      console.log('gRPC backend started successfully');
      // Initialize gRPC client after backend is ready
      return mainGrpcClient.initialize();
    })
    .then(() => {
      console.log('Main process gRPC client initialized');
    })
    .catch((error) => {
      console.error('Failed to start gRPC backend or initialize client:', error);
      // Backend will show as unhealthy in the UI, which is fine
    });
}

async function installExtensions() {
  try {
    const result = await installExtension(REACT_DEVELOPER_TOOLS);
    console.log(`Extensions installed successfully: ${result.name}`);
  } catch {
    console.error("Failed to install extensions");
  }
}

app.whenReady().then(createWindow).then(installExtensions);

// IPC handlers for gRPC operations
ipcMain.handle('grpc-health-check', async () => {
  try {
    return await mainGrpcClient.healthCheck();
  } catch (error) {
    console.error('gRPC health check failed:', error);
    return { healthy: false, version: '1.0.0', status: { error: String(error) } };
  }
});

ipcMain.handle('grpc-get-features', async (event, bounds, featureTypes, limit) => {
  try {
    return await mainGrpcClient.getFeatures(bounds, featureTypes, limit);
  } catch (error) {
    console.error('gRPC getFeatures failed:', error);
    throw error;
  }
});

ipcMain.handle('grpc-get-stream-data', async (event, bounds, dataTypes, maxPointsPerSecond, maxDuration) => {
  try {
    return await mainGrpcClient.getStreamData(bounds, dataTypes, maxPointsPerSecond, maxDuration);
  } catch (error) {
    console.error('gRPC getStreamData failed:', error);
    throw error;
  }
});

// Handle app shutdown
app.on("before-quit", async (event) => {
  event.preventDefault();
  console.log('Shutting down gRPC backend...');
  await backendManager.stopBackend();
  app.exit(0);
});

//osX only
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
//osX only ends
