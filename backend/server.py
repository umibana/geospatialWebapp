#!/usr/bin/env python
"""
Standalone Django server for Electron app
"""
import os
import sys
import threading
import time
import socket
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

import django
from django.core.management import execute_from_command_line
from django.core.wsgi import get_wsgi_application

def find_free_port(start_port=8000):
    """Find a free port starting from start_port"""
    for port in range(start_port, start_port + 100):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            continue
    raise RuntimeError("No free port found")

def run_server():
    """Run Django development server"""
    try:
        # Change to the script directory to ensure relative paths work
        script_dir = Path(__file__).parent.absolute()
        os.chdir(script_dir)
        print(f"Working directory: {script_dir}")
        
        django.setup()
        
        # Find a free port
        port = find_free_port()
        
        # Write port to file for Electron to read
        port_file = script_dir / 'server_port.txt'
        with open(port_file, 'w') as f:
            f.write(str(port))
        
        print(f"Starting Django server on port {port}")
        print(f"Port file: {port_file}")
        
        # Run Django server
        sys.argv = ['server.py', 'runserver', f'127.0.0.1:{port}', '--noreload']
        execute_from_command_line(sys.argv)
        
    except Exception as e:
        print(f"Error starting Django server: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    run_server() 