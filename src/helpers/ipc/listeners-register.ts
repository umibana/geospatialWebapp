import { BrowserWindow } from "electron";
import { addThemeEventListeners } from "./theme/theme-listeners";
import { addWindowEventListeners } from "./window/window-listeners";
import { registerBackendListeners } from "./backend/backend-listeners";
import { registerDialogHandlers } from "./dialog-handlers";

export default function registerListeners(mainWindow: BrowserWindow) {
  addWindowEventListeners(mainWindow);
  addThemeEventListeners();
  registerBackendListeners();
  registerDialogHandlers();
}
