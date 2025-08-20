// Auto-generated IPC handlers from protos/*
// DO NOT EDIT - This file is auto-generated

import { ipcMain } from 'electron';
import { autoMainGrpcClient } from './auto-main-client';

export function registerAutoGrpcHandlers() {
  console.log('🔌 Registering auto-generated gRPC IPC handlers...');

  // Unary method: HelloWorld
  ipcMain.handle('grpc-helloworld', async (event, request) => {
    try {
      return await autoMainGrpcClient.helloWorld(request);
    } catch (error) {
      console.error('gRPC helloWorld failed:', error);
      throw error;
    }
  });

  // Unary method: EchoParameter
  ipcMain.handle('grpc-echoparameter', async (event, request) => {
    try {
      return await autoMainGrpcClient.echoParameter(request);
    } catch (error) {
      console.error('gRPC echoParameter failed:', error);
      throw error;
    }
  });

  // Unary method: HealthCheck
  ipcMain.handle('grpc-healthcheck', async (event, request) => {
    try {
      return await autoMainGrpcClient.healthCheck(request);
    } catch (error) {
      console.error('gRPC healthCheck failed:', error);
      throw error;
    }
  });

  // Unary method: GetFeatures
  ipcMain.handle('grpc-getfeatures', async (event, request) => {
    try {
      return await autoMainGrpcClient.getFeatures(request);
    } catch (error) {
      console.error('gRPC getFeatures failed:', error);
      throw error;
    }
  });

  // Streaming method: GetBatchDataStreamed
  ipcMain.on('grpc-getbatchdatastreamed', async (event, request) => {
    try {
      const results = await autoMainGrpcClient.getBatchDataStreamed(request);
      results.forEach(data => {
        event.sender.send('grpc-stream-data', {
          requestId: request.requestId,
          type: 'data',
          payload: data
        });
      });
      event.sender.send('grpc-stream-data', {
        requestId: request.requestId,
        type: 'complete'
      });
    } catch (error) {
      event.sender.send('grpc-stream-error', {
        requestId: request.requestId,
        error: error.message
      });
    }
  });

  // Unary method: GetBatchDataColumnar
  ipcMain.handle('grpc-getbatchdatacolumnar', async (event, request) => {
    try {
      return await autoMainGrpcClient.getBatchDataColumnar(request);
    } catch (error) {
      console.error('gRPC getBatchDataColumnar failed:', error);
      throw error;
    }
  });

  // Streaming method: GetBatchDataColumnarStreamed
  ipcMain.on('grpc-getbatchdatacolumnarstreamed', async (event, request) => {
    try {
      const results = await autoMainGrpcClient.getBatchDataColumnarStreamed(request);
      results.forEach(data => {
        event.sender.send('grpc-stream-data', {
          requestId: request.requestId,
          type: 'data',
          payload: data
        });
      });
      event.sender.send('grpc-stream-data', {
        requestId: request.requestId,
        type: 'complete'
      });
    } catch (error) {
      event.sender.send('grpc-stream-error', {
        requestId: request.requestId,
        error: error.message
      });
    }
  });

  // Unary method: AnalyzeCsv
  ipcMain.handle('grpc-analyzecsv', async (event, request) => {
    try {
      return await autoMainGrpcClient.analyzeCsv(request);
    } catch (error) {
      console.error('gRPC analyzeCsv failed:', error);
      throw error;
    }
  });

  // Unary method: SendFile
  ipcMain.handle('grpc-sendfile', async (event, request) => {
    try {
      return await autoMainGrpcClient.sendFile(request);
    } catch (error) {
      console.error('gRPC sendFile failed:', error);
      throw error;
    }
  });

  // Unary method: GetLoadedDataStats
  ipcMain.handle('grpc-getloadeddatastats', async (event, request) => {
    try {
      return await autoMainGrpcClient.getLoadedDataStats(request);
    } catch (error) {
      console.error('gRPC getLoadedDataStats failed:', error);
      throw error;
    }
  });

  // Unary method: GetLoadedDataChunk
  ipcMain.handle('grpc-getloadeddatachunk', async (event, request) => {
    try {
      return await autoMainGrpcClient.getLoadedDataChunk(request);
    } catch (error) {
      console.error('gRPC getLoadedDataChunk failed:', error);
      throw error;
    }
  });

  // Unary method: CreateProject
  ipcMain.handle('grpc-createproject', async (event, request) => {
    try {
      return await autoMainGrpcClient.createProject(request);
    } catch (error) {
      console.error('gRPC createProject failed:', error);
      throw error;
    }
  });

  // Unary method: GetProjects
  ipcMain.handle('grpc-getprojects', async (event, request) => {
    try {
      return await autoMainGrpcClient.getProjects(request);
    } catch (error) {
      console.error('gRPC getProjects failed:', error);
      throw error;
    }
  });

  // Unary method: GetProject
  ipcMain.handle('grpc-getproject', async (event, request) => {
    try {
      return await autoMainGrpcClient.getProject(request);
    } catch (error) {
      console.error('gRPC getProject failed:', error);
      throw error;
    }
  });

  // Unary method: UpdateProject
  ipcMain.handle('grpc-updateproject', async (event, request) => {
    try {
      return await autoMainGrpcClient.updateProject(request);
    } catch (error) {
      console.error('gRPC updateProject failed:', error);
      throw error;
    }
  });

  // Unary method: DeleteProject
  ipcMain.handle('grpc-deleteproject', async (event, request) => {
    try {
      return await autoMainGrpcClient.deleteProject(request);
    } catch (error) {
      console.error('gRPC deleteProject failed:', error);
      throw error;
    }
  });

  // Unary method: CreateFile
  ipcMain.handle('grpc-createfile', async (event, request) => {
    try {
      return await autoMainGrpcClient.createFile(request);
    } catch (error) {
      console.error('gRPC createFile failed:', error);
      throw error;
    }
  });

  // Unary method: GetProjectFiles
  ipcMain.handle('grpc-getprojectfiles', async (event, request) => {
    try {
      return await autoMainGrpcClient.getProjectFiles(request);
    } catch (error) {
      console.error('gRPC getProjectFiles failed:', error);
      throw error;
    }
  });

  // Unary method: DeleteFile
  ipcMain.handle('grpc-deletefile', async (event, request) => {
    try {
      return await autoMainGrpcClient.deleteFile(request);
    } catch (error) {
      console.error('gRPC deleteFile failed:', error);
      throw error;
    }
  });

  // Unary method: GetProjectDatasets
  ipcMain.handle('grpc-getprojectdatasets', async (event, request) => {
    try {
      return await autoMainGrpcClient.getProjectDatasets(request);
    } catch (error) {
      console.error('gRPC getProjectDatasets failed:', error);
      throw error;
    }
  });

  // Unary method: AnalyzeCsvForProject
  ipcMain.handle('grpc-analyzecsvforproject', async (event, request) => {
    try {
      return await autoMainGrpcClient.analyzeCsvForProject(request);
    } catch (error) {
      console.error('gRPC analyzeCsvForProject failed:', error);
      throw error;
    }
  });

  // Unary method: ProcessDataset
  ipcMain.handle('grpc-processdataset', async (event, request) => {
    try {
      return await autoMainGrpcClient.processDataset(request);
    } catch (error) {
      console.error('gRPC processDataset failed:', error);
      throw error;
    }
  });

  // Unary method: GetDatasetData
  ipcMain.handle('grpc-getdatasetdata', async (event, request) => {
    try {
      return await autoMainGrpcClient.getDatasetData(request);
    } catch (error) {
      console.error('gRPC getDatasetData failed:', error);
      throw error;
    }
  });

  console.log('✅ Auto-generated gRPC IPC handlers registered successfully');
}
