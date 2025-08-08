// Auto-generated main process gRPC client from protos/*
// DO NOT EDIT - This file is auto-generated

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
// Using loose types to avoid coupling to generated TS types

class AutoMainGrpcClient {
  private client: any = null;
  private initialized = false;
  private readonly serverAddress = '127.0.0.1:50077';

  async initialize(): Promise<void> {
    try {
      const protoPath = process.env.NODE_ENV === 'development' 
        ? join(process.cwd(), 'protos/main_service.proto')
        : join(process.resourcesPath, 'app', 'protos/main_service.proto');
      
      const protoOptions = {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [join(process.cwd(), 'protos')]
      };
      
      const packageDefinition = protoLoader.loadSync(protoPath, protoOptions);

      const protoDefinition = grpc.loadPackageDefinition(packageDefinition) as any;
      const GeospatialService = protoDefinition.geospatial?.GeospatialService;
      
      const options = {
        'grpc.max_send_message_length': 500 * 1024 * 1024,
        'grpc.max_receive_message_length': 500 * 1024 * 1024,
        'grpc.default_compression_algorithm': 1,
        'grpc.default_compression_level': 6,
      };
      
      this.client = new GeospatialService(
        this.serverAddress,
        grpc.credentials.createInsecure(),
        options
      );

      console.log(`🔗 Auto-generated gRPC client connected to ${this.serverAddress}`);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize auto-generated gRPC client:', error);
      throw error;
    }
  }

  private ensureClient() {
    if (!this.client || !this.initialized) {
      throw new Error('Auto-generated gRPC client not initialized');
    }
    return this.client;
  }

  async helloWorld(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const client = this.ensureClient();
      client.HelloWorld(request, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async echoParameter(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const client = this.ensureClient();
      client.EchoParameter(request, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async healthCheck(request: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const client = this.ensureClient();
      client.HealthCheck(request, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async getFeatures(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const client = this.ensureClient();
      client.GetFeatures(request, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async getBatchDataStreamed(request: any): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const client = this.ensureClient();
      const stream = client.GetBatchDataStreamed(request);
      const results: any[] = [];
      let buffered = 0;
      const MAX_BUFFERED = 2000; // simple backpressure cap by count of chunk messages
      
      stream.on('data', (data: any) => {
        results.push(data);
        buffered += 1;
        // If too many chunks buffered, pause briefly to yield
        if (buffered >= MAX_BUFFERED && (stream as any).pause) {
          (stream as any).pause();
          setTimeout(() => {
            buffered = 0;
            (stream as any).resume?.();
          }, 10);
        }
      });
      
      stream.on('end', () => {
        resolve(results);
      });
      
      stream.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  // NEW: true incremental streaming with callback; returns totals when stream ends
  async streamBatchDataIncremental(
    request: any,
    onChunk: (chunk: any) => void,
  ): Promise<{ totalPoints: number; totalChunks: number }> {
    return new Promise((resolve, reject) => {
      const client = this.ensureClient();
      const stream = client.GetBatchDataStreamed(request);
      let totalPoints = 0;
      let totalChunks = 0;
      const MAX_PER_BATCH = 10; // yield every N chunks
      let sinceYield = 0;

      const yieldAsync = () => new Promise(r => setImmediate(r));

      stream.on('data', async (data: any) => {
        totalChunks += 1;
        totalPoints += (data?.data_points?.length || 0);
        onChunk(data);
        sinceYield += 1;
        if (sinceYield >= MAX_PER_BATCH && (stream as any).pause) {
          (stream as any).pause();
          sinceYield = 0;
          await yieldAsync();
          (stream as any).resume?.();
        }
      });
      
      stream.on('end', () => {
        resolve({ totalPoints, totalChunks });
      });
      
      stream.on('error', (error: Error) => {
        reject(error);
      });
    });
  }
}

export const autoMainGrpcClient = new AutoMainGrpcClient();
