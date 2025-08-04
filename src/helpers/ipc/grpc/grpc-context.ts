import { ipcRenderer, contextBridge } from "electron";

// Types matching the main process
interface CoordinateData {
  latitude: number;
  longitude: number;
  altitude?: number;
}

interface BoundingBoxData {
  northeast: CoordinateData;
  southwest: CoordinateData;
}

interface GeospatialFeatureData {
  id: string;
  name: string;
  location: CoordinateData;
  properties: Record<string, string>;
  timestamp: number;
}

interface DataPointData {
  id: string;
  location: CoordinateData;
  value: number;
  unit: string;
  timestamp: number;
  metadata: Record<string, string>;
}

interface HealthCheckData {
  healthy: boolean;
  version: string;
  status: Record<string, string>;
}

/**
 * Interfaz de Contexto gRPC para Comunicación IPC de Electron
 * 
 * Esta interfaz define todos los métodos gRPC disponibles para procesamiento de datos geoespaciales.
 * Todos los métodos usan comunicación IPC segura entre el proceso renderer y main.
 */
export interface GrpcContext {
  /**
   * Check the health status of the gRPC backend server
   * @returns Promise<HealthCheckData> Server health information
   * 
   * @example
   * ```typescript
   * const health = await window.electronGrpc.healthCheck();
   * console.log('Server healthy:', health.healthy);
   * ```
   */
  healthCheck: () => Promise<HealthCheckData>;

  /**
   * Simple Hello World gRPC call for testing basic connectivity
   * @param message - Message to send to server
   * @returns Promise<{message: string}> Echo response from server
   * 
   * @example
   * ```typescript
   * const response = await window.electronGrpc.helloWorld("Hello from frontend!");
   * console.log('Server response:', response.message);
   * ```
   */
  helloWorld: (message: string) => Promise<{ message: string }>;

  /**
   * Echo parameter test - sends a parameter and gets it back with processing info
   * @param value - Numeric value to process
   * @param operation - Mathematical operation to perform
   * @returns Promise<{originalValue: number, processedValue: number, operation: string}>
   * 
   * @example
   * ```typescript
   * const result = await window.electronGrpc.echoParameter(42, "square");
   * console.log(`${result.originalValue} squared = ${result.processedValue}`);
   * ```
   */
  echoParameter: (value: number, operation: string) => Promise<{
    originalValue: number;
    processedValue: number;
    operation: string;
  }>;

  /**
   * Get geospatial features within specified bounds
   * @param bounds - Geographic bounding box
   * @param featureTypes - Types of features to retrieve
   * @param limit - Maximum number of features to return
   * @returns Promise with features array and total count
   * 
   * @example
   * ```typescript
   * const bounds = {
   *   northeast: { latitude: 37.7849, longitude: -122.4094 },
   *   southwest: { latitude: 37.7749, longitude: -122.4194 }
   * };
   * const result = await window.electronGrpc.getFeatures(bounds, ['poi'], 100);
   * ```
   */
  getFeatures: (
    bounds: BoundingBoxData,
    featureTypes: string[],
    limit: number
  ) => Promise<{ features: GeospatialFeatureData[]; total_count: number }>;



  /**
   * ⚡ RECOMENDADO: Streaming con Web Workers (CERO bloqueo del hilo principal)
   * 
   * Este método elimina completamente el bloqueo de la UI mediante:
   * 1. Reenvío de chunks directamente al Web Worker (sin acumulación en renderer)
   * 2. Worker procesa todos los datos en hilo de fondo
   * 3. Hilo principal solo recibe actualizaciones de progreso y resumen final
   * 4. CERO arrays grandes en el proceso renderer principal
   * 
   * @param bounds - Caja delimitadora geográfica para generación de datos
   * @param dataTypes - Tipos de datos a generar (elevation, temperature, pressure)
   * @param maxPoints - Número máximo de puntos de datos a generar
   * @param resolution - Resolución/calidad de datos (mayor = más detallado)
   * @param onProgress - Callback para actualizaciones de progreso durante streaming
   * @returns Promise con resumen de procesamiento (sin datos raw)
   * 
   * @example
   * ```typescript
   * const limites = {
   *   noreste: { latitude: 37.7849, longitude: -122.4094 },
   *   suroeste: { latitude: 37.7749, longitude: -122.4194 }
   * };
   * 
   * const resultado = await window.electronGrpc.getBatchDataWorkerStreamed(
   *   limites, 
   *   ['elevation'], 
   *   1000000, // 1M puntos - CERO bloqueo de UI!
   *   20,
   *   (progreso) => {
   *     console.log(`Procesado: ${progreso.processed}/${progreso.total} (${progreso.percentage.toFixed(1)}%)`);
   *     // UI permanece 100% responsiva - sin acumulación de datos en hilo principal!
   *   }
   * );
   * ```
   */
  getBatchDataWorkerStreamed: (
    bounds: BoundingBoxData,
    dataTypes: string[],
    maxPoints: number,
    resolution?: number,
    onProgress?: (progress: { processed: number; total: number; percentage: number; phase: string }) => void
  ) => Promise<{ 
    totalProcessed: number; 
    processingTime: number; 
    generationMethod: string; 
    summary: any;
    dataSample?: Array<{
      id: string;
      latitude: number;
      longitude: number;
      valor: number;
      unidad: string;
      tipo: string;
      timestamp: string;
    }>;
  }>;

  /**
   * Detener cualquier flujo de datos actualmente en ejecución
   * @returns Promise<{success: boolean}> Estado de éxito
   */
  stopStream: () => Promise<{ success: boolean }>;
}

const grpcContext: GrpcContext = {
  healthCheck: () => ipcRenderer.invoke('grpc-health-check'),
  
  helloWorld: (message: string) => ipcRenderer.invoke('grpc-hello-world', message),
  
  echoParameter: (value: number, operation: string) => 
    ipcRenderer.invoke('grpc-echo-parameter', value, operation),
  
  getFeatures: (bounds, featureTypes, limit) => 
    ipcRenderer.invoke('grpc-get-features', bounds, featureTypes, limit),
  
  
  // NEW: Ultra-lightweight streaming (no data chunks sent through IPC)
  getBatchDataStreamedLightweight: (bounds, dataTypes, maxPoints, resolution = 20, onProgress) => {
    return new Promise((resolve, reject) => {
      const requestId = `lightweight-${Date.now()}-${Math.random()}`;
      
      const handleProgress = (event: any, data: any) => {
        if (data.requestId !== requestId) return;
        
        if (data.type === 'progress' && onProgress) {
          onProgress({
            received: data.received,
            total: data.total,
            percentage: data.percentage
          });
        }
        
        if (data.type === 'complete') {
          ipcRenderer.off('grpc-lightweight-progress', handleProgress);
          ipcRenderer.off('grpc-lightweight-error', handleError);
          resolve({
            dataPoints: data.dataPoints,
            totalCount: data.totalCount,
            generationMethod: data.generationMethod
          });
        }
      };
      
      const handleError = (event: any, data: any) => {
        if (data.requestId !== requestId) return;
        
        ipcRenderer.off('grpc-lightweight-progress', handleProgress);
        ipcRenderer.off('grpc-lightweight-error', handleError);
        reject(new Error(data.error));
      };
      
      // Listen for responses
      ipcRenderer.on('grpc-lightweight-progress', handleProgress);
      ipcRenderer.on('grpc-lightweight-error', handleError);
      
      // Send the lightweight request
      ipcRenderer.send('grpc-start-lightweight-stream', {
        requestId,
        bounds,
        dataTypes,
        maxPoints,
        resolution
      });
    });
  },

  stopStream: () => 
    ipcRenderer.invoke('grpc-stop-stream'),

  // NUEVO: Streaming con Web Workers - CERO acumulación en hilo principal
  getBatchDataWorkerStreamed: (bounds, dataTypes, maxPoints, resolution = 20, onProgress) => {
    return new Promise((resolve, reject) => {
      const requestId = `worker-stream-${Date.now()}-${Math.random()}`;
      
      console.log(`⚡ Iniciando streaming con Web Worker: ${maxPoints} puntos (CERO acumulación en hilo principal)`);
      
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
            dataSample: data.dataSample // ¡Incluir muestra de datos reales!
          });
        }
      };
      
      const handleError = (event: any, data: any) => {
        if (data.requestId !== requestId) return;
        
        ipcRenderer.off('grpc-worker-stream-progress', handleProgress);
        ipcRenderer.off('grpc-worker-stream-error', handleError);
        reject(new Error(data.error));
      };
      
      // Escuchar respuestas de streaming del worker
      ipcRenderer.on('grpc-worker-stream-progress', handleProgress);
      ipcRenderer.on('grpc-worker-stream-error', handleError);
      
      // Iniciar el streaming del worker
      ipcRenderer.send('grpc-start-worker-stream', {
        requestId,
        bounds,
        dataTypes,
        maxPoints,
        resolution
      });
    });
  },

  
  // Listeners de eventos
  on: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.on(channel, listener);
  },
  
  off: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.off(channel, listener);
  },
};

export function exposeGrpcContext() {
  contextBridge.exposeInMainWorld("electronGrpc", grpcContext);
}