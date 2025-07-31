import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';

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

// gRPC service client interface
interface GeospatialServiceClient {
  GetFeatures: (
    request: any,
    callback: (error: grpc.ServiceError | null, response?: any) => void
  ) => grpc.ClientUnaryCall;
  
  StreamData: (request: any) => grpc.ClientReadableStream<any>;
  
  HealthCheck: (
    request: any,
    callback: (error: grpc.ServiceError | null, response?: any) => void
  ) => grpc.ClientUnaryCall;
}

class MainProcessGrpcClient {
  private client: GeospatialServiceClient | null = null;
  private readonly serverAddress = '127.0.0.1:50077';
  private protoDefinition: any = null;

  async initialize(): Promise<void> {
    try {
      // Load the proto file - find it in the app root
      const protoPath = process.env.NODE_ENV === 'development' 
        ? join(process.cwd(), 'geospatial.proto')
        : join(process.resourcesPath, 'app', 'geospatial.proto');
      
      const packageDefinition = protoLoader.loadSync(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      });

      this.protoDefinition = grpc.loadPackageDefinition(packageDefinition);
      
      // Create the client
      const GeospatialService = this.protoDefinition.geospatial.GeospatialService;
      this.client = new GeospatialService(
        this.serverAddress,
        grpc.credentials.createInsecure()
      ) as GeospatialServiceClient;

      console.log(`🔗 Main process gRPC client connected to ${this.serverAddress}`);
    } catch (error) {
      console.error('Failed to initialize main process gRPC client:', error);
      throw error;
    }
  }

  private ensureClient(): GeospatialServiceClient {
    if (!this.client) {
      throw new Error('gRPC client not initialized');
    }
    return this.client;
  }

  async healthCheck(): Promise<HealthCheckData> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🏥 Main process performing gRPC health check...');
        
        const client = this.ensureClient();
        const request = {};
        
        client.HealthCheck(request, (error: grpc.ServiceError | null, response?: any) => {
          if (error) {
            console.error('Health check failed:', error);
            resolve({
              healthy: false,
              version: '1.0.0',
              status: {
                error: error.message
              }
            });
            return;
          }

          resolve({
            healthy: response.healthy || false,
            version: response.version || '1.0.0',
            status: response.status || {}
          });
        });
      } catch (error) {
        console.error('Health check error:', error);
        reject(error);
      }
    });
  }

  async getFeatures(
    bounds: BoundingBoxData,
    featureTypes: string[],
    limit: number
  ): Promise<{ features: GeospatialFeatureData[]; total_count: number }> {
    return new Promise((resolve, reject) => {
      try {
        console.log('📍 Main process fetching geospatial features via gRPC...');
        
        const client = this.ensureClient();
        const request = {
          bounds: {
            northeast: {
              latitude: bounds.northeast.latitude,
              longitude: bounds.northeast.longitude,
              altitude: bounds.northeast.altitude
            },
            southwest: {
              latitude: bounds.southwest.latitude,
              longitude: bounds.southwest.longitude,
              altitude: bounds.southwest.altitude
            }
          },
          feature_types: featureTypes,
          limit: limit
        };

        client.GetFeatures(request, (error: grpc.ServiceError | null, response?: any) => {
          if (error) {
            console.error('GetFeatures failed:', error);
            reject(error);
            return;
          }

          const features: GeospatialFeatureData[] = (response.features || []).map((feature: any) => ({
            id: feature.id,
            name: feature.name,
            location: {
              latitude: feature.location.latitude,
              longitude: feature.location.longitude,
              altitude: feature.location.altitude
            },
            properties: feature.properties || {},
            timestamp: Number(feature.timestamp)
          }));

          resolve({
            features,
            total_count: response.total_count || features.length
          });
        });
      } catch (error) {
        console.error('GetFeatures error:', error);
        reject(error);
      }
    });
  }

  // Note: Streaming is more complex in main process -> renderer IPC
  // For now, we'll implement a simple version that collects stream data
  async getStreamData(
    bounds: BoundingBoxData,
    dataTypes: string[],
    maxPointsPerSecond: number,
    maxDuration: number = 30000 // 30 seconds max
  ): Promise<DataPointData[]> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔄 Main process starting gRPC data stream...');
        
        const client = this.ensureClient();
        const request = {
          bounds: {
            northeast: {
              latitude: bounds.northeast.latitude,
              longitude: bounds.northeast.longitude,
              altitude: bounds.northeast.altitude
            },
            southwest: {
              latitude: bounds.southwest.latitude,
              longitude: bounds.southwest.longitude,
              altitude: bounds.southwest.altitude
            }
          },
          data_types: dataTypes,
          max_points_per_second: maxPointsPerSecond
        };

        const stream = client.StreamData(request);
        const dataPoints: DataPointData[] = [];
        
        // Set timeout to prevent infinite streaming
        const timeout = setTimeout(() => {
          stream.destroy();
          resolve(dataPoints);
        }, maxDuration);

        stream.on('data', (dataPoint: any) => {
          dataPoints.push({
            id: dataPoint.id,
            location: {
              latitude: dataPoint.location.latitude,
              longitude: dataPoint.location.longitude,
              altitude: dataPoint.location.altitude
            },
            value: dataPoint.value,
            unit: dataPoint.unit,
            timestamp: Number(dataPoint.timestamp),
            metadata: dataPoint.metadata || {}
          });
        });

        stream.on('end', () => {
          clearTimeout(timeout);
          resolve(dataPoints);
        });

        stream.on('error', (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        });

      } catch (error) {
        console.error('StreamData failed:', error);
        reject(error);
      }
    });
  }
}

// Export singleton instance
export const mainGrpcClient = new MainProcessGrpcClient();