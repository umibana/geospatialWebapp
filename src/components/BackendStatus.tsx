import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';

interface BackendStatusProps {
  className?: string;
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: number;
  uptime: number;
  django: {
    version: string;
    debug: boolean;
    status: string;
  };
  grpc: {
    running: boolean;
    port: number | null;
    status: string;
  };
  services: {
    rest_api: boolean;
    grpc_service: boolean;
    database: boolean;
  };
  error?: string;
}

export function BackendStatus({ className = '' }: BackendStatusProps) {
  const [backendUrl, setBackendUrl] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const checkBackendStatus = async () => {
    try {
      // Get backend URL from Electron
      const url = await window.electronBackend.getBackendUrl();
      setBackendUrl(url);
      
      // Call the health endpoint
      const response = await fetch(`${url}/api/health/`);
      const healthData: HealthStatus = await response.json();
      
      setHealthStatus(healthData);
      console.log('Backend health status:', healthData);
    } catch (error) {
      console.error('Failed to check backend status:', error);
      setBackendUrl(null);
      setHealthStatus({
        status: 'unhealthy',
        timestamp: Date.now(),
        uptime: 0,
        django: { version: 'unknown', debug: false, status: 'stopped' },
        grpc: { running: false, port: null, status: 'stopped' },
        services: { rest_api: false, grpc_service: false, database: false },
        error: error instanceof Error ? error.message : 'Connection failed'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestartBackend = async () => {
    try {
      setLoading(true);
      const result = await window.electronBackend.restartBackend();
      console.log('Backend restarted:', result);
      // Wait a moment for the backend to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      await checkBackendStatus();
    } catch (error) {
      console.error('Failed to restart backend:', error);
    } finally {
      setLoading(false);
    }
  };

  const testBackendAPI = async () => {
    if (!backendUrl) return;
    
    try {
      const response = await fetch(`${backendUrl}/api/data/`);
      const data = await response.json();
      console.log('Backend API response:', data);
      alert(`Backend API Test:\n${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      console.error('Failed to test backend API:', error);
      alert('Failed to connect to backend API');
    }
  };

  useEffect(() => {
    checkBackendStatus();
    
    // Check status every 30 seconds
    const interval = setInterval(checkBackendStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={`p-4 border rounded-lg ${className}`}>
        <div className="flex items-center">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="ml-2">Checking backend status...</span>
        </div>
      </div>
    );
  }

  const isHealthy = healthStatus?.status === 'healthy';

  return (
    <div className={`p-4 border rounded-lg ${className} ${isHealthy ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
      <h3 className="font-semibold mb-3 flex items-center">
        <div 
          className={`w-3 h-3 rounded-full mr-2 ${
            isHealthy ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        Backend Status: {isHealthy ? 'Healthy' : 'Unhealthy'}
      </h3>
      
      <div className="space-y-3">
        {/* Basic Info */}
        {backendUrl && (
          <div className="text-sm">
            <strong>URL:</strong> {backendUrl}
          </div>
        )}
        
        {healthStatus && (
          <>
            {/* Django Status */}
            <div className="text-sm">
              <strong>Django:</strong> v{healthStatus.django.version} 
              <span className={`ml-1 px-1 py-0.5 text-xs rounded ${
                healthStatus.django.status === 'running' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {healthStatus.django.status}
              </span>
              {healthStatus.django.debug && (
                <span className="ml-1 px-1 py-0.5 text-xs rounded bg-yellow-100 text-yellow-800">
                  DEBUG
                </span>
              )}
            </div>

            {/* gRPC Status */}
            <div className="text-sm">
              <strong>gRPC:</strong> 
              <span className={`ml-1 px-1 py-0.5 text-xs rounded ${
                healthStatus.grpc.running ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {healthStatus.grpc.status}
              </span>
              {healthStatus.grpc.port && (
                <span className="ml-1 text-gray-600">
                  :{healthStatus.grpc.port}
                </span>
              )}
            </div>

            {/* Services Status */}
            <div className="text-sm">
              <strong>Services:</strong>
              <div className="ml-2 mt-1 space-y-1">
                <div className="flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-2 ${healthStatus.services.rest_api ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  REST API
                </div>
                <div className="flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-2 ${healthStatus.services.grpc_service ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  gRPC Service
                </div>
                <div className="flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-2 ${healthStatus.services.database ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  Database
                </div>
              </div>
            </div>

            {/* Error Info */}
            {healthStatus.error && (
              <div className="text-sm text-red-600 bg-red-100 p-2 rounded">
                <strong>Error:</strong> {healthStatus.error}
              </div>
            )}

            {/* Timestamp */}
            <div className="text-xs text-gray-500">
              Last checked: {new Date(healthStatus.timestamp).toLocaleTimeString()}
            </div>
          </>
        )}
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button 
            size="sm" 
            onClick={checkBackendStatus}
            variant="outline"
            disabled={loading}
          >
            Refresh
          </Button>
          
          <Button 
            size="sm" 
            onClick={handleRestartBackend}
            variant="outline"
            disabled={loading}
          >
            Restart
          </Button>
          
          {backendUrl && (
            <Button 
              size="sm" 
              onClick={testBackendAPI}
              variant="outline"
              disabled={loading}
            >
              Test API
            </Button>
          )}
        </div>
      </div>
    </div>
  );
} 