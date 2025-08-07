import exposeContexts from "./helpers/ipc/context-exposer";
import { contextBridge, ipcRenderer } from 'electron';

exposeContexts();

// 🎉 New Auto-Generated gRPC Context Bridge
contextBridge.exposeInMainWorld('grpc', {
  // Simple methods using new auto-generated channels
  healthCheck: () => ipcRenderer.invoke('grpc-healthcheck'),
  helloWorld: (request: { message: string }) => ipcRenderer.invoke('grpc-helloworld', request),
  echoParameter: (request: { value: number; operation: string }) => 
    ipcRenderer.invoke('grpc-echoparameter', request),
  getFeatures: (request: { bounds: any; featureTypes: string[]; limit: number }) => 
    ipcRenderer.invoke('grpc-getfeatures', request),
  
  // Streaming method
  getBatchDataStreamed: (request: { bounds: any; dataTypes: string[]; maxPoints: number; resolution?: number }, onData?: (data: any) => void) => {
    return new Promise((resolve, reject) => {
      const requestId = `stream-${Date.now()}-${Math.random()}`;
      const results: any[] = [];
      
      const handleData = (event: any, data: any) => {
        if (data.requestId !== requestId) return;
        
        if (data.type === 'data') {
          results.push(data.payload);
          if (onData) onData(data.payload);
        } else if (data.type === 'complete') {
          ipcRenderer.off('grpc-stream-data', handleData);
          ipcRenderer.off('grpc-stream-error', handleError);
          resolve(results);
        }
      };
      
      const handleError = (event: any, data: any) => {
        if (data.requestId !== requestId) return;
        ipcRenderer.off('grpc-stream-data', handleData);
        ipcRenderer.off('grpc-stream-error', handleError);
        reject(new Error(data.error));
      };
      
      ipcRenderer.on('grpc-stream-data', handleData);
      ipcRenderer.on('grpc-stream-error', handleError);
      
      ipcRenderer.send('grpc-getbatchdatastreamed', { requestId, ...request });
    });
  },
  
  // ⚡ NEW: Real Web Worker streaming with actual data
  getBatchDataWorkerStreamed: (bounds: any, dataTypes: string[], maxPoints: number, resolution = 20, onProgress?: (progress: any) => void, onChunkData?: (chunk: any) => void) => {
    return new Promise((resolve, reject) => {
      const requestId = `worker-stream-${Date.now()}-${Math.random()}`;
      const receivedChunks: any[] = [];
      
      const handleProgress = (event: any, data: any) => {
        if (data.requestId !== requestId) return;
        
        if (data.type === 'progress' && onProgress) {
          onProgress({
            processed: data.processed,
            total: data.total,
            percentage: data.percentage,
            phase: data.phase
          });
        }
        
        if (data.type === 'complete') {
          ipcRenderer.off('grpc-worker-stream-progress', handleProgress);
          ipcRenderer.off('grpc-worker-stream-chunk', handleChunkData);
          ipcRenderer.off('grpc-worker-stream-error', handleError);
          resolve({
            totalProcessed: data.totalProcessed,
            processingTime: data.processingTime,
            generationMethod: data.generationMethod,
            summary: data.summary,
            dataSample: data.dataSample,
            receivedChunks: receivedChunks // Include all received chunks
          });
        }
      };
      
      // NEW: Handle incoming chunk data
      const handleChunkData = (event: any, data: any) => {
        if (data.requestId !== requestId) return;
        
        // Store the chunk
        receivedChunks.push(data.chunkData);
        
        // Notify callback about received chunk
        if (onChunkData) {
          onChunkData({
            chunkNumber: data.chunkNumber,
            totalChunks: data.totalChunks,
            chunkData: data.chunkData,
            processed: data.processed,
            total: data.total,
            percentage: data.percentage
          });
        }
        
        // Also send progress update
        if (onProgress) {
          onProgress({
            processed: data.processed,
            total: data.total,
            percentage: data.percentage,
            phase: `processing_chunk_${data.chunkNumber}_of_${data.totalChunks}`
          });
        }
      };
      
      const handleError = (event: any, data: any) => {
        if (data.requestId !== requestId) return;
        
        ipcRenderer.off('grpc-worker-stream-progress', handleProgress);
        ipcRenderer.off('grpc-worker-stream-chunk', handleChunkData);
        ipcRenderer.off('grpc-worker-stream-error', handleError);
        reject(new Error(data.error));
      };
      
      ipcRenderer.on('grpc-worker-stream-progress', handleProgress);
      ipcRenderer.on('grpc-worker-stream-chunk', handleChunkData);
      ipcRenderer.on('grpc-worker-stream-error', handleError);
      
      ipcRenderer.send('grpc-start-worker-stream', {
        requestId,
        bounds,
        dataTypes,
        maxPoints,
        resolution
      });
    });
  },
  
  stopStream: () => ipcRenderer.invoke('grpc-stop-stream'),
  
  // Helper function to fetch chart data in chunks
  fetchChartDataInChunks: async (requestId: string): Promise<Array<[number, number, number]>> => {
    return new Promise((resolve, reject) => {
      const chartData: Array<[number, number, number]> = [];
      let offset = 0;
      const chunkSize = 1000; // Small chunks to prevent IPC blocking
      
      const fetchNextChunk = () => {
        ipcRenderer.send('grpc-get-chart-data', { requestId, chunkSize, offset });
      };
      
      const handleChartDataResponse = (event: any, data: any) => {
        if (data.requestId === requestId) {
          if (data.error) {
            ipcRenderer.removeListener('grpc-chart-data-response', handleChartDataResponse);
            reject(new Error(data.error));
            return;
          }
          
          // Add chunk to our data
          chartData.push(...data.chunk);
          
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
  getBatchDataChildProcessStreamed: (bounds: any, dataTypes: string[], maxPoints: number, resolution?: number, onProgress?: (progress: { processed: number; total: number; percentage: number; phase: string }) => void) => {
    const requestId = `child-stream-${Date.now()}-${Math.random()}`;
    
    return new Promise(async (resolve, reject) => {
      const fetchChartDataInChunks = async (requestId: string): Promise<Array<[number, number, number]>> => {
        return new Promise((resolve, reject) => {
          const chartData: Array<[number, number, number]> = [];
          let offset = 0;
          const chunkSize = 1000; // Small chunks to prevent IPC blocking
          
          const fetchNextChunk = () => {
            ipcRenderer.send('grpc-get-chart-data', { requestId, chunkSize, offset });
          };
          
          const handleChartDataResponse = (event: any, data: any) => {
            if (data.requestId === requestId) {
              if (data.error) {
                ipcRenderer.removeListener('grpc-chart-data-response', handleChartDataResponse);
                reject(new Error(data.error));
                return;
              }
              
              // Add chunk to our data
              chartData.push(...data.chunk);
              
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
      };

      const progressHandler = (event: any, data: any) => {
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
              fetchChartDataInChunks(requestId).then(chartData => {
                resolve({
                  stats: data.stats,
                  chartConfig: {
                    ...data.chartConfig,
                    data: chartData
                  },
                  message: data.message
                });
              }).catch(error => {
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
      
      const errorHandler = (event: any, data: any) => {
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
  }
});

// Keep backward compatibility by also exposing the old interface
contextBridge.exposeInMainWorld('electronGrpc', {
  healthCheck: () => ipcRenderer.invoke('grpc-healthcheck'),
  helloWorld: (message: string) => ipcRenderer.invoke('grpc-helloworld', { message }),
  echoParameter: (value: number, operation: string) => 
    ipcRenderer.invoke('grpc-echoparameter', { value, operation }),
  getFeatures: (bounds: any, featureTypes: string[], limit: number) => 
    ipcRenderer.invoke('grpc-getfeatures', { bounds, featureTypes, limit }),
  getBatchDataWorkerStreamed: (bounds: any, dataTypes: string[], maxPoints: number, resolution = 20, onProgress?: (progress: any) => void, onChunkData?: (chunk: any) => void) => {
    return new Promise((resolve, reject) => {
      const requestId = `worker-stream-${Date.now()}-${Math.random()}`;
      const receivedChunks: any[] = [];
      
      const handleProgress = (event: any, data: any) => {
        if (data.requestId !== requestId) return;
        
        if (data.type === 'progress' && onProgress) {
          onProgress({
            processed: data.processed,
            total: data.total,
            percentage: data.percentage,
            phase: data.phase
          });
        }
        
        if (data.type === 'complete') {
          ipcRenderer.off('grpc-worker-stream-progress', handleProgress);
          ipcRenderer.off('grpc-worker-stream-chunk', handleChunkData);
          ipcRenderer.off('grpc-worker-stream-error', handleError);
          resolve({
            totalProcessed: data.totalProcessed,
            processingTime: data.processingTime,
            generationMethod: data.generationMethod,
            summary: data.summary,
            dataSample: data.dataSample,
            receivedChunks: receivedChunks
          });
        }
      };
      
      const handleChunkData = (event: any, data: any) => {
        if (data.requestId !== requestId) return;
        
        receivedChunks.push(data.chunkData);
        
        if (onChunkData) {
          onChunkData({
            chunkNumber: data.chunkNumber,
            totalChunks: data.totalChunks,
            chunkData: data.chunkData,
            processed: data.processed,
            total: data.total,
            percentage: data.percentage
          });
        }
        
        if (onProgress) {
          onProgress({
            processed: data.processed,
            total: data.total,
            percentage: data.percentage,
            phase: `processing_chunk_${data.chunkNumber}_of_${data.totalChunks}`
          });
        }
      };
      
      const handleError = (event: any, data: any) => {
        if (data.requestId !== requestId) return;
        
        ipcRenderer.off('grpc-worker-stream-progress', handleProgress);
        ipcRenderer.off('grpc-worker-stream-error', handleError);
        reject(new Error(data.error));
      };
      
      ipcRenderer.on('grpc-worker-stream-progress', handleProgress);
      ipcRenderer.on('grpc-worker-stream-error', handleError);
      
      ipcRenderer.send('grpc-start-worker-stream', {
        requestId,
        bounds,
        dataTypes,
        maxPoints,
        resolution
      });
    });
  },
  stopStream: () => ipcRenderer.invoke('grpc-stop-stream')
});
