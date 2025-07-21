#!/usr/bin/env python
"""
Combined Django + ConnectRPC server for Electron app
Starts both Django REST API and ConnectRPC services together
"""
import os
import sys
import socket
import threading
import time
import subprocess
from pathlib import Path

def find_free_port(start_port=8000):
    """Find a free port starting from start_port"""
    for port in range(start_port, start_port + 10):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            continue
    return start_port  # Fallback

def start_connectrpc_server():
    """Start ConnectRPC server in a separate process"""
    try:
        script_dir = Path(__file__).parent.absolute()
        connectrpc_script = script_dir / 'connectrpc_server.py'
        
        print("🚀 Starting ConnectRPC server...")
        
        # Start ConnectRPC server as subprocess
        process = subprocess.Popen(
            [sys.executable, str(connectrpc_script)],
            cwd=script_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        # Monitor ConnectRPC output
        def monitor_connectrpc():
            for line in iter(process.stdout.readline, ''):
                if line:
                    print(f"[ConnectRPC] {line.strip()}")
            process.stdout.close()
        
        monitor_thread = threading.Thread(target=monitor_connectrpc, daemon=True)
        monitor_thread.start()
        
        return process
        
    except Exception as e:
        print(f"❌ Failed to start ConnectRPC server: {e}")
        return None

def main():
    connectrpc_process = None
    
    try:
        # Set up environment
        if getattr(sys, 'frozen', False):
            script_dir = Path(sys.executable).parent.absolute()
        else:
            script_dir = Path(__file__).parent.absolute()
        
        os.chdir(script_dir)
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
        
        print("🏗️  Starting Combined Server (Django + ConnectRPC)")
        print(f"📁 Working directory: {script_dir}")
        
        # Start ConnectRPC server first
        connectrpc_process = start_connectrpc_server()
        
        # Give ConnectRPC time to start
        time.sleep(2)
        
        # Find a free port for Django
        django_port = find_free_port(8000)
        
        # Write Django port to file for Electron to read
        port_file = script_dir / 'server_port.txt'
        with open(port_file, 'w') as f:
            f.write(str(django_port))
        
        print(f"🌐 Django server starting on port {django_port}")
        print(f"📄 Port file: {port_file}")
        
        # Import and start Django
        import django
        from django.core.management import execute_from_command_line
        
        django.setup()
        
        # Start Django server
        sys.argv = [
            'combined_server.py', 
            'runserver', 
            f'127.0.0.1:{django_port}', 
            '--noreload', 
            '--insecure'
        ]
        
        print("✅ Combined server ready!")
        print(f"   - Django REST API: http://127.0.0.1:{django_port}")
        print("   - ConnectRPC: Check backend/connectrpc_port.txt for port")
        
        execute_from_command_line(sys.argv)
        
    except KeyboardInterrupt:
        print("\n🛑 Shutting down servers...")
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        
        # Write error to file
        try:
            error_file = Path(__file__).parent / 'server_error.txt'
            with open(error_file, 'w') as f:
                f.write(f"Error: {e}\n")
                f.write(traceback.format_exc())
        except:
            pass
    finally:
        # Clean up ConnectRPC process
        if connectrpc_process:
            print("🧹 Stopping ConnectRPC server...")
            connectrpc_process.terminate()
            try:
                connectrpc_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                connectrpc_process.kill()
        
        sys.exit(1)

if __name__ == '__main__':
    main() 