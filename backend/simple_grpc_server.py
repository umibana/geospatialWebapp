#!/usr/bin/env python
"""
Simple standalone gRPC server for development and testing
"""
import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.absolute()
sys.path.insert(0, str(backend_dir))

# Set up Django environment (needed for any Django models/settings if used)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Import and run the gRPC server
from grpc_server import serve

if __name__ == '__main__':
    print("🚀 Starting standalone gRPC server...")
    print("📁 Working directory:", backend_dir)
    serve() 