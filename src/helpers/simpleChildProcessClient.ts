/**
 * Simple Child Process Client for Renderer Process
 * Only uses IPC communication - no Node.js modules
 */

export interface ChildProcessStats {
  totalProcessed: number;
  avgValue: number;
  minValue: number;
  maxValue: number;
  dataTypes: string[];
  processingTime: number;
  pointsPerSecond: number;
  memoryUsage: {
    storedPoints: number;
    totalProcessed: number;
    estimatedMemoryMB: number;
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

class SimpleChildProcessClient {
  
  public isReady(): boolean {
    // Always ready since we're just using IPC
    return true;
  }

  public async processLargeDataset(
    bounds: any,
    dataTypes: string[],
    maxPoints: number,
    resolution?: number,
    onProgress?: (progress: { processed: number; total: number; percentage: number; phase: string }) => void
  ): Promise<{
    stats: ChildProcessStats;
    chartConfig: ChartConfig;
    message: string;
  }> {
    
    return new Promise((resolve, reject) => {
      const requestId = `child-${Date.now()}-${Math.random()}`;
      
      const progressHandler = (event: any, data: any) => {
        if (data.requestId === requestId) {
          if (data.type === 'progress' && onProgress) {
            onProgress({
              processed: data.processed,
              total: data.total,
              percentage: data.percentage,
              phase: data.phase
            });
          } else if (data.type === 'complete') {
            cleanup();
            resolve({
              stats: data.stats,
              chartConfig: data.chartConfig,
              message: data.message
            });
          }
        }
      };
      
      const errorHandler = (event: any, data: any) => {
        if (data.requestId === requestId) {
          cleanup();
          reject(new Error(data.error));
        }
      };
      
      const cleanup = () => {
        // @ts-ignore - Electron IPC
        window.electronAPI?.off?.('grpc-child-process-progress', progressHandler);
        // @ts-ignore - Electron IPC  
        window.electronAPI?.off?.('grpc-child-process-error', errorHandler);
      };
      
      // Use the preload API
      if (window.grpc?.getBatchDataChildProcessStreamed) {
        window.grpc.getBatchDataChildProcessStreamed(
          bounds,
          dataTypes,
          maxPoints,
          resolution,
          onProgress
        ).then((result: any) => {
          // Ensure we have valid stats with default values
          const stats = result.stats || {};
          const safeStats = {
            totalProcessed: stats.totalProcessed || 0,
            avgValue: stats.avgValue || 0,
            minValue: stats.minValue || 0,
            maxValue: stats.maxValue || 0,
            dataTypes: stats.dataTypes || [],
            processingTime: stats.processingTime || 0,
            pointsPerSecond: stats.pointsPerSecond || 0
          };
          
          // Ensure we have valid chart config
          const chartConfig = result.chartConfig || {};
          const safeChartConfig = {
            type: chartConfig.type || 'scatter',
            data: chartConfig.data || [],
            metadata: chartConfig.metadata || {
              totalPoints: 0,
              chartPoints: 0,
              samplingRatio: 0,
              bounds: { lng: [0, 0], lat: [0, 0], value: [0, 0] }
            }
          };
          
          resolve({
            stats: safeStats,
            chartConfig: safeChartConfig,
            message: result.message || 'Subprocess completed'
          });
        }).catch(reject);
      } else {
        reject(new Error('Child process API not available'));
      }
    });
  }
}

// Singleton instance
export const simpleChildProcessClient = new SimpleChildProcessClient();