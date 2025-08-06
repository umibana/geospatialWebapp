// Electron API types

declare global {
  interface Window {
    // 🎉 New simplified gRPC API
    grpc: {
      healthCheck: () => Promise<{ healthy: boolean; version: string; status: Record<string, string> }>;
      helloWorld: (request: { message: string }) => Promise<{ message: string }>;
      echoParameter: (request: { value: number; operation: string }) => Promise<{ originalValue: number; processedValue: number; operation: string }>;
      getFeatures: (request: { bounds: any; featureTypes: string[]; limit: number }) => Promise<{ features: any[]; total_count: number }>;
      getBatchDataStreamed: (request: { bounds: any; dataTypes: string[]; maxPoints: number; resolution?: number }, onData?: (data: any) => void) => Promise<any[]>;
      getBatchDataWorkerStreamed: (bounds: any, dataTypes: string[], maxPoints: number, resolution?: number, onProgress?: (progress: { processed: number; total: number; percentage: number; phase: string }) => void) => Promise<{ totalProcessed: number; processingTime: number; generationMethod: string; summary: any }>;
      stopStream: () => Promise<{ success: boolean }>;
    };
    
    // Backward compatibility - old gRPC API
    electronGrpc: {
      healthCheck: () => Promise<{ healthy: boolean; version: string; status: Record<string, string> }>;
      helloWorld: (message: string) => Promise<{ message: string }>;
      echoParameter: (value: number, operation: string) => Promise<{ originalValue: number; processedValue: number; operation: string }>;
      getFeatures: (bounds: any, featureTypes: string[], limit: number) => Promise<{ features: any[]; total_count: number }>;
      getBatchDataWorkerStreamed: (bounds: any, dataTypes: string[], maxPoints: number, resolution?: number, onProgress?: (progress: { processed: number; total: number; percentage: number; phase: string }) => void) => Promise<{ totalProcessed: number; processingTime: number; generationMethod: string; summary: any }>;
      stopStream: () => Promise<{ success: boolean }>;
    };
    
    electronBackend: {
      getBackendUrl: () => Promise<string>;
    };
  }
}