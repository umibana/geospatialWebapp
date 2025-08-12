import { app, BrowserWindow, ipcMain } from "electron";
import registerListeners from "./helpers/ipc/listeners-register";
import { backendManager } from "./helpers/backend_helpers";
import { autoMainGrpcClient } from "./grpc-auto/auto-main-client";
import { registerAutoGrpcHandlers } from "./grpc-auto/auto-ipc-handlers";
// removed unused imports
import * as path from "path";
import { MainProcessWorker } from "./helpers/mainProcessWorker";

// Store processed chart data in memory (main process only)
const chartDataCache = new Map<string, Array<[number, number, number]>>();

// Global progress coalescer (avoids chatty IPC). Sends at most every 100ms per requestId
const lastProgressSent = new Map<string, number>();
const PROGRESS_COALESCE_MS = 100;
function sendProgressCoalesced(event: Electron.IpcMainEvent, data: { requestId: string; type: string; processed: number; total: number; percentage: number; phase: string }) {
  const key = data.requestId;
  const now = Date.now();
  const last = lastProgressSent.get(key) ?? 0;
  const isTerminal = data.type === 'complete' || data.percentage >= 100;
  if (isTerminal || now - last >= PROGRESS_COALESCE_MS) {
    lastProgressSent.set(key, now);
    event.sender.send('grpc-child-process-progress', data);
  }
}

// Ultra-fast streaming data processor - runs directly in main process with yielding
type GrpcDataPoint = { id?: string; location: { latitude: number; longitude: number; altitude?: number }; value: number; unit?: string; timestamp?: number; metadata?: Record<string, unknown> };
type GrpcChunk = { data_points?: GrpcDataPoint[] };
type ProcessingStats = { totalProcessed: number; avgValue: number; minValue: number; maxValue: number; dataTypes: string[]; processingTime: number; pointsPerSecond: number };
type ChartMetadata = { totalPoints: number; chartPoints: number; samplingRatio: number; bounds: { lng: [number, number]; lat: [number, number]; value: [number, number] } };
async function processDataStreamingInMainProcess(
  chunks: GrpcChunk[],
  requestId: string,
  onProgress: (progress: { processed: number; total: number; percentage: number; phase: string }) => void
): Promise<{ stats: ProcessingStats; chartConfig: { type: string; data: Array<[number, number, number]>; metadata: ChartMetadata } }> {
  
  const processedPoints: Array<[number, number, number]> = [];
  const stats = {
    totalProcessed: 0,
    minValue: Infinity,
    maxValue: -Infinity,
    sum: 0,
    dataTypes: new Set<string>()
  };
  
  const startTime = performance.now();
  const totalPoints = chunks.reduce((sum, chunk) => sum + (chunk.data_points?.length || 0), 0);
  
  // Process chunks with ULTRA micro-batching and frequent yielding
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    
    if (chunk.data_points) {
      // Process points in VERY small batches
      const microBatchSize = 500; // Very small batches
      
      for (let i = 0; i < chunk.data_points.length; i += microBatchSize) {
        const batchEnd = Math.min(i + microBatchSize, chunk.data_points.length);
        
        // Process micro-batch
        for (let j = i; j < batchEnd; j++) {
          const point = chunk.data_points[j] as GrpcDataPoint;
          
          // Store essential data for charting (limited amount)
          if (processedPoints.length < 10000) { // Reduced limit for performance
            processedPoints.push([
              point.location.longitude,
              point.location.latitude,
              point.value
            ]);
          }
          
          // Update statistics
          stats.totalProcessed++;
          stats.sum += point.value;
          stats.minValue = Math.min(stats.minValue, point.value);
          stats.maxValue = Math.max(stats.maxValue, point.value);
          
           if (point.metadata && typeof (point.metadata as any).sensor_type === 'string') {
             stats.dataTypes.add((point.metadata as any).sensor_type as string);
          }
        }
        
        // Yield control after EVERY micro-batch to prevent blocking
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    // Send progress update every chunk
    onProgress({
      processed: stats.totalProcessed,
      total: totalPoints,
      percentage: ((chunkIndex + 1) / chunks.length) * 100,
      phase: `streaming_chunk_${chunkIndex + 1}_of_${chunks.length}`
    });
    
    // Yield control after each chunk
    await new Promise(resolve => setImmediate(resolve));
  }
  
  const endTime = performance.now();
  const processingTime = (endTime - startTime) / 1000;
  const avgValue = stats.totalProcessed > 0 ? stats.sum / stats.totalProcessed : 0;
  
  return {
    stats: {
      totalProcessed: stats.totalProcessed,
      avgValue: Number(avgValue.toFixed(2)),
      minValue: Number(stats.minValue.toFixed(2)),
      maxValue: Number(stats.maxValue.toFixed(2)),
      dataTypes: Array.from(stats.dataTypes),
      processingTime: Number(processingTime.toFixed(3)),
      pointsPerSecond: Math.round(stats.totalProcessed / processingTime)
    },
    chartConfig: {
      type: 'scatter',
      data: processedPoints,
      metadata: {
        totalPoints: stats.totalProcessed,
        chartPoints: processedPoints.length,
        samplingRatio: processedPoints.length / stats.totalProcessed,
        bounds: {
          lng: processedPoints.length > 0 ? [
            Math.min(...processedPoints.map(p => p[0])),
            Math.max(...processedPoints.map(p => p[0]))
          ] : [0, 0],
          lat: processedPoints.length > 0 ? [
            Math.min(...processedPoints.map(p => p[1])),
            Math.max(...processedPoints.map(p => p[1]))
          ] : [0, 0],
          value: processedPoints.length > 0 ? [
            Math.min(...processedPoints.map(p => p[2])),
            Math.max(...processedPoints.map(p => p[2]))
          ] : [0, 0]
        }
      }
    }
  };
}
// "electron-squirrel-startup" seems broken when packaging with vite
//import started from "electron-squirrel-startup";
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

// Track in-flight streaming by requestId for cancellation
const inflightStreams = new Map<string, { terminate: () => void; cancelGrpc?: () => boolean }>();

ipcMain.handle('grpc-stop-stream', async (_event, payload?: { requestId?: string }) => {
  try {
    const rid = payload?.requestId;
    if (rid && inflightStreams.has(rid)) {
      const ctx = inflightStreams.get(rid)!;
      try { ctx.cancelGrpc?.(); } catch {}
      try { ctx.terminate(); } catch {}
      inflightStreams.delete(rid);
      return { success: true, cancelled: true };
    }
    return { success: true, cancelled: false };
  } catch (error) {
    console.error('gRPC stopStream failed:', error);
    throw error;
  }
});

// NEW: Main Process Worker Threads - no external dependencies, no JSON files
ipcMain.on('grpc-start-child-process-stream', async (event, request) => {
  const { requestId, bounds, dataTypes, maxPoints, resolution } = request;
  
  try {
    // Stream incremental: nutrir al worker a medida que llegan chunks gRPC
    let totalPoints = 0;
    const workerManager = MainProcessWorker.getInstance();
    const streamer = workerManager.startStreamingProcessor(requestId, (progress) => {
      sendProgressCoalesced(event, { requestId, type: 'progress', processed: progress.processed, total: totalPoints || progress.total, percentage: progress.percentage, phase: progress.phase });
    });
    try {
      const totals = await (async () => {
        // start gRPC stream and register cancel handle
        const cancel = (rid: string) => () => autoMainGrpcClient.cancelStream(rid);
        inflightStreams.set(requestId, { terminate: streamer.terminate, cancelGrpc: cancel(requestId) });
        try {
          const res = await autoMainGrpcClient.streamBatchDataIncremental(
            { bounds, data_types: dataTypes, max_points: maxPoints, resolution },
            (chunk) => { streamer.postChunk(chunk); },
            requestId
          );
          return res;
        } finally {
          inflightStreams.delete(requestId);
        }
      })();
      totalPoints = totals.totalPoints;
      sendProgressCoalesced(event, { requestId, type: 'progress', processed: 0, total: totalPoints, percentage: 0, phase: 'worker_receiving_stream' });
      const result = await streamer.finalize();
      // Cache y completar
      chartDataCache.set(requestId, result.chartConfig.data);
      event.sender.send('grpc-child-process-progress', {
        requestId,
        type: 'complete',
        stats: result.stats,
        chartConfig: { type: result.chartConfig.type, metadata: result.chartConfig.metadata, dataReady: true },
        message: `🎉 Worker Thread completed ${result.stats?.totalProcessed || 0} points in ${result.stats?.processingTime || 0}s`
      });
      return;
    } catch (workerError) {
      console.warn(`⚠️ Worker Threads failed, falling back to main-thread streaming for ${requestId}:`, workerError);
      // Fallback: compute in main process with ultra-yielding
      const fallbackChunks = await autoMainGrpcClient.getBatchDataStreamed({ bounds, data_types: dataTypes, max_points: maxPoints, resolution });
      const fallback = await processDataStreamingInMainProcess(
        fallbackChunks,
        requestId,
        (progress) => {
          sendProgressCoalesced(event, {
            requestId,
            type: 'progress',
            processed: progress.processed,
            total: progress.total,
            percentage: progress.percentage,
            phase: `fallback_${progress.phase}`
          });
        }
      );
      chartDataCache.set(requestId, fallback.chartConfig.data);
      event.sender.send('grpc-child-process-progress', {
        requestId,
        type: 'complete',
        stats: fallback.stats,
        chartConfig: { type: fallback.chartConfig.type, metadata: fallback.chartConfig.metadata, dataReady: true },
        message: `🎉 Main Process Streaming completed ${fallback.stats?.totalProcessed || 0} points in ${fallback.stats?.processingTime || 0}s (fallback)`
      });
      return;
    }
    
  } catch (error) {
    console.error(`Worker Thread failed for ${requestId}:`, error);
    event.sender.send('grpc-child-process-error', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// IPC handler to fetch chart data in small chunks (prevents IPC blocking)
ipcMain.on('grpc-get-chart-data', (event, { requestId, chunkSize = 1000, offset = 0 }) => {
  try {
    const fullData = chartDataCache.get(requestId);
    
    if (!fullData) {
      event.sender.send('grpc-chart-data-response', {
        requestId,
        error: 'Chart data not found'
      });
      return;
    }
    
    // Send data in small chunks to prevent IPC blocking
    const chunk = fullData.slice(offset, offset + chunkSize);
    const isComplete = offset + chunkSize >= fullData.length;
    
    event.sender.send('grpc-chart-data-response', {
      requestId,
      chunk,
      offset,
      chunkSize,
      totalSize: fullData.length,
      isComplete,
      nextOffset: isComplete ? -1 : offset + chunkSize
    });
    
    // Clean up cache when done
    if (isComplete) {
      chartDataCache.delete(requestId);
      console.log(`🧹 Cleaned up chart data cache for ${requestId}`);
    }
    
  } catch (error) {
    event.sender.send('grpc-chart-data-response', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Legacy Web Worker streaming removed





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
