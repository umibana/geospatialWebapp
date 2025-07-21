#!/usr/bin/env python
"""
Simple build script for Django server
"""
import os
import sys
import subprocess
from pathlib import Path

def build_server():
    # Set up paths
    backend_dir = Path(__file__).parent
    os.chdir(backend_dir)
    
    # Set Django settings
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    
    # Build command
    cmd = [
        sys.executable, '-m', 'PyInstaller',
        '--onedir',
        '--name=django-server',
        '--distpath=dist',
        '--workpath=build',
        '--specpath=.',
        '--clean',
        '--noconfirm',
        'simple_server.py'
    ]
    
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    
    if result.returncode == 0:
        print("✅ Django server built successfully!")
        print(f"📁 Output: {backend_dir}/dist/django-server/")
    else:
        print("❌ Build failed!")
        sys.exit(1)

if __name__ == '__main__':
    build_server() 