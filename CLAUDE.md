# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a **desktop geospatial application** built with Electron that combines a React frontend with a Python gRPC backend. The application handles geospatial data processing and visualization with real-time streaming capabilities using **gRPC-only communication**.

### Tech Stack
- **Frontend**: Electron 36 + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Backend**: Pure gRPC server (Python) - no Django/REST API
- **Communication**: gRPC-only via Electron IPC, Protocol Buffers
- **Testing**: Vitest (unit), Playwright (e2e), React Testing Library
- **Build**: Vite 6, Electron Forge, PyInstaller

### Key Architecture Patterns

1. **Secure IPC-based gRPC**: Renderer process communicates via IPC to main process, which handles gRPC calls
2. **Protocol Buffer Integration**: Shared `.proto` definitions ensure type safety across TypeScript and Python
3. **Desktop Process Management**: gRPC server runs as bundled executable managed by Electron main process
4. **Real-time Data Streaming**: gRPC server streaming for live geospatial data points

### Communication Flow
```
React Components (Renderer)
        ↓ IPC
Main Process (gRPC Client)
        ↓ gRPC (@grpc/grpc-js)
Python gRPC Server (Backend)
```

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
- `components/GrpcDemo.tsx` - gRPC API demonstration
- `helpers/ipc/` - Electron IPC communication helpers
  - `helpers/ipc/grpc/` - gRPC IPC context and handlers
- `helpers/backend_helpers.ts` - Backend process management
- `helpers/grpc_client.ts` - Renderer-side gRPC client (uses IPC)
- `main/grpc-client.ts` - Main process gRPC client (@grpc/grpc-js)
- `generated/` - Auto-generated Protocol Buffer files
- `contexts/` - React contexts for state management
- `routes/` - TanStack Router configuration

### Backend Structure (`/backend/`)
- `grpc_server.py` - gRPC service implementation and main entry point
- `generated/` - Auto-generated Protocol Buffer files
- `build_server.py` - PyInstaller build configuration
- `requirements.txt` - Python dependencies (gRPC only)

### Configuration Files
- `geospatial.proto` - Protocol Buffer definitions for type-safe communication
- `forge.config.ts` - Electron packaging and distribution settings
- `backend/requirements.txt` - Python dependencies (grpcio, grpcio-tools, protobuf only)
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