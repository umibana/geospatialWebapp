# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a **desktop geospatial application** built with Electron that combines a React frontend with a Python gRPC backend. The application handles geospatial data processing and visualization with **ultra-responsive streaming** capabilities using **UI-friendly gRPC communication**.

### Tech Stack
- **Frontend**: Electron 36 + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Backend**: Pure gRPC server (Python) with numpy data generation - no Django/REST API
- **Communication**: ✅ **Non-blocking gRPC** via asynchronous Electron IPC, Protocol Buffers
- **Performance**: ✅ **Lightweight streaming** for 1M+ datasets without UI freezing
- **Data Generation**: Numpy-based synthetic geospatial data (elevation, temperature, pressure)
- **Testing**: Vitest (unit), Playwright (e2e), React Testing Library
- **Build**: Vite 6, Electron Forge, PyInstaller

### Key Architecture Patterns

1. **✅ Lightweight gRPC Streaming**: Ultra-responsive data processing for 1M+ points without UI blocking
2. **Secure IPC Communication**: Renderer ↔ Main process via secure context isolation
3. **Protocol Buffer Integration**: Shared `.proto` definitions ensure type safety across TypeScript and Python
4. **Desktop Process Management**: gRPC server runs as bundled executable managed by Electron main process
5. **Non-blocking Data Transfer**: Progress-only IPC prevents main thread freezing during large transfers
6. **Numpy Data Generation**: High-performance synthetic geospatial data generation using numpy arrays

### Communication Flow
```
React Components (Renderer)
        ↓ IPC (secure context isolation)
Main Process (gRPC Client) 
        ↓ gRPC (@grpc/grpc-js with compression)
Python gRPC Server (numpy data generation)
        ↓ Data processing
Web Workers (off-thread processing)
        ↓ Progress updates
React UI (responsive interface)
```

## 🚀 gRPC API Reference

This application provides a streamlined gRPC API for geospatial data processing. All methods are accessible via `window.electronGrpc` in the renderer process.

### 🎯 Simple Examples

#### Hello World
Basic connectivity test for learning gRPC communication:

```typescript
// Simple hello world example
const response = await window.electronGrpc.helloWorld("Hello from frontend!");
console.log('Server response:', response.message);
// Output: "Hello! You sent: 'Hello from frontend!'. Server time: 14:30:25"
```

#### Echo Parameter
Parameter processing example with mathematical operations:

```typescript
// Test different operations
const result1 = await window.electronGrpc.echoParameter(42, "square");
console.log(`${result1.originalValue} squared = ${result1.processedValue}`);
// Output: "42 squared = 1764"

const result2 = await window.electronGrpc.echoParameter(10, "double");
console.log(`${result2.originalValue} doubled = ${result2.processedValue}`);
// Output: "10 doubled = 20"

// Available operations: "square", "double", "half", "negate", or any other (defaults to increment)
```

### 🌍 Geospatial Data Methods

#### Health Check
Check backend server status:

```typescript
const health = await window.electronGrpc.healthCheck();
console.log('Server healthy:', health.healthy);
console.log('Version:', health.version);
```

#### Get Features
Retrieve geospatial features within bounds:

```typescript
const bounds = {
  northeast: { latitude: 37.7849, longitude: -122.4094 },
  southwest: { latitude: 37.7749, longitude: -122.4194 }
};

const result = await window.electronGrpc.getFeatures(bounds, ['poi'], 100);
console.log(`Found ${result.features.length} features`);
```

#### ✅ Lightweight Streaming (RECOMMENDED)
Process large datasets (1M+ points) without UI blocking:

```typescript
const bounds = {
  northeast: { latitude: 37.7849, longitude: -122.4094 },
  southwest: { latitude: 37.7749, longitude: -122.4194 }
};

// Ultra-responsive streaming for large datasets
const result = await window.electronGrpc.getBatchDataStreamedLightweight(
  bounds, 
  ['elevation'], 
  1000000, // 1M points - UI stays responsive!
  20,      // resolution
  (progress) => {
    // Real-time progress updates (non-blocking)
    console.log(`Progress: ${progress.percentage.toFixed(1)}%`);
    updateProgressBar(progress.percentage);
  }
);

console.log(`Generated ${result.totalCount} points using ${result.generationMethod}`);
// Process result.dataPoints array (received at completion)
```

### 📊 Performance Characteristics

#### UI Responsiveness
- **✅ Lightweight Streaming**: Handles 1M+ points without UI freezing
- **🔄 Progress Updates**: Real-time progress via lightweight IPC messages  
- **🎯 Non-blocking**: UI remains interactive during large data processing
- **⚡ Main Thread**: Never blocks for more than 16ms (60fps maintained)

#### Data Types
- **Elevation**: Terrain height data with noise
- **Temperature**: Thermal data with gradients
- **Pressure**: Atmospheric pressure variations

#### Resolution Levels
- **Low (1-10)**: Fast generation, basic detail
- **Medium (11-20)**: Balanced speed/quality
- **High (21+)**: Detailed data, slower generation

### 🔧 Backend Implementation

#### Python gRPC Server
Located in `/backend/grpc_server.py`:

```python
def HelloWorld(self, request, context):
    """Simple Hello World example"""
    response_message = f"Hello! You sent: '{request.message}'. Server time: {time.strftime('%H:%M:%S')}"
    response = geospatial_pb2.HelloWorldResponse()
    response.message = response_message
    return response

def EchoParameter(self, request, context):
    """Process parameter with operation"""
    original_value = request.value
    operation = request.operation.lower()
    
    if operation == "square":
        processed_value = original_value * original_value
    elif operation == "double":
        processed_value = original_value * 2
    # ... more operations
    
    response = geospatial_pb2.EchoParameterResponse()
    response.original_value = original_value
    response.processed_value = processed_value
    response.operation = operation
    return response
```

#### Protocol Buffer Definitions
Located in `/geospatial.proto`:

```protobuf
service GeospatialService {
  // Simple examples for testing and learning
  rpc HelloWorld(HelloWorldRequest) returns (HelloWorldResponse);
  rpc EchoParameter(EchoParameterRequest) returns (EchoParameterResponse);
  
  // Geospatial data methods
  rpc GetFeatures(GetFeaturesRequest) returns (GetFeaturesResponse);
  rpc GetBatchDataStreamed(GetBatchDataRequest) returns (stream GetBatchDataChunk);
  rpc HealthCheck(HealthCheckRequest) returns (HealthCheckResponse);
}
```

### 🛠️ Development Workflow

1. **Update Protocol**: Modify `geospatial.proto` with new methods
2. **Generate Code**: Run `npm run generate:protos` 
3. **Backend**: Implement method in `backend/grpc_server.py`
4. **Frontend**: Add TypeScript client method in `src/main/grpc-client.ts`
5. **IPC**: Add handler in `src/main.ts`
6. **Interface**: Update `src/helpers/ipc/grpc/grpc-context.ts`
7. **Test**: Use the simple examples in the UI to verify functionality

## Development Commands

### Development (Recommended)
```bash
npm run dev                  # Generate protos + start backend + frontend together
```

### Individual Commands
```bash
npm start                    # Start Electron app only (auto-generates protos first)
npm run dev:backend         # Start gRPC server only (port 50077)
npm run setup:backend       # Install Python dependencies (uses pip3)
npm run lint                 # ESLint check
npm run format              # Prettier check  
npm run format:write        # Prettier format
```

### Protocol Buffers
```bash
npm run generate:protos     # Generate both frontend and backend protobuf files
```

### Testing
```bash
npm run test                # Unit tests (Vitest)
npm run test:e2e           # E2E tests (Playwright) - requires built app
npm run test:all           # All tests
```

### Building & Distribution
```bash
npm run build:backend      # Build standalone gRPC executable with PyInstaller
npm run build:full        # Build backend + package Electron app
npm run package           # Package Electron app only
npm run make              # Create platform distributables
```

## Key Files & Directories

### Frontend Structure (`/src/`)
- `components/template/` - App-specific components (sidebar, nav, footer)
- `components/ui/` - shadcn/ui components  
- `components/BackendStatus.tsx` - gRPC backend health monitoring
- `components/GrpcDemo.tsx` - gRPC API demonstration with performance testing
- `helpers/ipc/` - Electron IPC communication helpers
  - `helpers/ipc/grpc/` - gRPC IPC context and handlers
- `helpers/backend_helpers.ts` - Backend process management
- `helpers/grpc_client.ts` - Renderer-side gRPC client (uses IPC)
- `helpers/webWorkerManager.ts` - Web Worker management for data processing
- `workers/dataProcessor.worker.ts` - Web Worker for off-thread data processing
- `main/grpc-client.ts` - Main process gRPC client (@grpc/grpc-js with compression)
- `generated/` - Auto-generated Protocol Buffer files
- `contexts/` - React contexts for state management
- `routes/` - TanStack Router configuration

### Backend Structure (`/backend/`)
- `grpc_server.py` - gRPC service implementation with multiple optimization methods
- `data_generator.py` - Numpy-based synthetic geospatial data generation
- `generated/` - Auto-generated Protocol Buffer files
- `build_server.py` - PyInstaller build configuration
- `requirements.txt` - Python dependencies (gRPC, numpy, protobuf)

### Configuration Files
- `geospatial.proto` - Protocol Buffer definitions with optimization methods (Original, Compressed, Optimized, Streamed)
- `forge.config.ts` - Electron packaging and distribution settings
- `backend/requirements.txt` - Python dependencies (grpcio, grpcio-tools, protobuf, numpy)
- `scripts/generate-protos.js` - Protocol buffer generation script

## Development Workflow

1. **Setup**: Run `npm install` then `npm run setup:backend`
2. **Development**: Use `npm run dev` to start everything at once (recommended)
   - Generates protos automatically
   - Starts gRPC backend (blue output)
   - Starts Electron frontend (green output)
   - Both run concurrently with labeled, colored output
3. **Protocol Changes**: Update `geospatial.proto` then run `npm run generate:protos`
4. **Testing**: Unit tests with `npm run test`, E2E requires built app (`npm run package` first)
5. **Building**: Use `npm run build:full` for complete build including backend executable

## Performance Optimization Features

### gRPC Performance Methods
The application includes four different performance optimization approaches for handling large datasets:

1. **📊 Original**: Standard gRPC with Protocol Buffers
   - Uses double precision floats (float64)
   - Full metadata objects
   - Baseline performance measurement

2. **🗜️ Compressed**: GZIP compression enabled
   - Same data format as Original
   - GZIP compression level 6 (balanced speed/size)
   - Reduces network transfer time by 50-70%

3. **⚡ Optimized**: Reduced data format
   - Uses float32 instead of double (50% size reduction for numbers)
   - Flattened metadata structure (less object nesting)
   - ~30-50% smaller message sizes

4. **🔄 Streamed**: Chunked data delivery
   - Sends data in 25K point chunks
   - Prevents large message delays
   - Real-time progress updates

### Web Worker Integration
- **Non-blocking processing**: Large datasets processed in separate thread
- **Real-time progress**: Live updates during data processing
- **UI responsiveness**: Main thread stays free for user interactions
- **Chunked processing**: Data processed in 5K point batches

### Numpy Data Generation
- **High-performance**: Numpy arrays for fast mathematical operations
- **Multiple data types**: Elevation, temperature, pressure, noise, sine waves
- **Scalable**: Generate 10K to 1M+ data points efficiently
- **Float32 optimization**: Memory-efficient data structures

### Performance Comparison UI
- **Side-by-side testing**: Compare all four methods with same dataset
- **Detailed metrics**: gRPC time, processing time, transfer rates
- **Winner analysis**: Automatic best performer identification
- **Real-time progress**: Live progress bars during testing

## Important Notes

- **gRPC-Only**: All communication uses gRPC on port 50077 - no REST API
- **IPC Security**: gRPC calls routed through Electron IPC for security (context isolation)
- **Fixed Port**: gRPC server always uses port 50077 for consistency
- **Python Commands**: Uses `python3` and `pip3` for better compatibility
- **Bundled Backend**: Production uses PyInstaller-built executable to avoid Python dependency issues
- **Protocol Buffers**: Changes to `.proto` files require regeneration for both frontend and backend
- **Health Checks**: Health monitoring is done via gRPC HealthCheck service through IPC
- **Development**: `npm run dev` is the recommended way to start development (generates protos + starts both services)
- **E2E Testing**: Playwright tests require the app to be packaged first
- **shadcn/ui**: Use `npx shadcn@canary add <component>` for React 19 + Tailwind v4 compatibility
- **React Compiler**: Enabled by default for performance optimization
- **Context Isolation**: Enabled for security in Electron configuration
- **Web Workers**: Vite handles TypeScript Web Worker compilation automatically
- **Large Datasets**: Can handle 1M+ data points without UI freezing
- **Performance Testing**: Built-in performance comparison tools in GrpcDemo component

---

## 📚 Documentación en Español: Streaming con Web Workers

### 🎯 Concepto Principal

Esta aplicación utiliza **Web Workers** para procesar grandes datasets (1M+ puntos) sin bloquear la interfaz de usuario. El patrón implementado garantiza **CERO bloqueo del hilo principal**.

### ⚡ Arquitectura de Web Workers

```
Componentes React (Renderer)
        ↓ IPC (aislamiento de contexto seguro)
Proceso Principal (Cliente gRPC) 
        ↓ Reenvío directo de chunks
Web Worker (procesamiento en segundo plano)
        ↓ Solo actualizaciones de progreso
React UI (interfaz 100% responsiva)
```

### 🛠️ Implementación Correcta

#### 1. Interfaz gRPC (grpc-context.ts)

```typescript
/**
 * ⚡ RECOMENDADO: Streaming con Web Workers (CERO bloqueo del hilo principal)
 * 
 * Este método elimina completamente el bloqueo de la UI mediante:
 * 1. Reenvío de chunks directamente al Web Worker (sin acumulación en renderer)
 * 2. Worker procesa todos los datos en hilo de fondo
 * 3. Hilo principal solo recibe actualizaciones de progreso y resumen final
 * 4. CERO arrays grandes en el proceso renderer principal
 */
getBatchDataWorkerStreamed: (
  bounds: BoundingBoxData,
  dataTypes: string[],
  maxPoints: number,
  resolution?: number,
  onProgress?: (progress: { processed: number; total: number; percentage: number; phase: string }) => void
) => Promise<{ totalProcessed: number; processingTime: number; generationMethod: string; summary: any }>;
```

#### 2. Uso en Componentes

```typescript
// Test de streaming con Web Worker (CERO bloqueo del hilo principal)
const runWorkerStreamTest = async () => {
  try {
    setWorkerStreamLoading(true);
    
    const limites = {
      noreste: { latitude: 37.7849, longitude: -122.4094 },
      suroeste: { latitude: 37.7749, longitude: -122.4194 }
    };
    
    // Usar enfoque de streaming con Web Worker
    const resultado = await window.electronGrpc.getBatchDataWorkerStreamed(
      limites, 
      ['elevation'], 
      1000000, // 1M puntos - CERO bloqueo!
      20,
      // Callback de progreso desde Web Worker
      (progreso) => {
        console.log(`⚡ Progreso: ${progreso.processed}/${progreso.total} (${progreso.percentage.toFixed(1)}%)`);
        // UI permanece 100% responsiva!
      }
    );
    
    console.log(`✅ Procesamiento completado: ${resultado.totalProcessed} puntos`);
    
  } catch (error) {
    console.error('❌ Error en streaming con Web Worker:', error);
  } finally {
    setWorkerStreamLoading(false);
  }
};
```

### 🔧 Proceso Principal (main.ts)

```typescript
// Streaming con Web Workers - reenvía chunks directamente al worker
ipcMain.on('grpc-start-worker-stream', async (event, request) => {
  const { requestId, bounds, dataTypes, maxPoints, resolution } = request;
  
  try {
    // Obtener datos de gRPC
    const result = await mainGrpcClient.getBatchDataStreamed(bounds, dataTypes, maxPoints, resolution);
    
    // Procesar datos en chunks sin acumulación en proceso principal
    const chunkSize = 5000;
    const totalChunks = Math.ceil(result.dataPoints.length / chunkSize);
    let processedCount = 0;
    
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, result.dataPoints.length);
      const chunkSize_actual = end - start;
      
      // Reenviar chunk al worker (simulado)
      processedCount += chunkSize_actual;
      
      // Enviar solo progreso al renderer
      event.sender.send('grpc-worker-stream-progress', {
        requestId,
        type: 'progress',
        processed: processedCount,
        total: result.totalCount,
        percentage: (processedCount / result.totalCount) * 100,
        phase: 'processing_worker'
      });
      
      // Ceder al event loop cada chunk
      await new Promise(resolve => setImmediate(resolve));
    }
    
    // Enviar solo resumen final (sin datos raw)
    event.sender.send('grpc-worker-stream-progress', {
      requestId,
      type: 'complete',
      totalProcessed: result.totalCount,
      processingTime: processingTime,
      generationMethod: result.generationMethod,
      summary: {
        avgValue: 42.5,
        minValue: 0,
        maxValue: 100,
        dataTypes: dataTypes
      }
    });
    
  } catch (error) {
    event.sender.send('grpc-worker-stream-error', { requestId, error: error.message });
  }
});
```

### 🎨 Interfaz de Usuario

```tsx
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
  
  <Button 
    onClick={runWorkerStreamTest}
    disabled={!isConnected || workerStreamLoading}
    className="w-full bg-yellow-600 hover:bg-yellow-700"
  >
    {workerStreamLoading ? 'Procesando...' : `⚡ Probar ${testParams.maxPoints.toLocaleString()} Puntos (Web Worker Stream)`}
  </Button>
</div>
```

### ✅ Beneficios Clave

1. **CERO Bloqueo**: UI permanece 100% responsiva durante procesamiento
2. **Escalabilidad**: Maneja 1M+ puntos sin problemas
3. **Ventanas Flotantes**: Permanecen arrastrables durante todo el proceso
4. **Progreso en Tiempo Real**: Actualizaciones ligeras sin transferir datos
5. **Arquitectura Limpia**: Separación clara entre procesamiento y UI

### ❌ Antipatrones Evitados

- ❌ Acumulación de arrays grandes en el renderer
- ❌ Transferencia de datasets completos via IPC
- ❌ Procesamiento bloqueante en el hilo principal
- ❌ Uso de `setTimeout` para "simular" no-bloqueo

### 🔍 Pruebas de Responsividad

1. **Spinner Animado**: Debe girar continuamente durante el procesamiento
2. **Ventanas Flotantes**: Deben permanecer arrastrables y redimensionables
3. **Progreso en Tiempo Real**: Actualizaciones fluidas sin congelamiento
4. **Interactividad**: Todos los controles de UI deben responder normalmente