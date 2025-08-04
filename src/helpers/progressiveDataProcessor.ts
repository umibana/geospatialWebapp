// Progressive data processor to handle large datasets without blocking UI

export interface ProgressiveProcessingOptions {
  chunkSize?: number;
  delayBetweenChunks?: number;
  onProgress?: (progress: { processed: number; total: number; percentage: number }) => void;
  onChunk?: (chunk: any[]) => void;
}

export class ProgressiveDataProcessor {
  private isProcessing = false;
  private shouldCancel = false;

  /**
   * Process large dataset progressively without blocking the UI
   */
  async processLargeDataset<T>(
    data: T[],
    processor: (item: T) => any,
    options: ProgressiveProcessingOptions = {}
  ): Promise<any[]> {
    const {
      chunkSize = 1000,
      delayBetweenChunks = 1,
      onProgress,
      onChunk
    } = options;

    return new Promise((resolve, reject) => {
      if (this.isProcessing) {
        reject(new Error('Already processing data'));
        return;
      }

      this.isProcessing = true;
      this.shouldCancel = false;
      
      const results: any[] = [];
      let processedCount = 0;
      const totalCount = data.length;

      const processNextChunk = (startIndex: number) => {
        if (this.shouldCancel) {
          this.isProcessing = false;
          reject(new Error('Processing cancelled'));
          return;
        }

        const endIndex = Math.min(startIndex + chunkSize, totalCount);
        const chunk: any[] = [];

        // Process current chunk
        for (let i = startIndex; i < endIndex; i++) {
          try {
            const processed = processor(data[i]);
            chunk.push(processed);
            results.push(processed);
          } catch (error) {
            console.error('Error processing item:', error);
          }
        }

        processedCount += chunk.length;

        // Send progress update
        if (onProgress) {
          onProgress({
            processed: processedCount,
            total: totalCount,
            percentage: (processedCount / totalCount) * 100
          });
        }

        // Send chunk update
        if (onChunk) {
          onChunk(chunk);
        }

        // Continue processing or complete
        if (endIndex < totalCount) {
          // Use setTimeout to yield control to the event loop
          setTimeout(() => processNextChunk(endIndex), delayBetweenChunks);
        } else {
          // Processing complete
          this.isProcessing = false;
          resolve(results);
        }
      };

      // Start processing
      processNextChunk(0);
    });
  }

  /**
   * Process gRPC result progressively to prevent UI blocking
   */
  async processGrpcResult(
    grpcCall: () => Promise<any>,
    onProgress?: (progress: { status: string; details?: string }) => void
  ): Promise<any> {
    try {
      if (onProgress) {
        onProgress({ status: 'starting', details: 'Initiating gRPC call...' });
      }

      // Break the gRPC call into chunks by using setTimeout
      const result = await new Promise((resolve, reject) => {
        setTimeout(async () => {
          try {
            if (onProgress) {
              onProgress({ status: 'fetching', details: 'Fetching data from server...' });
            }
            
            const data = await grpcCall();
            
            if (onProgress) {
              onProgress({ status: 'processing', details: 'Processing received data...' });
            }
            
            // Yield control before resolving
            setTimeout(() => resolve(data), 1);
          } catch (error) {
            reject(error);
          }
        }, 1);
      });

      return result;
    } catch (error) {
      if (onProgress) {
        onProgress({ status: 'error', details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` });
      }
      throw error;
    }
  }

  cancel() {
    this.shouldCancel = true;
  }

  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }
}

export const progressiveProcessor = new ProgressiveDataProcessor();