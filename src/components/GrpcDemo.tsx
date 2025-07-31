import React, { useEffect, useState } from 'react';
import { grpcClient } from '../helpers/grpc_client';
import { Button } from './ui/button';

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
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initializeGrpc();
  }, []);

  const initializeGrpc = async () => {
    try {
      setLoading(true);
      
      // Test connection via IPC
      const health = await grpcClient.healthCheck();
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
      
      const result = await grpcClient.getFeatures(bounds, [], 20);
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
      
      console.log('🔄 Starting real-time gRPC stream...');
      
      // This is the power of gRPC - simple async iteration!
      for await (const dataPoint of grpcClient.streamData(bounds, [], 5)) {
        setStreamData(prev => {
          const newData = [...prev, dataPoint];
          // Keep only last 10 data points for display
          return newData.slice(-10);
        });
      }
    } catch (error) {
      console.error('Streaming error:', error);
    } finally {
      setStreaming(false);
      console.log('🛑 gRPC Stream ended');
    }
  };

  const handleStopStreaming = () => {
    setStreaming(false);
    // In a real implementation, you'd cancel the async iterator
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

        {/* Real-time Streaming */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Real-time gRPC Data Stream</h3>
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
  );
} 