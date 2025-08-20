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
// New columnar data format for efficient large dataset processing
type GrpcColumnarData = {
  id: string[];              // Point IDs
  x: number[];               // X coordinates (longitude)
  y: number[];               // Y coordinates (latitude)  
  z: number[];               // Z values (main value like elevation)
  id_value: string[];        // ID value column
  additional_data: Record<string, number[]>; // Dynamic additional columns (temperature, pressure, etc.)
};
type GrpcChunk = { columnar_data: GrpcColumnarData }; // Only columnar format now
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
  
  // Calculate total points from columnar format
  const totalPoints = chunks.reduce((sum, chunk) => {
    return sum + (chunk.columnar_data.x?.length || 0);
  }, 0);
  
  // Process chunks with ULTRA micro-batching and frequent yielding
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    const data = chunk.columnar_data;
    const pointCount = data.x?.length || 0;
    const microBatchSize = 500; // Very small batches
    
    for (let i = 0; i < pointCount; i += microBatchSize) {
      const batchEnd = Math.min(i + microBatchSize, pointCount);
      
      // Process micro-batch of columnar data
      for (let j = i; j < batchEnd; j++) {
        const x = data.x[j];
        const y = data.y[j];
        const z = data.z[j];
        
        // Store essential data for charting (limited amount)
        if (processedPoints.length < 10000) { // Reduced limit for performance
          processedPoints.push([x, y, z]);
        }
        
        // Update statistics
        stats.totalProcessed++;
        stats.sum += z;
        stats.minValue = Math.min(stats.minValue, z);
        stats.maxValue = Math.max(stats.maxValue, z);
      }
      
      // Add data types from additional columns
      Object.keys(data.additional_data || {}).forEach(key => {
        stats.dataTypes.add(key);
      });
      
      // Yield control after EVERY micro-batch to prevent blocking
      await new Promise(resolve => setImmediate(resolve));
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
      // Register CSV series aggregator IPC
      ipcMain.handle('csv-start-series-aggregation', async (_event, request: { xAxis: 'x'|'y'|'z'; yAxis: 'x'|'y'|'z'; metrics: string[]; sampleCap?: number }) => {
        try {
          const { xAxis, yAxis, metrics, sampleCap } = request;
          const worker = MainProcessWorker.getInstance().startCsvSeriesProcessor('csv-' + Date.now(), { xKey: xAxis, yKey: yAxis, metrics, maxPerSeries: typeof sampleCap === 'number' ? sampleCap : 10000 }, () => {});
          let offset = 0;
          const limit = 5000;
          // Stream chunks from backend and translate rows to worker format
          while (true) {
            const res = await autoMainGrpcClient.getLoadedDataChunk({ offset, limit });
            const rows = (res.rows || []).map((r: { x?: number; y?: number; z?: number; id?: string; metrics?: Record<string, number> }) => ({ x: r.x, y: r.y, z: r.z, id: r.id, metrics: r.metrics }));
            worker.postRows(rows, res.is_complete ? (Math.ceil((offset + rows.length) / limit)) : undefined);
            offset = res.next_offset;
            if (res.is_complete) break;
          }
          const result = await worker.finalize();
          return { success: true, ...result };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
      });
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


// Track in-flight streaming by requestId for cancellation
const inflightStreams = new Map<string, { terminate: () => void }>();

ipcMain.handle('grpc-stop-stream', async (_event, payload?: { requestId?: string }) => {
  try {
    const rid = payload?.requestId;
    if (rid && inflightStreams.has(rid)) {
      const ctx = inflightStreams.get(rid)!;
      try { ctx.terminate(); } catch { /* Worker termination error ignored */ }
      inflightStreams.delete(rid);
      return { success: true, cancelled: true };
    }
    return { success: true, cancelled: false };
  } catch (error) {
    console.error('gRPC stopStream failed:', error);
    throw error;
  }
});

// Main Process Worker Threads
ipcMain.on('grpc-start-child-process-stream', async (event, request) => {
  const { requestId, bounds, dataTypes, maxPoints, resolution, maxChartPoints = 50000 } = request;
  
  try {
    // Stream incremental: nutrir al worker a medida que llegan chunks gRPC
    let totalPoints = 0;
    const workerManager = MainProcessWorker.getInstance();
    const streamer = workerManager.startStreamingProcessor(requestId, (progress) => {
      sendProgressCoalesced(event, { requestId, type: 'progress', processed: progress.processed, total: totalPoints || progress.total, percentage: progress.percentage, phase: progress.phase });
    }, maxChartPoints);
    try {
      const totals = await (async () => {
        // start gRPC stream and register cancel handle
        inflightStreams.set(requestId, { terminate: streamer.terminate });
        try {
          const chunks = await autoMainGrpcClient.getBatchDataColumnarStreamed({
            bounds, 
            data_types: dataTypes, 
            max_points: maxPoints, 
            resolution
          });
          
          // Process each chunk through the worker with complete chunk data
          for (const chunk of chunks) {
            streamer.postChunk({ 
              columnar_data: chunk,
              points_in_chunk: chunk.points_in_chunk,
              chunk_number: chunk.chunk_number,
              total_chunks: chunk.total_chunks
            });
          }
          
          // Debug logging to track chunk data
          console.log(`📊 Chunks received: ${chunks.length}`);
          chunks.slice(0, 3).forEach((chunk, index) => {
            console.log(`📊 Chunk ${index}: points_in_chunk=${chunk.points_in_chunk}, x.length=${chunk.x?.length || 0}`);
          });
          
          const totalPoints = chunks.reduce((sum, chunk) => sum + (chunk.points_in_chunk || 0), 0);
          const totalArrayPoints = chunks.reduce((sum, chunk) => sum + (chunk.x?.length || 0), 0);
          console.log(`📊 Total calculation: points_in_chunk sum=${totalPoints}, array length sum=${totalArrayPoints}`);
          
          return { totalPoints };
        } finally {
          inflightStreams.delete(requestId);
        }
      })();
      totalPoints = (totals as { totalPoints: number }).totalPoints;
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
      // Fallback: use columnar streaming
      const fallbackChunks = await autoMainGrpcClient.getBatchDataColumnarStreamed({ 
        bounds, 
        data_types: dataTypes, 
        max_points: maxPoints, 
        resolution 
      });
      
      // Convert columnar chunks to the format expected by processDataStreamingInMainProcess
      const convertedChunks = fallbackChunks.map(chunk => ({ 
        columnar_data: {
          id: chunk.id || [],
          x: chunk.x || [],
          y: chunk.y || [],
          z: chunk.z || [],
          id_value: chunk.id_value || [],
          additional_data: chunk.additional_data || {}
        }
      }));
      
      const fallback = await processDataStreamingInMainProcess(
        convertedChunks,
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
