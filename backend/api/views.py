from django.http import JsonResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response
from pathlib import Path

@api_view(['GET'])
def health_check(request):
    return Response({'status': 'healthy', 'message': 'Django backend is running'})

@api_view(['GET'])
def connectrpc_port(request):
    """Return the ConnectRPC server port"""
    try:
        port_file = Path(__file__).parent.parent / 'connectrpc_port.txt'
        if port_file.exists():
            port = int(port_file.read_text().strip())
            return Response({'port': port, 'status': 'running'})
        else:
            return Response({'error': 'ConnectRPC server not running'}, status=503)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
def get_data(request):
    # Example endpoint - replace with your actual data logic
    sample_data = {
        'data': [
            {'id': 1, 'name': 'Sample Data 1', 'value': 100},
            {'id': 2, 'name': 'Sample Data 2', 'value': 200},
            {'id': 3, 'name': 'Sample Data 3', 'value': 300}
        ]
    }
    return Response(sample_data)