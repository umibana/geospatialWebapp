// Web Worker for processing large datasets without blocking the main thread
// Includes IndexedDB access for non-blocking large dataset processing

// IndexedDB utilities for Web Worker
class WorkerIndexedDB {
  private dbName = 'GeospatialDataStore';
  private version = 1;
  private storeName = 'datasets';

  async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(new Error('Failed to open IndexedDB in worker'));
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('createdAt', 'metadata.createdAt', { unique: false });
        }
      };
    });
  }

  async getDataset(datasetId: string): Promise<any> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(datasetId);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to get dataset: ${request.error}`));
    });
  }

  async getDatasetChunk(datasetId: string, offset: number, limit: number): Promise<DataPoint[]> {
    const dataset = await this.getDataset(datasetId);
    if (!dataset) {
      throw new Error(`Dataset ${datasetId} not found in worker`);
    }

    const endIndex = Math.min(offset + limit, dataset.dataPoints.length);
    return dataset.dataPoints.slice(offset, endIndex);
  }
}

const workerDB = new WorkerIndexedDB();

export interface DataPoint {
  id: string;
  location: {
    latitude: number;
    longitude: number;
    altitude: number;
  };
  value: number;
  unit: string;
  timestamp: number;
  metadata: Record<string, string>;
}

export interface WorkerMessage {
  type: 'PROCESS_DATA' | 'PROCESS_CHUNK' | 'CALCULATE_STATS' | 'PROCESS_STORED_DATASET';
  payload: any;
  id: string;
}

export interface WorkerResponse {
  type: 'DATA_PROCESSED' | 'CHUNK_PROCESSED' | 'STATS_CALCULATED' | 'PROGRESS' | 'ERROR' | 'STORED_DATASET_PROCESSED';
  payload: any;
  id: string;
}

// Worker context - runs in separate thread
self.onmessage = function(event: MessageEvent<WorkerMessage>) {
  const { type, payload, id } = event.data;
  
  try {
    switch (type) {
      case 'PROCESS_DATA':
        processLargeDataset(payload, id);
        break;
        
      case 'PROCESS_CHUNK':
        processDataChunk(payload, id);
        break;
        
      case 'CALCULATE_STATS':
        calculateDataStats(payload, id);
        break;
        
      case 'PROCESS_STORED_DATASET':
        processStoredDataset(payload, id);
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      payload: { error: error instanceof Error ? error.message : 'Unknown error' },
      id
    } as WorkerResponse);
  }
};

function processLargeDataset(data: { dataPoints: DataPoint[]; chunkSize?: number }, id: string) {
  const { dataPoints, chunkSize = 5000 } = data;
  const totalPoints = dataPoints.length;
  let processedCount = 0;
  
  console.log(`🔧 Worker: Processing ${totalPoints} data points in chunks of ${chunkSize}`);
  
  // Process data in chunks to allow progress updates
  const processChunk = (startIndex: number) => {
    const endIndex = Math.min(startIndex + chunkSize, totalPoints);
    const chunk = dataPoints.slice(startIndex, endIndex);
    
    // Simulate some processing work (calculating statistics, transformations, etc.)
    const processedChunk = chunk.map(point => ({
      ...point,
      // Add processing timestamp
      processedAt: Date.now(),
      // Add some computed fields
      distanceFromCenter: Math.sqrt(
        Math.pow(point.location.latitude - 37.7749, 2) + 
        Math.pow(point.location.longitude + 122.4194, 2)
      ),
      // Normalize value (example processing)
      normalizedValue: point.value / 1000
    }));
    
    processedCount += chunk.length;
    
    // Send progress update
    self.postMessage({
      type: 'PROGRESS',
      payload: {
        processed: processedCount,
        total: totalPoints,
        percentage: (processedCount / totalPoints) * 100,
        chunk: processedChunk
      },
      id
    } as WorkerResponse);
    
    // Continue processing next chunk
    if (endIndex < totalPoints) {
      // Use setTimeout to yield control and prevent blocking
      setTimeout(() => processChunk(endIndex), 1);
    } else {
      // All chunks processed
      self.postMessage({
        type: 'DATA_PROCESSED',
        payload: {
          totalProcessed: processedCount,
          completed: true
        },
        id
      } as WorkerResponse);
    }
  };
  
  // Start processing
  processChunk(0);
}

function processDataChunk(data: { chunk: DataPoint[]; chunkIndex: number }, id: string) {
  const { chunk, chunkIndex } = data;
  
  console.log(`🔧 Worker: Processing chunk ${chunkIndex} with ${chunk.length} points`);
  
  // Process the chunk
  const processedChunk = chunk.map(point => ({
    ...point,
    processedAt: Date.now(),
    chunkIndex: chunkIndex,
    distanceFromCenter: Math.sqrt(
      Math.pow(point.location.latitude - 37.7749, 2) + 
      Math.pow(point.location.longitude + 122.4194, 2)
    )
  }));
  
  self.postMessage({
    type: 'CHUNK_PROCESSED',
    payload: {
      chunkIndex,
      processedChunk,
      pointCount: chunk.length
    },
    id
  } as WorkerResponse);
}

function calculateDataStats(data: { dataPoints: DataPoint[] }, id: string) {
  const { dataPoints } = data;
  
  console.log(`🔧 Worker: Calculating statistics for ${dataPoints.length} points`);
  
  if (dataPoints.length === 0) {
    self.postMessage({
      type: 'STATS_CALCULATED',
      payload: { error: 'No data points to analyze' },
      id
    } as WorkerResponse);
    return;
  }
  
  // Calculate statistics
  const values = dataPoints.map(p => p.value);
  const latitudes = dataPoints.map(p => p.location.latitude);
  const longitudes = dataPoints.map(p => p.location.longitude);
  
  const stats = {
    totalPoints: dataPoints.length,
    value: {
      min: Math.min(...values),
      max: Math.max(...values),
      mean: values.reduce((sum, val) => sum + val, 0) / values.length,
      median: values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
    },
    location: {
      bounds: {
        minLat: Math.min(...latitudes),
        maxLat: Math.max(...latitudes),
        minLng: Math.min(...longitudes),
        maxLng: Math.max(...longitudes)
      },
      center: {
        lat: latitudes.reduce((sum, val) => sum + val, 0) / latitudes.length,
        lng: longitudes.reduce((sum, val) => sum + val, 0) / longitudes.length
      }
    },
    dataTypes: [...new Set(dataPoints.map(p => p.unit))],
    timeRange: {
      earliest: Math.min(...dataPoints.map(p => p.timestamp)),
      latest: Math.max(...dataPoints.map(p => p.timestamp))
    }
  };
  
  self.postMessage({
    type: 'STATS_CALCULATED',
    payload: { stats },
    id
  } as WorkerResponse);
}

async function processStoredDataset(data: { datasetId: string; chunkSize?: number }, id: string) {
  const { datasetId, chunkSize = 5000 } = data;
  
  try {
    console.log(`🔧 Worker: Processing stored dataset ${datasetId} from IndexedDB`);
    
    // Get dataset metadata first
    const dataset = await workerDB.getDataset(datasetId);
    if (!dataset) {
      throw new Error(`Dataset ${datasetId} not found in IndexedDB`);
    }
    
    const totalPoints = dataset.metadata.totalCount;
    let processedCount = 0;
    
    console.log(`🔧 Worker: Found dataset with ${totalPoints} points, processing in chunks of ${chunkSize}`);
    
    // Process data in chunks to prevent memory issues and allow progress updates
    const processChunk = async (offset: number) => {
      try {
        // Get chunk from IndexedDB
        const chunk = await workerDB.getDatasetChunk(datasetId, offset, chunkSize);
        
        if (chunk.length === 0) {
          // All chunks processed
          self.postMessage({
            type: 'STORED_DATASET_PROCESSED',
            payload: {
              totalProcessed: processedCount,
              completed: true,
              datasetId
            },
            id
          } as WorkerResponse);
          return;
        }
        
        // Process the chunk (same processing as regular chunks)
        const processedChunk = chunk.map(point => ({
          ...point,
          processedAt: Date.now(),
          distanceFromCenter: Math.sqrt(
            Math.pow(point.location.latitude - 37.7749, 2) + 
            Math.pow(point.location.longitude + 122.4194, 2)
          ),
          normalizedValue: point.value / 1000
        }));
        
        processedCount += chunk.length;
        
        // Send progress update with processed chunk
        self.postMessage({
          type: 'PROGRESS',
          payload: {
            processed: processedCount,
            total: totalPoints,
            percentage: (processedCount / totalPoints) * 100,
            chunk: processedChunk,
            source: 'indexeddb'
          },
          id
        } as WorkerResponse);
        
        // Continue with next chunk
        if (processedCount < totalPoints) {
          // Small delay to yield control
          setTimeout(() => processChunk(offset + chunkSize), 1);
        } else {
          // All done
          self.postMessage({
            type: 'STORED_DATASET_PROCESSED',
            payload: {
              totalProcessed: processedCount,
              completed: true,
              datasetId
            },
            id
          } as WorkerResponse);
        }
        
      } catch (error) {
        throw new Error(`Failed to process chunk at offset ${offset}: ${error}`);
      }
    };
    
    // Start processing from the beginning
    await processChunk(0);
    
  } catch (error) {
    console.error(`🔧 Worker: Failed to process stored dataset ${datasetId}:`, error);
    self.postMessage({
      type: 'ERROR',
      payload: { error: error instanceof Error ? error.message : 'Unknown error processing stored dataset' },
      id
    } as WorkerResponse);
  }
}

export {};