# Backend Server Options

This backend supports multiple server configurations:

## Available Server Scripts

### 1. `server.py` - Django Only
Simple Django REST API server without gRPC.
```bash
python server.py
```

### 2. `combined_server.py` - Django + gRPC (Recommended)
Runs both Django REST API and gRPC services together.
```bash
python combined_server.py
```

### 3. `simple_grpc_server.py` - gRPC Only
Standalone gRPC server for testing.
```bash
python simple_grpc_server.py
```

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Generate gRPC files (if needed):
```bash
python -m grpc_tools.protoc --python_out=generated --grpc_python_out=generated --proto_path=.. ../geospatial.proto
```

## Default Configuration

- **Development**: Uses `combined_server.py` (Django + gRPC)
- **Production**: Uses packaged executable

## Port Files

- `server_port.txt` - Django REST API port
- `grpc_port.txt` - gRPC service port

## API Endpoints

- `GET /api/data/` - Sample REST endpoint
- `GET /api/grpc-port/` - Returns gRPC server port

## gRPC Services

- `GeospatialService.GetFeatures` - Fetch geospatial features
- `GeospatialService.StreamData` - Real-time data streaming
- `GeospatialService.HealthCheck` - Service health check 