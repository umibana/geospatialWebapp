// Import the existing protobuf types
import { create } from "@bufbuild/protobuf";
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

  constructor() {
    this.baseUrl = 'http://127.0.0.1:50051'; // Default gRPC port
  }

  async updatePort(): Promise<void> {
    try {
      // Get the Django backend URL first
      const backendUrl = await window.electronBackend.getBackendUrl();
      
      // Get gRPC port from Django API
      const response = await fetch(`${backendUrl}/api/grpc-port/`);
      const data = await response.json();
      
      if (data.port) {
        this.baseUrl = `http://127.0.0.1:${data.port}`;
        console.log(`🔗 gRPC client updated to port ${data.port}`);
      } else {
        throw new Error('gRPC port not available');
      }
    } catch (error) {
      console.error('Failed to update gRPC port:', error);
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
      console.log('🏥 Performing gRPC health check...');
      
      // For now, simulate a successful health check
      // In production, you'd make an actual gRPC call to the server
      const request = create(HealthCheckRequestSchema, {});
      await this.makeGrpcRequest('HealthCheck', request);
      
      return {
        healthy: true,
        version: '1.0.0',
        status: {
          service: 'GeospatialService',
          protocol: 'gRPC',
          connection: 'active',
          timestamp: new Date().toISOString()
        }
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
      console.log('📍 Fetching geospatial features via gRPC...');
      
      const request = create(GetFeaturesRequestSchema, {
        bounds: this.createBoundingBox(bounds),
        featureTypes: featureTypes,
        limit: limit,
      });

      // For now, simulate the gRPC call
      // In production, you'd make an actual gRPC call to the server
      const features = await this.simulateGetFeatures(bounds, featureTypes, limit);
      
      return {
        features,
        total_count: features.length
      };
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
      console.log('🔄 Starting gRPC data stream...');
      
      const request = create(StreamDataRequestSchema, {
        bounds: this.createBoundingBox(bounds),
        dataTypes: dataTypes,
        maxPointsPerSecond: maxPointsPerSecond,
      });

      // Simulate streaming data for demo
      // In production, you'd use actual gRPC streaming
      for (let i = 0; i < 30; i++) { // Stream for 30 iterations
        await new Promise(resolve => setTimeout(resolve, 1000 / maxPointsPerSecond));
        
        const dataPoint = create(DataPointSchema, {
          id: `grpc_datapoint_${i}_${Date.now()}`,
          location: create(CoordinateSchema, {
            latitude: bounds.southwest.latitude + Math.random() * (bounds.northeast.latitude - bounds.southwest.latitude),
            longitude: bounds.southwest.longitude + Math.random() * (bounds.northeast.longitude - bounds.southwest.longitude),
            altitude: Math.random() * 50
          }),
          value: Math.random() * 100,
          unit: ['temperature', 'humidity', 'pressure'][Math.floor(Math.random() * 3)],
          timestamp: BigInt(Date.now()),
          metadata: {
            sensor_type: ['temperature', 'humidity', 'air_quality'][Math.floor(Math.random() * 3)],
            accuracy: (0.8 + Math.random() * 0.2).toFixed(2),
            source: 'grpc_demo_sensor',
            protocol: 'gRPC'
          }
        });
        
        yield this.parseDataPoint(dataPoint);
      }
    } catch (error) {
      console.error('StreamData failed:', error);
      throw error;
    }
  }

  private async makeGrpcRequest(method: string, request: any): Promise<any> {
    // Simulate gRPC request for now
    // In production, this would make actual gRPC calls
    console.log(`📡 Making gRPC ${method} request to ${this.baseUrl}`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return Promise.resolve({});
  }

  private async simulateGetFeatures(
    bounds: BoundingBoxData,
    featureTypes: string[],
    limit: number
  ): Promise<GeospatialFeatureData[]> {
    // Generate sample features for demo using protobuf types
    const features: GeospatialFeatureData[] = [];
    const featureCount = Math.min(limit || 10, 50);

    for (let i = 0; i < featureCount; i++) {
      const lat = bounds.southwest.latitude + Math.random() * (bounds.northeast.latitude - bounds.southwest.latitude);
      const lng = bounds.southwest.longitude + Math.random() * (bounds.northeast.longitude - bounds.southwest.longitude);

      const feature = create(GeospatialFeatureSchema, {
        id: `grpc_feature_${i}_${Date.now()}`,
        name: `gRPC Feature ${i + 1}`,
        location: create(CoordinateSchema, {
          latitude: lat,
          longitude: lng,
          altitude: Math.random() * 100
        }),
        properties: {
          type: ['poi', 'landmark', 'building'][Math.floor(Math.random() * 3)],
          category: ['restaurant', 'park', 'shop', 'office'][Math.floor(Math.random() * 4)],
          importance: Math.floor(Math.random() * 10 + 1).toString(),
          protocol: 'gRPC'
        },
        timestamp: BigInt(Date.now())
      });

      features.push(this.parseGeospatialFeature(feature));
    }

    return features;
  }
}

// Export singleton instance
export const grpcClient = new GrpcClient(); 