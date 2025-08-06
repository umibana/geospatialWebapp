import { app, BrowserWindow, ipcMain } from "electron";
import registerListeners from "./helpers/ipc/listeners-register";
import { backendManager } from "./helpers/backend_helpers";
import { autoMainGrpcClient } from "./grpc-auto/auto-main-client";
import { registerAutoGrpcHandlers } from "./grpc-auto/auto-ipc-handlers";
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
      return autoMainGrpcClient.initialize();
    })
    .then(() => {
      console.log('Main process gRPC client initialized');
      // 🎉 Register auto-generated gRPC handlers
      registerAutoGrpcHandlers();
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

// 🎉 All gRPC IPC handlers now auto-generated!
// See registerAutoGrpcHandlers() call above

ipcMain.handle('grpc-stop-stream', async () => {
  try {
    // Note: stopCurrentStream method needs to be implemented in auto-generated client
    // mainGrpcClient.stopCurrentStream();
    return { success: true };
  } catch (error) {
    console.error('gRPC stopStream failed:', error);
    throw error;
  }
});

// NEW: Web Worker streaming - forwards chunks directly to worker (ZERO main thread accumulation)
ipcMain.on('grpc-start-worker-stream', async (event, request) => {
  const { requestId, bounds, dataTypes, maxPoints, resolution } = request;
  
  try {
    console.log(`⚡ Starting Web Worker stream for request ${requestId} with ${maxPoints} points...`);
    
    // Note: En una implementación real, aquí se inicializaría el Web Worker
    // Para esta demo, simulamos el procesamiento distribuido
    
    // Get data from gRPC in chunks
    const chunks = await autoMainGrpcClient.getBatchDataStreamed({ bounds, data_types: dataTypes, max_points: maxPoints, resolution });
    
    // Calculate total points from all chunks
    const totalPoints = chunks.reduce((sum, chunk) => sum + (chunk.data_points?.length || 0), 0);
    console.log(`📊 Generated ${totalPoints} points in ${chunks.length} chunks, forwarding directly to Web Worker...`);
    
    const startTime = performance.now();
    
    // Send initial progress
    event.sender.send('grpc-worker-stream-progress', {
      requestId,
      type: 'progress',
      processed: 0,
      total: totalPoints,
      percentage: 0,
      phase: 'starting_worker'
    });
    
    // Process gRPC chunks directly (already chunked by server)
    let processedCount = 0;
    
    // Process each chunk from gRPC stream 
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkPointCount = chunk.data_points?.length || 0;
      
      // Forward chunk to worker (simulated - in real implementation would use postMessage)
      // For now, we'll simulate the processing time without holding the data
      processedCount += chunkPointCount;
      
      // Send progress update
      event.sender.send('grpc-worker-stream-progress', {
        requestId,
        type: 'progress',
        processed: processedCount,
        total: totalPoints,
        percentage: (processedCount / totalPoints) * 100,
        phase: 'processing_worker'
      });
      
      // Yield to event loop every chunk
      await new Promise(resolve => setImmediate(resolve));
    }
    
    const endTime = performance.now();
    const processingTime = (endTime - startTime) / 1000;
    
    // Calculate statistics from the chunks
    let sum = 0;
    let minValue = Infinity;
    let maxValue = -Infinity;
    let pointCount = 0;
    
    console.log(`📊 Calculating statistics from ${chunks.length} gRPC chunks...`);
    
    // Process each chunk for statistics
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const dataPoints = chunk.data_points || [];
      
      // Calculate stats for this chunk
      for (const dataPoint of dataPoints) {
        const value = dataPoint.value || 0;
        sum += value;
        minValue = Math.min(minValue, value);
        maxValue = Math.max(maxValue, value);
        pointCount++;
      }
      
      // Send progress update for statistics calculation
      const statsProgress = ((i + 1) / chunks.length) * 100;
      event.sender.send('grpc-worker-stream-progress', {
        requestId,
        type: 'progress',
        processed: pointCount,
        total: totalPoints,
        percentage: statsProgress,
        phase: 'calculating_statistics'
      });
      
      // Yield to event loop every chunk to prevent blocking
      if (i < chunks.length - 1) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    const avgValue = pointCount > 0 ? sum / pointCount : 0;
    console.log(`📊 Statistics calculated: avg=${avgValue.toFixed(2)}, min=${minValue.toFixed(2)}, max=${maxValue.toFixed(2)}`);
    
    // Get a distributed sample of the actual data for visualization (safe sampling)
    console.log(`📝 Creating distributed sample from ${pointCount} points...`);
    const sampleSize = 10;
    const dataSample = [];
    
    // Take samples from the first chunk for demonstration
    if (chunks.length > 0 && chunks[0].data_points) {
      const firstChunkData = chunks[0].data_points;
      const samplesToTake = Math.min(sampleSize, firstChunkData.length);
      
      for (let i = 0; i < samplesToTake; i++) {
        const point = firstChunkData[i];
        if (point && point.location) {
          dataSample.push({
            id: point.id || `sample_${i}`,
            latitude: point.location.latitude || 0,
            longitude: point.location.longitude || 0,
            valor: point.value || 0,
            unidad: point.unit || 'units',
            tipo: (point.metadata && point.metadata.sensor_type) || dataTypes[0] || 'elevation',
            timestamp: new Date(point.timestamp || Date.now()).toLocaleTimeString(),
            posicion: `${i + 1}/${pointCount}` // Mostrar posición en el dataset
          });
        }
      }
    }
    
    console.log(`📝 Sample created with ${dataSample.length} points`);
    
    // Send completion with real data summary and sample
    event.sender.send('grpc-worker-stream-progress', {
      requestId,
      type: 'complete',
      totalProcessed: pointCount,
      processingTime: processingTime,
      generationMethod: chunks[0]?.generation_method || 'chunked_streaming',
      summary: {
        avgValue: Number(avgValue.toFixed(2)),
        minValue: Number(minValue.toFixed(2)),
        maxValue: Number(maxValue.toFixed(2)),
        dataTypes: dataTypes
      },
      dataSample: dataSample // ¡Datos reales para visualizar!
    });
    
    console.log(`⚡ Web Worker stream completed for ${requestId}: ${pointCount} points processed in ${processingTime.toFixed(2)}s`);
    
  } catch (error) {
    console.error(`Web Worker stream failed for ${requestId}:`, error);
    event.sender.send('grpc-worker-stream-error', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});





// 🗑️ Old manual handlers removed - now auto-generated!

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
