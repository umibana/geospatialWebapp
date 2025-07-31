// Types for easier use
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

class GrpcClient {
  constructor() {
    // No initialization needed - all handled via IPC to main process
  }

  async healthCheck(): Promise<HealthCheckData> {
    try {
      console.log('🏥 Performing gRPC health check via IPC...');
      return await window.electronGrpc.healthCheck();
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        healthy: false,
        version: '1.0.0',
        status: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  async getFeatures(
    bounds: BoundingBoxData,
    featureTypes: string[],
    limit: number
  ): Promise<{ features: GeospatialFeatureData[]; total_count: number }> {
    try {
      console.log('📍 Fetching geospatial features via gRPC (IPC)...');
      return await window.electronGrpc.getFeatures(bounds, featureTypes, limit);
    } catch (error) {
      console.error('GetFeatures failed:', error);
      throw error;
    }
  }

  async* streamData(
    bounds: BoundingBoxData,
    dataTypes: string[],
    maxPointsPerSecond: number
  ): AsyncGenerator<DataPointData> {
    try {
      console.log('🔄 Starting gRPC data stream via IPC...');
      
      // Get all stream data at once (simplified for IPC)
      const dataPoints = await window.electronGrpc.getStreamData(
        bounds, 
        dataTypes, 
        maxPointsPerSecond, 
        30000 // 30 seconds
      );
      
      // Yield each data point with appropriate timing
      const interval = 1000 / maxPointsPerSecond;
      
      for (const dataPoint of dataPoints) {
        yield dataPoint;
        // Wait for the appropriate interval
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    } catch (error) {
      console.error('StreamData failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const grpcClient = new GrpcClient();