# Desktop Geospatial Application

A high-performance desktop geospatial application built with Electron and React, featuring real-time data visualization, large-scale data processing, and advanced gRPC optimization strategies.

## Architecture Overview

This application combines a React-based Electron frontend with a Python gRPC backend for high-performance geospatial data processing and visualization.

### Communication Flow
```
React Components (Renderer Process)
          ↓ Secure IPC
Main Process (gRPC Client with Compression)
          ↓ gRPC Protocol (4 optimization methods)
Python gRPC Server (Numpy Data Generation)
          ↓ Data Processing
Web Workers (Off-thread Processing)
          ↓ Progress Updates
React UI (Responsive Interface)
```

### Key Features
- **🚀 High-Performance Data Processing**: Handle 1M+ data points without UI freezing
- **⚡ Four gRPC Optimization Methods**: Original, Compressed, Optimized, Streamed
- **🔧 Web Worker Integration**: Off-thread processing keeps UI responsive
- **📊 Numpy Data Generation**: High-speed synthetic geospatial data (elevation, temperature, pressure)
- **📡 Real-time Streaming**: Live data updates with progress tracking
- **🖥️ Cross-platform Desktop**: Windows, macOS, Linux support
- **🔒 Secure Architecture**: Electron context isolation with IPC communication
- **⚙️ Performance Testing**: Built-in comparison tools for optimization methods
- **🎨 Modern UI**: shadcn/ui components with Tailwind CSS

## Tech Stack

### Frontend 🖥️
- [Electron 36](https://www.electronjs.org) - Cross-platform desktop framework
- [React 19](https://reactjs.org) - UI framework with React Compiler
- [TypeScript 5.8](https://www.typescriptlang.org) - Type safety
- [Tailwind CSS 4](https://tailwindcss.com) - Styling
- [shadcn/ui](https://ui.shadcn.com) - Modern UI components
- [TanStack Router](https://tanstack.com/router) - Client-side routing
- [TanStack Query](https://tanstack.com/query) - Data fetching and caching

### Backend 🚀
- **Python gRPC Server** - High-performance backend with compression
- **Numpy Data Generation** - Fast synthetic geospatial data creation
- **Protocol Buffers** - Efficient serialization with optimization variants
- **Real-time streaming** - Server-side streaming RPCs with chunking
- **Health monitoring** - Built-in health checks via gRPC

### Development Tools 🛠️
- [Vite 6](https://vitejs.dev) - Fast build tool
- [Vitest](https://vitest.dev) - Unit testing
- [Playwright](https://playwright.dev) - E2E testing
- [ESLint 9](https://eslint.org) + [Prettier](https://prettier.io) - Code quality
- [Electron Forge](https://www.electronforge.io) - Packaging and distribution

### gRPC Services 📡
- **GetBatchData** - Standard batch data retrieval
- **GetBatchDataCompressed** - GZIP compressed data transfer
- **GetBatchDataOptimized** - Float32 optimized data format
- **GetBatchDataStreamed** - Chunked streaming delivery
- **StreamData** - Real-time data point streaming
- **HealthCheck** - Service health monitoring

## Project Structure

```plaintext
├── src/                          # Frontend source code
│   ├── components/               # React components
│   │   ├── BackendStatus.tsx    # gRPC backend health monitoring
│   │   ├── GrpcDemo.tsx         # gRPC API demo + performance testing
│   │   ├── template/            # App layout components
│   │   └── ui/                  # shadcn/ui components
│   ├── helpers/                 # Utility functions
│   │   ├── ipc/                 # Electron IPC communication
│   │   │   └── grpc/           # gRPC IPC handlers
│   │   ├── backend_helpers.ts   # Backend process management
│   │   ├── grpc_client.ts      # Renderer gRPC client (IPC-based)
│   │   └── webWorkerManager.ts # Web Worker management
│   ├── workers/                 # Web Workers
│   │   └── dataProcessor.worker.ts # Off-thread data processing
│   ├── main/                    # Main process code
│   │   └── grpc-client.ts      # Main process gRPC client (with compression)
│   └── generated/              # Auto-generated protobuf files
├── backend/                     # Python gRPC server
│   ├── grpc_server.py          # gRPC service with optimization methods
│   ├── data_generator.py       # Numpy-based data generation
│   ├── build_server.py         # PyInstaller build script
│   ├── generated/              # Auto-generated protobuf files
│   └── requirements.txt        # Python dependencies (gRPC + numpy)
├── geospatial.proto            # Protocol buffer definitions
└── scripts/                    # Build and utility scripts
    └── generate-protos.js      # Protobuf generation
```

### Key Components
- **Frontend**: Secure IPC-based gRPC communication with type-safe Protocol Buffers
- **Backend**: Pure Python gRPC server with real-time streaming capabilities
- **Security**: Electron context isolation with IPC-mediated backend communication
- **Development**: Hot-reload development with concurrent frontend/backend startup

## Development

### Quick Start

```bash
# Install dependencies
npm install

# Setup Python backend
npm run setup:backend

# Start development (recommended - starts both frontend and backend)
npm run dev
```

### Available Scripts

#### Development
```bash
npm run dev                  # Start both frontend and backend with proto generation
npm start                   # Start frontend only
npm run dev:backend         # Start gRPC backend only
```

#### Protocol Buffers
```bash
npm run generate:protos     # Generate TypeScript and Python protobuf files
```

#### Testing
```bash
npm run test               # Unit tests (Vitest)
npm run test:e2e          # E2E tests (Playwright) - requires built app
npm run test:all          # Run all tests
```

#### Building & Distribution
```bash
npm run build:backend     # Build Python executable with PyInstaller
npm run build:full       # Build backend + package Electron app
npm run package          # Package Electron app only
npm run make             # Create platform distributables (.exe, .dmg, etc.)
```

#### Code Quality
```bash
npm run lint             # ESLint check
npm run format          # Prettier check
npm run format:write    # Format code with Prettier
```

### Development Workflow

1. **Setup**: `npm install` → `npm run setup:backend`
2. **Development**: `npm run dev` (starts everything)
3. **Protocol Changes**: Update `geospatial.proto` → `npm run generate:protos`
4. **Testing**: `npm run test:all` (E2E requires `npm run package` first)
5. **Distribution**: `npm run build:full`

## Performance Optimization

### 🚀 Four gRPC Optimization Strategies

The application implements four different approaches to handle large datasets efficiently:

#### 1. 📊 **Original Method**
- Standard gRPC with Protocol Buffers
- Double-precision floats (float64)
- Full metadata objects
- Baseline performance measurement

#### 2. 🗜️ **Compressed Method**
- GZIP compression (level 6)
- Same data format as Original
- 50-70% reduction in transfer time
- Transparent compression/decompression

#### 3. ⚡ **Optimized Method**
- Float32 instead of double (50% size reduction)
- Flattened metadata structure
- 30-50% smaller message sizes
- Optimized Protocol Buffer schema

#### 4. 🔄 **Streamed Method**
- Data delivered in 25K point chunks
- Real-time progress updates
- Prevents large message delays
- Frontend stays responsive

### 🔧 Web Worker Integration

- **Non-blocking Processing**: Large datasets processed in separate thread
- **Real-time Progress**: Live updates during data processing (5K point batches)
- **UI Responsiveness**: Main thread free for user interactions
- **Memory Efficient**: Chunked processing prevents memory issues

### 📊 Performance Testing UI

The built-in performance comparison tool allows you to:
- Test all four methods with identical datasets
- Compare gRPC transfer time vs processing time
- Analyze transfer rates (MB/s) and total performance
- Identify the best method for your use case
- Handle datasets from 10K to 1M+ points

### 🧪 Typical Performance Results

| Method | 100K Points | 1M Points | Transfer Rate | UI Freeze |
|--------|-------------|-----------|---------------|-----------|
| Original | ~15s | ~35s | 3-5 MB/s | ❌ Yes |
| Compressed | ~8s | ~18s | 8-12 MB/s | ❌ Yes |
| Optimized | ~12s | ~25s | 5-8 MB/s | ❌ Yes |
| Streamed | ~10s | ~20s | 6-10 MB/s | ✅ No |
| **+ Web Workers** | ~10s | ~20s | 6-10 MB/s | ✅ **No** |

*Results may vary based on system specifications and network conditions*

## gRPC API

The application provides six main gRPC services:

### GetBatchData (Original)
Standard batch data retrieval
```typescript
const result = await window.electronGrpc.getBatchData(
  bounds, ['elevation'], 100000, 100
);
console.log(`Loaded ${result.totalCount} points`);
```

### GetBatchDataCompressed
GZIP compressed data transfer (50-70% faster)
```typescript
const result = await window.electronGrpc.getBatchDataCompressed(
  bounds, ['elevation'], 100000, 100
);
```

### GetBatchDataOptimized  
Float32 optimized format (30-50% smaller)
```typescript
const result = await window.electronGrpc.getBatchDataOptimized(
  bounds, ['elevation'], 100000, 100
);
```

### GetBatchDataStreamed
Chunked streaming delivery (no UI freeze)
```typescript
const result = await window.electronGrpc.getBatchDataStreamed(
  bounds, ['elevation'], 1000000, 500
);
```

### StreamData
Real-time streaming of geospatial data points
```typescript
for await (const dataPoint of grpcClient.streamData(bounds, ['temperature'], 5)) {
  console.log(`${dataPoint.unit}: ${dataPoint.value}`);
}
```

### HealthCheck
Monitor service health and status
```typescript
const health = await window.electronGrpc.healthCheck();
console.log(`Service healthy: ${health.healthy}`);
```

## Usage Examples

### Performance Testing
```typescript
// Test all methods with 1M data points
const bounds = {
  northeast: { latitude: 37.7849, longitude: -122.4094 },
  southwest: { latitude: 37.7749, longitude: -122.4194 }
};

// Compare performance (built into UI)
const results = await Promise.all([
  window.electronGrpc.getBatchData(bounds, ['elevation'], 1000000, 500),
  window.electronGrpc.getBatchDataCompressed(bounds, ['elevation'], 1000000, 500),
  window.electronGrpc.getBatchDataOptimized(bounds, ['elevation'], 1000000, 500),
  window.electronGrpc.getBatchDataStreamed(bounds, ['elevation'], 1000000, 500)
]);
```

### Web Worker Data Processing
```typescript
import { webWorkerManager } from './helpers/webWorkerManager';

// Process large dataset without blocking UI
const result = await webWorkerManager.processLargeDataset(
  dataPoints,
  {
    chunkSize: 5000,
    onProgress: (progress) => {
      console.log(`Processed ${progress.percentage.toFixed(1)}%`);
      // Update progress bar
    }
  }
);
```

## Requirements

- **Node.js** 18+ 
- **Python** 3.8+
- **Protocol Buffers compiler** (`protoc`)

## Security

- **Context Isolation**: Enabled for secure renderer process
- **IPC Communication**: All backend communication via secure IPC channels
- **No Direct Network Access**: Renderer process cannot directly access gRPC server
- **Process Separation**: Backend runs as separate managed process

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Update protocol buffers if needed: `npm run generate:protos`
5. Run tests: `npm run test:all`
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
