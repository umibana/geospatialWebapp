/**
 * True Node.js Subprocess Manager
 * Spawns actual Node.js child processes for heavy data processing
 * Completely isolated from Electron main process
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SubprocessResult {
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

export class TrueSubprocessManager {
  private static instance: TrueSubprocessManager;
  private activeProcesses = new Map<string, ChildProcess>();

  public static getInstance(): TrueSubprocessManager {
    if (!TrueSubprocessManager.instance) {
      TrueSubprocessManager.instance = new TrueSubprocessManager();
    }
    return TrueSubprocessManager.instance;
  }

  public async processLargeDataset(
    chunks: any[],
    requestId: string,
    onProgress: (progress: { processed: number; total: number; percentage: number; phase: string }) => void
  ): Promise<SubprocessResult> {
    
    return new Promise((resolve, reject) => {
      // Create temporary files for data exchange
      const tempDir = os.tmpdir();
      const inputPath = path.join(tempDir, `subprocess-input-${requestId}.json`);
      const outputPath = path.join(tempDir, `subprocess-output-${requestId}.json`);
      const progressPath = path.join(tempDir, `subprocess-progress-${requestId}.json`);
      
      try {
        // Write input data to temp file
        fs.writeFileSync(inputPath, JSON.stringify({
          chunks,
          requestId,
          timestamp: Date.now()
        }));

        // Create the subprocess script content
        const subprocessScript = this.createSubprocessScript();
        const scriptPath = path.join(tempDir, `subprocess-${requestId}.js`);
        fs.writeFileSync(scriptPath, subprocessScript);

        console.log(`🚀 Spawning true Node.js subprocess for ${chunks.length} chunks`);

        // Spawn the subprocess
        const subprocess = spawn('node', [scriptPath, inputPath, outputPath, progressPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: false,
          cwd: process.cwd()
        });

        this.activeProcesses.set(requestId, subprocess);

        // Monitor subprocess output
        subprocess.stdout.on('data', (data) => {
          console.log(`Subprocess stdout: ${data.toString().trim()}`);
        });

        subprocess.stderr.on('data', (data) => {
          console.error(`Subprocess stderr: ${data.toString().trim()}`);
        });

        // Poll for progress updates
        const progressInterval = setInterval(() => {
          if (fs.existsSync(progressPath)) {
            try {
              const progressData = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
              onProgress(progressData);
            } catch (error) {
              // Progress file might be being written, ignore read errors
            }
          }
        }, 250); // Check every 250ms

        // Handle subprocess completion
        subprocess.on('exit', (code, signal) => {
          clearInterval(progressInterval);
          this.activeProcesses.delete(requestId);

          // Clean up temp files
          try {
            fs.unlinkSync(inputPath);
            fs.unlinkSync(scriptPath);
            if (fs.existsSync(progressPath)) {
              fs.unlinkSync(progressPath);
            }
          } catch (cleanupError) {
            console.warn('Cleanup warning:', cleanupError);
          }

          if (code === 0) {
            // Success - read results ASYNCHRONOUSLY to prevent blocking
            try {
              if (fs.existsSync(outputPath)) {
                // Use async file reading to prevent UI blocking
                setImmediate(() => {
                  try {
                    const results = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
                    fs.unlinkSync(outputPath); // Clean up output file
                    resolve(results);
                  } catch (readError) {
                    reject(new Error(`Failed to read subprocess results: ${readError.message}`));
                  }
                });
              } else {
                reject(new Error('Subprocess completed but no output file found'));
              }
            } catch (error) {
              reject(new Error(`Failed to read subprocess results: ${error.message}`));
            }
          } else {
            reject(new Error(`Subprocess exited with code ${code}, signal ${signal}`));
          }
        });

        subprocess.on('error', (error) => {
          clearInterval(progressInterval);
          this.activeProcesses.delete(requestId);
          reject(new Error(`Subprocess spawn error: ${error.message}`));
        });

      } catch (error) {
        reject(new Error(`Failed to start subprocess: ${error.message}`));
      }
    });
  }

  private createSubprocessScript(): string {
    return `
// True Node.js Subprocess for Heavy Data Processing
const fs = require('fs');

// Get command line arguments
const [inputPath, outputPath, progressPath] = process.argv.slice(2);

console.log('🔧 Subprocess started, processing data...');

function writeProgress(data) {
  try {
    fs.writeFileSync(progressPath, JSON.stringify(data));
  } catch (error) {
    // Ignore progress write errors
  }
}

async function processData() {
  try {
    // Read input data
    const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const { chunks, requestId } = inputData;
    
    const startTime = Date.now();
    let processedPoints = [];
    let stats = {
      totalProcessed: 0,
      minValue: Infinity,
      maxValue: -Infinity,
      sum: 0,
      dataTypes: new Set()
    };

    console.log(\`Processing \${chunks.length} chunks...\`);

    // Process chunks one by one with progress updates
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      
      if (chunk.data_points && chunk.data_points.length > 0) {
        // Process all points in this chunk (subprocess is isolated, no UI blocking)
        for (let i = 0; i < chunk.data_points.length; i++) {
          const point = chunk.data_points[i];
          
          // Intelligent sampling: take every Nth point for charting (reduce file size)
          const maxChartPoints = 2000;
          const totalExpectedPoints = chunks.reduce((sum, c) => sum + (c.data_points?.length || 0), 0);
          const samplingRate = Math.max(1, Math.floor(totalExpectedPoints / maxChartPoints));
          
          if (processedPoints.length < maxChartPoints && stats.totalProcessed % samplingRate === 0) {
            processedPoints.push([
              point.location.longitude,
              point.location.latitude,
              point.value
            ]);
          }
          
          // Update statistics for ALL points
          stats.totalProcessed++;
          stats.sum += point.value;
          stats.minValue = Math.min(stats.minValue, point.value);
          stats.maxValue = Math.max(stats.maxValue, point.value);
          
          if (point.metadata && point.metadata.sensor_type) {
            stats.dataTypes.add(point.metadata.sensor_type);
          }
        }
      }
      
      // Write progress update every 5 chunks
      if (chunkIndex % 5 === 0) {
        const percentage = ((chunkIndex + 1) / chunks.length) * 100;
        writeProgress({
          processed: stats.totalProcessed,
          total: chunks.reduce((sum, c) => sum + (c.data_points?.length || 0), 0),
          percentage: percentage,
          phase: \`subprocess_chunk_\${chunkIndex + 1}_of_\${chunks.length}\`
        });
      }
    }

    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000;
    const avgValue = stats.totalProcessed > 0 ? stats.sum / stats.totalProcessed : 0;

    console.log(\`✅ Subprocess completed: \${stats.totalProcessed} points in \${processingTime.toFixed(2)}s\`);

    // Prepare final results
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
        data: processedPoints,
        metadata: {
          totalPoints: stats.totalProcessed,
          chartPoints: processedPoints.length,
          samplingRatio: processedPoints.length / stats.totalProcessed,
          bounds: {
            lng: processedPoints.length > 0 ? [
              Math.min(...processedPoints.map(p => p[0])),
              Math.max(...processedPoints.map(p => p[0]))
            ] : [0, 0],
            lat: processedPoints.length > 0 ? [
              Math.min(...processedPoints.map(p => p[1])),
              Math.max(...processedPoints.map(p => p[1]))
            ] : [0, 0],
            value: processedPoints.length > 0 ? [
              Math.min(...processedPoints.map(p => p[2])),
              Math.max(...processedPoints.map(p => p[2]))
            ] : [0, 0]
          }
        }
      }
    };

    // Write final results
    fs.writeFileSync(outputPath, JSON.stringify(result));
    console.log('📊 Results written to output file');

    process.exit(0);
    
  } catch (error) {
    console.error('❌ Subprocess error:', error);
    fs.writeFileSync(outputPath, JSON.stringify({
      error: error.message
    }));
    process.exit(1);
  }
}

// Start processing
processData();
`;
  }

  public terminate(requestId?: string) {
    if (requestId) {
      const process = this.activeProcesses.get(requestId);
      if (process) {
        process.kill('SIGTERM');
        this.activeProcesses.delete(requestId);
      }
    } else {
      // Terminate all processes
      for (const [id, process] of this.activeProcesses) {
        process.kill('SIGTERM');
      }
      this.activeProcesses.clear();
    }
  }

  public getActiveProcessCount(): number {
    return this.activeProcesses.size;
  }
}