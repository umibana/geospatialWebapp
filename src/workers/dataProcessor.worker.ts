/**
 * Real Web Worker for processing large geospatial datasets
 * Handles 1M+ points without blocking the main UI thread
 */

export interface DataPoint {
  id: string;
  location: { latitude: number; longitude: number; altitude?: number };
  value: number;
  unit: string;
  timestamp: number;
  metadata: Record<string, string>;
}

export interface ProcessingChunk {
  data_points: DataPoint[];
  chunk_number: number;
  total_chunks: number;
  points_in_chunk: number;
  is_final_chunk: boolean;
  generation_method: string;
}

export interface WorkerMessage {
  type: 'process_chunk' | 'finalize_processing' | 'get_stats' | 'prepare_chart_data';
  requestId: string;
  data?: unknown;
}

export interface WorkerResponse {
  type: 'progress' | 'chunk_processed' | 'stats_ready' | 'chart_data_ready' | 'error' | 'complete';
  requestId: string;
  data?: unknown;
  error?: string;
}

// Worker global state
let processedPoints: DataPoint[] = [];
let processingStats = {
  totalProcessed: 0,
  minValue: Infinity,
  maxValue: -Infinity,
  sum: 0,
  dataTypes: new Set<string>(),
  startTime: 0,
  endTime: 0
};

// Reset state for new processing session
function resetState(requestId: string) {
  processedPoints = [];
  processingStats = {
    totalProcessed: 0,
    minValue: Infinity,
    maxValue: -Infinity,
    sum: 0,
    dataTypes: new Set<string>(),
    startTime: performance.now(),
    endTime: 0
  };
  
  postMessage({
    type: 'progress',
    requestId,
    data: { phase: 'initialized', processed: 0, total: 0, percentage: 0 }
  });
}

// Process a chunk of data points with micro-batching
function processChunk(chunk: ProcessingChunk, requestId: string) {
  const chunkStartTime = performance.now();
  
  if (!chunk.data_points || chunk.data_points.length === 0) {
    postMessage({
      type: 'error',
      requestId,
      error: 'Empty chunk received'
    });
    return;
  }
  
  // Process points in micro-batches to prevent blocking
  const MICRO_BATCH_SIZE = 1000; // Process 1000 points at a time
  let processedInChunk = 0;
  
  const processMicroBatch = (startIdx: number) => {
    const endIdx = Math.min(startIdx + MICRO_BATCH_SIZE, chunk.data_points.length);
    
    // Process this micro-batch
    for (let i = startIdx; i < endIdx; i++) {
      const point = chunk.data_points[i];
      
      // Only store essential data for charting (reduce memory usage)
      if (processedPoints.length < 50000) { // Limit stored points
        processedPoints.push(point);
      }
      
      // Update statistics
      processingStats.totalProcessed++;
      processingStats.sum += point.value;
      processingStats.minValue = Math.min(processingStats.minValue, point.value);
      processingStats.maxValue = Math.max(processingStats.maxValue, point.value);
      
      if (point.metadata && point.metadata.sensor_type) {
        processingStats.dataTypes.add(point.metadata.sensor_type);
      }
      
      processedInChunk++;
    }
    
    // If there are more points in this chunk, schedule next micro-batch
    if (endIdx < chunk.data_points.length) {
      // Use setTimeout to yield control
      setTimeout(() => processMicroBatch(endIdx), 0);
    } else {
      // Chunk complete - send final update
      finishChunkProcessing();
    }
  };
  
  const finishChunkProcessing = () => {
    const chunkEndTime = performance.now();
    const chunkProcessingTime = chunkEndTime - chunkStartTime;
    
    // Send progress update
    const totalExpected = chunk.total_chunks * chunk.points_in_chunk; // Rough estimate
    const percentage = (processingStats.totalProcessed / totalExpected) * 100;
    
    postMessage({
      type: 'progress',
      requestId,
      data: {
        phase: 'processing',
        processed: processingStats.totalProcessed,
        total: totalExpected,
        percentage: Math.min(percentage, 100),
        chunkNumber: chunk.chunk_number,
        totalChunks: chunk.total_chunks,
        chunkProcessingTime
      }
    });
    
    // Send chunk processed confirmation
    postMessage({
      type: 'chunk_processed',
      requestId,
      data: {
        chunkNumber: chunk.chunk_number,
        pointsProcessed: processedInChunk,
        cumulativeTotal: processingStats.totalProcessed
      }
    });
    
    // If this is the final chunk, finalize processing
    if (chunk.is_final_chunk) {
      finalizeProcessing(requestId);
    }
  };
  
  // Start processing the first micro-batch
  processMicroBatch(0);
}

// Finalize processing and calculate final statistics
function finalizeProcessing(requestId: string) {
  processingStats.endTime = performance.now();
  const totalTime = (processingStats.endTime - processingStats.startTime) / 1000;
  
  const avgValue = processingStats.totalProcessed > 0 
    ? processingStats.sum / processingStats.totalProcessed 
    : 0;
  
  const finalStats = {
    totalProcessed: processingStats.totalProcessed,
    avgValue: Number(avgValue.toFixed(2)),
    minValue: Number(processingStats.minValue.toFixed(2)),
    maxValue: Number(processingStats.maxValue.toFixed(2)),
    dataTypes: Array.from(processingStats.dataTypes),
    processingTime: Number(totalTime.toFixed(3)),
    pointsPerSecond: Math.round(processingStats.totalProcessed / totalTime)
  };
  
  postMessage({
    type: 'stats_ready',
    requestId,
    data: finalStats
  });
  
  postMessage({
    type: 'complete',
    requestId,
    data: {
      ...finalStats,
      message: `🎉 Successfully processed ${processingStats.totalProcessed.toLocaleString()} data points in ${totalTime.toFixed(2)}s`
    }
  });
}

// Prepare optimized data for ECharts visualization
function prepareChartData(requestId: string, options: { maxPoints?: number; chartType?: 'scatter' | 'heatmap' | 'line' } = {}) {
  const maxPoints = options.maxPoints || 10000; // Limit for performance
  const chartType = options.chartType || 'scatter';
  
  let chartData = [];
  
  if (processedPoints.length === 0) {
    postMessage({
      type: 'error',
      requestId,
      error: 'No processed points available for chart data'
    });
    return;
  }
  
  // For large datasets, sample points intelligently
  if (processedPoints.length > maxPoints) {
    const step = Math.floor(processedPoints.length / maxPoints);
    for (let i = 0; i < processedPoints.length; i += step) {
      const point = processedPoints[i];
      chartData.push([
        point.location.longitude,
        point.location.latitude,
        point.value
      ]);
    }
  } else {
    // Use all points for smaller datasets
    chartData = processedPoints.map(point => [
      point.location.longitude,
      point.location.latitude,
      point.value
    ]);
  }
  
  const chartConfig = {
    type: chartType,
    data: chartData,
    metadata: {
      totalPoints: processedPoints.length,
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
  };
  
  postMessage({
    type: 'chart_data_ready',
    requestId,
    data: chartConfig
  });
}

// Get current statistics without finalizing
function getCurrentStats(requestId: string) {
  const currentTime = performance.now();
  const elapsedTime = (currentTime - processingStats.startTime) / 1000;
  
  const currentStats = {
    totalProcessed: processingStats.totalProcessed,
    avgValue: processingStats.totalProcessed > 0 
      ? Number((processingStats.sum / processingStats.totalProcessed).toFixed(2))
      : 0,
    minValue: processingStats.minValue === Infinity ? 0 : Number(processingStats.minValue.toFixed(2)),
    maxValue: processingStats.maxValue === -Infinity ? 0 : Number(processingStats.maxValue.toFixed(2)),
    dataTypes: Array.from(processingStats.dataTypes),
    elapsedTime: Number(elapsedTime.toFixed(3)),
    pointsPerSecond: elapsedTime > 0 ? Math.round(processingStats.totalProcessed / elapsedTime) : 0,
    memoryUsage: {
      processedPointsCount: processedPoints.length,
      estimatedMemoryMB: (processedPoints.length * 200) / 1024 / 1024 // Rough estimate
    }
  };
  
  postMessage({
    type: 'stats_ready',
    requestId,
    data: currentStats
  });
}

// Main message handler
self.onmessage = function(event: MessageEvent<WorkerMessage>) {
  const { type, requestId, data } = event.data;
  
  try {
    switch (type) {
      case 'process_chunk':
        if (!data) {
          postMessage({
            type: 'error',
            requestId,
            error: 'No chunk data provided'
          });
          return;
        }
        
        // Reset state if this is the first chunk
        const chunk = data as ProcessingChunk;
        if (chunk.chunk_number === 1) {
          resetState(requestId);
        }
        
        processChunk(chunk, requestId);
        break;
        
      case 'finalize_processing':
        finalizeProcessing(requestId);
        break;
        
      case 'get_stats':
        getCurrentStats(requestId);
        break;
        
      case 'prepare_chart_data':
        prepareChartData(requestId, data as { maxPoints?: number; chartType?: 'scatter' | 'heatmap' | 'line' });
        break;
        
      default:
        postMessage({
          type: 'error',
          requestId,
          error: `Unknown message type: ${type}`
        });
    }
  } catch (error) {
    postMessage({
      type: 'error',
      requestId,
      error: error instanceof Error ? error.message : 'Unknown worker error'
    });
  }
};

// Worker initialization
postMessage({
  type: 'progress',
  requestId: 'init',
  data: { 
    phase: 'worker_ready', 
    message: '🔧 Data processing worker initialized and ready'
  }
});