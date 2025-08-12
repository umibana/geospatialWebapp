// Auto-generated main process gRPC client from protos/*
// DO NOT EDIT - This file is auto-generated

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import * as FilesTypes from '../generated/files_pb';
import * as GeospatialTypes from '../generated/geospatial_pb';
import * as MainserviceTypes from '../generated/main_service_pb';

type Types = typeof FilesTypes & typeof GeospatialTypes & typeof MainserviceTypes;

class AutoMainGrpcClient {
  private client: any = null;
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

      const protoDefinition = grpc.loadPackageDefinition(packageDefinition);
      const GeospatialService = protoDefinition.geospatial.GeospatialService;
      
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
    } catch (error) {
      console.error('Failed to initialize auto-generated gRPC client:', error);
      throw error;
    }
  }

  private ensureClient() {
    if (!this.client) {
      throw new Error('Auto-generated gRPC client not initialized');
    }
    return this.client;
  }

  async helloWorld(request: Types.HelloWorldRequest): Promise<Types.HelloWorldResponse> {
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

  async echoParameter(request: Types.EchoParameterRequest): Promise<Types.EchoParameterResponse> {
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

  async healthCheck(request: Types.HealthCheckRequest): Promise<Types.HealthCheckResponse> {
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

  async getFeatures(request: Types.GetFeaturesRequest): Promise<Types.GetFeaturesResponse> {
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

  async getBatchDataStreamed(request: Types.GetBatchDataRequest): Promise<Types.GetBatchDataChunk[]> {
    return new Promise((resolve, reject) => {
      const client = this.ensureClient();
      const stream = client.GetBatchDataStreamed(request);
      const results: Types.GetBatchDataChunk[] = [];
      
      stream.on('data', (data: any) => {
        results.push(data);
      });
      
      stream.on('end', () => {
        resolve(results);
      });
      
      stream.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  async analyzeCsv(request: Types.AnalyzeCsvRequest): Promise<Types.AnalyzeCsvResponse> {
    return new Promise((resolve, reject) => {
      const client = this.ensureClient();
      client.AnalyzeCsv(request, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async sendFile(request: Types.SendFileRequest): Promise<Types.SendFileResponse> {
    return new Promise((resolve, reject) => {
      const client = this.ensureClient();
      client.SendFile(request, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async getLoadedDataStats(request: Types.GetLoadedDataStatsRequest): Promise<Types.GetLoadedDataStatsResponse> {
    return new Promise((resolve, reject) => {
      const client = this.ensureClient();
      client.GetLoadedDataStats(request, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async getLoadedDataChunk(request: Types.GetLoadedDataChunkRequest): Promise<Types.GetLoadedDataChunkResponse> {
    return new Promise((resolve, reject) => {
      const client = this.ensureClient();
      client.GetLoadedDataChunk(request, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }
}

export const autoMainGrpcClient = new AutoMainGrpcClient();
