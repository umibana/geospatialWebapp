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
  HelloWorld: (
    request: any,
    callback: (error: grpc.ServiceError | null, response?: any) => void
  ) => grpc.ClientUnaryCall;
  
  EchoParameter: (
    request: any,
    callback: (error: grpc.ServiceError | null, response?: any) => void
  ) => grpc.ClientUnaryCall;
  
  GetFeatures: (
    request: any,
    callback: (error: grpc.ServiceError | null, response?: any) => void
  ) => grpc.ClientUnaryCall;
  
  GetBatchDataStreamed: (request: any) => grpc.ClientReadableStream<any>;
  
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
      
      // Create the client with increased message size limits (500MB) + compression
      const GeospatialService = this.protoDefinition.geospatial.GeospatialService;
      const options = {
        'grpc.max_send_message_length': 500 * 1024 * 1024,  // 500MB
        'grpc.max_receive_message_length': 500 * 1024 * 1024,  // 500MB
        'grpc.default_compression_algorithm': 1,  // 1 = GZIP compression
        'grpc.default_compression_level': 6,      // Compression level (1-9, 6 is good balance)
      };
      this.client = new GeospatialService(
        this.serverAddress,
        grpc.credentials.createInsecure(),
        options
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

  /**
   * Simple Hello World example for testing basic gRPC connectivity
   */
  async helloWorld(message: string): Promise<{ message: string }> {
    if (!this.client) {
      throw new Error('gRPC client not initialized');
    }

    return new Promise((resolve, reject) => {
      this.client!.HelloWorld({ message }, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve({ message: response.message });
        }
      });
    });
  }

  /**
   * Echo Parameter example - sends value and operation, gets back processed result
   */
  async echoParameter(value: number, operation: string): Promise<{
    originalValue: number;
    processedValue: number;
    operation: string;
  }> {
    if (!this.client) {
      throw new Error('gRPC client not initialized');
    }

    return new Promise((resolve, reject) => {
      this.client!.EchoParameter({ value, operation }, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            originalValue: response.original_value,
            processedValue: response.processed_value,
            operation: response.operation
          });
        }
      });
    });
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

  async getBatchData(
    bounds: BoundingBoxData,
    dataTypes: string[],
    maxPoints: number,
    resolution: number = 20
  ): Promise<{ dataPoints: DataPointData[]; totalCount: number; generationMethod: string }> {
    return new Promise((resolve, reject) => {
      try {
        console.log('📦 Main process fetching batch geospatial data via gRPC...');
        
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
          max_points: maxPoints,
          resolution: resolution
        };

        client.GetBatchData(request, (error: grpc.ServiceError | null, response?: any) => {
          if (error) {
            console.error('GetBatchData failed:', error);
            reject(error);
            return;
          }

          const dataPoints: DataPointData[] = (response.data_points || []).map((dataPoint: any) => ({
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
          }));

          resolve({
            dataPoints,
            totalCount: response.total_count || dataPoints.length,
            generationMethod: response.generation_method || 'unknown'
          });
        });
      } catch (error) {
        console.error('GetBatchData error:', error);
        reject(error);
      }
    });
  }

  private currentStream: any = null;

  // Real-time streaming with proper cancellation - collect for shorter duration
  async getStreamData(
    bounds: BoundingBoxData,
    dataTypes: string[],
    maxPointsPerSecond: number,
    maxDuration: number = 10000 // Reduced to 10 seconds for faster response
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
              altitude: bounds.southwest.longitude // Fixed typo
            }
          },
          data_types: dataTypes,
          max_points_per_second: maxPointsPerSecond
        };

        const stream = client.StreamData(request);
        this.currentStream = stream; // Store reference for cancellation
        const dataPoints: DataPointData[] = [];
        
        // Set shorter timeout for more responsive streaming
        const timeout = setTimeout(() => {
          this.stopCurrentStream();
          resolve(dataPoints);
        }, maxDuration);

        stream.on('data', (dataPoint: any) => {
          const point: DataPointData = {
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
          };
          dataPoints.push(point);
          
          console.log(`📡 Streamed data point: ${point.value} ${point.unit} (${dataPoints.length} total)`);
        });

        stream.on('end', () => {
          clearTimeout(timeout);
          this.currentStream = null;
          console.log('🛑 Stream ended naturally');
          resolve(dataPoints);
        });

        stream.on('error', (error: Error) => {
          clearTimeout(timeout);
          this.currentStream = null;
          console.error('Stream error:', error);
          reject(error);
        });

      } catch (error) {
        console.error('StreamData failed:', error);
        reject(error);
      }
    });
  }

  stopCurrentStream(): void {
    if (this.currentStream) {
      console.log('🛑 Manually stopping gRPC stream...');
      this.currentStream.destroy();
      this.currentStream = null;
    }
  }

  // Method 1: Compressed batch data (same format, but with gRPC compression)
  async getBatchDataCompressed(
    bounds: BoundingBoxData,
    dataTypes: string[],
    maxPoints: number,
    resolution: number = 20
  ): Promise<{ dataPoints: DataPointData[]; totalCount: number; generationMethod: string }> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🗜️  Main process calling compressed gRPC batch data...');
        
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
          max_points: maxPoints,
          resolution: resolution
        };

        client.GetBatchDataCompressed(request, (error: any, response: any) => {
          if (error) {
            console.error('GetBatchDataCompressed failed:', error);
            reject(error);
            return;
          }

          const dataPoints: DataPointData[] = response.data_points.map((point: any) => ({
            id: point.id,
            location: {
              latitude: point.location.latitude,
              longitude: point.location.longitude,
              altitude: point.location.altitude
            },
            value: point.value,
            unit: point.unit,
            timestamp: Number(point.timestamp),
            metadata: point.metadata || {}
          }));

          resolve({
            dataPoints,
            totalCount: response.total_count,
            generationMethod: response.generation_method
          });
        });

      } catch (error) {
        console.error('GetBatchDataCompressed failed:', error);
        reject(error);
      }
    });
  }

  // Method 2: Optimized data format (float32, flattened metadata)
  async getBatchDataOptimized(
    bounds: BoundingBoxData,
    dataTypes: string[],
    maxPoints: number,
    resolution: number = 20
  ): Promise<{ dataPoints: DataPointData[]; totalCount: number; generationMethod: string }> {
    return new Promise((resolve, reject) => {
      try {
        console.log('⚡ Main process calling optimized gRPC batch data...');
        
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
          max_points: maxPoints,
          resolution: resolution
        };

        client.GetBatchDataOptimized(request, (error: any, response: any) => {
          if (error) {
            console.error('GetBatchDataOptimized failed:', error);
            reject(error);
            return;
          }

          const dataPoints: DataPointData[] = response.data_points.map((point: any) => ({
            id: point.id,
            location: {
              latitude: point.latitude,   // Direct float32 fields
              longitude: point.longitude, // Direct float32 fields
              altitude: point.altitude    // Direct float32 fields
            },
            value: point.value,           // Direct float32 field
            unit: point.unit,
            timestamp: Number(point.timestamp),
            metadata: {
              generation_method: point.generation_method  // Flattened metadata
            }
          }));

          resolve({
            dataPoints,
            totalCount: response.total_count,
            generationMethod: response.generation_method
          });
        });

      } catch (error) {
        console.error('GetBatchDataOptimized failed:', error);
        reject(error);
      }
    });
  }

  // Method 3: Chunked streaming (prevents frontend freeze)
  async getBatchDataStreamed(
    bounds: BoundingBoxData,
    dataTypes: string[],
    maxPoints: number,
    resolution: number = 20
  ): Promise<{ dataPoints: DataPointData[]; totalCount: number; generationMethod: string }> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔄 Main process calling streamed gRPC batch data...');
        
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
          max_points: maxPoints,
          resolution: resolution
        };

        const stream = client.GetBatchDataStreamed(request);
        let allDataPoints: DataPointData[] = [];
        let totalCount = 0;
        let generationMethod = '';
        let chunksReceived = 0;
        let totalChunks = 0;

        stream.on('data', (chunk: any) => {
          chunksReceived++;
          totalChunks = chunk.total_chunks;
          generationMethod = chunk.generation_method;
          
          console.log(`📦 Received chunk ${chunk.chunk_number}/${chunk.total_chunks} (${chunk.points_in_chunk} points)`);
          
          const chunkDataPoints: DataPointData[] = chunk.data_points.map((point: any) => ({
            id: point.id,
            location: {
              latitude: point.location.latitude,
              longitude: point.location.longitude,
              altitude: point.location.altitude
            },
            value: point.value,
            unit: point.unit,
            timestamp: Number(point.timestamp),
            metadata: point.metadata || {}
          }));

          allDataPoints.push(...chunkDataPoints);
          totalCount += chunk.points_in_chunk;

          if (chunk.is_final_chunk) {
            console.log(`✅ Received all ${chunksReceived} chunks, total ${totalCount} points`);
            resolve({
              dataPoints: allDataPoints,
              totalCount,
              generationMethod
            });
          }
        });

        stream.on('end', () => {
          console.log('🛑 Stream ended naturally');
          if (allDataPoints.length > 0) {
            resolve({
              dataPoints: allDataPoints,
              totalCount,
              generationMethod
            });
          }
        });

        stream.on('error', (error: Error) => {
          console.error('Stream error:', error);
          reject(error);
        });

      } catch (error) {
        console.error('GetBatchDataStreamed failed:', error);
        reject(error);
      }
    });
  }
}

// Export singleton instance
export const mainGrpcClient = new MainProcessGrpcClient();