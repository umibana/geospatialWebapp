import { ipcMain } from 'electron';
import { BACKEND_CHANNELS } from './backend-channels';
import { backendManager } from '../../backend_helpers';

export function registerBackendListeners() {
  ipcMain.handle(BACKEND_CHANNELS.GET_BACKEND_URL, () => {
    return backendManager.getBackendUrl();
  });

  ipcMain.handle(BACKEND_CHANNELS.HEALTH_CHECK, async () => {
    return await backendManager.healthCheck();
  });

  ipcMain.handle(BACKEND_CHANNELS.RESTART_BACKEND, async () => {
    await backendManager.stopBackend();
    return await backendManager.startBackend();
  });
} 