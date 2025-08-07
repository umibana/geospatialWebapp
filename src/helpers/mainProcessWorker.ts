/**
 * Main Process Worker - Heavy Processing in Electron Main Process
 * Uses Worker Threads for true parallel processing without external dependencies
 * No JSON files, no external Node.js requirement
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as path from 'path';

export interface ProcessingResult {
  stats: {
    totalProcessed: number;
    avgValue: number;
    minValue: number;
    maxValue: number;
    dataTypes: string[];
    processingTime: number;
    pointsPerSecond: number;
  };
  chartConfig: {
    type: string;
    data: Array<[number, number, number]>;
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
  };
}

// Worker thread code (runs in separate thread)
if (!isMainThread) {
  const { chunks, requestId } = workerData;
  
  let processedPoints: Array<{ lng: number; lat: number; value: number }> = [];
  let stats = {
    totalProcessed: 0,
    minValue: Infinity,
    maxValue: -Infinity,
    sum: 0,
    dataTypes: new Set<string>()
  };
  
  const startTime = performance.now();
  
  // Helper function to process chunks with micro-batching
  const processMicroBatch = async (startChunkIndex: number, endChunkIndex: number) => {
    for (let chunkIndex = startChunkIndex; chunkIndex < endChunkIndex; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      
      if (chunk.data_points) {
        // Process points in micro-batches to prevent blocking
        const pointBatchSize = 1000;
        for (let i = 0; i < chunk.data_points.length; i += pointBatchSize) {
          const batchEnd = Math.min(i + pointBatchSize, chunk.data_points.length);
          
          for (let j = i; j < batchEnd; j++) {
            const point = chunk.data_points[j];
            
            // Store essential data for charting
            if (processedPoints.length < 100000) {
              processedPoints.push({
                lng: point.location.longitude,
                lat: point.location.latitude,
                value: point.value
              });
            }
            
            // Update statistics
            stats.totalProcessed++;
            stats.sum += point.value;
            stats.minValue = Math.min(stats.minValue, point.value);
            stats.maxValue = Math.max(stats.maxValue, point.value);
            
            if (point.metadata?.sensor_type) {
              stats.dataTypes.add(point.metadata.sensor_type);
            }
          }
          
          // Yield control after each micro-batch to prevent blocking
          if (batchEnd < chunk.data_points.length) {
            await new Promise(resolve => setImmediate(resolve));
          }
        }
      }
      
      // Send progress update every chunk
      if (chunkIndex % 3 === 0) {
        parentPort?.postMessage({
          type: 'progress',
          requestId,
          processed: stats.totalProcessed,
          total: chunks.reduce((sum: number, c: any) => sum + (c.data_points?.length || 0), 0),
          percentage: ((chunkIndex + 1) / chunks.length) * 100,
          phase: `worker_processing_chunk_${chunkIndex + 1}_of_${chunks.length}`
        });
      }
    }
  };
  
  // Process all chunks in small batches with yielding
  const chunkBatchSize = 3; // Process 3 chunks at a time
  for (let i = 0; i < chunks.length; i += chunkBatchSize) {
    const endIndex = Math.min(i + chunkBatchSize, chunks.length);
    await processMicroBatch(i, endIndex);
    
    // Yield control between chunk batches to keep thread responsive
    await new Promise(resolve => setImmediate(resolve));
  }
  
  const endTime = performance.now();
  const processingTime = (endTime - startTime) / 1000;
  const avgValue = stats.totalProcessed > 0 ? stats.sum / stats.totalProcessed : 0;
  
  // Prepare chart data
  let chartData: Array<[number, number, number]> = [];
  const maxChartPoints = 10000;
  
  if (processedPoints.length > maxChartPoints) {
    const step = Math.floor(processedPoints.length / maxChartPoints);
    for (let i = 0; i < processedPoints.length; i += step) {
      const point = processedPoints[i];
      chartData.push([point.lng, point.lat, point.value]);
    }
  } else {
    chartData = processedPoints.map(p => [p.lng, p.lat, p.value]);
  }
  
  const result: ProcessingResult = {
    stats: {
      totalProcessed: stats.totalProcessed,
      avgValue: Number(avgValue.toFixed(2)),
      minValue: Number(stats.minValue.toFixed(2)),
      maxValue: Number(stats.maxValue.toFixed(2)),
      dataTypes: Array.from(stats.dataTypes),
      processingTime: Number(processingTime.toFixed(3)),
      pointsPerSecond: Math.round(stats.totalProcessed / processingTime)
    },
    chartConfig: {
      type: 'scatter',
      data: chartData,
      metadata: {
        totalPoints: stats.totalProcessed,
        chartPoints: chartData.length,
        samplingRatio: chartData.length / processedPoints.length,
        bounds: {
          lng: [
            Math.min(...chartData.map(p => p[0])),
            Math.max(...chartData.map(p => p[0]))
          ],
          lat: [
            Math.min(...chartData.map(p => p[1])),
            Math.max(...chartData.map(p => p[1]))
          ],
          value: [
            Math.min(...chartData.map(p => p[2])),
            Math.max(...chartData.map(p => p[2]))
          ]
        }
      }
    }
  };
  
  // Send final result
  parentPort?.postMessage({
    type: 'complete',
    requestId,
    result
  });
}

// Main thread functions
export class MainProcessWorker {
  private static instance: MainProcessWorker | null = null;
  
  public static getInstance(): MainProcessWorker {
    if (!MainProcessWorker.instance) {
      MainProcessWorker.instance = new MainProcessWorker();
    }
    return MainProcessWorker.instance;
  }
  
  public async processLargeDataset(
    chunks: any[],
    requestId: string,
    onProgress: (progress: { processed: number; total: number; percentage: number; phase: string }) => void
  ): Promise<ProcessingResult> {
    
    return new Promise((resolve, reject) => {
      // Create worker thread with data
      const worker = new Worker(__filename, {
        workerData: { chunks, requestId }
      });
      
      worker.on('message', (message) => {
        if (message.requestId === requestId) {
          if (message.type === 'progress') {
            onProgress({
              processed: message.processed,
              total: message.total,
              percentage: message.percentage,
              phase: message.phase
            });
          } else if (message.type === 'complete') {
            worker.terminate();
            resolve(message.result);
          }
        }
      });
      
      worker.on('error', (error) => {
        worker.terminate();
        reject(error);
      });
      
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }
}