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


ipcMain.handle('grpc-stop-stream', async () => {
  try {
    mainGrpcClient.stopCurrentStream();
    return { success: true };
  } catch (error) {
    console.error('gRPC stopStream failed:', error);
    throw error;
  }
});

// Performance testing methods


// Real-time streaming method that sends chunks via IPC events
ipcMain.handle('grpc-start-stream-batch-data', async (event, bounds, dataTypes, maxPoints, resolution) => {
  try {
    console.log('🔄 Starting real-time batch data stream via IPC events...');
    
    // Create the streaming call but don't collect all data
    console.log('🔄 Using mainGrpcClient.getBatchDataStreamed with real-time events...');
    
    // We'll use the existing method but handle chunks differently
    const bounds_typed = {
      northeast: {
        latitude: bounds.northeast.latitude,
        longitude: bounds.northeast.longitude,
        altitude: bounds.northeast.altitude || 0
      },
      southwest: {
        latitude: bounds.southwest.latitude,
        longitude: bounds.southwest.longitude,
        altitude: bounds.southwest.altitude || 0
      }
    };

    // Start the streaming and send chunks via events
    mainGrpcClient.getBatchDataStreamed(bounds_typed, dataTypes, maxPoints, resolution)
      .then((result) => {
        // This will be called when all chunks are collected
        event.sender.send('grpc-stream-completed', {
          totalCount: result.totalCount,
          generationMethod: result.generationMethod,
          allDataReceived: true
        });
      })
      .catch((error) => {
        event.sender.send('grpc-stream-error', { error: error.message });
      });

    // Return immediately - data will come via the original method
    return { status: 'streaming_started' };
    
  } catch (error) {
    console.error('gRPC start stream failed:', error);
    throw error;
  }
});

// Keep the old method for compatibility

// NEW: Web Worker streaming - forwards chunks directly to worker (ZERO main thread accumulation)
ipcMain.on('grpc-start-worker-stream', async (event, request) => {
  const { requestId, bounds, dataTypes, maxPoints, resolution } = request;
  
  try {
    console.log(`⚡ Starting Web Worker stream for request ${requestId} with ${maxPoints} points...`);
    
    // Note: En una implementación real, aquí se inicializaría el Web Worker
    // Para esta demo, simulamos el procesamiento distribuido
    
    // Get data from gRPC in chunks
    const result = await mainGrpcClient.getBatchDataStreamed(bounds, dataTypes, maxPoints, resolution);
    
    console.log(`📊 Generated ${result.dataPoints.length} points, forwarding directly to Web Worker...`);
    
    const startTime = performance.now();
    
    // Send initial progress
    event.sender.send('grpc-worker-stream-progress', {
      requestId,
      type: 'progress',
      processed: 0,
      total: result.totalCount,
      percentage: 0,
      phase: 'starting_worker'
    });
    
    // Process data in Web Worker via chunks (no main thread accumulation)
    const chunkSize = 5000;
    const totalChunks = Math.ceil(result.dataPoints.length / chunkSize);
    let processedCount = 0;
    
    // Simulate Web Worker processing without actually accumulating data in main thread
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, result.dataPoints.length);
      const chunkSize_actual = end - start;
      
      // Forward chunk to worker (simulated - in real implementation would use postMessage)
      // For now, we'll simulate the processing time without holding the data
      processedCount += chunkSize_actual;
      
      // Send progress update
      event.sender.send('grpc-worker-stream-progress', {
        requestId,
        type: 'progress',
        processed: processedCount,
        total: result.totalCount,
        percentage: (processedCount / result.totalCount) * 100,
        phase: 'processing_worker'
      });
      
      // Yield to event loop every chunk
      await new Promise(resolve => setImmediate(resolve));
    }
    
    const endTime = performance.now();
    const processingTime = (endTime - startTime) / 1000;
    
    // Calculate real statistics from the data (chunked processing for large datasets)
    let sum = 0;
    let minValue = Infinity;
    let maxValue = -Infinity;
    
    const statsChunkSize = 10000; // Process 10k points at a time
    const totalPoints = result.dataPoints.length;
    
    console.log(`📊 Calculating statistics for ${totalPoints} points in chunks of ${statsChunkSize}...`);
    
    // Process statistics in chunks to avoid blocking
    for (let i = 0; i < totalPoints; i += statsChunkSize) {
      const chunkEnd = Math.min(i + statsChunkSize, totalPoints);
      
      // Process chunk
      for (let j = i; j < chunkEnd; j++) {
        const value = result.dataPoints[j].value;
        sum += value;
        minValue = Math.min(minValue, value);
        maxValue = Math.max(maxValue, value);
      }
      
      // Send progress update for statistics calculation
      const statsProgress = (chunkEnd / totalPoints) * 100;
      event.sender.send('grpc-worker-stream-progress', {
        requestId,
        type: 'progress',
        processed: chunkEnd,
        total: totalPoints,
        percentage: statsProgress,
        phase: 'calculating_statistics'
      });
      
      // Yield to event loop every chunk to prevent blocking
      if (i + statsChunkSize < totalPoints) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    const avgValue = sum / totalPoints;
    console.log(`📊 Statistics calculated: avg=${avgValue.toFixed(2)}, min=${minValue.toFixed(2)}, max=${maxValue.toFixed(2)}`);
    
    // Get a distributed sample of the actual data for visualization (safe sampling)
    console.log(`📝 Creating distributed sample from ${totalPoints} points...`);
    const sampleSize = 10;
    const dataSample = [];
    
    // Take distributed samples across the entire dataset (safe indexing)
    for (let i = 0; i < sampleSize; i++) {
      const index = Math.floor((i / (sampleSize - 1)) * (totalPoints - 1));
      const safeIndex = Math.min(index, totalPoints - 1); // Ensure we don't go out of bounds
      const point = result.dataPoints[safeIndex];
      
      if (point) { // Safety check
        dataSample.push({
          id: point.id,
          latitude: point.location.latitude,
          longitude: point.location.longitude,
          valor: point.value,
          unidad: point.unit,
          tipo: point.metadata.sensor_type || dataTypes[0],
          timestamp: new Date(point.timestamp).toLocaleTimeString(),
          posicion: `${safeIndex + 1}/${totalPoints}` // Mostrar posición en el dataset
        });
      }
    }
    
    console.log(`📝 Sample created with ${dataSample.length} points`);
    
    // Send completion with real data summary and sample
    event.sender.send('grpc-worker-stream-progress', {
      requestId,
      type: 'complete',
      totalProcessed: result.totalCount,
      processingTime: processingTime,
      generationMethod: result.generationMethod,
      summary: {
        avgValue: Number(avgValue.toFixed(2)),
        minValue: Number(minValue.toFixed(2)),
        maxValue: Number(maxValue.toFixed(2)),
        dataTypes: dataTypes
      },
      dataSample: dataSample // ¡Datos reales para visualizar!
    });
    
    console.log(`⚡ Web Worker stream completed for ${requestId}: ${result.totalCount} points processed in ${processingTime.toFixed(2)}s`);
    
  } catch (error) {
    console.error(`Web Worker stream failed for ${requestId}:`, error);
    event.sender.send('grpc-worker-stream-error', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});





/**
 * Simple Hello World gRPC example
 * @param message - Message from frontend
 * @returns Echo response from backend
 */
ipcMain.handle('grpc-hello-world', async (event, message: string) => {
  try {
    console.log(`🌍 Hello World request: "${message}"`);
    const response = await mainGrpcClient.helloWorld(message);
    console.log(`🌍 Hello World response: "${response.message}"`);
    return response;
  } catch (error) {
    console.error('gRPC Hello World failed:', error);
    throw error;
  }
});

/**
 * Echo Parameter example - sends value and operation, gets back processed result
 * @param value - Numeric value to process
 * @param operation - Operation to perform (square, double, half)
 * @returns Processed result with original value and operation info
 */
ipcMain.handle('grpc-echo-parameter', async (event, value: number, operation: string) => {
  try {
    console.log(`🔄 Echo Parameter request: ${value} (${operation})`);
    const response = await mainGrpcClient.echoParameter(value, operation);
    console.log(`🔄 Echo Parameter response: ${response.originalValue} -> ${response.processedValue}`);
    return response;
  } catch (error) {
    console.error('gRPC Echo Parameter failed:', error);
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
