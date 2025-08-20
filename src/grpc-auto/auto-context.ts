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
  getBatchDataColumnar: (request: GetBatchDataRequest) => Promise<GetBatchDataColumnarResponse>;
  getBatchDataColumnarStreamed: (request: GetBatchDataRequest, onData?: (data: ColumnarDataChunk) => void) => Promise<ColumnarDataChunk[]>;
  analyzeCsv: (request: AnalyzeCsvRequest) => Promise<AnalyzeCsvResponse>;
  sendFile: (request: SendFileRequest) => Promise<SendFileResponse>;
  getLoadedDataStats: (request: GetLoadedDataStatsRequest) => Promise<GetLoadedDataStatsResponse>;
  getLoadedDataChunk: (request: GetLoadedDataChunkRequest) => Promise<GetLoadedDataChunkResponse>;
  createProject: (request: CreateProjectRequest) => Promise<CreateProjectResponse>;
  getProjects: (request: GetProjectsRequest) => Promise<GetProjectsResponse>;
  getProject: (request: GetProjectRequest) => Promise<GetProjectResponse>;
  updateProject: (request: UpdateProjectRequest) => Promise<UpdateProjectResponse>;
  deleteProject: (request: DeleteProjectRequest) => Promise<DeleteProjectResponse>;
  createFile: (request: CreateFileRequest) => Promise<CreateFileResponse>;
  getProjectFiles: (request: GetProjectFilesRequest) => Promise<GetProjectFilesResponse>;
  deleteFile: (request: DeleteFileRequest) => Promise<DeleteFileResponse>;
  getProjectDatasets: (request: GetProjectDatasetsRequest) => Promise<GetProjectDatasetsResponse>;
  analyzeCsvForProject: (request: AnalyzeCsvForProjectRequest) => Promise<AnalyzeCsvForProjectResponse>;
  processDataset: (request: ProcessDatasetRequest) => Promise<ProcessDatasetResponse>;
  getDatasetData: (request: GetDatasetDataRequest) => Promise<GetDatasetDataResponse>;
}

const autoGrpcContext: AutoGrpcContext = {
  helloWorld: autoGrpcClient.helloWorld.bind(autoGrpcClient),
  echoParameter: autoGrpcClient.echoParameter.bind(autoGrpcClient),
  healthCheck: autoGrpcClient.healthCheck.bind(autoGrpcClient),
  getFeatures: autoGrpcClient.getFeatures.bind(autoGrpcClient),
  getBatchDataStreamed: autoGrpcClient.getBatchDataStreamed.bind(autoGrpcClient),
  getBatchDataColumnar: autoGrpcClient.getBatchDataColumnar.bind(autoGrpcClient),
  getBatchDataColumnarStreamed: autoGrpcClient.getBatchDataColumnarStreamed.bind(autoGrpcClient),
  analyzeCsv: autoGrpcClient.analyzeCsv.bind(autoGrpcClient),
  sendFile: autoGrpcClient.sendFile.bind(autoGrpcClient),
  getLoadedDataStats: autoGrpcClient.getLoadedDataStats.bind(autoGrpcClient),
  getLoadedDataChunk: autoGrpcClient.getLoadedDataChunk.bind(autoGrpcClient),
  createProject: autoGrpcClient.createProject.bind(autoGrpcClient),
  getProjects: autoGrpcClient.getProjects.bind(autoGrpcClient),
  getProject: autoGrpcClient.getProject.bind(autoGrpcClient),
  updateProject: autoGrpcClient.updateProject.bind(autoGrpcClient),
  deleteProject: autoGrpcClient.deleteProject.bind(autoGrpcClient),
  createFile: autoGrpcClient.createFile.bind(autoGrpcClient),
  getProjectFiles: autoGrpcClient.getProjectFiles.bind(autoGrpcClient),
  deleteFile: autoGrpcClient.deleteFile.bind(autoGrpcClient),
  getProjectDatasets: autoGrpcClient.getProjectDatasets.bind(autoGrpcClient),
  analyzeCsvForProject: autoGrpcClient.analyzeCsvForProject.bind(autoGrpcClient),
  processDataset: autoGrpcClient.processDataset.bind(autoGrpcClient),
  getDatasetData: autoGrpcClient.getDatasetData.bind(autoGrpcClient),
};

export function exposeAutoGrpcContext() {
  contextBridge.exposeInMainWorld('autoGrpc', autoGrpcContext);
}
