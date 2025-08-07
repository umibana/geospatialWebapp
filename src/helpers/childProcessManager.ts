/**
 * Node.js Child Process Manager for Heavy Data Processing
 * Bypasses Electron IPC limitations for maximum performance
 * This runs ONLY in the main process, not in the renderer
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ChildProcessStats {
  totalProcessed: number;
  avgValue: number;
  minValue: number;
  maxValue: number;
  dataTypes: string[];
  processingTime?: number;
  elapsedTime?: number;
  pointsPerSecond: number;
  memoryUsage: {
    storedPoints: number;
    estimatedMemoryMB?: number;
    totalProcessed?: number;
  };
}

export interface ChartConfig {
  type: string;
  data: Array<[number, number, number]>;
  metadata: {
    totalPoints: number;
    storedPoints: number;
    chartPoints: number;
    samplingRatio: number;
    bounds: {
      lng: [number, number];
      lat: [number, number];
      value: [number, number];
    };
  };
}

export interface ProcessingChunk {
  data_points: Array<{
    id: string;
    location: { latitude: number; longitude: number; altitude?: number };
    value: number;
    unit: string;
    timestamp: number;
    metadata: Record<string, string>;
  }>;
  chunk_number: number;
  total_chunks: number;
  points_in_chunk: number;
  is_final_chunk: boolean;
  generation_method: string;
}

class ChildProcessManager {
  private worker: Worker | null = null;
  private messageHandlers: Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    onProgress?: (progress: any) => void;
    onChunkProcessed?: (data: any) => void;
  }> = new Map();

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      // Path to the Node.js child process worker
      const workerPath = path.join(__dirname, '../workers/dataProcessorChild.js');
      console.log('🔧 Initializing Node.js child process for heavy data processing...');
      
      this.worker = new Worker(workerPath);
      
      this.worker.on('message', (message) => {
        this.handleWorkerMessage(message);
      });
      
      this.worker.on('error', (error) => {
        console.error('❌ Child process error:', error);
        // Reject all pending promises
        for (const [requestId, handler] of this.messageHandlers) {
          handler.reject(new Error(`Child process error: ${error.message}`));
        }
        this.messageHandlers.clear();
      });
      
      this.worker.on('exit', (code) => {
        console.log(`🔄 Child process exited with code ${code}`);
        this.worker = null;
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize child process:', error);
      this.worker = null;
    }
  }

  private handleWorkerMessage(message: any) {
    const { type, requestId, data, error } = message;
    const handler = this.messageHandlers.get(requestId);
    
    if (!handler) {
      console.log(`⚠️ No handler found for request ${requestId}`);
      return;
    }
    
    switch (type) {
      case 'progress':
        if (handler.onProgress) {
          handler.onProgress(data);
        }
        break;
        
      case 'chunk_processed':
        if (handler.onChunkProcessed) {
          handler.onChunkProcessed(data);
        }
        break;
        
      case 'stats_ready':
      case 'chart_data_ready':
        handler.resolve(data);
        this.messageHandlers.delete(requestId);
        break;
        
      case 'complete':
        handler.resolve(data);
        this.messageHandlers.delete(requestId);
        break;
        
      case 'error':
        handler.reject(new Error(error));
        this.messageHandlers.delete(requestId);
        break;
    }
  }

  private generateRequestId(): string {
    return `child-${Date.now()}-${Math.random()}`;
  }

  public isReady(): boolean {
    return this.worker !== null;
  }

  public async processChunk(
    chunk: ProcessingChunk,
    onProgress?: (progress: any) => void,
    onChunkProcessed?: (data: any) => void
  ): Promise<any> {
    if (!this.worker) {
      throw new Error('Child process not initialized');
    }

    const requestId = this.generateRequestId();
    
    return new Promise((resolve, reject) => {
      this.messageHandlers.set(requestId, { resolve, reject, onProgress, onChunkProcessed });
      
      this.worker!.postMessage({
        type: 'process_chunk',
        requestId,
        data: chunk
      });
    });
  }

  public async getCurrentStats(): Promise<ChildProcessStats> {
    if (!this.worker) {
      throw new Error('Child process not initialized');
    }

    const requestId = this.generateRequestId();
    
    return new Promise((resolve, reject) => {
      this.messageHandlers.set(requestId, { resolve, reject });
      
      this.worker!.postMessage({
        type: 'get_stats',
        requestId
      });
    });
  }

  public async prepareChartData(options: {
    maxPoints?: number;
    chartType?: 'scatter' | 'heatmap' | 'line';
  } = {}): Promise<ChartConfig> {
    if (!this.worker) {
      throw new Error('Child process not initialized');
    }

    const requestId = this.generateRequestId();
    
    return new Promise((resolve, reject) => {
      this.messageHandlers.set(requestId, { resolve, reject });
      
      this.worker!.postMessage({
        type: 'prepare_chart_data',
        requestId,
        data: options
      });
    });
  }

  public async finalizeProcessing(): Promise<ChildProcessStats> {
    if (!this.worker) {
      throw new Error('Child process not initialized');
    }

    const requestId = this.generateRequestId();
    
    return new Promise((resolve, reject) => {
      this.messageHandlers.set(requestId, { resolve, reject });
      
      this.worker!.postMessage({
        type: 'finalize_processing',
        requestId
      });
    });
  }

  public terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.messageHandlers.clear();
  }
}

// Singleton instance
export const childProcessManager = new ChildProcessManager();