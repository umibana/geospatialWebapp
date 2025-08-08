# New Architecture Overview

This document explains the streamlined architecture for the Electron + gRPC geospatial app, including process boundaries, data flow, IPC channels, and how to extend the processing pipeline generically.

## High-Level Components

- Electron Main Process
  - Creates the BrowserWindow and preload
  - Manages backend (Python gRPC) lifecycle
  - Hosts auto-generated gRPC client (`@grpc/grpc-js`)
  - Registers IPC handlers (auto + custom for processing)
  - Runs Worker Threads for heavy processing
- Electron Preload (contextBridge)
  - Exposes safe, typed `window.grpc` API to renderer
  - Debounces chatty progress events
  - Provides helper to fetch chart data in chunks to avoid IPC blocking
- Renderer (React)
  - Calls `window.grpc` APIs only (no direct Node access)
  - Uses a single optimized API per feature (auto strategy selection)
- Python gRPC Backend
  - Implements gRPC methods and streaming endpoints
  - Streams chunked data for efficient transfer

## Data Flow (Smart Processing Selection)

1) Renderer invokes an optimized API (e.g., `window.grpc.getBatchDataOptimized(bounds, types, maxPoints, resolution, onProgress)`).
2) Preload decides strategy by threshold:
   - `< 50K` → Worker Stream (simulated main-thread streaming with chunking/yielding)
   - `≥ 50K` → Worker Threads (Node.js `worker_threads`)
3) Main process calls backend via `autoMainGrpcClient.getBatchDataStreamed` (chunked gRPC stream).
4) For Worker Threads:
   - Inline eval worker processes chunks: reservoir sampling (bounded), stats, chart metadata
   - Progress events throttled by a global coalescer (~100ms)
   - Final response includes metadata only; chart data fetched later by preload in chunks via IPC
5) Renderer updates UI based on `strategy`, `progress`, and final results.

## IPC Channels

- Auto-generated gRPC invoke channels: `grpc-*` (health, features, etc.)
- Processing channels:
  - `grpc-start-child-process-stream` (main → worker threads)
  - `grpc-child-process-progress` (progress + completion, coalesced)
  - `grpc-get-chart-data` / `grpc-chart-data-response` (chunked chart transfer)
  - Legacy worker stream (kept minimal): `grpc-start-worker-stream` (progress/chunk/error)
- Backend mgmt: `backend:*` (get-url, health-check, restart)

## Performance Techniques

- Chunked gRPC streaming + large gRPC message limits (send/receive)
- Worker Threads for true parallel CPU work (≥50K points)
- Reservoir sampling (max ~10K points) for bounded chart memory
- Coalesced progress (main) and debounced progress (preload) to reduce UI churn
- Chunked chart data fetch to avoid IPC blocking and large payloads

## Extending the Architecture (Add New Heavy Feature)

Checklist:
1. Backend: implement `GetXyzDataStreamed(request)` returning chunked data
2. Main gRPC client: add `autoMainGrpcClient.getXyzDataStreamed(request)` (same streaming wrapper)
3. Main IPC: add `ipcMain.on('grpc-start-xyz-child-process-stream', ...)`:
   - Fetch chunks via gRPC
   - Normalize chunk shape to `{ data_points: [...] }` if needed
   - Call `MainProcessWorker.getInstance().processLargeDataset(chunks, requestId, onProgress)`
   - Use global coalescer for progress; send final metadata; chart data via `grpc-get-chart-data`
4. Preload: add `getXyzDataChildProcessStreamed` and an optimized `getXyzDataOptimized` (threshold-based)
5. Renderer: call only the optimized API; surface `strategy` in UI

Generic Worker Contract:
- Worker input: array of normalized chunks `{ data_points: { location: { latitude, longitude }, value, unit, metadata }[] }`
- Worker output: `{ stats, chartConfig }` with bounded `chartConfig.data` via reservoir sampling
- For different visualization types, extend worker with a `mode` option and switch transforms while reusing sampling and progress

## Text Diagram

Renderer (React)
  ↓
Preload (contextBridge)
  - Exposes typed window.grpc
  - Debounces progress
  ↓ IPC invoke
Main Process (Electron)
  - Auto gRPC client (@grpc/grpc-js)
  - Global progress coalescer
  - Worker Threads for heavy processing
  - Chart data cache + chunked fetch
  ↓ gRPC
Python Backend (gRPC)
  - Streamed chunk responses

This architecture keeps the renderer simple (one optimized API per feature), enforces safe boundaries, scales to very large datasets, and provides a clear path to plug in new heavy features with minimal boilerplate.

