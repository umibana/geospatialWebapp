#!/usr/bin/env python
"""
Simple Django server for Electron app
"""
import os
import sys
import socket
from pathlib import Path

def find_free_port(start_port=8000):
    """Find a free port starting from start_port"""
    for port in range(start_port, start_port + 10):  # Try only 10 ports
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            continue
    return 8000  # Fallback

def main():
    try:
        # Set up environment - handle PyInstaller bundled environment
        if getattr(sys, 'frozen', False):
            # Running in PyInstaller bundle
            script_dir = Path(sys.executable).parent.absolute()
        else:
            # Running as script
            script_dir = Path(__file__).parent.absolute()
        
        os.chdir(script_dir)
        
        # Set Django settings
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
        
        # Find a free port
        port = find_free_port()
        
        # Write port to file for Electron to read (in the main directory, not _internal)
        port_file = script_dir / 'server_port.txt'
        with open(port_file, 'w') as f:
            f.write(str(port))
        
        print(f"Django server starting on port {port}")
        print(f"Working directory: {script_dir}")
        print(f"Port file: {port_file}")
        print(f"Is frozen: {getattr(sys, 'frozen', False)}")
        print(f"Executable: {sys.executable}")
        
        # Import Django after setting up environment
        import django
        from django.core.management import execute_from_command_line
        
        django.setup()
        
        # Start server
        sys.argv = ['simple_server.py', 'runserver', f'127.0.0.1:{port}', '--noreload', '--insecure']
        execute_from_command_line(sys.argv)
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        
        # Write error to file so Electron can see it
        try:
            error_file = Path(__file__).parent / 'server_error.txt'
            with open(error_file, 'w') as f:
                f.write(f"Error: {e}\n")
                f.write(traceback.format_exc())
        except:
            pass
        
        sys.exit(1)

if __name__ == '__main__':
    main() 