// Auto-generated gRPC client from protos/*
// DO NOT EDIT - This file is auto-generated

import { ipcRenderer } from 'electron';
import {
  HelloWorldRequest,
  HelloWorldResponse,
  EchoParameterRequest,
  EchoParameterResponse,
  HealthCheckResponse,
  GetFeaturesRequest,
  GetFeaturesResponse,
  GetBatchDataRequest,
  GetBatchDataChunk,
} from './types';

export class AutoGrpcClient {
  private async callMethod<T, R>(methodName: string, request: T): Promise<R> {
    const channel = `grpc-${methodName.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    return ipcRenderer.invoke(channel, request);
  }
  
  private async callStreamingMethod<T, R>(methodName: string, request: T, onData?: (data: R) => void): Promise<R[]> {
    return new Promise((resolve, reject) => {
      const requestId = `stream-${Date.now()}-${Math.random()}`;
      const results: R[] = [];
      type StreamDataEvent = { requestId: string; type: 'data' | 'complete'; payload?: R };
      type StreamErrorEvent = { requestId: string; error: string };

      const handleData = (_event: unknown, data: StreamDataEvent) => {
        if (data.requestId !== requestId) return;
        
        if (data.type === 'data') {
          if (data.payload !== undefined) {
            results.push(data.payload);
            if (onData) onData(data.payload);
          }
        } else if (data.type === 'complete') {
          ipcRenderer.off('grpc-stream-data', handleData);
          ipcRenderer.off('grpc-stream-error', handleError);
          resolve(results);
        }
      };
      
      const handleError = (_event: unknown, data: StreamErrorEvent) => {
        if (data.requestId !== requestId) return;
        ipcRenderer.off('grpc-stream-data', handleData);
        ipcRenderer.off('grpc-stream-error', handleError);
        reject(new Error(data.error));
      };
      
      ipcRenderer.on('grpc-stream-data', handleData);
      ipcRenderer.on('grpc-stream-error', handleError);
      
      const channel = `grpc-${methodName.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      ipcRenderer.send(channel, { requestId, ...request });
    });
  }

  async helloWorld(request: HelloWorldRequest): Promise<HelloWorldResponse> {
    return this.callMethod('HelloWorld', request);
  }

  async echoParameter(request: EchoParameterRequest): Promise<EchoParameterResponse> {
    return this.callMethod('EchoParameter', request);
  }

  async healthCheck(request: object = {}): Promise<HealthCheckResponse> {
    return this.callMethod('HealthCheck', request);
  }

  async getFeatures(request: GetFeaturesRequest): Promise<GetFeaturesResponse> {
    return this.callMethod('GetFeatures', request);
  }

  async getBatchDataStreamed(request: GetBatchDataRequest, onData?: (data: GetBatchDataChunk) => void): Promise<GetBatchDataChunk[]> {
    return this.callStreamingMethod('GetBatchDataStreamed', request, onData);
  }
}

export const autoGrpcClient = new AutoGrpcClient();
