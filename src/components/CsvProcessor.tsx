import React, { useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import CsvScatterChart from './CsvScatterChart';

interface ColumnInfo {
  name: string;
  type: string;
  is_required: boolean;
}

interface AnalyzeCsvResponse {
  columns: ColumnInfo[];
  auto_detected_mapping: Record<string, string>;
  success: boolean;
  error_message?: string;
}

interface SendFileResponse {
  total_rows_processed: number;
  valid_rows: number;
  invalid_rows: number;
  errors: string[];
  success: boolean;
  processing_time: string;
}

interface LoadedDataStats {
  total_points: number;
  x_stats: Record<string, number>;
  y_stats: Record<string, number>;
  z_stats: Record<string, number>;
  available_columns: string[];
  has_data: boolean;
}

export default function CsvProcessor() {
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [autoMapping, setAutoMapping] = useState<Record<string, string>>({});
  const [manualMapping, setManualMapping] = useState({
    id: '',
    x: '',
    y: '',
    z: '',
    depth: ''
  });
  const [processingResult, setProcessingResult] = useState<SendFileResponse | null>(null);
  const [dataStats, setDataStats] = useState<LoadedDataStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [columnTypes, setColumnTypes] = useState<Record<string, 'string' | 'number'>>({});
  const [columnIncluded, setColumnIncluded] = useState<Record<string, boolean>>({});
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [axisMapping, setAxisMapping] = useState<{ x: 'x' | 'y' | 'z'; y: 'x' | 'y' | 'z' }>({ x: 'x', y: 'y' });
  const [fullResolution, setFullResolution] = useState<boolean>(true);
  const [availableMetricKeys, setAvailableMetricKeys] = useState<string[]>([]);
  const [chartKey, setChartKey] = useState<number>(0);

  const handleFileSelect = async () => {
    try {
      // Use Electron's dialog to select a CSV file
      const result = await window.electronAPI.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (result.canceled || result.filePaths.length === 0) {
        return;
      }
      
      const filePath = result.filePaths[0];
      const fileName = filePath.split('/').pop() || 'unknown.csv';
      
      setSelectedFile(filePath);
      setFileName(fileName);
      
      setLoading(true);
      
      // Analyze the CSV file (backend typed columns + auto mapping)
      const response = await window.autoGrpc.analyzeCsv({
        file_path: filePath,
        file_name: fileName,
        rows_to_analyze: 2
      }) as AnalyzeCsvResponse;
      
      if (response.success) {
        setColumns(response.columns);
        setAutoMapping(response.auto_detected_mapping);
        
        // Set manual mapping to auto-detected values
        setManualMapping({
          id: response.auto_detected_mapping.id || '',
          x: response.auto_detected_mapping.x || '',
          y: response.auto_detected_mapping.y || '',
          z: response.auto_detected_mapping.z || '',
          depth: response.auto_detected_mapping.depth || ''
        });

        // Local preview of first two rows (header + first row)
        const preview = await window.electronAPI.readCsvPreview(filePath, 2);
        setPreviewHeaders(preview.headers);
        setPreviewRows(preview.rows);

        // Initialize column types using backend-detected types if available, else infer from row 1
        const detectedTypes: Record<string, 'string' | 'number'> = {};
        preview.headers.forEach((header, index) => {
          const backendType = response.columns.find((c) => c.name === header)?.type;
          if (backendType === 'number' || backendType === 'string') {
            detectedTypes[header] = backendType as 'string' | 'number';
            return;
          }
          const value = preview.rows[0]?.[index] ?? '';
          const numeric = value !== '' && !Number.isNaN(Number(value));
          detectedTypes[header] = numeric ? 'number' : 'string';
        });
        setColumnTypes(detectedTypes);
        // Default include all columns initially
        const initialIncluded: Record<string, boolean> = {};
        preview.headers.forEach((h) => { initialIncluded[h] = true; });
        setColumnIncluded(initialIncluded);

        // Open the preview dialog
        setPreviewOpen(true);
      } else {
        console.error('Failed to analyze CSV:', response.error_message);
      }
    } catch (error) {
      console.error('Error analyzing CSV:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessFile = async () => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    if (!manualMapping.x || !manualMapping.y) {
      alert('Please map at least X and Y variables');
      return;
    }

    try {
      setLoading(true);
      
      const response = await window.autoGrpc.sendFile({
        file_path: selectedFile,
        file_name: fileName,
        file_type: 'csv',
        x_variable: manualMapping.x,
        y_variable: manualMapping.y,
        z_variable: manualMapping.z,
        id_variable: manualMapping.id,
        depth_variable: manualMapping.depth,
        column_types: columnTypes,
        include_first_row: true,
        included_columns: previewHeaders.filter((h) => columnIncluded[h])
      }) as SendFileResponse;
      
      setProcessingResult(response);
      
      if (response.success) {
        // Get statistics of loaded data
        const stats = await window.autoGrpc.getLoadedDataStats({}) as LoadedDataStats;
        setDataStats(stats);
        setChartKey((k) => k + 1);
      }
    } catch (error) {
      console.error('Error processing file:', error);
    } finally {
      setLoading(false);
    }
  };

  // Chart rendering delegated to CsvScatterChart component using main-process aggregators

  const handleMappingChange = (variable: string, columnName: string) => {
    setManualMapping(prev => ({
      ...prev,
      [variable]: columnName
    }));
  };

  const handleChangeType = (header: string, type: 'string' | 'number') => {
    setColumnTypes((prev) => ({ ...prev, [header]: type }));
  };

  const handleToggleColumn = (header: string) => {
    setColumnIncluded((prev) => ({ ...prev, [header]: !prev[header] }));
  };

  const previewTable = useMemo(() => {
    if (previewHeaders.length === 0) return null;
    const rowsToShow: Array<{ label: string; values: string[] }> = [
      { label: 'Header', values: previewHeaders },
      ...(previewRows[0] ? [{ label: 'Row 1', values: previewRows[0] }] : []),
    ];
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-2 text-left">Include</th>
              {previewHeaders.map((h) => (
                <th key={h} className="border border-gray-300 px-2 py-2 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{h}</span>
                    <input
                      type="checkbox"
                      className="ml-1"
                      checked={columnIncluded[h] ?? true}
                      onChange={() => handleToggleColumn(h)}
                      aria-label={`Include column ${h}`}
                    />
                    <ToggleGroup
                      type="single"
                      value={columnTypes[h]}
                      onValueChange={(val) => val && handleChangeType(h, val as 'string' | 'number')}
                      className="ml-2"
                    >
                      <ToggleGroupItem value="string" aria-label={`Set ${h} type to string`}>
                        str
                      </ToggleGroupItem>
                      <ToggleGroupItem value="number" aria-label={`Set ${h} type to number`}>
                        num
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowsToShow.map((r) => (
              <tr key={r.label}>
                <td className="border border-gray-300 px-2 py-2 text-sm text-gray-600">{r.label}</td>
                {r.values.map((v, cidx) => (
                  <td key={`${r.label}-${cidx}`} className="border border-gray-300 px-2 py-2">
                    <span className="text-sm">{v}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [previewHeaders, previewRows, columnTypes, columnIncluded]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">CSV File Processor</h2>
      
      {/* File Selection */}
      <div className="mb-6">
        <Button onClick={handleFileSelect} disabled={loading} aria-label="Select CSV File">
          {loading ? 'Analyzing...' : 'Select CSV File'}
        </Button>
        {selectedFile && (
          <p className="mt-2 text-sm text-gray-600">Selected: {fileName}</p>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CSV Preview and Mapping</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <p className="text-sm text-gray-600">Header and first row preview. Select columns, adjust types, and set variable mapping.</p>
            {previewTable}
            {/* Axis selection & metrics selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-md font-semibold mb-2">Axis Mapping</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">X Axis</label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded"
                      value={axisMapping.x}
                      onChange={(e) => setAxisMapping((prev) => ({ ...prev, x: e.target.value as 'x' | 'y' | 'z' }))}
                    >
                      {(['x','y','z'] as const).map(ax => (
                        <option key={ax} value={ax}>{ax.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Y Axis</label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded"
                      value={axisMapping.y}
                      onChange={(e) => setAxisMapping((prev) => ({ ...prev, y: e.target.value as 'x' | 'y' | 'z' }))}
                    >
                      {(['x','y','z'] as const).map(ax => (
                        <option key={ax} value={ax}>{ax.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-md font-semibold mb-2">Metrics (dot size)</h4>
                <div className="flex flex-wrap gap-2">
                  {availableMetricKeys.length === 0 ? (
                    <p className="text-sm text-gray-500">Metrics will be available after processing.</p>
                  ) : (
                    availableMetricKeys.map((m) => (
                      <label key={m} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedMetrics.includes(m)}
                          onChange={() => setSelectedMetrics((prev) => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
                          aria-label={`Toggle metric ${m}`}
                        />
                        {m}
                      </label>
                    ))
                  )}
                  <label className="flex items-center gap-2 text-sm ml-4">
                    <input
                      type="checkbox"
                      checked={fullResolution}
                      onChange={(e) => setFullResolution(e.target.checked)}
                      aria-label="Toggle full resolution points"
                    />
                    Full resolution (no sampling)
                  </label>
                </div>
              </div>
            </div>
            {/* Mapping inside dialog */}
            <div>
              <h4 className="text-md font-semibold mb-2">Variable Mapping</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(['id', 'x', 'y', 'z', 'depth'] as const).map((variable) => (
                  <div key={variable}>
                    <label className="block text-sm font-medium mb-1">
                      {variable.toUpperCase()} {(['x', 'y'].includes(variable)) && '(Required)'}
                    </label>
                    <select
                      value={manualMapping[variable]}
                      onChange={(e) => handleMappingChange(variable, e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded"
                    >
                      <option value="">— Select Column —</option>
                      {previewHeaders.filter((h) => columnIncluded[h]).map((h) => (
                        <option key={h} value={h}>
                          {h} ({columnTypes[h]})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">Columns selected: {Object.values(columnIncluded).filter(Boolean).length}</div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPreviewOpen(false)}
                  variant="secondary"
                  aria-label="Close preview"
                  className="bg-gray-200 hover:bg-gray-300 text-gray-900"
                >
                  Close
                </Button>
                <Button
                  onClick={() => setPreviewOpen(false)}
                  aria-label="Confirm preview"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Confirm
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Column Information */}
      {columns.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Detected Columns</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2">Column Name</th>
                  <th className="border border-gray-300 px-4 py-2">Type</th>
                  <th className="border border-gray-300 px-4 py-2">Auto-Detected</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col, index) => (
                  <tr key={index}>
                    <td className="border border-gray-300 px-4 py-2">{col.name}</td>
                    <td className="border border-gray-300 px-4 py-2">{col.type}</td>
                    <td className="border border-gray-300 px-4 py-2">
                      {Object.entries(autoMapping).find((entry) => entry[1] === col.name)?.[0] || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Variable Mapping moved to dialog */}

      {/* Process Button */}
      {columns.length > 0 && (
        <div className="mb-6">
          <Button 
            onClick={handleProcessFile}
            disabled={loading || !manualMapping.x || !manualMapping.y}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Processing...' : 'Process File'}
          </Button>
          <div className="mt-4">
            <CsvScatterChart
              key={chartKey}
              axes={axisMapping}
              metrics={selectedMetrics}
              fullResolution={fullResolution}
              onMetricsDetected={(keys) => setAvailableMetricKeys(keys)}
            />
          </div>
        </div>
      )}

      {/* Processing Results */}
      {processingResult && (
        <div className="mb-6 p-4 border rounded">
          <h3 className="text-lg font-semibold mb-3">Processing Results</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium">Total Rows</p>
              <p className="text-2xl">{processingResult.total_rows_processed}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Valid Rows</p>
              <p className="text-2xl text-green-600">{processingResult.valid_rows}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Invalid Rows</p>
              <p className="text-2xl text-red-600">{processingResult.invalid_rows}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Processing Time</p>
              <p className="text-2xl">{processingResult.processing_time}</p>
            </div>
          </div>
          
          {processingResult.errors.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-red-600">Errors:</p>
              <ul className="list-disc list-inside text-sm">
                {processingResult.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Data Statistics */}
      {dataStats && dataStats.has_data && (
        <div className="p-4 border rounded">
          <h3 className="text-lg font-semibold mb-3">Loaded Data Statistics</h3>
          <p className="mb-2"><strong>Total Points:</strong> {dataStats.total_points}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {dataStats.x_stats && Object.keys(dataStats.x_stats).length > 0 && (
              <div>
                <p className="font-medium">X Coordinates</p>
                <p>Min: {dataStats.x_stats.min?.toFixed(6)}</p>
                <p>Max: {dataStats.x_stats.max?.toFixed(6)}</p>
                <p>Avg: {dataStats.x_stats.avg?.toFixed(6)}</p>
              </div>
            )}
            
            {dataStats.y_stats && Object.keys(dataStats.y_stats).length > 0 && (
              <div>
                <p className="font-medium">Y Coordinates</p>
                <p>Min: {dataStats.y_stats.min?.toFixed(6)}</p>
                <p>Max: {dataStats.y_stats.max?.toFixed(6)}</p>
                <p>Avg: {dataStats.y_stats.avg?.toFixed(6)}</p>
              </div>
            )}
            
            {dataStats.z_stats && Object.keys(dataStats.z_stats).length > 0 && (
              <div>
                <p className="font-medium">Z Values</p>
                <p>Min: {dataStats.z_stats.min?.toFixed(6)}</p>
                <p>Max: {dataStats.z_stats.max?.toFixed(6)}</p>
                <p>Avg: {dataStats.z_stats.avg?.toFixed(6)}</p>
              </div>
            )}
          </div>
          
          {dataStats.available_columns.length > 0 && (
            <div className="mt-4">
              <p className="font-medium">Available Columns:</p>
              <p className="text-sm">{dataStats.available_columns.join(', ')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}