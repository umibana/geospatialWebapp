from django.http import JsonResponse, HttpResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response
from pathlib import Path
import time
import os
import json
import grpc
import sys

# Add the backend directory to Python path to import gRPC files
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))
sys.path.insert(0, str(backend_dir / 'generated'))

import geospatial_pb2
import geospatial_pb2_grpc

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

@api_view(['POST'])
def grpc_get_features(request):
    """Proxy gRPC GetFeatures call via REST API"""
    try:
        # Get gRPC port
        grpc_port_file = Path(__file__).parent.parent / 'grpc_port.txt'
        if not grpc_port_file.exists():
            return Response({'error': 'gRPC server not running'}, status=503)
        
        grpc_port = int(grpc_port_file.read_text().strip())
        
        # Parse request data
        data = request.data
        bounds_data = data.get('bounds', {})
        feature_types = data.get('feature_types', [])
        limit = data.get('limit', 10)
        
        # Create gRPC request
        bounds = geospatial_pb2.BoundingBox(
            northeast=geospatial_pb2.Coordinate(
                latitude=bounds_data.get('northeast', {}).get('latitude', 0),
                longitude=bounds_data.get('northeast', {}).get('longitude', 0),
                altitude=bounds_data.get('northeast', {}).get('altitude')
            ),
            southwest=geospatial_pb2.Coordinate(
                latitude=bounds_data.get('southwest', {}).get('latitude', 0),
                longitude=bounds_data.get('southwest', {}).get('longitude', 0),
                altitude=bounds_data.get('southwest', {}).get('altitude')
            )
        )
        
        grpc_request = geospatial_pb2.GetFeaturesRequest(
            bounds=bounds,
            feature_types=feature_types,
            limit=limit
        )
        
        # Make gRPC call
        with grpc.insecure_channel(f'127.0.0.1:{grpc_port}') as channel:
            stub = geospatial_pb2_grpc.GeospatialServiceStub(channel)
            response = stub.GetFeatures(grpc_request)
            
            # Convert to JSON
            features = []
            for feature in response.features:
                features.append({
                    'id': feature.id,
                    'name': feature.name,
                    'location': {
                        'latitude': feature.location.latitude,
                        'longitude': feature.location.longitude,
                        'altitude': feature.location.altitude if feature.location.HasField('altitude') else None
                    },
                    'properties': dict(feature.properties),
                    'timestamp': feature.timestamp
                })
            
            return Response({
                'features': features,
                'total_count': response.total_count
            })
            
    except Exception as e:
        print(f"❌ gRPC proxy error: {e}")
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
def grpc_stream_data(request):
    """Proxy gRPC StreamData call via Server-Sent Events"""
    try:
        # Get gRPC port
        grpc_port_file = Path(__file__).parent.parent / 'grpc_port.txt'
        if not grpc_port_file.exists():
            return Response({'error': 'gRPC server not running'}, status=503)
        
        grpc_port = int(grpc_port_file.read_text().strip())
        
        # Parse request data
        data = request.data
        bounds_data = data.get('bounds', {})
        data_types = data.get('data_types', [])
        max_points_per_second = data.get('max_points_per_second', 5)
        
        # Create gRPC request
        bounds = geospatial_pb2.BoundingBox(
            northeast=geospatial_pb2.Coordinate(
                latitude=bounds_data.get('northeast', {}).get('latitude', 0),
                longitude=bounds_data.get('northeast', {}).get('longitude', 0),
                altitude=bounds_data.get('northeast', {}).get('altitude')
            ),
            southwest=geospatial_pb2.Coordinate(
                latitude=bounds_data.get('southwest', {}).get('latitude', 0),
                longitude=bounds_data.get('southwest', {}).get('longitude', 0),
                altitude=bounds_data.get('southwest', {}).get('altitude')
            )
        )
        
        grpc_request = geospatial_pb2.StreamDataRequest(
            bounds=bounds,
            data_types=data_types,
            max_points_per_second=max_points_per_second
        )
        
        # For streaming, we'll collect some data and return it
        # In a real implementation, you'd use Server-Sent Events or WebSockets
        data_points = []
        
        with grpc.insecure_channel(f'127.0.0.1:{grpc_port}') as channel:
            stub = geospatial_pb2_grpc.GeospatialServiceStub(channel)
            stream = stub.StreamData(grpc_request)
            
            # Collect first 10 points for demo
            count = 0
            for data_point in stream:
                if count >= 10:  # Limit for REST demo
                    break
                    
                data_points.append({
                    'id': data_point.id,
                    'location': {
                        'latitude': data_point.location.latitude,
                        'longitude': data_point.location.longitude,
                        'altitude': data_point.location.altitude if data_point.location.HasField('altitude') else None
                    },
                    'value': data_point.value,
                    'unit': data_point.unit,
                    'timestamp': data_point.timestamp,
                    'metadata': dict(data_point.metadata)
                })
                count += 1
            
            return Response({'data_points': data_points})
            
    except Exception as e:
        print(f"❌ gRPC stream proxy error: {e}")
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
def grpc_health_check(request):
    """Proxy gRPC HealthCheck call via REST API"""
    try:
        # Get gRPC port
        grpc_port_file = Path(__file__).parent.parent / 'grpc_port.txt'
        if not grpc_port_file.exists():
            return Response({'error': 'gRPC server not running'}, status=503)
        
        grpc_port = int(grpc_port_file.read_text().strip())
        
        # Make gRPC call
        with grpc.insecure_channel(f'127.0.0.1:{grpc_port}') as channel:
            stub = geospatial_pb2_grpc.GeospatialServiceStub(channel)
            grpc_request = geospatial_pb2.HealthCheckRequest()
            response = stub.HealthCheck(grpc_request)
            
            return Response({
                'healthy': response.healthy,
                'version': response.version,
                'status': dict(response.status)
            })
            
    except Exception as e:
        print(f"❌ gRPC health check proxy error: {e}")
        return Response({'healthy': False, 'error': str(e)}, status=500)

@api_view(['POST'])
def grpc_get_features_protobuf(request):
    """Proxy gRPC GetFeatures call and return protobuf binary"""
    try:
        # Get gRPC port
        grpc_port_file = Path(__file__).parent.parent / 'grpc_port.txt'
        if not grpc_port_file.exists():
            return Response({'error': 'gRPC server not running'}, status=503)
        
        grpc_port = int(grpc_port_file.read_text().strip())
        
        # Parse request data
        data = request.data
        bounds_data = data.get('bounds', {})
        feature_types = data.get('feature_types', [])
        limit = data.get('limit', 10)
        
        # Create gRPC request
        bounds = geospatial_pb2.BoundingBox(
            northeast=geospatial_pb2.Coordinate(
                latitude=bounds_data.get('northeast', {}).get('latitude', 0),
                longitude=bounds_data.get('northeast', {}).get('longitude', 0),
                altitude=bounds_data.get('northeast', {}).get('altitude')
            ),
            southwest=geospatial_pb2.Coordinate(
                latitude=bounds_data.get('southwest', {}).get('latitude', 0),
                longitude=bounds_data.get('southwest', {}).get('longitude', 0),
                altitude=bounds_data.get('southwest', {}).get('altitude')
            )
        )
        
        grpc_request = geospatial_pb2.GetFeaturesRequest(
            bounds=bounds,
            feature_types=feature_types,
            limit=limit
        )
        
        # Make gRPC call
        with grpc.insecure_channel(f'127.0.0.1:{grpc_port}') as channel:
            stub = geospatial_pb2_grpc.GeospatialServiceStub(channel)
            response = stub.GetFeatures(grpc_request)
            
            # Return the protobuf response as binary data
            return HttpResponse(
                response.SerializeToString(),
                content_type='application/x-protobuf'
            )
            
    except Exception as e:
        print(f"❌ gRPC proxy error: {e}")
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
def grpc_health_check_protobuf(request):
    """Proxy gRPC HealthCheck call and return protobuf binary"""
    try:
        # Get gRPC port
        grpc_port_file = Path(__file__).parent.parent / 'grpc_port.txt'
        if not grpc_port_file.exists():
            return Response({'error': 'gRPC server not running'}, status=503)
        
        grpc_port = int(grpc_port_file.read_text().strip())
        
        # Make gRPC call
        with grpc.insecure_channel(f'127.0.0.1:{grpc_port}') as channel:
            stub = geospatial_pb2_grpc.GeospatialServiceStub(channel)
            grpc_request = geospatial_pb2.HealthCheckRequest()
            response = stub.HealthCheck(grpc_request)
            
            # Return the protobuf response as binary data
            return HttpResponse(
                response.SerializeToString(),
                content_type='application/x-protobuf'
            )
            
    except Exception as e:
        print(f"❌ gRPC health check proxy error: {e}")
        error_response = geospatial_pb2.HealthCheckResponse(
            healthy=False,
            version="1.0.0",
            status={"error": str(e)}
        )
        return HttpResponse(
            error_response.SerializeToString(),
            content_type='application/x-protobuf'
        )

@api_view(['POST'])
def grpc_stream_data_protobuf(request):
    """Proxy gRPC StreamData call and return protobuf binary (batch)"""
    try:
        # Get gRPC port
        grpc_port_file = Path(__file__).parent.parent / 'grpc_port.txt'
        if not grpc_port_file.exists():
            error_response = geospatial_pb2.GetFeaturesResponse()  # Empty response
            return HttpResponse(
                error_response.SerializeToString(),
                content_type='application/x-protobuf',
                status=503
            )
        
        grpc_port = int(grpc_port_file.read_text().strip())
        
        # Parse request data
        data = request.data
        bounds_data = data.get('bounds', {})
        data_types = data.get('data_types', [])
        max_points_per_second = data.get('max_points_per_second', 5)
        
        # Create gRPC request
        bounds = geospatial_pb2.BoundingBox(
            northeast=geospatial_pb2.Coordinate(
                latitude=bounds_data.get('northeast', {}).get('latitude', 0),
                longitude=bounds_data.get('northeast', {}).get('longitude', 0),
                altitude=bounds_data.get('northeast', {}).get('altitude')
            ),
            southwest=geospatial_pb2.Coordinate(
                latitude=bounds_data.get('southwest', {}).get('latitude', 0),
                longitude=bounds_data.get('southwest', {}).get('longitude', 0),
                altitude=bounds_data.get('southwest', {}).get('altitude')
            )
        )
        
        grpc_request = geospatial_pb2.StreamDataRequest(
            bounds=bounds,
            data_types=data_types,
            max_points_per_second=max_points_per_second
        )
        
        # Collect data points from gRPC stream (batch of 5 for demo)
        data_points = []
        
        with grpc.insecure_channel(f'127.0.0.1:{grpc_port}') as channel:
            stub = geospatial_pb2_grpc.GeospatialServiceStub(channel)
            stream = stub.StreamData(grpc_request)
            
            # Collect first 5 points for demo
            count = 0
            for data_point in stream:
                if count >= 5:  # Limit for REST demo
                    break
                data_points.append(data_point)
                count += 1
        
        # Create a response with multiple data points
        # Since we don't have a "StreamResponse" message, we'll create a custom one
        # or use GetFeaturesResponse format but with DataPoints
        response_data = []
        for dp in data_points:
            response_data.append(dp.SerializeToString())
        
        # For simplicity, return the first data point as protobuf
        # In a real app, you'd design a proper batch response message
        if data_points:
            return HttpResponse(
                data_points[0].SerializeToString(),  # Just return first point as protobuf
                content_type='application/x-protobuf'
            )
        else:
            # Return empty DataPoint
            empty_point = geospatial_pb2.DataPoint()
            return HttpResponse(
                empty_point.SerializeToString(),
                content_type='application/x-protobuf'
            )
            
    except Exception as e:
        print(f"❌ gRPC stream proxy error: {e}")
        empty_point = geospatial_pb2.DataPoint()
        return HttpResponse(
            empty_point.SerializeToString(),
            content_type='application/x-protobuf',
            status=500
        )