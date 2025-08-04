// Web Worker Manager for handling data processing without blocking the main thread

import { WorkerMessage, WorkerResponse, DataPoint } from '../workers/dataProcessor.worker';

export class WebWorkerManager {
  private worker: Worker | null = null;
  private pendingTasks = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    onProgress?: (progress: any) => void;
  }>();

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker() {
    try {
      // Create worker from the TypeScript file
      // Vite will handle the worker compilation
      this.worker = new Worker(
        new URL('../workers/dataProcessor.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { type, payload, id } = event.data;
        const task = this.pendingTasks.get(id);

        if (!task) {
          console.warn(`No pending task found for ID: ${id}`);
          return;
        }

        switch (type) {
          case 'DATA_PROCESSED':
          case 'CHUNK_PROCESSED':
          case 'STATS_CALCULATED':
          case 'STORED_DATASET_PROCESSED':
            task.resolve(payload);
            this.pendingTasks.delete(id);
            break;

          case 'PROGRESS':
            if (task.onProgress) {
              task.onProgress(payload);
            }
            break;

          case 'ERROR':
            task.reject(new Error(payload.error));
            this.pendingTasks.delete(id);
            break;

          default:
            console.warn(`Unknown worker response type: ${type}`);
        }
      };

      this.worker.onerror = (error) => {
        console.error('Worker error:', error);
        // Reject all pending tasks
        this.pendingTasks.forEach(task => {
          task.reject(new Error('Worker error occurred'));
        });
        this.pendingTasks.clear();
      };

      console.log('✅ Web Worker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Web Worker:', error);
    }
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Process large dataset in chunks without blocking the main thread
   */
  async processLargeDataset(
    dataPoints: DataPoint[],
    options: {
      chunkSize?: number;
      onProgress?: (progress: { processed: number; total: number; percentage: number; chunk: any[] }) => void;
    } = {}
  ): Promise<{ totalProcessed: number; completed: boolean }> {
    if (!this.worker) {
      throw new Error('Web Worker not initialized');
    }

    const taskId = this.generateTaskId();
    
    return new Promise((resolve, reject) => {
      this.pendingTasks.set(taskId, {
        resolve,
        reject,
        onProgress: options.onProgress
      });

      const message: WorkerMessage = {
        type: 'PROCESS_DATA',
        payload: {
          dataPoints,
          chunkSize: options.chunkSize || 5000
        },
        id: taskId
      };

      this.worker!.postMessage(message);
    });
  }

  /**
   * Process a single chunk of data
   */
  async processDataChunk(
    chunk: DataPoint[],
    chunkIndex: number
  ): Promise<{ chunkIndex: number; processedChunk: any[]; pointCount: number }> {
    if (!this.worker) {
      throw new Error('Web Worker not initialized');
    }

    const taskId = this.generateTaskId();
    
    return new Promise((resolve, reject) => {
      this.pendingTasks.set(taskId, { resolve, reject });

      const message: WorkerMessage = {
        type: 'PROCESS_CHUNK',
        payload: { chunk, chunkIndex },
        id: taskId
      };

      this.worker!.postMessage(message);
    });
  }

  /**
   * Calculate statistics for a dataset
   */
  async calculateDataStats(
    dataPoints: DataPoint[]
  ): Promise<{ stats: any }> {
    if (!this.worker) {
      throw new Error('Web Worker not initialized');
    }

    const taskId = this.generateTaskId();
    
    return new Promise((resolve, reject) => {
      this.pendingTasks.set(taskId, { resolve, reject });

      const message: WorkerMessage = {
        type: 'CALCULATE_STATS',
        payload: { dataPoints },
        id: taskId
      };

      this.worker!.postMessage(message);
    });
  }

  /**
   * Terminate the worker and clean up
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingTasks.clear();
    console.log('🛑 Web Worker terminated');
  }

  /**
   * Process dataset stored in IndexedDB (non-blocking approach)
   */
  async processStoredDataset(
    datasetId: string,
    options: {
      chunkSize?: number;
      onProgress?: (progress: { processed: number; total: number; percentage: number; chunk: any[]; source?: string }) => void;
    } = {}
  ): Promise<{ totalProcessed: number; completed: boolean; datasetId: string }> {
    if (!this.worker) {
      throw new Error('Web Worker not initialized');
    }

    const taskId = this.generateTaskId();
    
    return new Promise((resolve, reject) => {
      this.pendingTasks.set(taskId, {
        resolve,
        reject,
        onProgress: options.onProgress
      });

      const message: WorkerMessage = {
        type: 'PROCESS_STORED_DATASET',
        payload: {
          datasetId,
          chunkSize: options.chunkSize || 5000
        },
        id: taskId
      };

      this.worker!.postMessage(message);
    });
  }

  /**
   * Check if worker is available
   */
  isAvailable(): boolean {
    return this.worker !== null;
  }
}

// Singleton instance
export const webWorkerManager = new WebWorkerManager();