/**
 * Web Worker Manager for handling real Web Workers
 * Provides a clean interface for data processing operations
 */

import { WorkerMessage, WorkerResponse } from '../workers/dataProcessor.worker';

export interface ProgressCallback {
  (progress: {
    phase: string;
    processed: number;
    total: number;
    percentage: number;
    chunkNumber?: number;
    totalChunks?: number;
    chunkProcessingTime?: number;
  }): void;
}

export interface ChartConfig {
  type: 'scatter' | 'heatmap' | 'line';
  data: number[][];
  metadata: {
    totalPoints: number;
    chartPoints: number;
    samplingRatio: number;
    bounds: {
      lng: [number, number];
      lat: [number, number];
      value: [number, number];
    };
  };
}

export interface ProcessingStats {
  totalProcessed: number;
  avgValue: number;
  minValue: number;
  maxValue: number;
  dataTypes: string[];
  processingTime?: number;
  elapsedTime?: number;
  pointsPerSecond: number;
  memoryUsage?: {
    processedPointsCount: number;
    estimatedMemoryMB: number;
  };
}

export class WebWorkerManager {
  private worker: Worker | null = null;
  private activeRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    onProgress?: ProgressCallback;
    onChunkProcessed?: (data: any) => void;
  }>();

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker() {
    try {
      // Create worker from the TypeScript file (Vite handles compilation)
      this.worker = new Worker(
        new URL('../workers/dataProcessor.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);
      
      console.log('🔧 WebWorkerManager: Data processing worker initialized');
    } catch (error) {
      console.error('❌ Failed to initialize data processing worker:', error);
      throw new Error('Web Worker initialization failed');
    }
  }

  private handleWorkerMessage(event: MessageEvent<WorkerResponse>) {
    const { type, requestId, data, error } = event.data;
    
    const request = this.activeRequests.get(requestId);
    
    switch (type) {
      case 'progress':
        if (request?.onProgress && data) {
          request.onProgress(data);
        }
        break;
        
      case 'chunk_processed':
        if (request?.onChunkProcessed && data) {
          request.onChunkProcessed(data);
        }
        break;
        
      case 'stats_ready':
      case 'chart_data_ready':
      case 'complete':
        if (request) {
          request.resolve(data);
          if (type === 'complete') {
            this.activeRequests.delete(requestId);
          }
        }
        break;
        
      case 'error':
        if (request) {
          request.reject(new Error(error || 'Worker processing failed'));
          this.activeRequests.delete(requestId);
        } else {
          console.error('❌ Worker error:', error);
        }
        break;
        
      default:
        console.warn('🟡 Unknown worker message type:', type);
    }
  }

  private handleWorkerError(error: ErrorEvent) {
    console.error('❌ Worker error:', error);
    
    // Reject all pending requests
    for (const [requestId, request] of this.activeRequests) {
      request.reject(new Error(`Worker error: ${error.message}`));
    }
    this.activeRequests.clear();
    
    // Try to reinitialize worker
    try {
      this.initializeWorker();
    } catch (reinitError) {
      console.error('❌ Failed to reinitialize worker after error:', reinitError);
    }
  }

  private sendMessage(message: WorkerMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      this.activeRequests.set(message.requestId, { resolve, reject });
      this.worker.postMessage(message);
    });
  }

  /**
   * Process a chunk of data points
   */
  processChunk(
    chunk: any,
    onProgress?: ProgressCallback,
    onChunkProcessed?: (data: any) => void
  ): Promise<any> {
    const requestId = `chunk-${Date.now()}-${Math.random()}`;
    
    // Store callbacks
    if (onProgress || onChunkProcessed) {
      const existingRequest = this.activeRequests.get(requestId) || { resolve: () => {}, reject: () => {} };
      this.activeRequests.set(requestId, {
        ...existingRequest,
        onProgress,
        onChunkProcessed
      });
    }
    
    return this.sendMessage({
      type: 'process_chunk',
      requestId,
      data: chunk
    });
  }

  /**
   * Get current processing statistics
   */
  async getCurrentStats(): Promise<ProcessingStats> {
    const requestId = `stats-${Date.now()}-${Math.random()}`;
    return this.sendMessage({
      type: 'get_stats',
      requestId
    });
  }

  /**
   * Prepare optimized data for ECharts visualization
   */
  async prepareChartData(options: {
    maxPoints?: number;
    chartType?: 'scatter' | 'heatmap' | 'line';
  } = {}): Promise<ChartConfig> {
    const requestId = `chart-${Date.now()}-${Math.random()}`;
    return this.sendMessage({
      type: 'prepare_chart_data',
      requestId,
      data: options
    });
  }

  /**
   * Finalize processing session
   */
  async finalizeProcessing(): Promise<ProcessingStats> {
    const requestId = `finalize-${Date.now()}-${Math.random()}`;
    return this.sendMessage({
      type: 'finalize_processing',
      requestId
    });
  }

  /**
   * Process multiple chunks with progress tracking
   */
  async processAllChunks(
    chunks: any[],
    onProgress?: ProgressCallback,
    onChunkProcessed?: (data: any) => void
  ): Promise<ProcessingStats> {
    let lastResult: any = null;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = {
        ...chunks[i],
        chunk_number: i + 1,
        total_chunks: chunks.length,
        is_final_chunk: i === chunks.length - 1
      };
      
      try {
        lastResult = await this.processChunk(chunk, onProgress, onChunkProcessed);
      } catch (error) {
        console.error(`❌ Failed to process chunk ${i + 1}/${chunks.length}:`, error);
        throw error;
      }
    }
    
    return lastResult;
  }

  /**
   * Terminate the worker and cleanup
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    // Reject all pending requests
    for (const [requestId, request] of this.activeRequests) {
      request.reject(new Error('Worker terminated'));
    }
    this.activeRequests.clear();
    
    console.log('🔧 WebWorkerManager: Worker terminated');
  }

  /**
   * Check if worker is ready
   */
  isReady(): boolean {
    return this.worker !== null;
  }

  /**
   * Get number of active requests
   */
  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }
}

// Singleton instance for global use
export const webWorkerManager = new WebWorkerManager();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    webWorkerManager.terminate();
  });
}