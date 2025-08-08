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

      const progressHandler = (_event: unknown, data: { requestId: string; type: string; processed: number; total: number; percentage: number; phase: string; stats?: unknown; chartConfig?: any; message?: string; totalPoints?: number; totalChunks?: number }) => {
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
            if (data.chartConfig.dataReady) {
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
      
      const errorHandler = (_event: unknown, data: { requestId: string; error: string }) => {
        if (data.requestId === requestId) {
          reject(new Error(data.error));
        }
      };
      
      ipcRenderer.on('grpc-child-process-progress', progressHandler);
      ipcRenderer.on('grpc-child-process-error', errorHandler);
      
      const cleanup = () => {
        ipcRenderer.removeListener('grpc-child-process-progress', progressHandler);
        ipcRenderer.removeListener('grpc-child-process-error', errorHandler);
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
      const progressHandler = (_event: unknown, data: { requestId: string; type: string; processed?: number; total?: number; percentage?: number; phase?: string; totalProcessed?: number; processingTime?: number; generationMethod?: string; summary?: unknown; dataSample?: unknown[] }) => {
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
          ipcRenderer.removeListener('grpc-worker-stream-progress', progressHandler as any);
          ipcRenderer.removeListener('grpc-worker-stream-chunk', chunkHandler as any);
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

      const chunkHandler = (_event: unknown, payload: { requestId: string; chunkData?: unknown }) => {
        if (payload.requestId !== requestId) return;
        onChunkData?.(payload.chunkData);
      };

      const errorHandler = (_event: unknown, data: { requestId: string; error: string }) => {
        if (data.requestId !== requestId) return;
        ipcRenderer.removeListener('grpc-worker-stream-progress', progressHandler as any);
        ipcRenderer.removeListener('grpc-worker-stream-chunk', chunkHandler as any);
        ipcRenderer.removeListener('grpc-worker-stream-error', errorHandler as any);
        reject(new Error(data.error));
      };

      ipcRenderer.on('grpc-worker-stream-progress', progressHandler as any);
      ipcRenderer.on('grpc-worker-stream-chunk', chunkHandler as any);
      ipcRenderer.on('grpc-worker-stream-error', errorHandler as any);

      ipcRenderer.send('grpc-start-worker-stream', {
        requestId,
        bounds,
        dataTypes,
        maxPoints,
        resolution
      });

      // 5-minute safety timeout
      setTimeout(() => {
        ipcRenderer.removeListener('grpc-worker-stream-progress', progressHandler as any);
        ipcRenderer.removeListener('grpc-worker-stream-chunk', chunkHandler as any);
        ipcRenderer.removeListener('grpc-worker-stream-error', errorHandler as any);
        reject(new Error('Worker stream timeout'));
      }, 300000);
    });
  }
};

contextBridge.exposeInMainWorld('grpc', grpcApi);

// Legacy electronGrpc removed
