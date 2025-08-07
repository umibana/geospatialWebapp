/**
 * Standalone Node.js Child Process for Heavy Geospatial Data Processing
 * Runs as a separate Node.js process - NOT in browser/renderer
 */

const fs = require('fs');
const path = require('path');

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

// Process data and write results to shared file
function processLargeDataset(dataChunks, outputPath) {
  console.log(`🔧 Child process starting to process ${dataChunks.length} chunks...`);
  
  processingStats.startTime = Date.now();
  processedPoints = [];
  
  let totalProcessed = 0;
  
  // Process all chunks
  for (let chunkIndex = 0; chunkIndex < dataChunks.length; chunkIndex++) {
    const chunk = dataChunks[chunkIndex];
    
    if (chunk.data_points && chunk.data_points.length > 0) {
      // Process all points in this chunk
      for (const point of chunk.data_points) {
        // Store essential data for charting (limit memory usage)
        if (processedPoints.length < 100000) { // Higher limit for child process
          processedPoints.push({
            lng: point.location.longitude,
            lat: point.location.latitude,
            value: point.value,
            type: point.metadata?.sensor_type || 'unknown'
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
        
        totalProcessed++;
      }
    }
    
    // Write progress update every 5 chunks
    if (chunkIndex % 5 === 0) {
      const progressData = {
        type: 'progress',
        processed: totalProcessed,
        total: dataChunks.reduce((sum, c) => sum + (c.data_points?.length || 0), 0),
        percentage: ((chunkIndex + 1) / dataChunks.length) * 100,
        phase: `processing_chunk_${chunkIndex + 1}_of_${dataChunks.length}`,
        timestamp: Date.now()
      };
      
      // Write progress to temp file
      const progressPath = outputPath.replace('.json', '.progress.json');
      fs.writeFileSync(progressPath, JSON.stringify(progressData));
    }
  }
  
  processingStats.endTime = Date.now();
  const totalTime = (processingStats.endTime - processingStats.startTime) / 1000;
  
  // Calculate final statistics
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
      totalProcessed: processingStats.totalProcessed,
      estimatedMemoryMB: (processedPoints.length * 100) / 1024 / 1024
    }
  };
  
  // Prepare chart data with intelligent sampling
  let chartData = [];
  const maxChartPoints = 10000;
  
  if (processedPoints.length > maxChartPoints) {
    const step = Math.floor(processedPoints.length / maxChartPoints);
    for (let i = 0; i < processedPoints.length; i += step) {
      const point = processedPoints[i];
      chartData.push([point.lng, point.lat, point.value]);
    }
  } else {
    chartData = processedPoints.map(point => [point.lng, point.lat, point.value]);
  }
  
  const chartConfig = {
    type: 'scatter',
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
  
  // Write final results to output file
  const results = {
    type: 'complete',
    stats: finalStats,
    chartConfig: chartConfig,
    timestamp: Date.now(),
    message: `🎉 Child process completed ${processingStats.totalProcessed.toLocaleString()} points in ${totalTime.toFixed(2)}s`
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(results));
  
  console.log(`✅ Child process completed! Processed ${totalProcessed} points in ${totalTime.toFixed(2)}s`);
  console.log(`📊 Results written to: ${outputPath}`);
  
  process.exit(0);
}

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node childDataProcessor.js <dataPath> <outputPath>');
  process.exit(1);
}

const dataPath = args[0];
const outputPath = args[1];

try {
  // Read data chunks from input file
  const dataChunks = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  // Process the data
  processLargeDataset(dataChunks, outputPath);
  
} catch (error) {
  console.error('❌ Child process error:', error);
  
  // Write error to output file
  const errorResult = {
    type: 'error',
    error: error.message,
    timestamp: Date.now()
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(errorResult));
  process.exit(1);
}