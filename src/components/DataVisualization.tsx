import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as echarts from 'echarts';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { webWorkerManager, type ChartConfig, type ProcessingStats } from '../helpers/webWorkerManager';

interface DataVisualizationProps {
  title?: string;
  maxPoints?: number;
  autoResize?: boolean;
}

export function DataVisualization({ 
  title = "🌍 Geospatial Data Visualization", 
  maxPoints = 1000000,
  autoResize = true 
}: DataVisualizationProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null);
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
      renderer: 'canvas', // Use canvas for better performance with large datasets
      useDirtyRect: true, // Optimize rendering
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
              <strong>Geospatial Point</strong><br/>
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
        symbolSize: 3,
        itemStyle: {
          color: function(params: any) {
            // Color based on value
            const value = params.data[2];
            const normalized = (value - 100) / (1000 - 100); // Assuming range 100-1000
            const hue = (1 - normalized) * 240; // Blue to red
            return `hsl(${hue}, 70%, 60%)`;
          }
        },
        emphasis: {
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 2
          }
        }
      }],
      animation: false // Disable animation for large datasets
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
    if (!chart || chart.isDisposed()) return;

    console.log(`📊 Updating chart with ${config.data.length} points (${config.metadata.samplingRatio.toFixed(2)}x sampling)`);

    // Update chart options with new data
    chart.setOption({
      title: {
        text: `${title} (${config.metadata.chartPoints.toLocaleString()}/${config.metadata.totalPoints.toLocaleString()} points)`,
        subtext: `Sampling: ${(config.metadata.samplingRatio * 100).toFixed(1)}%`
      },
      xAxis: {
        min: config.metadata.bounds.lng[0],
        max: config.metadata.bounds.lng[1]
      },
      yAxis: {
        min: config.metadata.bounds.lat[0],
        max: config.metadata.bounds.lat[1]
      },
      series: [{
        data: config.data,
        symbolSize: config.metadata.chartPoints > 50000 ? 2 : 3 // Smaller symbols for large datasets
      }]
    }, true);

    toast.success('Chart updated!', {
      description: `Visualizing ${config.metadata.chartPoints.toLocaleString()} points from ${config.metadata.totalPoints.toLocaleString()} total`
    });
  }, [title]);

  // Load and visualize large dataset
  const loadLargeDataset = useCallback(async () => {
    if (!webWorkerManager.isReady()) {
      toast.error('Web Worker not ready');
      return;
    }

    setIsLoading(true);
    setProgress({ processed: 0, total: 0, percentage: 0, phase: 'initializing' });

    try {
      // Sample bounds for demonstration (San Francisco Bay Area)
      const bounds = {
        northeast: { latitude: 37.8, longitude: -122.3 },
        southwest: { latitude: 37.7, longitude: -122.5 }
      };

      console.log(`🚀 Starting large dataset processing: ${maxPoints.toLocaleString()} points`);

      // Start the gRPC streaming with Web Worker processing
      const result = await window.grpc.getBatchDataWorkerStreamed(
        bounds,
        ['elevation', 'temperature'],
        maxPoints,
        50, // Higher resolution for detailed data
        // Progress callback
        (progressData) => {
          setProgress({
            processed: progressData.processed,
            total: progressData.total,
            percentage: progressData.percentage,
            phase: progressData.phase
          });
        },
        // Chunk callback - process each chunk in the Web Worker with throttling
        (chunkData) => {
          console.log(`📦 Received chunk ${chunkData.chunkNumber}/${chunkData.totalChunks}: ${chunkData.chunkData.data_points?.length || 0} points`);
          
          // Throttle chunk processing to prevent overwhelming the Web Worker
          setTimeout(() => {
            webWorkerManager.processChunk(
              {
                ...chunkData.chunkData,
                chunk_number: chunkData.chunkNumber,
                total_chunks: chunkData.totalChunks,
                points_in_chunk: chunkData.chunkData.data_points?.length || 0,
                is_final_chunk: chunkData.chunkNumber === chunkData.totalChunks
              },
              // Worker progress callback
              (workerProgress) => {
                setProgress(prev => ({
                  ...prev,
                  phase: `worker_${workerProgress.phase}`
                }));
              },
              // Chunk processed callback - update chart progressively
              async (chunkProcessedData) => {
                // Every 10 chunks, update the chart with current data
                if (chunkProcessedData.chunkNumber % 10 === 0 || chunkProcessedData.chunkNumber === chunkData.totalChunks) {
                  try {
                    const currentStats = await webWorkerManager.getCurrentStats();
                    setProcessingStats(currentStats);
                    
                    // Get partial chart data and update chart
                    if (currentStats.totalProcessed > 5000) { // Only update chart if we have enough data
                      const partialChartData = await webWorkerManager.prepareChartData({
                        maxPoints: 5000, // Smaller subset for progressive updates
                        chartType: 'scatter'
                      });
                      
                      setChartConfig(partialChartData);
                      updateChart(partialChartData);
                    }
                  } catch (error) {
                    console.log('⚠️ Progressive chart update skipped:', error);
                  }
                }
              }
            ).catch(error => {
              console.error('❌ Web Worker chunk processing failed:', error);
            });
          }, chunkData.chunkNumber * 2); // Small progressive delay
        }
      );

      console.log('🎉 gRPC streaming completed:', result);

      // Get processing statistics from Web Worker
      const stats = await webWorkerManager.getCurrentStats();
      setProcessingStats(stats);
      
      console.log('📊 Processing stats:', stats);

      // Prepare optimized chart data
      setProgress(prev => ({ ...prev, phase: 'preparing_chart' }));
      
      const chartData = await webWorkerManager.prepareChartData({
        maxPoints: 10000, // Limit chart points for performance
        chartType: 'scatter'
      });

      setChartConfig(chartData);
      updateChart(chartData);

      setProgress({ processed: stats.totalProcessed, total: stats.totalProcessed, percentage: 100, phase: 'complete' });

      toast.success('🎉 Large dataset visualization complete!', {
        description: `Processed ${stats.totalProcessed.toLocaleString()} points in ${stats.elapsedTime}s (${stats.pointsPerSecond.toLocaleString()} points/sec)`
      });

    } catch (error) {
      console.error('❌ Large dataset processing failed:', error);
      toast.error('Failed to load dataset', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
      setProgress(prev => ({ ...prev, phase: 'error' }));
    } finally {
      setIsLoading(false);
    }
  }, [maxPoints, updateChart]);

  // Test with different dataset sizes
  const testSizes = [10000, 100000, 500000, 1000000];

  return (
    <div className="w-full space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">ECharts + Web Workers</h3>
          <p className="text-sm text-gray-600">
            Ultra-responsive visualization of large geospatial datasets
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {testSizes.map(size => (
            <Button
              key={size}
              onClick={() => {
                // Update maxPoints and trigger load
                const currentMaxPoints = size;
                // Create a new promise with the specific size
                const testLoad = async () => {
                  setIsLoading(true);
                  setProgress({ processed: 0, total: 0, percentage: 0, phase: 'initializing' });

                  try {
                    const bounds = {
                      northeast: { latitude: 37.8, longitude: -122.3 },
                      southwest: { latitude: 37.7, longitude: -122.5 }
                    };

                    const result = await window.grpc.getBatchDataWorkerStreamed(
                      bounds,
                      ['elevation'],
                      currentMaxPoints,
                      30,
                      (progressData) => {
                        setProgress({
                          processed: progressData.processed,
                          total: progressData.total,
                          percentage: progressData.percentage,
                          phase: progressData.phase
                        });
                      },
                      (chunkData) => {
                        webWorkerManager.processChunk(
                          {
                            ...chunkData.chunkData,
                            chunk_number: chunkData.chunkNumber,
                            total_chunks: chunkData.totalChunks,
                            points_in_chunk: chunkData.chunkData.data_points?.length || 0,
                            is_final_chunk: chunkData.chunkNumber === chunkData.totalChunks
                          },
                          // Progress callback
                          (workerProgress) => {
                            setProgress(prev => ({
                              ...prev,
                              phase: `worker_${workerProgress.phase}`
                            }));
                          },
                          // Progressive updates - update chart every 20 chunks
                          async (chunkProcessedData) => {
                            if (chunkProcessedData.chunkNumber % 20 === 0) {
                              try {
                                const currentStats = await webWorkerManager.getCurrentStats();
                                const partialChart = await webWorkerManager.prepareChartData({
                                  maxPoints: 2000,
                                  chartType: 'scatter'
                                });
                                setChartConfig(partialChart);
                                updateChart(partialChart);
                              } catch (error) {
                                console.log('Progressive update skipped:', error);
                              }
                            }
                          }
                        ).catch(console.error);
                      }
                    );

                    const stats = await webWorkerManager.getCurrentStats();
                    setProcessingStats(stats);
                    
                    const chartData = await webWorkerManager.prepareChartData({
                      maxPoints: Math.min(currentMaxPoints / 10, 10000),
                      chartType: 'scatter'
                    });

                    setChartConfig(chartData);
                    updateChart(chartData);
                    setProgress({ processed: stats.totalProcessed, total: stats.totalProcessed, percentage: 100, phase: 'complete' });

                  } catch (error) {
                    console.error('Test failed:', error);
                    toast.error(`Failed to test ${size.toLocaleString()} points`);
                  } finally {
                    setIsLoading(false);
                  }
                };
                testLoad();
              }}
              disabled={isLoading}
              size="sm"
              variant={size === maxPoints ? "default" : "outline"}
            >
              {size.toLocaleString()}
            </Button>
          ))}
        </div>
      </div>

      {/* Progress */}
      {(isLoading || progress.percentage > 0) && (
        <div className="p-4 bg-white rounded-lg border shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Processing: {progress.phase.replace(/_/g, ' ')}
            </span>
            <span className="text-sm text-gray-500">
              {progress.percentage.toFixed(1)}%
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progress.percentage, 100)}%` }}
            />
          </div>
          
          {progress.total > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {progress.processed.toLocaleString()} / {progress.total.toLocaleString()} points
            </p>
          )}
        </div>
      )}

      {/* Statistics */}
      {processingStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-white rounded-lg border text-center">
            <div className="text-2xl font-bold text-blue-600">
              {processingStats.totalProcessed.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Points Processed</div>
          </div>
          
          <div className="p-3 bg-white rounded-lg border text-center">
            <div className="text-2xl font-bold text-green-600">
              {processingStats.pointsPerSecond.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Points/sec</div>
          </div>
          
          <div className="p-3 bg-white rounded-lg border text-center">
            <div className="text-2xl font-bold text-purple-600">
              {processingStats.avgValue}
            </div>
            <div className="text-xs text-gray-500">Avg Value</div>
          </div>
          
          <div className="p-3 bg-white rounded-lg border text-center">
            <div className="text-2xl font-bold text-orange-600">
              {processingStats.elapsedTime || processingStats.processingTime || 0}s
            </div>
            <div className="text-xs text-gray-500">Processing Time</div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="relative">
        <div 
          ref={chartRef}
          className="w-full bg-white rounded-lg border shadow-sm"
          style={{ height: '500px' }}
        />
        
        {chartConfig && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
            {chartConfig.metadata.chartPoints.toLocaleString()} points displayed
          </div>
        )}
      </div>

      {/* Chart Info */}
      {chartConfig && (
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>Total Points:</strong> {chartConfig.metadata.totalPoints.toLocaleString()}</p>
          <p><strong>Chart Points:</strong> {chartConfig.metadata.chartPoints.toLocaleString()}</p>
          <p><strong>Sampling Ratio:</strong> {(chartConfig.metadata.samplingRatio * 100).toFixed(1)}%</p>
          <p><strong>Value Range:</strong> {chartConfig.metadata.bounds.value[0].toFixed(2)} - {chartConfig.metadata.bounds.value[1].toFixed(2)}</p>
        </div>
      )}
    </div>
  );
}