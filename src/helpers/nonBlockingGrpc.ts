// Non-blocking gRPC wrapper that prevents UI freezing

export interface NonBlockingProgress {
  phase: 'starting' | 'transferring' | 'processing' | 'complete';
  processed: number;
  total: number;
  percentage: number;
  transferRate?: number;
}

export class NonBlockingGrpcWrapper {
  /**
   * Execute gRPC call without blocking the UI using progressive yielding
   */
  static async executeNonBlocking<T>(
    grpcCall: () => Promise<T>,
    onProgress?: (progress: NonBlockingProgress) => void
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // Start the process
      if (onProgress) {
        onProgress({
          phase: 'starting',
          processed: 0,
          total: 1,
          percentage: 0
        });
      }

      // Use setTimeout to yield control before starting
      setTimeout(async () => {
        try {
          if (onProgress) {
            onProgress({
              phase: 'transferring',
              processed: 0,
              total: 1,
              percentage: 10
            });
          }

          // Execute the gRPC call
          const startTime = performance.now();
          const result = await grpcCall();
          const duration = performance.now() - startTime;

          if (onProgress) {
            onProgress({
              phase: 'processing',
              processed: 1,
              total: 1,
              percentage: 90,
              transferRate: 1 / (duration / 1000)
            });
          }

          // Yield control before completing
          setTimeout(() => {
            if (onProgress) {
              onProgress({
                phase: 'complete',
                processed: 1,
                total: 1,
                percentage: 100,
                transferRate: 1 / (duration / 1000)
              });
            }
            resolve(result);
          }, 1);

        } catch (error) {
          reject(error);
        }
      }, 1);
    });
  }

  /**
   * Process large result set progressively to prevent UI blocking
   */
  static async processLargeResult<T>(
    data: T[],
    processor: (batch: T[]) => void,
    batchSize: number = 1000,
    onProgress?: (progress: NonBlockingProgress) => void
  ): Promise<void> {
    return new Promise((resolve) => {
      let processed = 0;
      const total = data.length;

      const processBatch = (startIndex: number) => {
        const endIndex = Math.min(startIndex + batchSize, total);
        const batch = data.slice(startIndex, endIndex);
        
        // Process the batch
        processor(batch);
        
        processed += batch.length;

        if (onProgress) {
          onProgress({
            phase: 'processing',
            processed,
            total,
            percentage: (processed / total) * 100
          });
        }

        // Continue or complete
        if (endIndex < total) {
          // Yield control to the main thread
          setTimeout(() => processBatch(endIndex), 1);
        } else {
          if (onProgress) {
            onProgress({
              phase: 'complete',
              processed: total,
              total,
              percentage: 100
            });
          }
          resolve();
        }
      };

      // Start processing
      setTimeout(() => processBatch(0), 1);
    });
  }

}

export default NonBlockingGrpcWrapper;