
# 🔄 gRPC Communication Architecture & Extension Guide

## ⏺ Overview

Based on a deep analysis of the entire codebase, here's how the gRPC communication works and how to add new functions.

---

## 🧱 3-Layer Communication Flow

```text
React Components (Renderer)
    ↓ IPC (Context Bridge - Secure)
Electron Main Process (gRPC Client)
    ↓ gRPC (@grpc/grpc-js)
Python Backend (gRPC Server)
```

---

## 🧩 Key Components

### 1. Protocol Definition (`geospatial.proto`)
- Defines the service contract with 5 methods:
  - `HelloWorld`
  - `EchoParameter`
  - `GetFeatures`
  - `GetBatchDataStreamed`
  - `HealthCheck`
- Uses optimized data types (e.g., `float32`, compressed formats)

### 2. Python gRPC Server (`backend/grpc_server.py`)
- Implements `GeospatialServicer` class
- Runs on port `50077`
- Uses NumPy for high-performance data
- Supports:
  - Compression
  - Streaming
  - Optimized formats

### 3. Electron Main Process (`src/main/grpc-client.ts`)
- `MainProcessGrpcClient` built with `@grpc/grpc-js`
- GZIP compression enabled
- 500MB message limit
- Manages gRPC connections and streaming

### 4. IPC Bridge Layer (`src/main.ts`)
- 13 IPC handlers connecting renderer ↔ main
- Web Worker integration for non-blocking execution
- Progress streaming and error handling

### 5. Renderer Context (`src/helpers/ipc/grpc/grpc-context.ts`)
- Secure context bridge via `window.electronGrpc`
- Type-safe API matching the backend
- Web Worker integration ensures **zero UI blocking**

---

## 🛠️ How to Add a New gRPC Function

### ✅ Step-by-Step Process

---

### 1. Update Protocol Buffer Definition

```proto
// In geospatial.proto
rpc YourNewMethod(YourNewRequest) returns (YourNewResponse);

message YourNewRequest {
  string input_parameter = 1;
  int32 numeric_value = 2;
}

message YourNewResponse {
  string result = 1;
  bool success = 2;
}
```

---

### 2. Generate Protocol Buffer Code

```bash
npm run generate:protos
```
> Generates TypeScript and Python bindings.

---

### 3. Implement Backend Method

```python
# In backend/grpc_server.py

def YourNewMethod(self, request, context):
    """Your method implementation"""
    input_param = request.input_parameter
    numeric_val = request.numeric_value

    result_value = f"Processed: {input_param} with value {numeric_val}"

    response = geospatial_pb2.YourNewResponse()
    response.result = result_value
    response.success = True
    return response
```

---

### 4. Add gRPC Client Method

```ts
// In src/main/grpc-client.ts

async yourNewMethod(inputParameter: string, numericValue: number): Promise<YourNewResponse> {
  return new Promise((resolve, reject) => {
    if (!this.client) {
      reject(new Error('gRPC client not initialized'));
      return;
    }

    const request = {
      inputParameter,
      numericValue
    };

    this.client.YourNewMethod(request, (error, response) => {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}
```

---

### 5. Add IPC Handler

```ts
// In src/main.ts

ipcMain.handle('grpc-your-new-method', async (event, inputParameter: string, numericValue: number) => {
  try {
    return await mainGrpcClient.yourNewMethod(inputParameter, numericValue);
  } catch (error) {
    console.error('gRPC your-new-method error:', error);
    throw error;
  }
});
```

---

### 6. Update Context Interface

```ts
// In src/helpers/ipc/grpc/grpc-context.ts

export interface ElectronGrpcApi {
  // ... existing methods
  yourNewMethod: (inputParameter: string, numericValue: number) => Promise<YourNewResponse>;
}

// Add to exposeGrpcInMainWorld function:

yourNewMethod: (inputParameter: string, numericValue: number) =>
  ipcRenderer.invoke('grpc-your-new-method', inputParameter, numericValue),
```

---

### 7. Use in React Components

```tsx
// In any React component:

const handleNewMethod = async () => {
  try {
    const result = await window.electronGrpc.yourNewMethod("test input", 42);
    console.log('Result:', result.result);
    console.log('Success:', result.success);
  } catch (error) {
    console.error('Error calling new method:', error);
  }
};
```

---

## 🚀 Advanced Features

### For Streaming Methods:
- Use `GetBatchDataStreamed` as a template
- Implement Python generators with `yield`
- Add Web Worker for zero blocking

### For Performance:
- Use GZIP compression
- Optimize with `float32` types
- Chunk processing for large datasets

---

## 🔐 Security Considerations
- All methods go through **secure IPC**
- Context isolation ensures safety
- Input validation in both frontend and backend

---

## ✅ Summary

This architecture is **modular**, **secure**, and **extendable**.

By following this **7-step guide**, you can add any new gRPC function seamlessly into the Electron + Python-based stack, while maintaining performance and UI responsiveness.
