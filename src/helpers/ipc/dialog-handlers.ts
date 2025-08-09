import { ipcMain, dialog } from 'electron';

export function registerDialogHandlers() {
  console.log('📂 Registering dialog IPC handlers...');

  // Handle file open dialog
  ipcMain.handle('dialog:openFile', async (event, options) => {
    try {
      const result = await dialog.showOpenDialog(options);
      return result;
    } catch (error) {
      console.error('Dialog openFile failed:', error);
      throw error;
    }
  });

  // Handle file save dialog
  ipcMain.handle('dialog:saveFile', async (event, options) => {
    try {
      const result = await dialog.showSaveDialog(options);
      return result;
    } catch (error) {
      console.error('Dialog saveFile failed:', error);
      throw error;
    }
  });

  console.log('✅ Dialog IPC handlers registered successfully');
}