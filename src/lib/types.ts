// Electron API types and shared gRPC result/progress shapes

export type GrpcBounds = {
  northeast: { latitude: number; longitude: number };
  southwest: { latitude: number; longitude: number };
};

export type GrpcProgress = {
  processed: number;
  total: number;
  percentage: number;
  phase: string;
};

export type WorkerStreamSummary = {
  avgValue?: number;
  minValue?: number;
  maxValue?: number;
  [key: string]: unknown;
};

export type WorkerStreamResult = {
  totalProcessed: number;
  processingTime: number;
  generationMethod: string;
  summary: WorkerStreamSummary;
  dataSample?: any[];
  receivedChunks?: any[];
};

export type WorkerThreadsStats = {
  totalProcessed: number;
  avgValue: number;
  minValue: number;
  maxValue: number;
  dataTypes: string[];
  processingTime: number;
  pointsPerSecond: number;
};

export type WorkerThreadsChartConfig = {
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

export type WorkerThreadsResult = {
  stats: WorkerThreadsStats;
  chartConfig: WorkerThreadsChartConfig;
  message?: string;
};

export type OptimizedResult =
  | ({ strategy: 'worker_stream' } & WorkerStreamResult)
  | ({ strategy: 'worker_threads' } & WorkerThreadsResult);

// Type guards and helpers for unified handling in renderer
export function isWorkerThreads(result: OptimizedResult): result is ({ strategy: 'worker_threads' } & WorkerThreadsResult) {
  return result.strategy === 'worker_threads';
}

export function isWorkerStream(result: OptimizedResult): result is ({ strategy: 'worker_stream' } & WorkerStreamResult) {
  return result.strategy === 'worker_stream';
}

export function extractTotalProcessed(result: OptimizedResult): number {
  return isWorkerThreads(result) ? result.stats.totalProcessed : result.totalProcessed;
}

export function extractProcessingTimeSeconds(result: OptimizedResult): number {
  return isWorkerThreads(result) ? result.stats.processingTime : result.processingTime;
}

export function extractPointsPerSecond(result: OptimizedResult): number {
  return isWorkerThreads(result) ? result.stats.pointsPerSecond : Math.round(result.totalProcessed / Math.max(1e-6, result.processingTime));
}

export type StandardProgressEvent = GrpcProgress & { requestId?: string; type?: 'progress' | 'complete' | 'batch_complete' };