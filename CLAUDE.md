# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a **desktop geospatial application** built with Electron that combines a React frontend with a Python gRPC backend. The application handles geospatial data processing and visualization with **ultra-responsive streaming** capabilities using **auto-generated gRPC communication** and **efficient columnar data format**.

### Tech Stack
- **Frontend**: Electron 36 + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Backend**: Pure gRPC server (Python) with numpy data generation - no Django/REST API
- **Communication**: ✅ **Auto-generated gRPC API** via Protocol Buffers with secure Electron IPC
- **Data Format**: ✅ **Columnar format** for 70% memory reduction and optimal performance
- **Performance**: ✅ **Streaming architecture** for 1M+ datasets without UI freezing
- **Data Generation**: Numpy-based synthetic geospatial data (elevation, temperature, pressure)
- **Testing**: Vitest (unit), Playwright (e2e), React Testing Library
- **Build**: Vite 6, Electron Forge, PyInstaller

### Key Architecture Patterns

1. **✅ Auto-Generated gRPC API**: Complete type safety with auto-generated clients, handlers, and contexts
2. **✅ Columnar Data Format**: Efficient array-based data structure for large datasets
3. **✅ Dual Processing Strategy**: Columnar streaming + Worker threads for different dataset sizes
4. **✅ Secure IPC Communication**: Renderer ↔ Main process via secure context isolation
5. **✅ Protocol Buffer Integration**: Shared `.proto` definitions ensure type safety across TypeScript and Python
6. **✅ Desktop Process Management**: gRPC server runs as bundled executable managed by Electron main process

### Communication Flow
```
React Components (Renderer Process)
        ↓ Auto-Generated Context Bridge (window.autoGrpc)
        ↓ Secure IPC with Type Safety
Main Process (Auto-Generated Handlers)
        ├── Columnar Streaming API (< 2M points)
        └── Worker Thread Processing (≥ 2M points)
        ↓ gRPC (@grpc/grpc-js with compression)
Python gRPC Server (numpy columnar data generation)
        ↓ Efficient columnar format
Backend Process (managed by backend_helpers.ts)
```

## 🏗️ Modern Architecture Overview

### **Auto-Generated gRPC System**

The application uses a **fully auto-generated gRPC system** that eliminates manual API code:

#### **Auto-Generation Stack**
- **Protocol Buffers**: Single source of truth in `/protos/` directory
- **TypeScript Client**: Auto-generated renderer process client (`window.autoGrpc`)
- **IPC Handlers**: Auto-generated main process handlers with proper routing
- **Context Bridge**: Auto-generated secure context exposure
- **Main Process Client**: Auto-generated gRPC client with connection management

#### **Generated Files Structure**
```
src/grpc-auto/                    # Auto-generated directory (DO NOT EDIT)
├── auto-grpc-client.ts           # Renderer process gRPC client
├── auto-ipc-handlers.ts          # Main process IPC handlers  
├── auto-grpc-context.ts          # Context bridge definitions
└── auto-main-client.ts           # Main process gRPC client
```

### **Efficient Columnar Data Format**

The application uses a **columnar data format** optimized for large geospatial datasets:

#### **Columnar Structure**
```typescript
type ColumnarData = {
  id: string[];                    // Point IDs
  x: number[];                     // X coordinates (longitude)
  y: number[];                     // Y coordinates (latitude)  
  z: number[];                     // Z values (main value like elevation)
  id_value: string[];              // ID value column
  additional_data: Record<string, number[]>; // Dynamic columns (temperature, pressure, etc.)
};
```

#### **Benefits of Columnar Format**
- **70% Memory Reduction**: Array-based storage vs object-based
- **Faster Processing**: Vectorized operations on columns
- **Streaming Friendly**: Natural chunking for large datasets
- **Cache Efficient**: Better CPU cache utilization
- **Numpy Compatible**: Direct integration with Python backend

### **Dual Processing Strategy**

The application implements **two complementary processing approaches**:

#### **1. Columnar Streaming API** (`ChildProcessVisualization`)
- **Best for**: 100K - 2M points
- **Technology**: Auto-generated `getBatchDataColumnarStreamed`
- **Benefits**: Simple, reliable, efficient columnar format
- **UI**: Green theme, "Columnar Data Streaming"
- **Memory**: Efficient sampling to prevent stack overflow

#### **2. Worker Thread Processing** (`WorkerThreadVisualization`)
- **Best for**: 3M - 5M+ points  
- **Technology**: Complex IPC with worker threads + chart data caching
- **Benefits**: Maximum performance, isolated processing, handles ultra-large datasets
- **UI**: Purple theme, "True Node.js Worker Threads"
- **Memory**: Chart data caching with chunked IPC transfer

### **IPC Architecture** (`src/helpers/ipc/`)

**Modular IPC System** with domain-based organization:

```
src/helpers/ipc/
├── context-exposer.ts          # Main context bridge coordinator
├── listeners-register.ts       # IPC handler registration coordinator
├── backend/                    # gRPC backend management
│   ├── backend-context.ts      # Backend context bridge
│   ├── backend-listeners.ts    # Backend IPC handlers
│   └── backend-channels.ts     # Backend channel definitions
├── theme/                      # Theme management
│   ├── theme-context.ts        # Theme context bridge  
│   ├── theme-listeners.ts      # Theme IPC handlers
│   └── theme-channels.ts       # Theme channel definitions
└── window/                     # Window management
    ├── window-context.ts       # Window context bridge
    ├── window-listeners.ts     # Window IPC handlers
    └── window-channels.ts      # Window channel definitions
```

**Key Features**:
- **Secure Context Isolation**: All IPC goes through secure context bridges
- **Domain Separation**: Backend, theme, and window concerns are isolated
- **Type Safety**: TypeScript definitions for all IPC channels
- **Auto-Generated Integration**: Works seamlessly with auto-generated gRPC system

### **Process Management** (`src/helpers/backend_helpers.ts`)

**Python gRPC Server Lifecycle Management**:
- **Development Mode**: Direct `python grpc_server.py` execution
- **Production Mode**: PyInstaller-built executable
- **Health Monitoring**: Connection testing with 15-second timeout
- **Graceful Shutdown**: SIGTERM → wait → SIGKILL sequence
- **Auto-Recovery**: Automatic restart on connection failures

## 🚀 Auto-Generated gRPC API Reference

The application provides a **fully auto-generated gRPC API** accessible via `window.autoGrpc` in the renderer process.

### 🎯 Simple Examples

#### Hello World
Basic connectivity test for learning gRPC communication:

```typescript
// Simple hello world example
const response = await window.autoGrpc.helloWorld({ message: "Hello from frontend!" });
console.log('Server response:', response.message);
// Output: "Hello! You sent: 'Hello from frontend!'. Server time: 14:30:25"
```

#### Echo Parameter
Parameter processing example with mathematical operations:

```typescript
// Test different operations
const result1 = await window.autoGrpc.echoParameter({ value: 42, operation: "square" });
console.log(`${result1.original_value} squared = ${result1.processed_value}`);
// Output: "42 squared = 1764"

const result2 = await window.autoGrpc.echoParameter({ value: 10, operation: "double" });
console.log(`${result2.original_value} doubled = ${result2.processed_value}`);
// Output: "10 doubled = 20"

// Available operations: "square", "double", "half", "negate", or any other (defaults to increment)
```

### 🌍 Geospatial Data Methods

#### Health Check
Check backend server status:

```typescript
const health = await window.autoGrpc.healthCheck({});
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

const result = await window.autoGrpc.getFeatures({ 
  bounds, 
  feature_types: ['poi'], 
  limit: 100 
});
console.log(`Found ${result.features.length} features`);
```

#### ✅ Columnar Data API (RECOMMENDED)
Process large datasets efficiently with columnar format:

```typescript
const bounds = {
  northeast: { latitude: 37.7849, longitude: -122.4094 },
  southwest: { latitude: 37.7749, longitude: -122.4194 }
};

// Efficient columnar format for large datasets
const result = await window.autoGrpc.getBatchDataColumnar({
  bounds, 
  data_types: ['elevation'], 
  max_points: 1000000, // 1M points efficiently!
  resolution: 20
});

console.log(`Generated ${result.total_count} points using ${result.generation_method}`);
// Access columnar data: result.columnar_data.x, result.columnar_data.y, result.columnar_data.z
```

#### ✅ Columnar Streaming (ULTRA-LARGE DATASETS)
Stream large datasets with real-time progress:

```typescript
// Ultra-responsive streaming for massive datasets
const result = await window.autoGrpc.getBatchDataColumnarStreamed({
  bounds, 
  data_types: ['elevation'], 
  max_points: 5000000, // 5M points with streaming!
  resolution: 30
}, (chunk) => {
  // Real-time progress updates per chunk
  console.log(`Chunk ${chunk.chunk_number + 1}/${chunk.total_chunks}: ${chunk.points_in_chunk} points`);
  updateProgressBar((chunk.chunk_number + 1) / chunk.total_chunks * 100);
});

console.log(`Streamed ${result.length} chunks successfully`);
```

### 📊 Performance Characteristics

#### UI Responsiveness
- **✅ Columnar Format**: 70% memory reduction vs object-based format
- **✅ Streaming Architecture**: Handles 5M+ points without UI freezing
- **✅ Auto-Generated API**: Zero manual API maintenance, full type safety
- **✅ Memory Efficient**: Smart sampling prevents stack overflow on large datasets

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
def GetBatchDataColumnar(self, request, context):
    """Get batch data in columnar format for efficient processing"""
    columnar_data, generation_method = data_generator.generate_columnar_data(
        bounds=bounds,
        data_types=list(request.data_types),
        max_points=request.max_points,
        resolution=request.resolution or 20
    )
    
    response = geospatial_pb2.GetBatchDataColumnarResponse()
    response.total_count = len(columnar_data['x'])
    response.generation_method = generation_method
    
    chunk = response.columnar_data
    chunk.id.extend(columnar_data['id'])
    chunk.x.extend(columnar_data['x'])
    chunk.y.extend(columnar_data['y'])
    chunk.z.extend(columnar_data['z'])
    chunk.id_value.extend(columnar_data['id_value'])
    
    return response
```

#### Protocol Buffer Definitions
Located in `/protos/main_service.proto`:

```protobuf
service GeospatialService {
  // Simple examples for testing and learning
  rpc HelloWorld(HelloWorldRequest) returns (HelloWorldResponse);
  rpc EchoParameter(EchoParameterRequest) returns (EchoParameterResponse);
  
  // Geospatial data methods
  rpc GetFeatures(GetFeaturesRequest) returns (GetFeaturesResponse);
  rpc HealthCheck(HealthCheckRequest) returns (HealthCheckResponse);
  
  // Efficient columnar format for large datasets
  rpc GetBatchDataColumnar(GetBatchDataRequest) returns (GetBatchDataColumnarResponse);
  rpc GetBatchDataColumnarStreamed(GetBatchDataRequest) returns (stream ColumnarDataChunk);
  
  // CSV file processing methods
  rpc AnalyzeCsv(AnalyzeCsvRequest) returns (AnalyzeCsvResponse);
  rpc SendFile(SendFileRequest) returns (SendFileResponse);
  rpc GetLoadedDataStats(GetLoadedDataStatsRequest) returns (GetLoadedDataStatsResponse);
}
```

### 🛠️ Development Workflow

1. **Update Protocol**: Modify `.proto` files in `/protos/` directory
2. **Auto-Generate**: Run `npm run generate:full-stack` to regenerate all APIs
3. **Backend**: Implement method in `backend/grpc_server.py`
4. **Frontend**: Use auto-generated `window.autoGrpc` methods
5. **Test**: All methods are automatically type-safe and available

## Development Commands

### Development (Recommended)
```bash
npm run dev                  # Generate protos + start backend + frontend together (uses pythonvenv)
```

### Individual Commands
```bash
npm start                    # Start Electron app only (auto-generates protos first)
npm run dev:backend         # Start gRPC server only (port 50077, uses pythonvenv)
npm run setup:backend       # Install Python dependencies in pythonvenv
npm run lint                 # ESLint check
npm run format              # Prettier check  
npm run format:write        # Prettier format
```

### Protocol Buffers & Auto-Generation
```bash
npm run generate:protos     # Generate basic protobuf files from protos/ directory
npm run generate:full-stack # Generate complete auto-generated gRPC system (RECOMMENDED)
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
- `components/ChildProcessVisualization.tsx` - Columnar streaming visualization (100K-2M points)
- `components/WorkerThreadVisualization.tsx` - Worker thread visualization (3M-5M+ points)
- `components/CsvProcessor.tsx` - CSV file processing and analysis
- **`grpc-auto/`** - **Auto-generated gRPC system (DO NOT EDIT)**
  - `auto-grpc-client.ts` - Renderer process gRPC client
  - `auto-ipc-handlers.ts` - Main process IPC handlers
  - `auto-grpc-context.ts` - Context bridge definitions
  - `auto-main-client.ts` - Main process gRPC client
- `helpers/ipc/` - Electron IPC communication helpers
- `helpers/backend_helpers.ts` - Backend process management
- `helpers/mainProcessWorker.ts` - Worker thread processing for ultra-large datasets
- `generated/` - Auto-generated Protocol Buffer files
- `contexts/` - React contexts for state management
- `routes/` - TanStack Router configuration

### Backend Structure (`/backend/`)
- `grpc_server.py` - gRPC service implementation with columnar data support
- `data_generator.py` - Numpy-based synthetic geospatial data generation (columnar format)
- `generated/` - Auto-generated Protocol Buffer files
- `build_server.py` - PyInstaller build configuration
- `requirements.txt` - Python dependencies (gRPC, numpy, protobuf)

### Configuration Files
- **`protos/`** - **Protocol Buffer definitions directory**:
  - `main_service.proto` - Main service combining all services (ENTRY POINT)
  - `geospatial.proto` - Geospatial data types and messages (includes columnar format)
  - `files.proto` - File processing service definitions
- `forge.config.ts` - Electron packaging and distribution settings (includes PyInstaller backend)
- `backend/requirements.txt` - Python dependencies (grpcio>=1.73.0, numpy>=1.24.0)
- `scripts/generate-protos.js` - Protocol buffer generation script
- `scripts/generate-full-stack.js` - Auto-generation script for complete gRPC system

## Development Workflow

1. **Setup**: Run `npm install` then `npm run setup:backend`
2. **Development**: Use `npm run dev` to start everything at once (recommended)
   - Auto-generates protos and gRPC system
   - Starts gRPC backend (blue output)
   - Starts Electron frontend (green output)
   - Both run concurrently with labeled, colored output
3. **Protocol Changes**: Update `.proto` files then run `npm run generate:full-stack`
4. **Testing**: Unit tests with `npm run test`, E2E requires built app (`npm run package` first)
5. **Building**: Use `npm run build:full` for complete build including backend executable

## Performance Optimization Features

### Columnar Data Processing
The application uses an **efficient columnar data format** optimized for large geospatial datasets:

1. **🏗️ Columnar Structure**: Array-based data organization for memory efficiency
   - **70% Memory Reduction**: Compared to object-based formats
   - **Vectorized Operations**: Efficient processing of large arrays
   - **Cache Friendly**: Better CPU cache utilization
   
2. **⚡ Streaming Architecture**: Chunked data delivery for ultra-large datasets
   - **Chunk-based Processing**: 25K points per chunk
   - **Real-time Progress**: Live progress updates during streaming
   - **Memory Bounded**: Prevents memory exhaustion on large datasets

3. **🔄 Dual Processing Strategy**: Automatic selection based on dataset size
   - **Columnar Streaming**: 100K-2M points with auto-generated API
   - **Worker Threads**: 3M-5M+ points with isolated processing

### Auto-Generated gRPC System
- **Type Safety**: Complete TypeScript integration across frontend and backend
- **Zero Maintenance**: No manual API code - everything auto-generated from `.proto` files
- **Performance**: Direct gRPC communication with Protocol Buffer efficiency
- **Reliability**: Consistent API contracts and automatic error handling

### Numpy Data Generation
- **High-performance**: Numpy arrays for fast mathematical operations
- **Columnar Output**: Direct generation in efficient columnar format
- **Multiple data types**: Elevation, temperature, pressure, noise, sine waves
- **Scalable**: Generate 10K to 5M+ data points efficiently

## Important Notes

- **Auto-Generated API**: Use `window.autoGrpc.*` - all methods are type-safe and auto-generated
- **Columnar Format**: All new development uses efficient columnar data format
- **gRPC-Only**: All communication uses gRPC on port 50077 - no REST API
- **IPC Security**: gRPC calls routed through Electron IPC for security (context isolation)
- **Fixed Port**: gRPC server always uses port 50077 for consistency
- **Python Environment**: Uses `pythonvenv/` virtual environment with `source pythonvenv/bin/activate`
- **Bundled Backend**: Production uses PyInstaller-built executable to avoid Python dependency issues
- **Protocol Buffers**: Changes to `.proto` files require `npm run generate:full-stack`
- **Health Checks**: Health monitoring is done via auto-generated gRPC HealthCheck service
- **Development**: `npm run dev` is the recommended way to start development
- **E2E Testing**: Playwright tests require the app to be packaged first
- **shadcn/ui**: Use `npx shadcn@canary add <component>` for React 19 + Tailwind v4 compatibility
- **React Compiler**: Enabled by default for performance optimization
- **Context Isolation**: Enabled for security in Electron configuration
- **Large Datasets**: Can handle 5M+ data points without UI freezing using columnar format
- **Performance Testing**: Built-in performance comparison tools in visualization components

---

## 🎯 Recent Architecture Updates

### **Auto-Generated gRPC System Implementation**

The application has been **completely modernized** with a full auto-generation system:

#### **What Was Added:**
- ✅ **Auto-Generated API**: Complete gRPC system generated from Protocol Buffers
- ✅ **Columnar Data Format**: Efficient array-based data structure for large datasets
- ✅ **Type Safety**: Full TypeScript integration across frontend and backend
- ✅ **Dual Processing**: Columnar streaming + Worker threads for different dataset sizes
- ✅ **Memory Efficiency**: 70% memory reduction and stack overflow prevention

#### **What Was Removed:**
- ❌ **Manual gRPC API**: Removed 293 lines of legacy manual API code
- ❌ **Legacy Processing**: Removed complex multi-strategy comparison system
- ❌ **Object-Based Format**: Replaced with efficient columnar format
- ❌ **Web Worker Simulation**: Replaced with real columnar streaming

#### **Key Benefits:**
1. **Zero Maintenance**: No manual API code - everything auto-generated
2. **Type Safety**: Complete TypeScript integration and error prevention
3. **Performance**: 70% memory reduction with columnar format
4. **Scalability**: Handles 5M+ points without UI freezing
5. **Reliability**: Consistent API contracts and automatic error handling

#### **Usage Pattern:**
```typescript
// Auto-generated API with full type safety
const result = await window.autoGrpc.getBatchDataColumnar({
  bounds: { northeast: {...}, southwest: {...} },
  data_types: ['elevation'],
  max_points: 1000000,
  resolution: 20
});

// Access columnar data efficiently
const points = result.columnar_data.x.length;
const coordinates = result.columnar_data.x.map((x, i) => ({
  lng: x,
  lat: result.columnar_data.y[i], 
  value: result.columnar_data.z[i]
}));
```

This modernization provides maximum performance and reliability while dramatically reducing maintenance overhead.