# Scripts Directory

This directory contains build and development scripts for the project.

## Protocol Buffer Generation

### `generate-protos.js`

Generates Protocol Buffer files for both frontend and backend from the root `geospatial.proto` file.

**Usage:**
```bash
# Generate all protobufs
npm run generate:protos

# Generate only frontend protobufs
npm run generate:protos:frontend

# Generate only backend protobufs
npm run generate:protos:backend
```

**Requirements:**
- `protoc` (Protocol Buffer Compiler)
- `@bufbuild/protoc-gen-es` (npm package)
- `grpcio-tools` (Python package)

**Generated Files:**
- **Frontend**: `src/generated/geospatial_pb.ts` (TypeScript)
- **Backend**: `backend/generated/geospatial_pb2.py` (Python)
- **Backend**: `backend/generated/geospatial_pb2_grpc.py` (Python gRPC)

**Automatic Generation:**
The script runs automatically before:
- `npm start` (development)
- `npm run make` (build)

**Manual Run:**
```bash
node scripts/generate-protos.js
```

## Dependencies

The script automatically checks for required dependencies and provides installation instructions if missing. 