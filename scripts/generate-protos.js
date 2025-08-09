#!/usr/bin/env node
/**
 * Generate Protocol Buffer files for both frontend and backend
 * Usage: node scripts/generate-protos.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROTO_DIR = 'protos';
const MAIN_PROTO_FILE = 'protos/main_service.proto';
const FRONTEND_OUT_DIR = 'src/generated';
const BACKEND_OUT_DIR = 'backend/generated';

function log(message) {
  console.log(`🔨 ${message}`);
}

function error(message) {
  console.error(`❌ ${message}`);
}

function success(message) {
  console.log(`✅ ${message}`);
}

function runCommand(command, description) {
  try {
    log(description);
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (err) {
    error(`Failed: ${description}`);
    console.error(err.message);
    return false;
  }
}

function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`Created directory: ${dir}`);
  }
}

function checkProtoFiles() {
  if (!fs.existsSync(PROTO_DIR)) {
    error(`Protocol buffer directory '${PROTO_DIR}' not found!`);
    process.exit(1);
  }
  if (!fs.existsSync(MAIN_PROTO_FILE)) {
    error(`Main protocol buffer file '${MAIN_PROTO_FILE}' not found!`);
    process.exit(1);
  }
}

function generateFrontendProtos() {
  log('Generating frontend Protocol Buffers...');
  
  ensureDirectory(FRONTEND_OUT_DIR);
  
  // Generate TypeScript files using Buf's protoc-gen-es - process all proto files
  const command = `protoc --plugin=protoc-gen-es=./node_modules/.bin/protoc-gen-es --es_out=${FRONTEND_OUT_DIR} --es_opt=target=ts --proto_path=${PROTO_DIR} ${PROTO_DIR}/*.proto`;
  
  return runCommand(command, 'Generating TypeScript protobuf files for frontend');
}

function generateBackendProtos() {
  log('Generating backend Protocol Buffers...');
  
  ensureDirectory(BACKEND_OUT_DIR);
  
  // Generate Python files using grpcio-tools - process all proto files  
  const command = `python -m grpc_tools.protoc --python_out=${BACKEND_OUT_DIR} --grpc_python_out=${BACKEND_OUT_DIR} --proto_path=${PROTO_DIR} ${PROTO_DIR}/*.proto`;
  
  return runCommand(command, 'Generating Python protobuf files for backend');
}

function checkDependencies() {
  log('Checking dependencies...');
  
  // Check if protoc is available
  try {
    execSync('protoc --version', { stdio: 'ignore' });
  } catch (err) {
    error('protoc is not installed or not in PATH');
    console.log('Install protoc: https://grpc.io/docs/protoc-installation/');
    process.exit(1);
  }
  
  // Check if protoc-gen-es is available
  const protocGenEs = './node_modules/.bin/protoc-gen-es';
  if (!fs.existsSync(protocGenEs)) {
    error('protoc-gen-es not found. Install with: npm install @bufbuild/protoc-gen-es');
    process.exit(1);
  }
  
  // Check if grpcio-tools is available (Python)
  try {
    execSync('python -c "import grpc_tools.protoc"', { stdio: 'ignore' });
  } catch (err) {
    error('grpcio-tools not installed for Python');
    console.log('Install with: pip install grpcio-tools');
    process.exit(1);
  }
  
  success('All dependencies found');
}

function main() {
  console.log('🚀 Protocol Buffer Generator');
  console.log('============================');
  
  checkDependencies();
  checkProtoFiles();
  
  const frontendSuccess = generateFrontendProtos();
  const backendSuccess = generateBackendProtos();
  
  console.log('\n📊 Results:');
  console.log(`Frontend: ${frontendSuccess ? '✅ Success' : '❌ Failed'}`);
  console.log(`Backend:  ${backendSuccess ? '✅ Success' : '❌ Failed'}`);
  
  if (frontendSuccess && backendSuccess) {
    success('All Protocol Buffers generated successfully!');
    console.log('\n📂 Generated files:');
    console.log(`   Frontend: ${FRONTEND_OUT_DIR}/geospatial_pb.ts`);
    console.log(`   Backend:  ${BACKEND_OUT_DIR}/geospatial_pb2.py`);
    console.log(`   Backend:  ${BACKEND_OUT_DIR}/geospatial_pb2_grpc.py`);
  } else {
    error('Some Protocol Buffer generation failed!');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main }; 