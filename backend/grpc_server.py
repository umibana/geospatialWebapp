#!/usr/bin/env python
"""
gRPC Geospatial Service Server
Replaces ConnectRPC implementation with native gRPC
"""
import os
import sys
import time
import random
import asyncio
import socket
import threading
from pathlib import Path
from concurrent import futures

# Add the current directory to Python path to find generated files
script_dir = Path(__file__).parent.absolute()
sys.path.insert(0, str(script_dir))
sys.path.insert(0, str(script_dir / 'generated'))

import grpc

# Import the generated protobuf files
import geospatial_pb2
import geospatial_pb2_grpc


class GeospatialServicer(geospatial_pb2_grpc.GeospatialServiceServicer):
    """Implementation of the GeospatialService"""
    
    def __init__(self):
        self.version = "1.0.0"
        print("🌍 GeospatialService initialized")
    
    def GetFeatures(self, request, context):
        """Get geospatial features within specified bounds"""
        try:
            print(f"📍 GetFeatures request: bounds={request.bounds.northeast.latitude},{request.bounds.northeast.longitude} to {request.bounds.southwest.latitude},{request.bounds.southwest.longitude}, limit={request.limit}")
            
            # Generate sample features for demo
            features = []
            feature_count = min(request.limit or 10, 50)  # Cap at 50 for demo
            
            # Sample area bounds
            lat_min = request.bounds.southwest.latitude
            lat_max = request.bounds.northeast.latitude
            lng_min = request.bounds.southwest.longitude
            lng_max = request.bounds.northeast.longitude
            
            for i in range(feature_count):
                # Generate random coordinates within bounds
                lat = random.uniform(lat_min, lat_max)
                lng = random.uniform(lng_min, lng_max)
                
                feature = geospatial_pb2.GeospatialFeature(
                    id=f"feature_{i}_{int(time.time())}",
                    name=f"Sample Feature {i+1}",
                    location=geospatial_pb2.Coordinate(
                        latitude=lat,
                        longitude=lng,
                        altitude=random.uniform(0, 100)
                    ),
                    timestamp=int(time.time() * 1000),
                    properties={
                        "type": random.choice(["poi", "landmark", "building"]),
                        "category": random.choice(["restaurant", "park", "shop", "office"]),
                        "importance": str(random.randint(1, 10))
                    }
                )
                features.append(feature)
            
            response = geospatial_pb2.GetFeaturesResponse(
                features=features,
                total_count=len(features)
            )
            
            print(f"✅ Returning {len(features)} features")
            return response
            
        except Exception as e:
            print(f"❌ Error in GetFeatures: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Internal server error: {str(e)}")
            return geospatial_pb2.GetFeaturesResponse()
    
    def StreamData(self, request, context):
        """Stream real-time geospatial data points"""
        try:
            print(f"🔄 StreamData request: bounds={request.bounds.northeast.latitude},{request.bounds.northeast.longitude} to {request.bounds.southwest.latitude},{request.bounds.southwest.longitude}")
            
            # Sample area bounds
            lat_min = request.bounds.southwest.latitude
            lat_max = request.bounds.northeast.latitude
            lng_min = request.bounds.southwest.longitude
            lng_max = request.bounds.northeast.longitude
            
            max_points = request.max_points_per_second or 5
            interval = 1.0 / max_points  # Points per second
            
            # Stream data points for 30 seconds (demo)
            start_time = time.time()
            point_id = 0
            
            while time.time() - start_time < 30:  # Stream for 30 seconds
                if context.is_active():
                    # Generate random data point
                    lat = random.uniform(lat_min, lat_max)
                    lng = random.uniform(lng_min, lng_max)
                    
                    data_point = geospatial_pb2.DataPoint(
                        id=f"datapoint_{point_id}_{int(time.time())}",
                        location=geospatial_pb2.Coordinate(
                            latitude=lat,
                            longitude=lng,
                            altitude=random.uniform(0, 50)
                        ),
                        value=random.uniform(0, 100),
                        unit=random.choice(["temperature", "humidity", "pressure"]),
                        timestamp=int(time.time() * 1000),
                        metadata={
                            "sensor_type": random.choice(["temperature", "humidity", "air_quality"]),
                            "accuracy": str(random.uniform(0.8, 1.0)),
                            "source": "demo_sensor"
                        }
                    )
                    
                    yield data_point
                    point_id += 1
                    
                    time.sleep(interval)
                else:
                    print("🛑 Client disconnected from stream")
                    break
            
            print(f"✅ StreamData finished, sent {point_id} data points")
            
        except Exception as e:
            print(f"❌ Error in StreamData: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Streaming error: {str(e)}")
    
    def HealthCheck(self, request, context):
        """Health check endpoint"""
        try:
            response = geospatial_pb2.HealthCheckResponse(
                healthy=True,
                version=self.version,
                status={
                    "service": "GeospatialService",
                    "uptime": str(int(time.time())),
                    "features_available": "true",
                    "streaming_available": "true"
                }
            )
            print("💚 Health check: OK")
            return response
            
        except Exception as e:
            print(f"❌ Health check error: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Health check failed: {str(e)}")
            return geospatial_pb2.HealthCheckResponse(healthy=False, version=self.version)


def find_free_port(start_port=50051):
    """Find a free port starting from start_port"""
    for port in range(start_port, start_port + 10):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            continue
    return start_port  # Fallback


def serve():
    """Start the gRPC server"""
    try:
        # Use fixed port for gRPC
        port = 50077
        
        # Create server
        server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
        
        # Add service to server
        geospatial_pb2_grpc.add_GeospatialServiceServicer_to_server(
            GeospatialServicer(), server
        )
        
        # Configure server
        listen_addr = f'127.0.0.1:{port}'
        server.add_insecure_port(listen_addr)
        
        # Write port to file so frontend can find it
        script_dir = Path(__file__).parent.absolute()
        port_file = script_dir / 'grpc_port.txt'
        with open(port_file, 'w') as f:
            f.write(str(port))
        
        # Start server
        server.start()
        
        print(f"🚀 gRPC GeospatialService started on {listen_addr}")
        print(f"📄 Port written to: {port_file}")
        print("✅ Ready to accept connections")
        
        try:
            server.wait_for_termination()
        except KeyboardInterrupt:
            print("\n🛑 Shutting down gRPC server...")
            server.stop(grace=5)
            
            # Clean up port file
            if port_file.exists():
                port_file.unlink()
                
    except Exception as e:
        print(f"❌ Failed to start gRPC server: {e}")
        
        # Write error to file
        script_dir = Path(__file__).parent.absolute()
        error_file = script_dir / 'grpc_error.txt'
        with open(error_file, 'w') as f:
            f.write(f"Error: {e}\n")
            import traceback
            f.write(traceback.format_exc())
        
        sys.exit(1)


if __name__ == '__main__':
    serve() 