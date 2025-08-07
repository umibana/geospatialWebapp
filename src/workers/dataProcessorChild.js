/**
 * Node.js Child Process for Heavy Geospatial Data Processing
 * Completely bypasses Electron IPC for maximum performance
 */

const { parentPort } = require('worker_threads');

// Global state for data processing
let processedPoints = [];
let processingStats = {
  totalProcessed: 0,
  minValue: Infinity,
  maxValue: -Infinity,
  sum: 0,
  dataTypes: new Set(),
  startTime: 0,
  endTime: 0
};

// Reset state for new processing session
function resetState(requestId) {
  processedPoints = [];
  processingStats = {
    totalProcessed: 0,
    minValue: Infinity,
    maxValue: -Infinity,
    sum: 0,
    dataTypes: new Set(),
    startTime: performance.now(),
    endTime: 0
  };
  
  parentPort.postMessage({
    type: 'progress',
    requestId,
    data: { phase: 'child_initialized', processed: 0, total: 0, percentage: 0 }
  });
}

// Ultra-fast chunk processing without micro-batching
function processChunk(chunk, requestId) {
  const chunkStartTime = performance.now();
  
  if (!chunk.data_points || chunk.data_points.length === 0) {
    parentPort.postMessage({
      type: 'error',
      requestId,
      error: 'Empty chunk received'
    });
    return;
  }
  
  // Process all points in chunk at once (no micro-batching needed in child process)
  let processedInChunk = 0;
  
  for (const point of chunk.data_points) {
    // Only store essential data for charting (limit memory usage)
    if (processedPoints.length < 100000) { // Higher limit for child process
      processedPoints.push({
        lng: point.location.longitude,
        lat: point.location.latitude,
        value: point.value
      });
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
  
  const chunkEndTime = performance.now();
  const chunkProcessingTime = chunkEndTime - chunkStartTime;
  
  // Send progress update
  const totalExpected = chunk.total_chunks * chunk.points_in_chunk;
  const percentage = (processingStats.totalProcessed / totalExpected) * 100;
  
  parentPort.postMessage({
    type: 'progress',
    requestId,
    data: {
      phase: 'child_processing',
      processed: processingStats.totalProcessed,
      total: totalExpected,
      percentage: Math.min(percentage, 100),
      chunkNumber: chunk.chunk_number,
      totalChunks: chunk.total_chunks,
      chunkProcessingTime,
      pointsPerSecond: processedInChunk / (chunkProcessingTime / 1000)
    }
  });
  
  // Send chunk processed confirmation
  parentPort.postMessage({
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
}

// Finalize processing and calculate final statistics
function finalizeProcessing(requestId) {
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
    pointsPerSecond: Math.round(processingStats.totalProcessed / totalTime),
    memoryUsage: {
      storedPoints: processedPoints.length,
      totalProcessed: processingStats.totalProcessed
    }
  };
  
  parentPort.postMessage({
    type: 'stats_ready',
    requestId,
    data: finalStats
  });
  
  parentPort.postMessage({
    type: 'complete',
    requestId,
    data: {
      ...finalStats,
      message: `🎉 Child process completed ${processingStats.totalProcessed.toLocaleString()} points in ${totalTime.toFixed(2)}s`
    }
  });
}

// Prepare optimized chart data
function prepareChartData(requestId, options = {}) {
  const maxPoints = options.maxPoints || 10000;
  const chartType = options.chartType || 'scatter';
  
  if (processedPoints.length === 0) {
    parentPort.postMessage({
      type: 'error',
      requestId,
      error: 'No processed points available for chart data'
    });
    return;
  }
  
  let chartData = [];
  
  // Smart sampling for large datasets
  if (processedPoints.length > maxPoints) {
    const step = Math.floor(processedPoints.length / maxPoints);
    for (let i = 0; i < processedPoints.length; i += step) {
      const point = processedPoints[i];
      chartData.push([point.lng, point.lat, point.value]);
    }
  } else {
    chartData = processedPoints.map(point => [point.lng, point.lat, point.value]);
  }
  
  const chartConfig = {
    type: chartType,
    data: chartData,
    metadata: {
      totalPoints: processingStats.totalProcessed,
      storedPoints: processedPoints.length,
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
  
  parentPort.postMessage({
    type: 'chart_data_ready',
    requestId,
    data: chartConfig
  });
}

// Get current statistics
function getCurrentStats(requestId) {
  const currentTime = performance.now();
  const elapsedTime = (processingStats.startTime > 0) ? (currentTime - processingStats.startTime) / 1000 : 0;
  
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
      storedPoints: processedPoints.length,
      estimatedMemoryMB: (processedPoints.length * 100) / 1024 / 1024
    }
  };
  
  parentPort.postMessage({
    type: 'stats_ready',
    requestId,
    data: currentStats
  });
}

// Main message handler
parentPort.on('message', (message) => {
  const { type, requestId, data } = message;
  
  try {
    switch (type) {
      case 'process_chunk':
        if (!data) {
          parentPort.postMessage({
            type: 'error',
            requestId,
            error: 'No chunk data provided'
          });
          return;
        }
        
        // Reset state if this is the first chunk
        if (data.chunk_number === 1) {
          resetState(requestId);
        }
        
        processChunk(data, requestId);
        break;
        
      case 'finalize_processing':
        finalizeProcessing(requestId);
        break;
        
      case 'get_stats':
        getCurrentStats(requestId);
        break;
        
      case 'prepare_chart_data':
        prepareChartData(requestId, data);
        break;
        
      default:
        parentPort.postMessage({
          type: 'error',
          requestId,
          error: `Unknown message type: ${type}`
        });
    }
  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      requestId,
      error: error.message
    });
  }
});

// Child process initialization
parentPort.postMessage({
  type: 'progress',
  requestId: 'init',
  data: { 
    phase: 'child_ready', 
    message: '🔧 Node.js child process initialized and ready for heavy data processing'
  }
});