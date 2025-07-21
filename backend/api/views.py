from django.http import JsonResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response
from pathlib import Path

@api_view(['GET'])
def data(request):
    """Sample API endpoint"""
    return Response({'message': 'Hello from Django!', 'data': [1, 2, 3, 4, 5]})

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