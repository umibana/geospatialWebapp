// Streaming gRPC client that processes data progressively to prevent UI freezing

export interface StreamingDataPoint {
  id: string;
  location: { latitude: number; longitude: number; altitude: number };
  value: number;
  unit: string;
  timestamp: number;
  metadata: Record<string, string>;
}

export interface StreamingProgress {
  chunksReceived: number;
  totalChunks: number;
  pointsReceived: number;
  estimatedTotal: number;
  percentage: number;
  transferRate: number; // points per second
}

export class StreamingGrpcClient {
  private isStreaming = false;
  private startTime = 0;
  private totalPointsReceived = 0;

  async streamBatchData(
    bounds: { northeast: { latitude: number; longitude: number }; southwest: { latitude: number; longitude: number } },
    dataTypes: string[],
    maxPoints: number,
    resolution: number,
    onProgress: (progress: StreamingProgress) => void,
    onChunk: (chunk: StreamingDataPoint[]) => void
  ): Promise<{ totalCount: number; generationMethod: string; duration: number }> {
    return new Promise((resolve, reject) => {
      try {
        this.isStreaming = true;
        this.startTime = performance.now();
        this.totalPointsReceived = 0;

        console.log('🔄 Starting progressive streaming gRPC call...');

        // Set up IPC listener for stream chunks
        const handleChunk = (event: any, chunkData: any) => {
          if (!this.isStreaming) return;

          try {
            const { dataPoints, chunkNumber, totalChunks, isComplete } = chunkData;
            
            // Process chunk progressively using setTimeout to yield control
            this.processChunkProgressively(dataPoints, (processedPoints) => {
              this.totalPointsReceived += processedPoints.length;
              
              // Calculate progress
              const progress: StreamingProgress = {
                chunksReceived: chunkNumber,
                totalChunks: totalChunks,
                pointsReceived: this.totalPointsReceived,
                estimatedTotal: maxPoints,
                percentage: (this.totalPointsReceived / maxPoints) * 100,
                transferRate: this.totalPointsReceived / ((performance.now() - this.startTime) / 1000)
              };

              // Send progress update
              onProgress(progress);
              
              // Send processed chunk
              onChunk(processedPoints);

              // Complete if final chunk
              if (isComplete) {
                window.electronAPI.off('grpc-stream-chunk', handleChunk);
                this.isStreaming = false;
                const duration = (performance.now() - this.startTime) / 1000;
                
                resolve({
                  totalCount: this.totalPointsReceived,
                  generationMethod: 'streaming_progressive',
                  duration
                });
              }
            });

          } catch (error) {
            console.error('Error processing chunk:', error);
            window.electronAPI.off('grpc-stream-chunk', handleChunk);
            this.isStreaming = false;
            reject(error);
          }
        };

        // Listen for stream chunks
        window.electronAPI.on('grpc-stream-chunk', handleChunk);

        // Start the streaming call
        window.electronGrpc.getBatchDataStreamed(bounds, dataTypes, maxPoints, resolution)
          .catch((error) => {
            window.electronAPI.off('grpc-stream-chunk', handleChunk);
            this.isStreaming = false;
            reject(error);
          });

      } catch (error) {
        this.isStreaming = false;
        reject(error);
      }
    });
  }

  private processChunkProgressively(
    dataPoints: any[],
    onComplete: (processedPoints: StreamingDataPoint[]) => void
  ) {
    const processedPoints: StreamingDataPoint[] = [];
    const chunkSize = 1000; // Process 1000 points at a time
    let index = 0;

    const processNextBatch = () => {
      const endIndex = Math.min(index + chunkSize, dataPoints.length);
      
      // Process batch
      for (let i = index; i < endIndex; i++) {
        const point = dataPoints[i];
        processedPoints.push({
          id: point.id,
          location: {
            latitude: point.location.latitude,
            longitude: point.location.longitude,
            altitude: point.location.altitude
          },
          value: point.value,
          unit: point.unit,
          timestamp: Number(point.timestamp),
          metadata: point.metadata || {}
        });
      }

      index = endIndex;

      // Continue processing or complete
      if (index < dataPoints.length) {
        // Use setTimeout to yield control to the main thread
        setTimeout(processNextBatch, 1);
      } else {
        onComplete(processedPoints);
      }
    };

    // Start processing
    processNextBatch();
  }

  stopStreaming() {
    this.isStreaming = false;
    console.log('🛑 Streaming stopped by user');
  }

  isCurrentlyStreaming(): boolean {
    return this.isStreaming;
  }
}

export const streamingGrpcClient = new StreamingGrpcClient();