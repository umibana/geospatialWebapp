#!/usr/bin/env python
"""
Build script for gRPC server
"""
import os
import sys
import subprocess
from pathlib import Path

def build_server():
    # Set up paths
    backend_dir = Path(__file__).parent
    os.chdir(backend_dir)
    
    # Build command
    cmd = [
        sys.executable, '-m', 'PyInstaller',
        '--onedir',
        '--name=grpc-server',
        '--distpath=dist',
        '--workpath=build',
        '--specpath=.',
        '--clean',
        '--noconfirm',
        '--add-data=generated:generated',
        'grpc_server.py'
    ]
    
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    
    if result.returncode == 0:
        print("✅ gRPC server built successfully!")
        print(f"📁 Output: {backend_dir}/dist/grpc-server/")
    else:
        print("❌ Build failed!")
        sys.exit(1)

if __name__ == '__main__':
    build_server() 