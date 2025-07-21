# Backend Server

This backend runs both Django REST API and gRPC services together.

## Server Configuration

### `combined_server.py` - Django + gRPC (Main Server)
Runs both Django REST API and gRPC services together on fixed ports.

**Fixed Ports:**
- **Django REST API**: `http://127.0.0.1:8077`
- **gRPC Service**: `127.0.0.1:50077`

```bash
python combined_server.py
```

### `grpc_server.py` - gRPC Service Implementation
Contains the gRPC service implementation used by `combined_server.py`.
**Do not run directly** - used internally by combined_server.

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

- **Development**: Uses `combined_server.py` on fixed ports
- **Production**: Uses packaged executable

## Port Files

- `server_port.txt` - Django REST API port (always 8077)
- `grpc_port.txt` - gRPC service port (always 50077)

## API Endpoints

- `GET /api/data/` - Sample REST endpoint
- `GET /api/health/` - Backend health check (Django + gRPC status)
- `GET /api/grpc-port/` - Returns gRPC server port

## gRPC Services

- `GeospatialService.GetFeatures` - Fetch geospatial features
- `GeospatialService.StreamData` - Real-time data streaming
- `GeospatialService.HealthCheck` - Service health check

## Development

Start the combined server:
```bash
npm run dev:backend
```

This starts both Django on port 8077 and gRPC on port 50077. 