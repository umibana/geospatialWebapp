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
  
  // Keep backward compatibility with old streaming system
  getBatchDataWorkerStreamed: (bounds: any, dataTypes: string[], maxPoints: number, resolution = 20, onProgress?: (progress: any) => void) => {
    return new Promise((resolve, reject) => {
      const requestId = `worker-stream-${Date.now()}-${Math.random()}`;
      
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
          ipcRenderer.off('grpc-worker-stream-error', handleError);
          resolve({
            totalProcessed: data.totalProcessed,
            processingTime: data.processingTime,
            generationMethod: data.generationMethod,
            summary: data.summary,
            dataSample: data.dataSample
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

// Keep backward compatibility by also exposing the old interface
contextBridge.exposeInMainWorld('electronGrpc', {
  healthCheck: () => ipcRenderer.invoke('grpc-healthcheck'),
  helloWorld: (message: string) => ipcRenderer.invoke('grpc-helloworld', { message }),
  echoParameter: (value: number, operation: string) => 
    ipcRenderer.invoke('grpc-echoparameter', { value, operation }),
  getFeatures: (bounds: any, featureTypes: string[], limit: number) => 
    ipcRenderer.invoke('grpc-getfeatures', { bounds, featureTypes, limit }),
  getBatchDataWorkerStreamed: (bounds: any, dataTypes: string[], maxPoints: number, resolution = 20, onProgress?: (progress: any) => void) => {
    return new Promise((resolve, reject) => {
      const requestId = `worker-stream-${Date.now()}-${Math.random()}`;
      
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
          ipcRenderer.off('grpc-worker-stream-error', handleError);
          resolve({
            totalProcessed: data.totalProcessed,
            processingTime: data.processingTime,
            generationMethod: data.generationMethod,
            summary: data.summary,
            dataSample: data.dataSample
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
