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

export interface GrpcContext {
  healthCheck: () => Promise<HealthCheckData>;
  getFeatures: (
    bounds: BoundingBoxData,
    featureTypes: string[],
    limit: number
  ) => Promise<{ features: GeospatialFeatureData[]; total_count: number }>;
  getStreamData: (
    bounds: BoundingBoxData,
    dataTypes: string[],
    maxPointsPerSecond: number,
    maxDuration?: number
  ) => Promise<DataPointData[]>;
}

const grpcContext: GrpcContext = {
  healthCheck: () => ipcRenderer.invoke('grpc-health-check'),
  
  getFeatures: (bounds, featureTypes, limit) => 
    ipcRenderer.invoke('grpc-get-features', bounds, featureTypes, limit),
  
  getStreamData: (bounds, dataTypes, maxPointsPerSecond, maxDuration = 30000) => 
    ipcRenderer.invoke('grpc-get-stream-data', bounds, dataTypes, maxPointsPerSecond, maxDuration),
};

export function exposeGrpcContext() {
  contextBridge.exposeInMainWorld("electronGrpc", grpcContext);
}