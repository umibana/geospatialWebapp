import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';

type AxisKey = 'x' | 'y' | 'z';

export function CsvScatterChart({
  axes,
  metrics,
  onMetricsDetected,
  fullResolution = true,
  enableZoom = true,
  showHeatmap = false,
  heatmapBins = 60,
  height = 420,
  className = '',
}: {
  axes: { x: AxisKey; y: AxisKey };
  metrics?: string[];
  onMetricsDetected?: (keys: string[]) => void;
  fullResolution?: boolean;
  enableZoom?: boolean;
  showHeatmap?: boolean;
  heatmapBins?: number;
  height?: number;
  className?: string;
}) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [available, setAvailable] = useState<string[]>([]);

  // init / dispose
  useEffect(() => {
    if (chartRef.current && !chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current);
    }
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  // fetch metrics (if not provided) and aggregate on each change
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setIsLoading(true);
        // If metrics not provided, peek first chunk to infer available keys
        let metricsToUse = metrics;
        if (!metricsToUse || metricsToUse.length === 0) {
          const first = await window.autoGrpc.getLoadedDataChunk({ offset: 0, limit: 1 });
          const keys = first.available_metric_keys || [];
          if (!cancelled) {
            setAvailable(keys);
            onMetricsDetected?.(keys);
          }
          metricsToUse = keys.slice(0, 1);
        }
        const agg = await window.grpc.aggregateCsvSeries(axes.x, axes.y, metricsToUse || [], fullResolution ? 0 : 10000);
        if (!agg.success) throw new Error(agg.error || 'Aggregation failed');
        if (cancelled) return;
        const entries = Object.entries(agg.series || {});
        const series = entries.map(([metric, points]) => ({
          name: metric,
          type: 'scatter' as const,
          data: points.map(([x, y, value, id]) => [x, y, value, id]),
          symbolSize: (val: number[]) => {
            const v = val[2] ?? 0;
            const max = agg.ranges?.[metric]?.max || 1;
            const size = 4 + 16 * (Math.max(0, Math.min(1, v / max)));
            return size;
          },
          emphasis: { focus: 'series' as const },
          encode: { tooltip: [0, 1, 2] },
        }));
        // Heatmap density layer over all points
        let heatmapSeries: any[] = [];
        let visualMap: any = undefined;
        if (showHeatmap) {
          const allPts: Array<[number, number]> = [];
          for (const [, pts] of entries) {
            for (const p of pts) {
              const x = p[0] as number; const y = p[1] as number;
              if (Number.isFinite(x) && Number.isFinite(y)) allPts.push([x, y]);
            }
          }
          let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
          for (const [x, y] of allPts) {
            if (x < xMin) xMin = x; if (x > xMax) xMax = x;
            if (y < yMin) yMin = y; if (y > yMax) yMax = y;
          }
          if (!(Number.isFinite(xMin) && Number.isFinite(xMax) && Number.isFinite(yMin) && Number.isFinite(yMax))) {
            xMin = 0; xMax = 1; yMin = 0; yMax = 1;
          }
          const binsX = Math.max(heatmapBins, 10);
          const binsY = Math.max(heatmapBins, 10);
          const dx = (xMax - xMin) / binsX || 1;
          const dy = (yMax - yMin) / binsY || 1;
          const grid = new Map<string, number>();
          let maxCount = 0;
          for (const [x, y] of allPts) {
            const ix = Math.min(binsX - 1, Math.max(0, Math.floor((x - xMin) / dx)));
            const iy = Math.min(binsY - 1, Math.max(0, Math.floor((y - yMin) / dy)));
            const key = ix + ',' + iy;
            const c = (grid.get(key) || 0) + 1;
            grid.set(key, c);
            if (c > maxCount) maxCount = c;
          }
          const heatData: Array<[number, number, number]> = [];
          for (const [key, count] of grid.entries()) {
            const [ixStr, iyStr] = key.split(',');
            const ix = parseInt(ixStr, 10); const iy = parseInt(iyStr, 10);
            const cx = xMin + (ix + 0.5) * dx;
            const cy = yMin + (iy + 0.5) * dy;
            heatData.push([cx, cy, count]);
          }
          heatmapSeries = [
            {
              name: 'Density',
              type: 'heatmap',
              data: heatData,
              progressive: 20000,
              emphasis: { focus: 'series' as const },
            },
          ];
          visualMap = {
            min: 0,
            max: Math.max(1, Math.ceil(maxCount || 1)),
            calculable: true,
            orient: 'vertical',
            right: 16,
            top: 'middle',
            inRange: { color: ['#eff6ff', '#93c5fd', '#3b82f6', '#1e40af'] },
          };
        }
        chartInstanceRef.current?.setOption({
          tooltip: { trigger: 'item' },
          legend: { top: 0 },
          xAxis: { name: axes.x.toUpperCase() },
          yAxis: { name: axes.y.toUpperCase() },
          dataZoom: enableZoom
            ? [
                { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
                { type: 'inside', yAxisIndex: 0, filterMode: 'none' },
                { type: 'slider', xAxisIndex: 0, height: 18, bottom: 8 },
                { type: 'slider', yAxisIndex: 0, width: 18, right: 8 },
              ]
            : [],
          visualMap,
          series: showHeatmap ? heatmapSeries : series,
        }, { notMerge: true });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('CsvScatterChart aggregation failed:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [axes.x, axes.y, JSON.stringify(metrics)]);

  return (
    <div className={className}>
      <div ref={chartRef} className="w-full border rounded" style={{ height }} aria-label="CSV Scatter Chart" />
      {isLoading && (
        <p className="text-xs text-gray-500 mt-2" aria-live="polite">Preparing chart data…</p>
      )}
    </div>
  );
}

export default CsvScatterChart;


