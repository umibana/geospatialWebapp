# Desktop Geospatial Application

A modern desktop geospatial application built with Electron and React, featuring real-time data visualization and processing capabilities through gRPC communication.

## Architecture Overview

This application combines a React-based Electron frontend with a Python gRPC backend for high-performance geospatial data processing and visualization.

### Communication Flow
```
React Components (Renderer Process)
          ↓ Secure IPC
Main Process (gRPC Client)
          ↓ gRPC Protocol
Python gRPC Server (Backend)
```

### Key Features
- **Real-time geospatial data streaming** via gRPC
- **Cross-platform desktop application** (Windows, macOS, Linux)
- **Type-safe communication** using Protocol Buffers
- **Secure architecture** with Electron context isolation
- **Modern UI** with shadcn/ui components

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
- **Python gRPC Server** - High-performance backend
- **Protocol Buffers** - Efficient serialization
- **Real-time streaming** - Server-side streaming RPCs
- **Health monitoring** - Built-in health checks

### Development Tools 🛠️
- [Vite 6](https://vitejs.dev) - Fast build tool
- [Vitest](https://vitest.dev) - Unit testing
- [Playwright](https://playwright.dev) - E2E testing
- [ESLint 9](https://eslint.org) + [Prettier](https://prettier.io) - Code quality
- [Electron Forge](https://www.electronforge.io) - Packaging and distribution

### gRPC Services 📡
- **GetFeatures** - Fetch geospatial features within bounds
- **StreamData** - Real-time data point streaming
- **HealthCheck** - Service health monitoring

## Project Structure

```plaintext
├── src/                          # Frontend source code
│   ├── components/               # React components
│   │   ├── BackendStatus.tsx    # gRPC backend health monitoring
│   │   ├── GrpcDemo.tsx         # gRPC API demonstration
│   │   ├── template/            # App layout components
│   │   └── ui/                  # shadcn/ui components
│   ├── helpers/                 # Utility functions
│   │   ├── ipc/                 # Electron IPC communication
│   │   │   └── grpc/           # gRPC IPC handlers
│   │   ├── backend_helpers.ts   # Backend process management
│   │   └── grpc_client.ts      # Renderer gRPC client (IPC-based)
│   ├── main/                    # Main process code
│   │   └── grpc-client.ts      # Main process gRPC client (@grpc/grpc-js)
│   └── generated/              # Auto-generated protobuf files
├── backend/                     # Python gRPC server
│   ├── grpc_server.py          # Main gRPC service implementation
│   ├── build_server.py         # PyInstaller build script
│   ├── generated/              # Auto-generated protobuf files
│   └── requirements.txt        # Python dependencies
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

## gRPC API

The application provides three main gRPC services:

### GetFeatures
Fetch geospatial features within specified bounds
```typescript
const features = await window.electronGrpc.getFeatures(
  {
    northeast: { latitude: 40.7829, longitude: -73.9654 },
    southwest: { latitude: 40.7489, longitude: -73.9904 }
  },
  ['poi', 'landmark'],
  10
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
