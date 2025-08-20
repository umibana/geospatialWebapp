// Auto-generated gRPC client from protos/*
// DO NOT EDIT - This file is auto-generated

import { ipcRenderer } from 'electron';
import * as FilesTypes from '../generated/files_pb';
import * as GeospatialTypes from '../generated/geospatial_pb';
import * as MainserviceTypes from '../generated/main_service_pb';

type Types = typeof FilesTypes & typeof GeospatialTypes & typeof MainserviceTypes;

export class AutoGrpcClient {
  private async callMethod<T, R>(methodName: string, request: T): Promise<R> {
    const channel = `grpc-${methodName.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    return ipcRenderer.invoke(channel, request);
  }
  
  private async callStreamingMethod<T, R>(methodName: string, request: T, onData?: (data: R) => void): Promise<R[]> {
    return new Promise((resolve, reject) => {
      const requestId = `stream-${Date.now()}-${Math.random()}`;
      const results: R[] = [];
      
      const handleData = (event: any, data: any) => {
        if (data.requestId !== requestId) return;
        
        if (data.type === 'data') {
          results.push(data.payload);
          if (onData) onData(data.payload);
        } else if (data.type === 'complete') {
          ipcRenderer.off('grpc-stream-data', handleData);
          ipcRenderer.off('grpc-stream-error', handleError);
          resolve(results);
        }
      };
      
      const handleError = (event: any, data: any) => {
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

  async healthCheck(request: HealthCheckRequest): Promise<HealthCheckResponse> {
    return this.callMethod('HealthCheck', request);
  }

  async getFeatures(request: GetFeaturesRequest): Promise<GetFeaturesResponse> {
    return this.callMethod('GetFeatures', request);
  }

  async getBatchDataStreamed(request: GetBatchDataRequest, onData?: (data: GetBatchDataChunk) => void): Promise<GetBatchDataChunk[]> {
    return this.callStreamingMethod('GetBatchDataStreamed', request, onData);
  }

  async getBatchDataColumnar(request: GetBatchDataRequest): Promise<GetBatchDataColumnarResponse> {
    return this.callMethod('GetBatchDataColumnar', request);
  }

  async getBatchDataColumnarStreamed(request: GetBatchDataRequest, onData?: (data: ColumnarDataChunk) => void): Promise<ColumnarDataChunk[]> {
    return this.callStreamingMethod('GetBatchDataColumnarStreamed', request, onData);
  }

  async analyzeCsv(request: AnalyzeCsvRequest): Promise<AnalyzeCsvResponse> {
    return this.callMethod('AnalyzeCsv', request);
  }

  async sendFile(request: SendFileRequest): Promise<SendFileResponse> {
    return this.callMethod('SendFile', request);
  }

  async getLoadedDataStats(request: GetLoadedDataStatsRequest): Promise<GetLoadedDataStatsResponse> {
    return this.callMethod('GetLoadedDataStats', request);
  }

  async getLoadedDataChunk(request: GetLoadedDataChunkRequest): Promise<GetLoadedDataChunkResponse> {
    return this.callMethod('GetLoadedDataChunk', request);
  }

  async createProject(request: CreateProjectRequest): Promise<CreateProjectResponse> {
    return this.callMethod('CreateProject', request);
  }

  async getProjects(request: GetProjectsRequest): Promise<GetProjectsResponse> {
    return this.callMethod('GetProjects', request);
  }

  async getProject(request: GetProjectRequest): Promise<GetProjectResponse> {
    return this.callMethod('GetProject', request);
  }

  async updateProject(request: UpdateProjectRequest): Promise<UpdateProjectResponse> {
    return this.callMethod('UpdateProject', request);
  }

  async deleteProject(request: DeleteProjectRequest): Promise<DeleteProjectResponse> {
    return this.callMethod('DeleteProject', request);
  }

  async createFile(request: CreateFileRequest): Promise<CreateFileResponse> {
    return this.callMethod('CreateFile', request);
  }

  async getProjectFiles(request: GetProjectFilesRequest): Promise<GetProjectFilesResponse> {
    return this.callMethod('GetProjectFiles', request);
  }

  async deleteFile(request: DeleteFileRequest): Promise<DeleteFileResponse> {
    return this.callMethod('DeleteFile', request);
  }

  async analyzeCsvForProject(request: AnalyzeCsvForProjectRequest): Promise<AnalyzeCsvForProjectResponse> {
    return this.callMethod('AnalyzeCsvForProject', request);
  }

  async processDataset(request: ProcessDatasetRequest): Promise<ProcessDatasetResponse> {
    return this.callMethod('ProcessDataset', request);
  }

  async getDatasetData(request: GetDatasetDataRequest): Promise<GetDatasetDataResponse> {
    return this.callMethod('GetDatasetData', request);
  }
}

export const autoGrpcClient = new AutoGrpcClient();
