// Auto-generated context provider from protos/*
// DO NOT EDIT - This file is auto-generated

import { contextBridge } from 'electron';
import { autoGrpcClient } from './auto-grpc-client';

export interface AutoGrpcContext {
  helloWorld: (request: HelloWorldRequest) => Promise<HelloWorldResponse>;
  echoParameter: (request: EchoParameterRequest) => Promise<EchoParameterResponse>;
  healthCheck: (request: HealthCheckRequest) => Promise<HealthCheckResponse>;
  getFeatures: (request: GetFeaturesRequest) => Promise<GetFeaturesResponse>;
  getBatchDataStreamed: (request: GetBatchDataRequest, onData?: (data: GetBatchDataChunk) => void) => Promise<GetBatchDataChunk[]>;
}

const autoGrpcContext: AutoGrpcContext = {
  helloWorld: autoGrpcClient.helloWorld.bind(autoGrpcClient),
  echoParameter: autoGrpcClient.echoParameter.bind(autoGrpcClient),
  healthCheck: autoGrpcClient.healthCheck.bind(autoGrpcClient),
  getFeatures: autoGrpcClient.getFeatures.bind(autoGrpcClient),
  getBatchDataStreamed: autoGrpcClient.getBatchDataStreamed.bind(autoGrpcClient),
};

export function exposeAutoGrpcContext() {
  contextBridge.exposeInMainWorld('autoGrpc', autoGrpcContext);
}
