/**
 * Main Process Worker - Heavy Processing in Electron Main Process
 * Uses Worker Threads for true parallel processing without external dependencies
 * No JSON files, no external Node.js requirement
 */

import { Worker } from 'worker_threads';

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

// Removed unused non-main-thread code; we use eval workers below

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
    chunks: Array<{ 
      columnar_data: { id: string[]; x: number[]; y: number[]; z: number[]; id_value: string[]; additional_data: Record<string, number[]> };
    }>,
    requestId: string,
    onProgress: (progress: { processed: number; total: number; percentage: number; phase: string }) => void
  ): Promise<ProcessingResult> {
    
    return new Promise((resolve, reject) => {
      // Inline worker code to avoid bundler pointing to main bundle (__filename)
      const workerCode = `
        const { parentPort, workerData } = require('worker_threads');
        (async () => {
          const { chunks, requestId } = workerData;
          let processedPoints = [];
          const stats = { totalProcessed: 0, minValue: Infinity, maxValue: -Infinity, sum: 0, dataTypes: new Set() };
          const startTime = globalThis.performance ? performance.now() : Date.now();

          const processMicroBatch = async (startChunkIndex, endChunkIndex) => {
            for (let chunkIndex = startChunkIndex; chunkIndex < endChunkIndex; chunkIndex++) {
              const chunk = chunks[chunkIndex];
              const data = chunk.columnar_data;
              const pointCount = data.x ? data.x.length : 0;
              const pointBatchSize = 1000;
              
              for (let i = 0; i < pointCount; i += pointBatchSize) {
                const batchEnd = Math.min(i + pointBatchSize, pointCount);
                for (let j = i; j < batchEnd; j++) {
                  const MAX_SAMPLE = 50000; // Increased for better representation of large datasets
                  const currentCount = stats.totalProcessed + 1;
                  if (processedPoints.length < MAX_SAMPLE) {
                    processedPoints.push({ lng: data.x[j], lat: data.y[j], value: data.z[j] });
                  } else {
                    const replaceIndex = Math.floor(Math.random() * currentCount);
                    if (replaceIndex < MAX_SAMPLE) {
                      processedPoints[replaceIndex] = { lng: data.x[j], lat: data.y[j], value: data.z[j] };
                    }
                  }
                  stats.totalProcessed++;
                  stats.sum += data.z[j];
                  stats.minValue = Math.min(stats.minValue, data.z[j]);
                  stats.maxValue = Math.max(stats.maxValue, data.z[j]);
                }
                
                // Add data types from additional columns
                Object.keys(data.additional_data || {}).forEach(key => {
                  stats.dataTypes.add(key);
                });
                
                if (batchEnd < pointCount) { await new Promise(r => setImmediate(r)); }
              }
              
              if (chunkIndex % 3 === 0) {
                const total = chunks.reduce((sum, c) => {
                  return sum + (c.columnar_data.x ? c.columnar_data.x.length : 0);
                }, 0);
                const phaseText = 'worker_processing_chunk_' + (chunkIndex + 1) + '_of_' + chunks.length;
                parentPort.postMessage({ type: 'progress', requestId, processed: stats.totalProcessed, total, percentage: ((chunkIndex + 1) / chunks.length) * 100, phase: phaseText });
              }
            }
          };

          const chunkBatchSize = 3;
          for (let i = 0; i < chunks.length; i += chunkBatchSize) {
            const endIndex = Math.min(i + chunkBatchSize, chunks.length);
            await processMicroBatch(i, endIndex);
            await new Promise(r => setImmediate(r));
          }

          const endTime = globalThis.performance ? performance.now() : Date.now();
          const processingTime = ((endTime - startTime) / 1000);
          const avgValue = stats.totalProcessed > 0 ? stats.sum / stats.totalProcessed : 0;
          const chartData = processedPoints.map(p => [p.lng, p.lat, p.value]);
          const result = {
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
                samplingRatio: chartData.length / (processedPoints.length || 1),
                bounds: {
                  lng: [Math.min(...chartData.map(p => p[0])), Math.max(...chartData.map(p => p[0]))],
                  lat: [Math.min(...chartData.map(p => p[1])), Math.max(...chartData.map(p => p[1]))],
                  value: [Math.min(...chartData.map(p => p[2])), Math.max(...chartData.map(p => p[2]))]
                }
              }
            }
          };
          parentPort.postMessage({ type: 'complete', requestId, result });
        })().catch(err => {
          parentPort.postMessage({ type: 'error', requestId, error: err && err.message ? err.message : String(err) });
        });
      `;

      const worker = new Worker(workerCode, { eval: true, workerData: { chunks, requestId } });

      worker.on('message', (message) => {
        if (message.requestId === requestId) {
          if (message.type === 'progress') {
            onProgress({ processed: message.processed, total: message.total, percentage: message.percentage, phase: message.phase });
          } else if (message.type === 'complete') {
            worker.terminate();
            resolve(message.result);
          } else if (message.type === 'error') {
            worker.terminate();
            reject(new Error(message.error || 'Worker error'));
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

  // Incremental streaming API: create a worker that accepts chunks over time
  public startStreamingProcessor(
    requestId: string,
    onProgress: (progress: { processed: number; total: number; percentage: number; phase: string }) => void
  ): { postChunk: (chunk: { columnar_data: { id: string[]; x: number[]; y: number[]; z: number[]; id_value: string[]; additional_data: Record<string, number[]> }; total_chunks?: number }) => void; finalize: () => Promise<ProcessingResult>; terminate: () => void; onWorkerMessage: (handler: (msg: unknown) => void) => void } {
    const workerCode = `
      const { parentPort } = require('worker_threads');
      let processedPoints = [];
      const stats = { totalProcessed: 0, minValue: Infinity, maxValue: -Infinity, sum: 0, dataTypes: new Set() };
      const startTime = globalThis.performance ? performance.now() : Date.now();
      let chunksSeen = 0;
      let totalChunksHint = null;
      let totalPointsExpected = 0;

      async function processChunk(chunk) {
        const data = chunk.columnar_data;
        const pointCount = data.x ? data.x.length : 0;
        const chunkPoints = data.points_in_chunk || pointCount;
        const pointBatchSize = 1000;
        
        for (let i = 0; i < pointCount; i += pointBatchSize) {
          const batchEnd = Math.min(i + pointBatchSize, pointCount);
          for (let j = i; j < batchEnd; j++) {
            const MAX_SAMPLE = 50000; // Increased for better representation of large datasets
            const currentCount = stats.totalProcessed + 1;
            if (processedPoints.length < MAX_SAMPLE) {
              processedPoints.push({ lng: data.x[j], lat: data.y[j], value: data.z[j] });
            } else {
              const replaceIndex = Math.floor(Math.random() * currentCount);
              if (replaceIndex < MAX_SAMPLE) {
                processedPoints[replaceIndex] = { lng: data.x[j], lat: data.y[j], value: data.z[j] };
              }
            }
            stats.totalProcessed++;
            stats.sum += data.z[j];
            stats.minValue = Math.min(stats.minValue, data.z[j]);
            stats.maxValue = Math.max(stats.maxValue, data.z[j]);
          }
          
          // Add data types from additional columns
          Object.keys(data.additional_data || {}).forEach(key => {
            stats.dataTypes.add(key);
          });
          
          if (batchEnd < pointCount) { await new Promise(r => setImmediate(r)); }
        }
      }

      parentPort.on('message', async (msg) => {
        if (!msg || !msg.type) return;
        if (msg.type === 'chunk') {
          chunksSeen += 1;
          const chunkData = msg.chunk.columnar_data;
          const chunkPointCount = chunkData.points_in_chunk || (chunkData.x ? chunkData.x.length : 0);
          if (msg.totalChunks && totalChunksHint == null) totalChunksHint = msg.totalChunks;
          totalPointsExpected += chunkPointCount;
          await processChunk(msg.chunk);
          const percentage = totalChunksHint ? (chunksSeen / totalChunksHint) * 100 : 0;
          parentPort.postMessage({ type: 'progress', processed: stats.totalProcessed, total: totalPointsExpected, percentage, phase: 'worker_stream_chunk_' + chunksSeen + (totalChunksHint ? ('_of_' + totalChunksHint) : '') });
          parentPort.postMessage({ type: 'chunk_done' });
        } else if (msg.type === 'end') {
          const endTime = globalThis.performance ? performance.now() : Date.now();
          const processingTime = ((endTime - startTime) / 1000);
          const avgValue = stats.totalProcessed > 0 ? stats.sum / stats.totalProcessed : 0;
          const chartData = processedPoints.map(p => [p.lng, p.lat, p.value]);
          const result = {
            stats: {
              totalProcessed: stats.totalProcessed,
              avgValue: Number(avgValue.toFixed(2)),
              minValue: Number(stats.minValue.toFixed(2)),
              maxValue: Number(stats.maxValue.toFixed(2)),
              dataTypes: Array.from(stats.dataTypes),
              processingTime: Number(processingTime.toFixed(3)),
              pointsPerSecond: Math.round(stats.totalProcessed / Math.max(processingTime, 1e-6))
            },
            chartConfig: {
              type: 'scatter',
              data: chartData,
              metadata: {
                totalPoints: stats.totalProcessed,
                chartPoints: chartData.length,
                samplingRatio: chartData.length / Math.max(processedPoints.length || 1, 1),
                bounds: {
                  lng: [Math.min(...chartData.map(p => p[0])), Math.max(...chartData.map(p => p[0]))],
                  lat: [Math.min(...chartData.map(p => p[1])), Math.max(...chartData.map(p => p[1]))],
                  value: [Math.min(...chartData.map(p => p[2])), Math.max(...chartData.map(p => p[2]))]
                }
              }
            }
          };
          parentPort.postMessage({ type: 'complete', result });
        } else if (msg.type === 'abort') {
          parentPort.postMessage({ type: 'error', error: 'aborted' });
        }
      });
    `;

    const worker = new Worker(workerCode, { eval: true });
    let resolveFinal: ((r: ProcessingResult) => void) | null = null;
    let rejectFinal: ((e: Error) => void) | null = null;
    const finalizePromise = new Promise<ProcessingResult>((resolve, reject) => { resolveFinal = resolve; rejectFinal = reject; });

    const messageHandler = (message: { type: string; processed?: number; total?: number; percentage?: number; phase?: string; result?: ProcessingResult; error?: string }) => {
      if (message.type === 'progress') {
        onProgress({
          processed: message.processed ?? 0,
          total: message.total ?? 0,
          percentage: message.percentage ?? 0,
          phase: message.phase ?? 'processing'
        });
      } else if (message.type === 'chunk_done') {
        // no-op, used for backpressure control by caller
      } else if (message.type === 'complete') {
        worker.terminate();
        if (message.result && resolveFinal) {
          resolveFinal(message.result);
        }
      } else if (message.type === 'error') {
        worker.terminate();
        if (rejectFinal) {
          rejectFinal(new Error(message.error || 'Worker stream error'));
        }
      }
    };
    worker.on('message', messageHandler);
    worker.on('error', (err: Error) => { worker.terminate(); if (rejectFinal) { rejectFinal(err); } });
    worker.on('exit', (code) => { if (code !== 0 && rejectFinal) { rejectFinal(new Error('Worker exited with code ' + String(code))); } });

    return {
      postChunk: (chunk: { columnar_data: { id: string[]; x: number[]; y: number[]; z: number[]; id_value: string[]; additional_data: Record<string, number[]>; points_in_chunk?: number } }) => { worker.postMessage({ type: 'chunk', chunk }); },
      finalize: () => { worker.postMessage({ type: 'end' }); return finalizePromise; },
      terminate: () => { try { worker.postMessage({ type: 'abort' }); } catch { /* ignore */ } finally { worker.terminate(); } },
      onWorkerMessage: (handler: (msg: unknown) => void) => { worker.on('message', handler as (message: { type: string }) => void); }
    };
  }

  /** CSV series aggregator: accumulates per-metric scatter series [x,y,value,id] with reservoir sampling per series */
  public startCsvSeriesProcessor(
    requestId: string,
    config: { xKey: 'x' | 'y' | 'z'; yKey: 'x' | 'y' | 'z'; metrics: string[]; maxPerSeries?: number },
    onProgress: (progress: { processed: number; total: number; percentage: number; phase: string }) => void
  ): { postRows: (rows: Array<{ x?: number; y?: number; z?: number; id?: string; metrics?: Record<string, number> }>, totalChunks?: number) => void; finalize: () => Promise<{ series: Record<string, Array<[number, number, number, string | undefined]>>; ranges: Record<string, { min: number; max: number }>; total: number; availableMetrics: string[] }>; terminate: () => void } {
    const { xKey, yKey, metrics, maxPerSeries = 10000 } = config;
    const workerCode = `
      const { parentPort } = require('worker_threads');
      const xKey = ${JSON.stringify(xKey)};
      const yKey = ${JSON.stringify(yKey)};
      const metrics = ${JSON.stringify(metrics)};
      const MAX_PER_SERIES = ${JSON.stringify(maxPerSeries)};
      const series = Object.create(null);
      const ranges = Object.create(null);
      const available = new Set();
      for (const m of metrics) { series[m] = []; ranges[m] = { min: Infinity, max: -Infinity }; }
      let totalProcessed = 0;
      let chunksSeen = 0;
      let totalChunksHint = null;
      function isFiniteNumber(v) { return typeof v === 'number' && Number.isFinite(v); }
      function reservoirPush(arr, item) {
        if (MAX_PER_SERIES <= 0) { arr.push(item); return; }
        if (arr.length < MAX_PER_SERIES) { arr.push(item); return; }
        const j = Math.floor(Math.random() * (totalProcessed + 1));
        if (j < MAX_PER_SERIES) arr[j] = item;
      }
      async function processRows(rows) {
        const BATCH = 2000;
        for (let i = 0; i < rows.length; i += BATCH) {
          const end = Math.min(i + BATCH, rows.length);
          for (let j = i; j < end; j++) {
            const row = rows[j] || {};
            const xv = row[xKey];
            const yv = row[yKey];
            const id = row.id;
            const mMap = row.metrics || {};
            if (!isFiniteNumber(xv) || !isFiniteNumber(yv)) { totalProcessed++; continue; }
            for (const m of metrics) {
              const mv = mMap[m];
              if (!isFiniteNumber(mv)) continue;
              available.add(m);
              reservoirPush(series[m], [xv, yv, mv, id]);
              const r = ranges[m];
              if (mv < r.min) r.min = mv;
              if (mv > r.max) r.max = mv;
            }
            totalProcessed++;
          }
          if (end < rows.length) await new Promise(r => setImmediate(r));
        }
      }
      parentPort.on('message', async (msg) => {
        if (!msg || !msg.type) return;
        if (msg.type === 'rows') {
          chunksSeen += 1;
          if (msg.totalChunks && totalChunksHint == null) totalChunksHint = msg.totalChunks;
          await processRows(msg.rows || []);
          const pct = totalChunksHint ? (chunksSeen / totalChunksHint) * 100 : 0;
          parentPort.postMessage({ type: 'progress', processed: totalProcessed, total: totalProcessed, percentage: pct, phase: 'csv_chunk_' + chunksSeen + (totalChunksHint ? ('_of_' + totalChunksHint) : '') });
        } else if (msg.type === 'end') {
          parentPort.postMessage({ type: 'complete', result: { series, ranges, total: totalProcessed, availableMetrics: Array.from(available) } });
        } else if (msg.type === 'abort') {
          parentPort.postMessage({ type: 'error', error: 'aborted' });
        }
      });
    `;
    const worker = new Worker(workerCode, { eval: true });
    let resolveFinal: ((r: { series: Record<string, Array<[number, number, number, string | undefined]>>; ranges: Record<string, { min: number; max: number }>; total: number; availableMetrics: string[] }) => void) | null = null;
    let rejectFinal: ((e: Error) => void) | null = null;
    const finalizePromise: Promise<{ series: Record<string, Array<[number, number, number, string | undefined]>>; ranges: Record<string, { min: number; max: number }>; total: number; availableMetrics: string[] }>
      = new Promise((resolve, reject) => { resolveFinal = resolve; rejectFinal = reject; });
    worker.on('message', (message: { type: string; processed?: number; total?: number; percentage?: number; phase?: string; result?: { series: Record<string, Array<[number, number, number, string | undefined]>>; ranges: Record<string, { min: number; max: number }>; total: number; availableMetrics: string[] }; error?: string }) => {
      if (message.type === 'progress') {
        onProgress({ processed: message.processed ?? 0, total: message.total ?? 0, percentage: message.percentage ?? 0, phase: message.phase ?? 'processing' });
      } else if (message.type === 'complete') {
        worker.terminate();
        if (resolveFinal) {
          resolveFinal(message.result as { series: Record<string, Array<[number, number, number, string | undefined]>>; ranges: Record<string, { min: number; max: number }>; total: number; availableMetrics: string[] });
        }
      } else if (message.type === 'error') {
        worker.terminate();
        if (rejectFinal) {
          rejectFinal(new Error(message.error || 'CSV worker error'));
        }
      }
    });
    worker.on('error', (err) => { worker.terminate(); if (rejectFinal) { rejectFinal(err as unknown as Error); } });
    worker.on('exit', (code) => { if (code !== 0 && rejectFinal) rejectFinal(new Error('CSV worker exited with code ' + String(code))); });
    return {
      postRows: (rows, totalChunks) => { worker.postMessage({ type: 'rows', rows, totalChunks }); },
      finalize: () => { worker.postMessage({ type: 'end' }); return finalizePromise; },
      terminate: () => { try { worker.postMessage({ type: 'abort' }); } catch { /* no-op */ } finally { worker.terminate(); } },
    };
  }
}