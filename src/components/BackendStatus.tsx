import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';

interface BackendStatusProps {
  className?: string;
}

export function BackendStatus({ className = '' }: BackendStatusProps) {
  const [backendUrl, setBackendUrl] = useState<string | null>(null);
  const [isHealthy, setIsHealthy] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const checkBackendStatus = async () => {
    try {
      const url = await window.electronBackend.getBackendUrl();
      const healthy = await window.electronBackend.healthCheck();
      
      setBackendUrl(url);
      setIsHealthy(healthy);
    } catch (error) {
      console.error('Failed to check backend status:', error);
      setBackendUrl(null);
      setIsHealthy(false);
    } finally {
      setLoading(false);
    }
  };

  const handleRestartBackend = async () => {
    try {
      setLoading(true);
      const result = await window.electronBackend.restartBackend();
      console.log('Backend restarted:', result);
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
      alert(`Backend response: ${JSON.stringify(data, null, 2)}`);
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
        <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        <span className="ml-2">Checking backend status...</span>
      </div>
    );
  }

  return (
    <div className={`p-4 border rounded-lg ${className}`}>
      <h3 className="font-semibold mb-2">Django Backend Status</h3>
      
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <div 
            className={`w-3 h-3 rounded-full ${
              isHealthy ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm">
            {isHealthy ? 'Healthy' : 'Unhealthy'}
          </span>
        </div>
        
        {backendUrl && (
          <div className="text-sm text-gray-600">
            URL: {backendUrl}
          </div>
        )}
        
        <div className="flex space-x-2 pt-2">
          <Button 
            size="sm" 
            onClick={checkBackendStatus}
            variant="outline"
          >
            Refresh Status
          </Button>
          
          <Button 
            size="sm" 
            onClick={handleRestartBackend}
            variant="outline"
          >
            Restart Backend
          </Button>
          
          {backendUrl && (
            <Button 
              size="sm" 
              onClick={testBackendAPI}
              variant="outline"
            >
              Test API
            </Button>
          )}
        </div>
      </div>
    </div>
  );
} 