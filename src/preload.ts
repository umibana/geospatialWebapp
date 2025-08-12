import exposeContexts from "./helpers/ipc/context-exposer";
import { contextBridge, ipcRenderer } from 'electron';
import type { OptimizedResult, GrpcBounds, GrpcProgress } from './lib/types';

exposeContexts();

// 🎉 New Auto-Generated gRPC Context Bridge
const grpcApi = {
  // Simple methods using new auto-generated channels
  healthCheck: () => ipcRenderer.invoke('grpc-healthcheck'),
  helloWorld: (request: { message: string }) => ipcRenderer.invoke('grpc-helloworld', request),
  echoParameter: (request: { value: number; operation: string }) => 
    ipcRenderer.invoke('grpc-echoparameter', request),
  getFeatures: (request: { bounds: GrpcBounds; featureTypes: string[]; limit: number }) => 
    ipcRenderer.invoke('grpc-getfeatures', request),
  
  // CSV file processing methods
  analyzeCsv: (request: { filePath: string; fileName: string; rowsToAnalyze?: number }) => {
    // Convert camelCase to snake_case for gRPC (keepCase: true)
    const snakeRequest = {
      file_path: request.filePath,
      file_name: request.fileName,
      rows_to_analyze: request.rowsToAnalyze ?? 2,
    } as const;
    return ipcRenderer.invoke('grpc-analyzecsv', snakeRequest);
  },
  sendFile: (request: { filePath: string; fileName: string; fileType: string; xVariable: string; yVariable: string; zVariable?: string; idVariable?: string; depthVariable?: string; columnTypes?: Record<string, 'string' | 'number'>; includeFirstRow?: boolean; includedColumns?: string[] }) => {
    // Convert camelCase to snake_case for gRPC (keepCase: true)
    const snakeRequest = {
      file_path: request.filePath,
      file_name: request.fileName,
      file_type: request.fileType,
      x_variable: request.xVariable,
      y_variable: request.yVariable,
      z_variable: request.zVariable ?? '',
      id_variable: request.idVariable ?? '',
      depth_variable: request.depthVariable ?? '',
      column_types: request.columnTypes ?? {},
      include_first_row: request.includeFirstRow ?? true,
      included_columns: request.includedColumns ?? [],
    } as const;
    return ipcRenderer.invoke('grpc-sendfile', snakeRequest);
  },
  getLoadedDataStats: () => 
    ipcRenderer.invoke('grpc-getloadeddatastats', {}),
  
  // Legacy streaming removed
  
  // Legacy worker-stream removed

  // Optimized API (usa worker_threads y chunked chart-data fetch)
  getBatchDataOptimized: (
    bounds: GrpcBounds,
    dataTypes: string[],
    maxPoints: number,
    resolution = 20,
    onProgress?: (progress: GrpcProgress) => void,
    onChunkData?: (chunk: unknown) => void,
    options: { threshold?: number } = {}
  ): Promise<OptimizedResult> => {
    // Ensure options is marked as used to satisfy linter when not consumed
    void options;
    return (grpcApi as unknown as { getBatchDataChildProcessStreamed: (b: GrpcBounds, d: string[], m: number, r?: number, p?: (g: GrpcProgress) => void) => Promise<unknown> }).getBatchDataChildProcessStreamed(
      bounds,
      dataTypes,
      maxPoints,
      resolution,
      onProgress
    ).then((result: unknown) => ({ ...(result as object), strategy: 'worker_threads' } as OptimizedResult));
  },
  
  // Allow optional requestId to cancel a specific in-flight request
  stopStream: (requestId?: string) => ipcRenderer.invoke('grpc-stop-stream', requestId ? { requestId } : {}),
  
  // Helper function to fetch chart data in chunks
  fetchChartDataInChunks: async (requestId: string): Promise<Array<[number, number, number]>> => {
    return new Promise((resolve, reject) => {
      const chartData: Array<[number, number, number]> = [];
      let offset = 0;
      const chunkSize = 1000; // Small chunks to prevent IPC blocking
      
      const fetchNextChunk = () => {
        ipcRenderer.send('grpc-get-chart-data', { requestId, chunkSize, offset });
      };
      
      const handleChartDataResponse = (_event: unknown, data: { requestId: string; error?: string; chunk: Array<[number, number, number]>; isComplete: boolean; nextOffset: number }) => {
        if (data.requestId === requestId) {
          if (data.error) {
            ipcRenderer.removeListener('grpc-chart-data-response', handleChartDataResponse);
            reject(new Error(data.error));
            return;
          }
          
          // Add chunk to our data
          chartData.push(...(data.chunk || []));
          
          if (data.isComplete) {
            ipcRenderer.removeListener('grpc-chart-data-response', handleChartDataResponse);
            resolve(chartData);
          } else {
            // Fetch next chunk with small delay to prevent blocking
            offset = data.nextOffset;
            setTimeout(fetchNextChunk, 10);
          }
        }
      };
      
      ipcRenderer.on('grpc-chart-data-response', handleChartDataResponse);
      fetchNextChunk();
    });
  },

  // NEW: Child Process Streaming - bypasses Electron IPC
  getBatchDataChildProcessStreamed: (bounds: GrpcBounds, dataTypes: string[], maxPoints: number, resolution?: number, onProgress?: (progress: GrpcProgress) => void) => {
    const requestId = `child-stream-${Date.now()}-${Math.random()}`;
    
    return new Promise((resolve, reject) => {
      const fetchChartDataSafely = (rid: string) => grpcApi.fetchChartDataInChunks(rid);

      const progressHandler = (_event: Electron.IpcRendererEvent, data: { requestId: string; type: string; processed: number; total: number; percentage: number; phase: string; stats?: unknown; chartConfig?: (Record<string, unknown> & { dataReady?: boolean }); message?: string; totalPoints?: number; totalChunks?: number }) => {
        if (data.requestId === requestId) {
          if (data.type === 'progress' || data.type === 'chunk_forwarded') {
            if (onProgress) {
              onProgress({
                processed: data.processed,
                total: data.total,
                percentage: data.percentage,
                phase: data.phase
              });
            }
          } else if (data.type === 'forwarding_complete') {
            resolve({
              totalForwarded: data.totalPoints,
              totalChunks: data.totalChunks,
              message: data.message,
              phase: 'child_process_handling'
            });
          } else if (data.type === 'complete') {
            // Check if we need to fetch chart data separately
            if (data.chartConfig && (data.chartConfig as { dataReady?: boolean }).dataReady) {
              // Fetch chart data in chunks to prevent IPC blocking
              fetchChartDataSafely(requestId).then(chartData => {
                resolve({
                  stats: data.stats,
                  chartConfig: {
                    ...data.chartConfig,
                    data: chartData
                  },
                  message: data.message
                });
              }).catch(() => {
                resolve({
                  stats: data.stats,
                  chartConfig: {
                    ...data.chartConfig,
                    data: [] // Empty data on error
                  },
                  message: data.message
                });
              });
            } else {
              resolve({
                stats: data.stats,
                chartConfig: data.chartConfig,
                message: data.message
              });
            }
          }
        }
      };
      
      const errorHandler = (_event: Electron.IpcRendererEvent, data: { requestId: string; error: string }) => {
        if (data.requestId === requestId) {
          reject(new Error(data.error));
        }
      };
      
      const onChildProgress: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void = (_event, ...args) => {
        const [payload] = args as [Parameters<typeof progressHandler>[1]];
        progressHandler(_event, payload);
      };
      const onChildError: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void = (_event, ...args) => {
        const [payload] = args as [Parameters<typeof errorHandler>[1]];
        errorHandler(_event, payload);
      };

      ipcRenderer.on('grpc-child-process-progress', onChildProgress);
      ipcRenderer.on('grpc-child-process-error', onChildError);
      
      const cleanup = () => {
        ipcRenderer.removeListener('grpc-child-process-progress', onChildProgress);
        ipcRenderer.removeListener('grpc-child-process-error', onChildError);
      };
      
      ipcRenderer.send('grpc-start-child-process-stream', {
        requestId,
        bounds,
        dataTypes,
        maxPoints,
        resolution
      });
      
      setTimeout(() => {
        cleanup();
        reject(new Error('Child process stream timeout'));
      }, 300000);
    });
  },

  // Legacy/Small-dataset path: main forwards gRPC chunks to renderer without worker_threads
  getBatchDataWorkerStreamed: (
    bounds: GrpcBounds,
    dataTypes: string[],
    maxPoints: number,
    resolution = 20,
    onProgress?: (progress: GrpcProgress) => void,
    onChunkData?: (chunk: unknown) => void
  ) => {
    const requestId = `worker-stream-${Date.now()}-${Math.random()}`;
    return new Promise((resolve, reject) => {
      const progressHandler = (_event: Electron.IpcRendererEvent, data: { requestId: string; type: string; processed?: number; total?: number; percentage?: number; phase?: string; totalProcessed?: number; processingTime?: number; generationMethod?: string; summary?: unknown; dataSample?: unknown[] }) => {
        if (data.requestId !== requestId) return;
        if (data.type === 'progress' || data.type === 'batch_complete') {
          if (onProgress) {
            onProgress({
              processed: data.processed || 0,
              total: data.total || 0,
              percentage: data.percentage || 0,
              phase: data.phase || 'processing'
            });
          }
        } else if (data.type === 'complete') {
          ipcRenderer.removeListener('grpc-worker-stream-progress', onWorkerProgress);
          ipcRenderer.removeListener('grpc-worker-stream-chunk', onWorkerChunk);
          resolve({
            strategy: 'worker_stream',
            totalProcessed: data.totalProcessed || 0,
            processingTime: data.processingTime || 0,
            generationMethod: data.generationMethod || 'chunked_streaming',
            summary: (data.summary || {}) as Record<string, unknown>,
            dataSample: data.dataSample || []
          });
        }
      };

      const chunkHandler = (_event: Electron.IpcRendererEvent, payload: { requestId: string; chunkData?: unknown }) => {
        if (payload.requestId !== requestId) return;
        onChunkData?.(payload.chunkData);
      };

      const errorHandler = (_event: Electron.IpcRendererEvent, data: { requestId: string; error: string }) => {
        if (data.requestId !== requestId) return;
        ipcRenderer.removeListener('grpc-worker-stream-progress', onWorkerProgress);
        ipcRenderer.removeListener('grpc-worker-stream-chunk', onWorkerChunk);
        ipcRenderer.removeListener('grpc-worker-stream-error', onWorkerError);
        reject(new Error(data.error));
      };

      const onWorkerProgress: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void = (_event, ...args) => {
        const [payload] = args as [Parameters<typeof progressHandler>[1]];
        progressHandler(_event, payload);
      };
      const onWorkerChunk: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void = (_event, ...args) => {
        const [payload] = args as [Parameters<typeof chunkHandler>[1]];
        chunkHandler(_event, payload);
      };
      const onWorkerError: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void = (_event, ...args) => {
        const [payload] = args as [Parameters<typeof errorHandler>[1]];
        errorHandler(_event, payload);
      };

      ipcRenderer.on('grpc-worker-stream-progress', onWorkerProgress);
      ipcRenderer.on('grpc-worker-stream-chunk', onWorkerChunk);
      ipcRenderer.on('grpc-worker-stream-error', onWorkerError);

      ipcRenderer.send('grpc-start-worker-stream', {
        requestId,
        bounds,
        dataTypes,
        maxPoints,
        resolution
      });

      // 5-minute safety timeout
      setTimeout(() => {
        ipcRenderer.removeListener('grpc-worker-stream-progress', onWorkerProgress);
        ipcRenderer.removeListener('grpc-worker-stream-chunk', onWorkerChunk);
        ipcRenderer.removeListener('grpc-worker-stream-error', onWorkerError);
        reject(new Error('Worker stream timeout'));
      }, 300000);
    });
  }
};

contextBridge.exposeInMainWorld('grpc', grpcApi);

// Electron API for file dialogs and system functionality
const electronAPI = {
  showOpenDialog: (options: Electron.OpenDialogOptions) => 
    ipcRenderer.invoke('dialog:openFile', options),
  showSaveDialog: (options: Electron.SaveDialogOptions) => 
    ipcRenderer.invoke('dialog:saveFile', options),
  // Read only the first N lines from a CSV file (comma + UTF-8)
  readCsvPreview: async (filePath: string, numRows: number = 2): Promise<{ headers: string[]; rows: string[][]; delimiter: string }> => {
    // Helper to parse a single CSV line with basic quote handling
    const parseCsvLine = (line: string): string[] => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          values.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current);
      // Trim surrounding quotes
      return values.map((v) => {
        const trimmed = v.trim();
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          return trimmed.slice(1, -1);
        }
        return trimmed;
      });
    };

    // Read only a small portion from the start of the file
    const { promises: fsPromises } = await import('fs');
    const fileHandle = await fsPromises.open(filePath, 'r');
    try {
      const bufferSize = 262144; // 256KB chunk from start
      const buffer = Buffer.allocUnsafe(bufferSize);
      const { bytesRead } = await fileHandle.read(buffer, 0, bufferSize, 0);
      const text = buffer.subarray(0, bytesRead).toString('utf8');
      const lines = text.split(/\r?\n/).filter((l) => l.length > 0).slice(0, Math.max(1, numRows));
      const headers = parseCsvLine(lines[0] ?? '');
      const rows: string[][] = [];
      for (let i = 1; i < lines.length && rows.length < numRows - 1; i++) {
        rows.push(parseCsvLine(lines[i]));
      }
      return { headers, rows, delimiter: ',' };
    } finally {
      await fileHandle.close();
    }
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Legacy electronGrpc removed
