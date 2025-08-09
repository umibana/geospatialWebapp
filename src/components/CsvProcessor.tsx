import React, { useState } from 'react';
import { Button } from './ui/button';

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
      
      // Analyze the CSV file
      const response = await window.grpc.analyzeCsv({
        filePath: filePath,
        fileName: fileName,
        rowsToAnalyze: 2
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
      
      const response = await window.grpc.sendFile({
        filePath: selectedFile,
        fileName: fileName,
        fileType: 'csv',
        xVariable: manualMapping.x,
        yVariable: manualMapping.y,
        zVariable: manualMapping.z,
        idVariable: manualMapping.id,
        depthVariable: manualMapping.depth
      }) as SendFileResponse;
      
      setProcessingResult(response);
      
      if (response.success) {
        // Get statistics of loaded data
        const stats = await window.grpc.getLoadedDataStats() as LoadedDataStats;
        setDataStats(stats);
      }
    } catch (error) {
      console.error('Error processing file:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (variable: string, columnName: string) => {
    setManualMapping(prev => ({
      ...prev,
      [variable]: columnName
    }));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">CSV File Processor</h2>
      
      {/* File Selection */}
      <div className="mb-6">
        <Button onClick={handleFileSelect} disabled={loading}>
          {loading ? 'Analyzing...' : 'Select CSV File'}
        </Button>
        {selectedFile && (
          <p className="mt-2 text-sm text-gray-600">Selected: {fileName}</p>
        )}
      </div>

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
                      {Object.entries(autoMapping).find(([_, value]) => value === col.name)?.[0] || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Variable Mapping */}
      {columns.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Variable Mapping</h3>
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
                  {columns.map((col) => (
                    <option key={col.name} value={col.name}>
                      {col.name} ({col.type})
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

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