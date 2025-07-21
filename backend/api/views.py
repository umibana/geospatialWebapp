from django.http import JsonResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response
from pathlib import Path
import time
import os

@api_view(['GET'])
def data(request):
    """Sample API endpoint"""
    return Response({'message': 'Hello from Django!', 'data': [1, 2, 3, 4, 5]})

@api_view(['GET'])
def health(request):
    """Health check endpoint for Django backend"""
    try:
        # Get some basic system info
        backend_dir = Path(__file__).parent.parent
        grpc_port_file = backend_dir / 'grpc_port.txt'
        
        # Check if gRPC server is running
        grpc_running = grpc_port_file.exists()
        grpc_port = None
        if grpc_running:
            try:
                grpc_port = int(grpc_port_file.read_text().strip())
            except:
                grpc_running = False
        
        health_data = {
            'status': 'healthy',
            'timestamp': int(time.time() * 1000),
            'uptime': int(time.time()),
            'django': {
                'version': '4.2.23',
                'debug': os.getenv('DEBUG', 'True').lower() == 'true',
                'status': 'running'
            },
            'grpc': {
                'running': grpc_running,
                'port': grpc_port,
                'status': 'running' if grpc_running else 'stopped'
            },
            'services': {
                'rest_api': True,
                'grpc_service': grpc_running,
                'database': True  # SQLite is always available
            }
        }
        
        return Response(health_data)
    except Exception as e:
        return Response({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': int(time.time() * 1000)
        }, status=500)

@api_view(['GET'])
def grpc_port(request):
    """Return the gRPC server port"""
    try:
        port_file = Path(__file__).parent.parent / 'grpc_port.txt'
        if port_file.exists():
            port = int(port_file.read_text().strip())
            return Response({'port': port, 'status': 'running'})
        else:
            return Response({'error': 'gRPC server not running'}, status=503)
    except Exception as e:
        return Response({'error': str(e)}, status=500)