import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { ChildProcessVisualization } from './ChildProcessVisualization';

interface GeospatialFeature {
  id: string;
  name: string;
  location: { latitude: number; longitude: number; altitude?: number };
  properties: Record<string, string>;
  timestamp: number;
}

interface DataPoint {
  id: string;
  location: { latitude: number; longitude: number; altitude?: number };
  value: number;
  unit: string;
  timestamp: number;
  metadata: Record<string, string>;
}

export function GrpcDemo() {
  const [isConnected, setIsConnected] = useState(false);
  const [features, setFeatures] = useState<GeospatialFeature[]>([]);
  const [streamData, setStreamData] = useState<DataPoint[]>([]);
  const [batchData, setBatchData] = useState<DataPoint[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [paramTestLoading, setParamTestLoading] = useState(false);
  const [paramTestData, setParamTestData] = useState<DataPoint[]>([]);
  const [testParams, setTestParams] = useState({
    maxPoints: 10000,
    resolution: 100,
    dataType: 'elevation'
  });
  
  // (removed legacy worker stream test state)
  
  // Simple gRPC examples state
  const [helloWorldInput, setHelloWorldInput] = useState('');
  const [echoParamInput, setEchoParamInput] = useState('');
  
  // (removed legacy worker stream progress/throttle state)

  // Optimized data processing state
  const [processingResult, setProcessingResult] = useState<{
    duration: number; 
    pointsPerSecond: number; 
    memoryUsage: string; 
    status: 'success' | 'failed' | 'running'; 
    data?: unknown;
  } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  useEffect(() => {
    initializeGrpc();
  }, []);

  const initializeGrpc = async () => {
    try {
      setLoading(true);
      
      // Test connection via IPC
      const health = await window.grpc.healthCheck();
      setIsConnected(health.healthy);
      
      console.log('✅ gRPC initialized via IPC:', health);
    } catch (error) {
      console.error('❌ gRPC initialization failed:', error);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadFeatures = async () => {
    if (!isConnected) return;
    
    try {
      setLoading(true);
      
      // Sample bounds for San Francisco area
      const bounds = {
        northeast: { latitude: 37.7849, longitude: -122.4094 },
        southwest: { latitude: 37.7749, longitude: -122.4194 }
      };
      
      const result = await window.grpc.getFeatures({ bounds, featureTypes: [], limit: 20 });
      setFeatures(result.features);
      
      console.log(`📍 Loaded ${result.features.length} features via gRPC`);
    } catch (error) {
      console.error('Failed to load features:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartStreaming = async () => {
    if (!isConnected || streaming) return;
    
    setStreaming(true);
    setStreamData([]);
    
    try {
      const bounds = {
        northeast: { latitude: 37.7849, longitude: -122.4094 },
        southwest: { latitude: 37.7749, longitude: -122.4194 }
      };
      
      console.log('🔄 Starting real-time gRPC stream (10 seconds)...');
      
      // This is the power of gRPC - simple async iteration with numpy data types!
      // Using getBatchDataWorkerStreamed with progress callback for real-time updates
      const result = await window.grpc.getBatchDataOptimized(
        bounds,
        ['elevation', 'temperature'],
        30,
        10,
        (progress) => {
        console.log('Streaming progress:', progress);
        // Update UI with progress - you could show real-time progress here
        }
      );
      
      console.log('Stream completed, result:', result);
      toast.success(`Processed ${result.totalProcessed} data points`);
    } catch (error) {
      console.error('Streaming error:', error);
    } finally {
      setStreaming(false);
      console.log('🛑 gRPC Stream ended');
    }
  };

  const handleStopStreaming = async () => {
    try {
      await window.grpc.stopStream();
      setStreaming(false);
      console.log('🛑 Stream stopped successfully');
    } catch (error) {
      console.error('Failed to stop stream:', error);
      setStreaming(false); // Still update UI state
    }
  };

  const handleLoadBatchData = async () => {
    if (!isConnected) return;
    
    try {
      setBatchLoading(true);
      setBatchData([]);
      
      // Sample bounds for San Francisco area
      const bounds = {
        northeast: { latitude: 37.7849, longitude: -122.4094 },
        southwest: { latitude: 37.7749, longitude: -122.4194 }
      };
      
      console.log('📦 Loading batch data via Optimized API...');
      const result = await window.grpc.getBatchDataOptimized(
        bounds,
        ['elevation'],
        50000,
        10,
        (progress: { processed: number; total: number; percentage: number; phase: string }) => console.log('Batch progress:', progress)
      );
      
      const usedWorkerThreads = result.strategy === 'worker_threads';
      const totalProcessed = usedWorkerThreads ? (result.stats?.totalProcessed || 0) : (result.totalProcessed || 0);
      const processingTime = usedWorkerThreads ? (result.stats?.processingTime || 0) : (result.processingTime || 0);
      // Logs reducidos para evitar overhead de DevTools con objetos grandes
      setBatchData([]);
      toast.success(`Batch Data Loaded!`, {
        description: `${totalProcessed.toLocaleString()} points in ${processingTime.toFixed(2)}s via ${usedWorkerThreads ? 'Worker Threads' : 'Worker Stream'}`
      });
    } catch (error) {
      console.error('Failed to load batch data:', error);
      toast.error('Failed to load batch data', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setBatchLoading(false);
    }
  };

  const handleParameterTest = async () => {
    if (!isConnected) return;
    
    try {
      setParamTestLoading(true);
      setParamTestData([]);
      
      // Sample bounds for San Francisco area
      const bounds = {
        northeast: { latitude: 37.7849, longitude: -122.4094 },
        southwest: { latitude: 37.7749, longitude: -122.4194 }
      };
      
      const totalStartTime = performance.now();
      // Log resumido
      console.log(`🧪 Testing: ${testParams.maxPoints.toLocaleString()} pts, res ${testParams.resolution}, type ${testParams.dataType}`);
      
      // Test with custom parameters
      console.log(`🔄 Starting gRPC call at ${new Date().toLocaleTimeString()}`);
      const grpcStartTime = performance.now();
      
      const result = await window.grpc.getBatchDataOptimized(
        bounds,
        [testParams.dataType],
        testParams.maxPoints,
        testParams.resolution,
        (progress: { processed: number; total: number; percentage: number; phase: string }) => console.log('Performance test progress:', progress)
      );
      
      const grpcEndTime = performance.now();
      const dataProcessingStartTime = performance.now();
      
      // Note: result structure changed for getBatchDataWorkerStreamed
      // No need for sample processing with the new worker-based approach
      
      const dataProcessingEndTime = performance.now();
      const totalEndTime = performance.now();
      
      const grpcTime = (grpcEndTime - grpcStartTime) / 1000;
      const dataProcessingTime = (dataProcessingEndTime - dataProcessingStartTime) / 1000;
      const totalDuration = (totalEndTime - totalStartTime) / 1000;
      
      // Use the sample data for display purposes
      const displayData = result.strategy === 'worker_stream' && result.dataSample ? result.dataSample : [];
      setParamTestData(displayData);
      
      // Calculate data transfer rate
      const estimatedDataSize = result.totalProcessed * 120; // rough estimate in bytes
      const transferRateMBps = (estimatedDataSize / (1024 * 1024)) / grpcTime;
      
      console.log(`⏱️ gRPC: ${grpcTime.toFixed(2)}s, Proc: ${dataProcessingTime.toFixed(2)}s, Total: ${totalDuration.toFixed(2)}s, Rate: ${transferRateMBps.toFixed(1)} MB/s`);
      
      toast.success(`Parameter Test Complete!`, {
        description: `${result.totalProcessed.toLocaleString()} ${testParams.dataType} points generated in ${totalDuration.toFixed(2)}s (${transferRateMBps.toFixed(1)} MB/s)`
      });
    } catch (error) {
      console.error('Parameter test failed:', error);
      toast.error('Parameter test failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setParamTestLoading(false);
    }
  };


  // Test de streaming con Web Worker (CERO bloqueo del hilo principal)
  // (removed legacy web worker deep-dive demo)

  // Optimized processing function with automatic strategy selection
  const runOptimizedProcessing = async () => {
    if (!isConnected || isProcessing) return;
    
    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingResult({ 
      duration: 0, 
      pointsPerSecond: 0, 
      memoryUsage: 'Processing...', 
      status: 'running' 
    });

    const bounds = {
      northeast: { latitude: 37.7849, longitude: -122.4094 },
      southwest: { latitude: 37.7749, longitude: -122.4194 }
    };

    try {
      console.log(`🎯 Processing ${testParams.maxPoints.toLocaleString()} points with auto strategy selection...`);
      const startTime = performance.now();

      const result = await window.grpc.getBatchDataOptimized(
        bounds,
        [testParams.dataType],
        testParams.maxPoints,
        testParams.resolution,
        (progress: { percentage: number }) => setProcessingProgress(progress.percentage)
      );
      
      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000;
      const usedWorkerThreads = result.strategy === 'worker_threads';
      const totalProcessed = usedWorkerThreads ? (result.stats?.totalProcessed || 0) : (result.totalProcessed || 0);
      const pointsPerSecond = Math.round(totalProcessed / duration);
      
      setProcessingResult({
        duration,
        pointsPerSecond,
        memoryUsage: usedWorkerThreads ? 'High (Node.js)' : 'Isolated (Worker)',
        status: 'success',
        data: result
      });
      
      console.log(`✅ Processing completed: ${duration.toFixed(2)}s, ${pointsPerSecond.toLocaleString()} pts/s`);
      
      toast.success(`⚡ Processing Complete!`, {
        description: `${totalProcessed.toLocaleString()} points in ${duration.toFixed(2)}s (${pointsPerSecond.toLocaleString()} pts/s) using ${usedWorkerThreads ? 'Worker Threads' : 'Worker Stream'}`
      });
      
    } catch (error) {
      console.error('❌ Optimized processing failed:', error);
      setProcessingResult({
        duration: 0,
        pointsPerSecond: 0,
        memoryUsage: 'Failed',
        status: 'failed'
      });
      toast.error('Processing failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // (removed legacy individual strategy testers)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">
          gRPC Geospatial Demo
        </h2>
        
        {/* Connection Status */}
        <div className="mb-6 p-4 rounded-lg bg-gray-50">
          <div className="flex items-center gap-2 mb-2">
            <div 
              className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="font-semibold">
              gRPC Status: {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          {!isConnected && (
            <Button 
              onClick={initializeGrpc}
              disabled={loading}
              className="mt-2"
            >
              {loading ? 'Connecting...' : 'Reconnect'}
            </Button>
          )}
        </div>

        {/* Feature Loading */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Load Geospatial Features</h3>
          <Button 
            onClick={handleLoadFeatures}
            disabled={!isConnected || loading}
            className="mb-4"
          >
            {loading ? 'Loading...' : 'Load Features'}
          </Button>
          
          {features.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">
                Loaded {features.length} features via gRPC:
              </h4>
              <div className="max-h-40 overflow-y-auto">
                {features.slice(0, 5).map((feature) => (
                  <div key={feature.id} className="text-sm mb-1">
                    <strong>{feature.name}</strong> - 
                    {feature.location.latitude.toFixed(4)}, 
                    {feature.location.longitude.toFixed(4)}
                    <span className="text-blue-600 ml-2">
                      (Protocol: {feature.properties.protocol || 'gRPC'})
                    </span>
                  </div>
                ))}
                {features.length > 5 && (
                  <div className="text-sm text-gray-600">
                    ... and {features.length - 5} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Batch Data Loading */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Batch Data Loading (Numpy Generated)</h3>
          <Button 
            onClick={handleLoadBatchData}
            disabled={!isConnected || batchLoading}
            className="mb-4"
          >
            {batchLoading ? 'Loading Batch Data...' : 'Load Batch Data (Elevation)'}
          </Button>
          
          {batchData.length > 0 && (
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">
                Loaded {batchData.length} data points via gRPC batch method:
              </h4>
              <div className="max-h-40 overflow-y-auto">
                {batchData.slice(0, 8).map((point) => (
                  <div key={point.id} className="text-sm mb-1">
                    <strong>📍 {point.location.latitude.toFixed(4)}, {point.location.longitude.toFixed(4)}</strong> - 
                    <span className="text-purple-600 ml-2">
                      {point.value.toFixed(2)} {point.unit}
                    </span>
                    <span className="text-gray-500 ml-2">
                      (Method: {point.metadata.generation_method})
                    </span>
                  </div>
                ))}
                {batchData.length > 8 && (
                  <div className="text-sm text-gray-600">
                    ... and {batchData.length - 8} more data points
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Parameter Testing */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Data Generator Parameter Testing</h3>
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Points
                </label>
                <select 
                  value={testParams.maxPoints}
                  onChange={(e) => setTestParams(prev => ({ ...prev, maxPoints: parseInt(e.target.value) }))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={1000}>1,000 points</option>
                  <option value={10000}>10,000 points</option>
                  <option value={100000}>100,000 points</option>
                  <option value={1000000}>1,000,000 points</option>
                  <option value={2000000}>2,000,000 points</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resolution
                </label>
                <input 
                  type="number"
                  value={testParams.resolution}
                  onChange={(e) => setTestParams(prev => ({ ...prev, resolution: parseInt(e.target.value) || 20 }))}
                  min="10"
                  max="1000"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Type
                </label>
                <select 
                  value={testParams.dataType}
                  onChange={(e) => setTestParams(prev => ({ ...prev, dataType: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="elevation">Elevation</option>
                  <option value="temperature">Temperature</option>
                  <option value="pressure">Pressure</option>
                  <option value="noise">Noise</option>
                  <option value="sine_wave">Sine Wave</option>
                </select>
              </div>
            </div>
            
            <Button 
              onClick={handleParameterTest}
              disabled={!isConnected || paramTestLoading}
              className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700"
            >
              {paramTestLoading ? 'Generating Data...' : `Generate ${testParams.maxPoints.toLocaleString()} Points`}
            </Button>
          </div>
          
          {paramTestData.length > 0 && (
            <div className="bg-indigo-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">
                Generated {paramTestData.length.toLocaleString()} data points:
              </h4>
              <div className="text-sm text-gray-600 mb-3">
                <strong>Type:</strong> {testParams.dataType} | 
                <strong> Resolution:</strong> {testParams.resolution} | 
                <strong> Method:</strong> numpy_{testParams.dataType}_batch
              </div>
              <div className="max-h-40 overflow-y-auto">
                {paramTestData.slice(0, 10).map((point) => (
                  <div key={point.id} className="text-sm mb-1">
                    <strong>📍 {point.location.latitude.toFixed(4)}, {point.location.longitude.toFixed(4)}</strong> - 
                    <span className="text-indigo-600 ml-2">
                      {point.value.toFixed(2)} {point.unit}
                    </span>
                    <span className="text-gray-500 ml-2">
                      (Grid: {point.metadata.grid_position})
                    </span>
                  </div>
                ))}
                {paramTestData.length > 10 && (
                  <div className="text-sm text-gray-600 mt-2">
                    ... and {(paramTestData.length - 10).toLocaleString()} more data points
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Simple gRPC Examples */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">🎯 Simple gRPC Examples</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">👋 Hola Mundo</h4>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Ingresa un mensaje..." 
                  value={helloWorldInput}
                  onChange={(e) => setHelloWorldInput(e.target.value)}
                  className="flex-1 px-3 py-1 border rounded text-sm"
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && helloWorldInput.trim()) {
                      try {
                        const response = await window.grpc.helloWorld({ message: helloWorldInput });
                        toast.success('Respuesta Hola Mundo', {
                          description: response.message
                        });
                        setHelloWorldInput(''); // Limpiar usando setState
                      } catch (error) {
                        toast.error('Hola Mundo Falló', {
                          description: error instanceof Error ? error.message : 'Error desconocido'
                        });
                      }
                    }
                  }}
                />
                <span className="text-xs text-gray-500 self-center">Presiona Enter</span>
              </div>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">🔢 Parámetro Echo</h4>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  placeholder="Valor..." 
                  value={echoParamInput}
                  onChange={(e) => setEchoParamInput(e.target.value)}
                  className="flex-1 px-3 py-1 border rounded text-sm"
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && echoParamInput.trim()) {
                      try {
                        const value = parseFloat(echoParamInput);
                        if (isNaN(value)) {
                          toast.error('Error', { description: 'Por favor ingresa un número válido' });
                          return;
                        }
                        const response = await window.grpc.echoParameter({ value, operation: 'square' });
                        toast.success('Respuesta Parámetro Echo', {
                          description: `${response.originalValue} al cuadrado = ${response.processedValue}`
                        });
                        setEchoParamInput(''); // Limpiar usando setState
                      } catch (error) {
                        toast.error('Parámetro Echo Falló', {
                          description: error instanceof Error ? error.message : 'Error desconocido'
                        });
                      }
                    }
                  }}
                />
                <span className="text-xs text-gray-500 self-center">Enter para elevar al cuadrado</span>
              </div>
            </div>
          </div>
        </div>

        {/* Streaming con Web Workers */}
        {/* Removed legacy Web Worker streaming demo section */}

        {/* ⚡ Optimized Data Processing */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">⚡ Optimized Data Processing</h3>
          
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 mb-6">
            <h4 className="font-semibold text-green-800 mb-3">
              🎯 Smart Processing Selection
            </h4>
            <p className="text-sm text-gray-700 mb-4">
              Automatically uses the best processing strategy for {testParams.maxPoints.toLocaleString()} {testParams.dataType} points:
              {testParams.maxPoints >= 50000 ? (
                <span className="ml-2 px-3 py-1 bg-green-100 text-green-700 rounded font-semibold">
                  ⚡ Child Process (50K+ points)
                </span>
              ) : (
                <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-700 rounded font-semibold">
                  🌐 Direct Processing (&lt;50K points)
                </span>
              )}
            </p>
            
            <div className="text-center">
              <Button 
                onClick={runOptimizedProcessing}
                disabled={!isConnected || isProcessing}
                className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-semibold py-4 text-lg"
              >
                {isProcessing ? 'Processing...' : `⚡ Process ${testParams.maxPoints.toLocaleString()} ${testParams.dataType} Points`}
              </Button>
              
              {isProcessing && (
                <div className="mt-4">
                  <div className="w-full bg-green-200 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-green-600 to-blue-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${processingProgress}%` }}
                    ></div>
                  </div>
                  <div className="text-sm text-green-600 mt-2 font-medium">
                    {processingProgress.toFixed(1)}% Complete - UI remains responsive!
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Processing Results */}
          {processingResult && processingResult.status === 'success' && (
            <div className="bg-white border border-green-200 rounded-lg p-6 mt-6">
              <h5 className="font-semibold text-green-800 mb-4">⚡ Processing Results</h5>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {processingResult.duration.toFixed(2)}s
                  </div>
                  <div className="text-sm text-gray-600">Duration</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {processingResult.pointsPerSecond.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Points/Second</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {processingResult.memoryUsage}
                  </div>
                  <div className="text-sm text-gray-600">Memory Usage</div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🎉</span>
                  <div>
                    <div className="font-bold text-green-800">Processing Complete!</div>
                    <div className="text-sm text-green-700">
                      Successfully processed {testParams.maxPoints.toLocaleString()} 
                      data points with optimized processing strategy {testParams.maxPoints >= 50000 ? '(Child Process)' : '(Direct Processing)'}.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Real-time Streaming */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Real-time gRPC Data Stream (Numpy Generated)</h3>
          <div className="flex gap-2 mb-4">
            <Button 
              onClick={handleStartStreaming}
              disabled={!isConnected || streaming}
              className="bg-green-600 hover:bg-green-700"
            >
              {streaming ? 'Streaming...' : 'Start gRPC Stream'}
            </Button>
            
            {streaming && (
              <Button 
                onClick={handleStopStreaming}
                className="bg-red-600 hover:bg-red-700"
              >
                Stop Stream
              </Button>
            )}
          </div>
          
          {streamData.length > 0 && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">
                Real-time gRPC Data ({streamData.length} points):
              </h4>
              <div className="max-h-40 overflow-y-auto">
                {streamData.slice().reverse().map((point) => (
                  <div key={point.id} className="text-sm mb-1 font-mono">
                    <span className="text-blue-600">{point.metadata.sensor_type}</span>: 
                    <span className="font-bold"> {point.value.toFixed(2)} {point.unit}</span>
                    <span className="text-gray-500 ml-2">
                      ({point.location.latitude.toFixed(4)}, {point.location.longitude.toFixed(4)})
                    </span>
                    <span className="text-green-600 ml-2">
                      [gRPC]
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ⚡ ECharts + Real Web Workers Visualization */}

      {/* 🚀 NEW: Main Process Worker Threads Visualization */}
      <div className="mt-8 border-t pt-6">
        <ChildProcessVisualization 
          title="🚀 Main Process Worker Threads - Production Ready"
          maxPoints={2000000}
        />
      </div>
    </div>
  );
} 