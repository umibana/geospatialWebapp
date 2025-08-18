import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as echarts from 'echarts';
import { Button } from './ui/button';
import { toast } from 'sonner';

type WorkerThreadStats = {
  totalProcessed: number;
  avgValue: number;
  minValue: number;
  maxValue: number;
  dataTypes: string[];
  processingTime: number;
  pointsPerSecond: number;
};

type ChartConfig = {
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

interface WorkerThreadVisualizationProps {
  title?: string;
  maxPoints?: number;
  autoResize?: boolean;
}

export function WorkerThreadVisualization({ 
  title = "🚀 True Node.js Worker Threads", 
  maxPoints = 3000000,
  autoResize = true 
}: WorkerThreadVisualizationProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingStats, setProcessingStats] = useState<WorkerThreadStats | null>(null);
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);
  const [progress, setProgress] = useState({
    processed: 0,
    total: 0,
    percentage: 0,
    phase: 'ready'
  });

  // Initialize chart
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current, undefined, {
      renderer: 'canvas',
      useDirtyRect: true,
    });

    chartInstanceRef.current = chart;

    // Set initial empty chart
    chart.setOption({
      title: {
        text: title,
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: function(params: any) {
          if (Array.isArray(params.data)) {
            const [lng, lat, value] = params.data;
            return `
              <strong>Worker Thread Point</strong><br/>
              Longitude: ${lng.toFixed(6)}<br/>
              Latitude: ${lat.toFixed(6)}<br/>
              Value: ${value.toFixed(2)}
            `;
          }
          return 'Loading...';
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: 'Longitude',
        nameLocation: 'middle',
        nameGap: 30
      },
      yAxis: {
        type: 'value',
        name: 'Latitude',
        nameLocation: 'middle',
        nameGap: 30
      },
      series: [{
        type: 'scatter',
        data: [],
        symbolSize: 2,
        itemStyle: {
          color: function(params: any) {
            const value = params.data[2];
            const normalized = (value - 100) / (1000 - 100);
            const hue = (1 - normalized) * 240;
            return `hsl(${hue}, 70%, 60%)`;
          }
        },
        emphasis: {
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 1
          }
        }
      }],
      animation: false
    });

    // Handle resize
    const handleResize = () => {
      if (autoResize && chart && !chart.isDisposed()) {
        chart.resize();
      }
    };

    if (autoResize) {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (autoResize) {
        window.removeEventListener('resize', handleResize);
      }
      if (chart && !chart.isDisposed()) {
        chart.dispose();
      }
      chartInstanceRef.current = null;
    };
  }, [title, autoResize]);

  // Update chart with new data
  const updateChart = useCallback((config: ChartConfig) => {
    const chart = chartInstanceRef.current;
    if (!chart || chart.isDisposed() || !config || !config.data) return;

    console.log(`📊 Updating chart with ${config.data?.length || 0} points (worker thread data)`);

    const metadata = config.metadata || {};
    const bounds = metadata.bounds || { lng: [0, 0], lat: [0, 0], value: [0, 0] };

    chart.setOption({
      title: {
        text: `${title} (${(metadata.chartPoints || 0).toLocaleString()}/${(metadata.totalPoints || 0).toLocaleString()} points)`,
        subtext: `Worker Thread Sampling: ${((metadata.samplingRatio || 0) * 100).toFixed(1)}%`
      },
      xAxis: {
        min: bounds.lng[0],
        max: bounds.lng[1]
      },
      yAxis: {
        min: bounds.lat[0],
        max: bounds.lat[1]
      },
      series: [{
        type: 'scatter',
        data: config.data || [],
        symbolSize: (metadata.chartPoints || 0) > 50000 ? 1 : 2
      }]
    }, true);

    toast.success('Worker Thread Chart Updated!', {
      description: `Visualizing ${(metadata.chartPoints || 0).toLocaleString()} points from ${(metadata.totalPoints || 0).toLocaleString()} total`
    });
  }, [title]);

  // Test worker threads with ultra-large datasets
  const testWorkerThreads = useCallback(async (testMaxPoints: number) => {
    setIsLoading(true);
    setProgress({ processed: 0, total: 0, percentage: 0, phase: 'starting_worker_threads' });

    try {
      const bounds = {
        northeast: { latitude: 37.8, longitude: -122.3 },
        southwest: { latitude: 37.7, longitude: -122.5 }
      };

      console.log(`🚀 Starting Worker Threads with ${testMaxPoints.toLocaleString()} points...`);

      // Use the direct IPC mechanism for worker thread processing
      const requestId = `worker-thread-${Date.now()}-${Math.random()}`;
      
      const result = await new Promise<any>((resolve, reject) => {
        const handleProgress = (event: any, data: any) => {
          if (data.requestId !== requestId) return;
          
          if (data.type === 'progress') {
            setProgress({
              processed: data.processed,
              total: data.total,
              percentage: data.percentage,
              phase: data.phase
            });
          } else if (data.type === 'complete') {
            window.electronAPI.off('grpc-child-process-progress', handleProgress);
            window.electronAPI.off('grpc-child-process-error', handleError);
            resolve({
              strategy: 'worker_threads',
              stats: data.stats,
              chartConfig: data.chartConfig,
              requestId: requestId // Include the requestId for chart data fetching
            });
          }
        };
        
        const handleError = (event: any, data: any) => {
          if (data.requestId !== requestId) return;
          window.electronAPI.off('grpc-child-process-progress', handleProgress);
          window.electronAPI.off('grpc-child-process-error', handleError);
          reject(new Error(data.error));
        };
        
        window.electronAPI.on('grpc-child-process-progress', handleProgress);
        window.electronAPI.on('grpc-child-process-error', handleError);
        
        window.electronAPI.send('grpc-start-child-process-stream', {
          requestId,
          bounds,
          dataTypes: ['elevation'],
          maxPoints: testMaxPoints,
          resolution: 50
        });
      });

      console.log('🎉 Worker thread completed:', result);
      
      // Set final results with safe access
      if (result.strategy === 'worker_threads' && result.stats) {
        setProcessingStats(result.stats as WorkerThreadStats);
      }
      
      if (result.strategy === 'worker_threads' && result.chartConfig) {
        // Fetch chart data in chunks to avoid IPC blocking
        const chartData = await new Promise<Array<[number, number, number]>>((resolve, reject) => {
          const chartRequestId = result.requestId; // Use the same requestId from worker processing
          let collectedData: Array<[number, number, number]> = [];
          
          const handleChartData = (event: any, data: any) => {
            if (data.requestId !== chartRequestId) return;
            
            if (data.error) {
              window.electronAPI.off('grpc-chart-data-response', handleChartData);
              reject(new Error(data.error));
              return;
            }
            
            if (data.chunk) {
              collectedData = collectedData.concat(data.chunk);
            }
            
            if (data.isComplete) {
              window.electronAPI.off('grpc-chart-data-response', handleChartData);
              resolve(collectedData);
            } else if (data.nextOffset >= 0) {
              // Request next chunk
              window.electronAPI.send('grpc-get-chart-data', {
                requestId: chartRequestId,
                chunkSize: 1000,
                offset: data.nextOffset
              });
            }
          };
          
          window.electronAPI.on('grpc-chart-data-response', handleChartData);
          
          // Start fetching chart data
          window.electronAPI.send('grpc-get-chart-data', {
            requestId: chartRequestId,
            chunkSize: 1000,
            offset: 0
          });
        });
        
        const chartConfigWithData = {
          ...result.chartConfig,
          data: chartData
        };
        
        setChartConfig(chartConfigWithData as ChartConfig);
        updateChart(chartConfigWithData as ChartConfig);
      }

      const totalProcessed = (result.stats?.totalProcessed as number) || 0;
      const pointsPerSecond = (result.stats?.pointsPerSecond as number) || 0;

      setProgress({ 
        processed: totalProcessed, 
        total: totalProcessed, 
        percentage: 100, 
        phase: 'complete' 
      });

      toast.success('🎉 True Node.js Worker Threads Complete!', {
        description: `Processed ${totalProcessed.toLocaleString()} points at ${pointsPerSecond.toLocaleString()} points/sec`
      });

    } catch (error) {
      console.error('❌ Worker thread test failed:', error);
      toast.error('Worker thread test failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
      setProgress(prev => ({ ...prev, phase: 'error' }));
    } finally {
      setIsLoading(false);
    }
  }, [updateChart]);

  // Test sizes for worker threads (ultra-large datasets)
  const testSizes = [1000000, 2000000, 3000000, 5000000];

  return (
    <div className="w-full space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">🚀 True Node.js Worker Threads</h3>
          <p className="text-sm text-gray-600">
            Ultra-large datasets (3M+ points) with isolated worker thread processing
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {testSizes.map(size => (
            <Button
              key={size}
              onClick={() => testWorkerThreads(size)}
              disabled={isLoading}
              size="sm"
              variant={size === maxPoints ? "default" : "outline"}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {(size / 1000000).toFixed(1)}M
            </Button>
          ))}
        </div>
      </div>

      {/* Progress */}
      {(isLoading || progress.percentage > 0) && (
        <div className="p-4 bg-white rounded-lg border shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Worker Thread: {progress.phase.replace(/_/g, ' ')}
            </span>
            <span className="text-sm text-gray-500">
              {progress.percentage.toFixed(1)}%
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            ></div>
          </div>
          
          <div className="text-xs text-gray-500 mt-1">
            {progress.processed.toLocaleString()} / {progress.total.toLocaleString()} points
          </div>
        </div>
      )}

      {/* Processing Results */}
      {processingStats && (
        <div className="bg-white border border-purple-200 rounded-lg p-6">
          <h5 className="font-semibold text-purple-800 mb-4">⚡ Worker Thread Results</h5>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {processingStats.processingTime.toFixed(2)}s
              </div>
              <div className="text-sm text-gray-600">Duration</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">
                {processingStats.pointsPerSecond.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Points/Second</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {processingStats.totalProcessed.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Points</div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <div>
                <div className="font-bold text-purple-800">Worker Thread Processing Complete!</div>
                <div className="text-sm text-purple-700">
                  Ultra-large dataset processed with isolated worker threads for maximum performance and stability.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div ref={chartRef} style={{ width: '100%', height: '500px' }}></div>
      </div>
    </div>
  );
}