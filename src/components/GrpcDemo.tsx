import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { toast } from 'sonner';

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
  
  // Web Worker streaming test state (CERO bloqueo del hilo principal)
  const [workerStreamLoading, setWorkerStreamLoading] = useState(false);
  const [workerStreamResult, setWorkerStreamResult] = useState<{ totalProcessed: number; processingTime: number; generationMethod: string; summary: Record<string, unknown> } | null>(null);
  
  // Simple gRPC examples state
  const [helloWorldInput, setHelloWorldInput] = useState('');
  const [echoParamInput, setEchoParamInput] = useState('');
  
  // Web Worker progress state
  const [workerProgress, setWorkerProgress] = useState<{
    isProcessing: boolean;
    processed: number;
    total: number;
    percentage: number;
    currentMethod?: string;
  }>({
    isProcessing: false,
    processed: 0,
    total: 0,
    percentage: 0
  });

  // Throttle state updates to prevent floating window freezing
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  const updateThrottleMs = 100; // Update UI every 100ms max

  // Throttled progress update function
  const updateProgressThrottled = (newProgress: Partial<typeof workerProgress>) => {
    const now = Date.now();
    
    // Always update if processing is complete or if enough time has passed
    if (!newProgress.isProcessing || (now - lastUpdateTime >= updateThrottleMs)) {
      setWorkerProgress(prev => ({ ...prev, ...newProgress }));
      setLastUpdateTime(now);
    }
  };

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
      const result = await window.grpc.getBatchDataWorkerStreamed(bounds, ['elevation', 'temperature'], 30, 10, (progress) => {
        console.log('Streaming progress:', progress);
        // Update UI with progress - you could show real-time progress here
      });
      
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
      
      console.log('📦 Loading batch data via gRPC...');
      
      // Note: getBatchData method doesn't exist, using getBatchDataWorkerStreamed instead
      const result = await window.grpc.getBatchDataWorkerStreamed(
        bounds, 
        ['elevation'], // Data type
        50, // Max points
        10, // Resolution
        (progress: { processed: number; total: number; percentage: number; phase: string }) => console.log('Batch progress:', progress)
      );
      
      console.log('📦 Raw gRPC result:', result);
      console.log('📦 Total processed:', result.totalProcessed);
      console.log('📦 Processing time:', result.processingTime);
      
      // Note: getBatchDataWorkerStreamed returns different structure
      console.log('Batch data result:', result);
      setBatchData([]);
      
      console.log(`📦 Processed ${result.totalProcessed || 0} data points via gRPC worker method`);
      console.log(`📦 Generation method: ${result.generationMethod}`);
      toast.success(`Batch Data Loaded!`, {
        description: `Points: ${result.totalCount} | Method: ${result.generationMethod}${result.dataPoints?.[0] ? ` | Sample: ${result.dataPoints[0].value.toFixed(2)} ${result.dataPoints[0].unit}` : ''}`
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
      console.log(`🧪 Testing data generator with ${testParams.maxPoints.toLocaleString()} points, resolution ${testParams.resolution}, type ${testParams.dataType}...`);
      
      // Test with custom parameters
      console.log(`🔄 Starting gRPC call at ${new Date().toLocaleTimeString()}`);
      const grpcStartTime = performance.now();
      
      const result = await window.grpc.getBatchDataWorkerStreamed(
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
      
      // Note: getBatchDataWorkerStreamed returns summary data, not the raw points\n      // Use the sample data for display purposes\n      const displayData = result.dataSample || [];\n      setParamTestData(displayData);
      
      // Calculate data transfer rate
      const estimatedDataSize = result.totalProcessed * 120; // rough estimate in bytes
      const transferRateMBps = (estimatedDataSize / (1024 * 1024)) / grpcTime;
      
      console.log(`⏱️  Frontend Timing Breakdown:`);
      console.log(`   • gRPC call (round-trip): ${grpcTime.toFixed(3)}s`);
      console.log(`   • Data processing: ${dataProcessingTime.toFixed(3)}s`);
      console.log(`   • Total frontend time: ${totalDuration.toFixed(3)}s`);
      console.log(`   • Estimated transfer rate: ${transferRateMBps.toFixed(1)} MB/s`);
      console.log(`🧪 Generated ${result.totalProcessed} data points using ${result.generationMethod}`);
      
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
  const runWorkerStreamTest = async () => {
    if (!isConnected) return;
    
    try {
      setWorkerStreamLoading(true);
      updateProgressThrottled({
        isProcessing: true,
        processed: 0,
        total: testParams.maxPoints,
        percentage: 0,
        currentMethod: 'worker-stream'
      });
      
      const bounds = {
        northeast: { latitude: 37.7849, longitude: -122.4094 },
        southwest: { latitude: 37.7749, longitude: -122.4194 }
      };
      
      const startTime = performance.now();
      console.log(`⚡ Iniciando test de streaming con Web Worker: ${testParams.maxPoints} puntos (CERO bloqueo del hilo principal)...`);
      
      // Usar enfoque de streaming con Web Worker - sin acumulación de datos en hilo principal
      const result = await window.grpc.getBatchDataWorkerStreamed(
        bounds, 
        [testParams.dataType], 
        testParams.maxPoints, 
        testParams.resolution,
        // Callback de progreso desde Web Worker (solo actualizaciones ligeras de progreso)
        (progress: { processed: number; total: number; percentage: number; phase: string }) => {
          updateProgressThrottled({
            processed: progress.processed,
            total: progress.total,
            percentage: progress.percentage,
            isProcessing: progress.percentage < 100
          });
          const phaseText = progress.phase === 'calculating_statistics' ? 'Calculando estadísticas' : 
                           progress.phase === 'processing_worker' ? 'Procesando con Web Worker' : 
                           progress.phase;
          console.log(`⚡ Progreso Worker Stream [${phaseText}]: ${progress.processed}/${progress.total} (${progress.percentage.toFixed(1)}%)`);
        }
      );
      
      const endTime = performance.now();
      const totalDuration = (endTime - startTime) / 1000;
      
      // Calculate statistics based on processing summary (no raw data transferred)
      const estimatedDataSize = result.totalProcessed * 120;
      const transferRateMBps = (estimatedDataSize / (1024 * 1024)) / result.processingTime;
      
      const testResult = {
        points: result.totalProcessed,
        totalDuration: totalDuration,
        processingTime: result.processingTime,
        transferRate: transferRateMBps,
        method: result.generationMethod,
        dataSize: estimatedDataSize,
        summary: result.summary,
        dataSample: result.dataSample, // ¡Datos reales recibidos!
        completed: true
      };
      
      setWorkerStreamResult(testResult);
      
      console.log(`✅ Web Worker streaming test completed:`, testResult);
      
      // Reset progress
      updateProgressThrottled({
        isProcessing: false,
        processed: testResult.points,
        total: testResult.points,
        percentage: 100
      });
      
      toast.success(`¡Streaming con Web Worker Completado!`, {
        description: `${result.totalProcessed.toLocaleString()} puntos de ${testParams.dataType} procesados en ${totalDuration.toFixed(2)}s (${transferRateMBps.toFixed(1)} MB/s) - ¡CERO bloqueo de UI! Ver muestra de datos abajo.`
      });
      
    } catch (error) {
      console.error(`❌ Test de streaming con Web Worker falló:`, error);
      toast.error(`Test de streaming con Web Worker falló`, {
        description: error instanceof Error ? error.message : 'Error desconocido'
      });
      updateProgressThrottled({
        isProcessing: false,
        processed: 0,
        total: 0,
        percentage: 0
      });
    } finally {
      setWorkerStreamLoading(false);
    }
  };



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
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">⚡ Streaming con Web Workers</h3>
          
          {/* Test de Responsividad de UI */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              <div>
                <h4 className="font-semibold text-blue-800">Test de Responsividad de UI</h4>
                <p className="text-sm text-blue-600">
                  Este spinner <strong>nunca debe dejar de moverse</strong> durante las pruebas. 
                  ¡Las ventanas flotantes deben permanecer arrastrables! ✨
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg mb-4">
            <p className="text-sm text-gray-700 mb-4">
              ⚡ <strong>CERO Bloqueo de UI:</strong> Streaming con Web Workers que reenvía chunks directamente a Web Workers sin acumulación en el hilo principal:
            </p>
            
            <Button 
              onClick={runWorkerStreamTest}
              disabled={!isConnected || workerStreamLoading}
              className="w-full bg-yellow-600 hover:bg-yellow-700"
            >
              {workerStreamLoading ? 'Procesando...' : `⚡ Probar ${testParams.maxPoints.toLocaleString()} Puntos (Web Worker Stream)`}
            </Button>
          </div>
          
          {/* Resultados de Streaming con Web Worker */}
          {workerStreamResult && (
            <div className="bg-white border rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-yellow-800 mb-2">⚡ Resultados de Streaming con Web Worker</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Puntos:</span>
                  <div className="font-bold">{workerStreamResult.points.toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-gray-600">Duración:</span>
                  <div className="font-bold">{workerStreamResult.totalDuration.toFixed(2)}s</div>
                </div>
                <div>
                  <span className="text-gray-600">Tiempo de Procesamiento:</span>
                  <div className="font-bold">{workerStreamResult.processingTime.toFixed(2)}s</div>
                </div>
                <div>
                  <span className="text-gray-600">Método:</span>
                  <div className="font-bold">Worker Sin-Bloqueo</div>
                </div>
              </div>
              <div className="mt-3 p-2 bg-yellow-100 rounded text-sm">
                <strong>Resumen:</strong> Promedio: {workerStreamResult.summary?.avgValue}, 
                Mín: {workerStreamResult.summary?.minValue}, 
                Máx: {workerStreamResult.summary?.maxValue}
                <div className="text-yellow-700 font-semibold">⚡ ¡CERO bloqueo del hilo principal!</div>
              </div>
              
              {/* Visualización de Datos Reales Recibidos */}
              {workerStreamResult.dataSample && workerStreamResult.dataSample.length > 0 && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                  <h5 className="font-semibold text-green-800 mb-3">
                    📊 Muestra de Datos Reales Recibidos (Distribuida en todo el dataset)
                  </h5>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-green-100">
                          <th className="px-2 py-1 text-left font-semibold">Posición</th>
                          <th className="px-2 py-1 text-left font-semibold">ID</th>
                          <th className="px-2 py-1 text-left font-semibold">Latitud</th>
                          <th className="px-2 py-1 text-left font-semibold">Longitud</th>
                          <th className="px-2 py-1 text-left font-semibold">Valor</th>
                          <th className="px-2 py-1 text-left font-semibold">Unidad</th>
                          <th className="px-2 py-1 text-left font-semibold">Tipo</th>
                          <th className="px-2 py-1 text-left font-semibold">Tiempo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workerStreamResult.dataSample.map((point: {
                          id: string;
                          latitude: number;
                          longitude: number;
                          valor: number;
                          unidad: string;
                          tipo: string;
                          timestamp: string;
                          posicion?: string;
                        }, index: number) => (
                          <tr key={point.id} className={index % 2 === 0 ? 'bg-white' : 'bg-green-25'}>
                            <td className="px-2 py-1 font-mono text-xs text-blue-600">{point.posicion || `${index + 1}/10`}</td>
                            <td className="px-2 py-1 font-mono text-xs">{point.id.substring(0, 8)}...</td>
                            <td className="px-2 py-1">{point.latitude.toFixed(4)}</td>
                            <td className="px-2 py-1">{point.longitude.toFixed(4)}</td>
                            <td className="px-2 py-1 font-bold text-green-700">{point.valor.toFixed(2)}</td>
                            <td className="px-2 py-1">{point.unidad}</td>
                            <td className="px-2 py-1">{point.tipo}</td>
                            <td className="px-2 py-1 font-mono">{point.timestamp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 text-xs text-green-600">
                    ✅ <strong>Datos auténticos</strong> procesados por Web Worker desde gRPC backend
                    <br />🎯 <strong>Muestreo distribuido:</strong> Puntos tomados a lo largo de todo el dataset de 1M+ elementos
                  </div>
                </div>
              )}
              
              {/* Mini Gráfico de Distribución de Valores */}
              {workerStreamResult.dataSample && workerStreamResult.dataSample.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                  <h5 className="font-semibold text-blue-800 mb-3">
                    📈 Distribución Visual de Valores (Muestra)
                  </h5>
                  <div className="flex items-end gap-1 h-20 mb-2">
                    {workerStreamResult.dataSample.map((point: {
                      id: string;
                      valor: number;
                      latitude: number;
                      longitude: number;
                      unidad: string;
                    }, index: number) => {
                      // Calculate max value efficiently (safe for small sample)
                      const maxValue = workerStreamResult.dataSample.reduce((max: number, p: {valor: number}) => 
                        Math.max(max, p.valor), 0);
                      const height = maxValue > 0 ? (point.valor / maxValue) * 100 : 0;
                      return (
                        <div
                          key={point.id}
                          className="flex-1 bg-blue-500 rounded-t min-w-0 transition-all hover:bg-blue-600"
                          style={{ height: `${height}%` }}
                          title={`Punto ${index + 1}: ${point.valor.toFixed(2)} ${point.unidad}\nLat: ${point.latitude.toFixed(4)}, Lng: ${point.longitude.toFixed(4)}`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-blue-600">
                    <span>Inicio del dataset</span>
                    <span>Distribución de {workerStreamResult.dataSample[0]?.tipo || 'datos'} (muestreo)</span>
                    <span>Final del dataset</span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Indicador de Progreso */}
          {workerProgress.isProcessing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-blue-800">
                  🔧 Procesando Datos ({workerProgress.currentMethod})
                </h4>
                <span className="text-sm text-blue-600">
                  {workerProgress.percentage.toFixed(1)}%
                </span>
              </div>
              
              <div className="w-full bg-blue-200 rounded-full h-3 mb-2">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${workerProgress.percentage}%` }}
                ></div>
              </div>
              
              <div className="flex justify-between text-sm text-blue-700">
                <span>{workerProgress.processed.toLocaleString()} / {workerProgress.total.toLocaleString()} puntos</span>
                <span>Procesamiento con Web Worker - ¡UI permanece responsiva! ✨</span>
              </div>
            </div>
          )}
          

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
    </div>
    </div>
  );
} 