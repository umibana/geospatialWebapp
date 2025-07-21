// Import the existing protobuf types
import { create, fromBinary } from "@bufbuild/protobuf";
import {
  type GeospatialFeature,
  type DataPoint,
  type BoundingBox,
  type Coordinate,
  type GetFeaturesRequest,
  type GetFeaturesResponse,
  type StreamDataRequest,
  type HealthCheckRequest,
  type HealthCheckResponse,
  GeospatialFeatureSchema,
  DataPointSchema,
  BoundingBoxSchema,
  CoordinateSchema,
  GetFeaturesRequestSchema,
  GetFeaturesResponseSchema,
  StreamDataRequestSchema,
  HealthCheckRequestSchema,
  HealthCheckResponseSchema,
} from '../generated/geospatial_pb';

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
  private baseUrl: string = '';
  private backendUrl: string = '';

  constructor() {
    this.baseUrl = 'http://127.0.0.1:50051'; // This is now unused
  }

  async updatePort(): Promise<void> {
    try {
      // Get the Django backend URL
      const url = await window.electronBackend.getBackendUrl();
      this.backendUrl = url || '';
      console.log(`🔗 gRPC client updated to use backend: ${this.backendUrl}`);
    } catch (error) {
      console.error('Failed to update backend URL:', error);
      throw error;
    }
  }

  private createCoordinate(coord: CoordinateData): Coordinate {
    return create(CoordinateSchema, {
      latitude: coord.latitude,
      longitude: coord.longitude,
      altitude: coord.altitude,
    });
  }

  private createBoundingBox(bounds: BoundingBoxData): BoundingBox {
    return create(BoundingBoxSchema, {
      northeast: this.createCoordinate(bounds.northeast),
      southwest: this.createCoordinate(bounds.southwest),
    });
  }

  private parseCoordinate(coord: Coordinate): CoordinateData {
    return {
      latitude: coord.latitude,
      longitude: coord.longitude,
      altitude: coord.altitude,
    };
  }

  private parseGeospatialFeature(feature: GeospatialFeature): GeospatialFeatureData {
    return {
      id: feature.id,
      name: feature.name,
      location: this.parseCoordinate(feature.location!),
      properties: feature.properties,
      timestamp: Number(feature.timestamp),
    };
  }

  private parseDataPoint(dataPoint: DataPoint): DataPointData {
    return {
      id: dataPoint.id,
      location: this.parseCoordinate(dataPoint.location!),
      value: dataPoint.value,
      unit: dataPoint.unit,
      timestamp: Number(dataPoint.timestamp),
      metadata: dataPoint.metadata,
    };
  }

  async healthCheck(): Promise<HealthCheckData> {
    try {
      console.log('🏥 Performing gRPC health check via REST->Protobuf...');
      
      const response = await fetch(`${this.backendUrl}/api/grpc/health/protobuf/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        throw new Error('Health check failed');
      }
      
      // Get the binary protobuf data
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      console.log('🔍 Raw protobuf response size:', uint8Array.length, 'bytes');
      console.log('🔍 Content-Type:', response.headers.get('content-type'));
      
      // Deserialize the protobuf response
      const protoResponse = fromBinary(HealthCheckResponseSchema, uint8Array);
      
      return {
        healthy: protoResponse.healthy,
        version: protoResponse.version,
        status: protoResponse.status
      };
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
      console.log('📍 Fetching geospatial features via REST->Protobuf...');
      
      const response = await fetch(`${this.backendUrl}/api/grpc/features/protobuf/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bounds: bounds,
          feature_types: featureTypes,
          limit: limit
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch features');
      }
      
      // Get the binary protobuf data
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Deserialize the protobuf response
      const protoResponse = fromBinary(GetFeaturesResponseSchema, uint8Array);
      
      // Convert protobuf to our interface types
      const features: GeospatialFeatureData[] = protoResponse.features.map((feature: GeospatialFeature) => ({
        id: feature.id,
        name: feature.name,
        location: this.parseCoordinate(feature.location!),
        properties: feature.properties,
        timestamp: Number(feature.timestamp)
      }));
      
      return {
        features,
        total_count: protoResponse.totalCount
      };
    } catch (error) {
      console.error('GetFeatures failed:', error);
      throw error;
    }
  }

  // For streaming, you'd still need to use polling or SSE since you can't 
  // stream protobuf over HTTP easily without WebSockets
  async* streamData(
    bounds: BoundingBoxData,
    dataTypes: string[],
    maxPointsPerSecond: number,
    abortSignal?: AbortSignal
  ): AsyncGenerator<DataPointData> {
    try {
      console.log('🔄 Starting gRPC data stream via REST...');
      
      // For real streaming, you'd use Server-Sent Events or WebSockets
      // For now, we'll poll the REST endpoint
      let iteration = 0;
      const maxIterations = 100; // Limit for demo
      
      while (iteration < maxIterations) {
        // Check if cancellation was requested
        if (abortSignal?.aborted) {
          console.log('🛑 gRPC Stream cancelled by user');
          return;
        }
        
        try {
          const response = await fetch(`${this.backendUrl}/api/grpc/stream/protobuf/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              bounds: bounds,
              data_types: dataTypes,
              max_points_per_second: maxPointsPerSecond
            }),
            signal: abortSignal
          });
          
          if (!response.ok) {
            throw new Error('Stream request failed');
          }
          
          // Get the binary protobuf data
          const arrayBuffer = await response.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          // Deserialize the protobuf response (single DataPoint)
          const protoDataPoint = fromBinary(DataPointSchema, uint8Array);
          
          // Convert to our interface type and yield
          const dataPoint: DataPointData = {
            id: protoDataPoint.id,
            location: this.parseCoordinate(protoDataPoint.location!),
            value: protoDataPoint.value,
            unit: protoDataPoint.unit,
            timestamp: Number(protoDataPoint.timestamp),
            metadata: protoDataPoint.metadata
          };
          
          if (abortSignal?.aborted) {
            return;
          }
          yield dataPoint;
          
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('🛑 gRPC Stream cancelled');
            return;
          }
          console.error('Stream iteration failed:', error);
        }
        
        // Wait before next iteration
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 10 / maxPointsPerSecond);
          
          if (abortSignal) {
            const onAbort = () => {
              clearTimeout(timeout);
              reject(new Error('Stream cancelled'));
            };
            
            if (abortSignal.aborted) {
              clearTimeout(timeout);
              reject(new Error('Stream cancelled'));
              return;
            }
            
            abortSignal.addEventListener('abort', onAbort, { once: true });
            
            setTimeout(() => {
              abortSignal.removeEventListener('abort', onAbort);
            }, 10 / maxPointsPerSecond);
          }
        });
        
        iteration++;
      }
    } catch (error) {
      if (error instanceof Error && (error.message === 'Stream cancelled' || error.name === 'AbortError')) {
        console.log('🛑 gRPC Stream properly cancelled');
        return;
      }
      console.error('StreamData failed:', error);
      throw error;
    }
  }

  // Remove the old simulation methods
  private async makeGrpcRequest(method: string, request: any): Promise<any> {
    // This method is no longer needed
    throw new Error('Direct gRPC calls not supported in browser');
  }

  private async simulateGetFeatures(...args: any[]): Promise<any> {
    // This method is no longer needed
    throw new Error('Simulation replaced with real gRPC calls via REST proxy');
  }
}

// Export singleton instance
export const grpcClient = new GrpcClient(); 