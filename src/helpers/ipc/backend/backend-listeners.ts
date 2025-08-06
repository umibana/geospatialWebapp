import { ipcMain } from 'electron';
import { BACKEND_CHANNELS } from './backend-channels';
import { backendManager } from '../../backend_helpers';
import { autoMainGrpcClient } from '../../../grpc-auto/auto-main-client';

export function registerBackendListeners() {
  ipcMain.handle(BACKEND_CHANNELS.GET_BACKEND_URL, () => {
    return backendManager.getBackendUrl();
  });

  ipcMain.handle(BACKEND_CHANNELS.HEALTH_CHECK, async () => {
    // Use gRPC health check instead of basic process check
    if (!backendManager.isBackendRunning()) {
      return { healthy: false, status: 'backend not running' };
    }
    
    try {
      return await autoMainGrpcClient.healthCheck();
    } catch (error) {
      return { healthy: false, status: 'gRPC connection failed' };
    }
  });

  ipcMain.handle(BACKEND_CHANNELS.RESTART_BACKEND, async () => {
    await backendManager.stopBackend();
    await backendManager.startBackend();
    // Re-initialize gRPC client after restart
    await autoMainGrpcClient.initialize();
    return { success: true };
  });
} 