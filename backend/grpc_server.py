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

# Import the data generator
from data_generator import data_generator


class GeospatialServicer(geospatial_pb2_grpc.GeospatialServiceServicer):
    """Implementation of the GeospatialService"""
    
    def __init__(self):
        self.version = "1.0.0"
        print("🌍 GeospatialService initialized")
    
    def HelloWorld(self, request, context):
        """
        Simple Hello World example for testing basic gRPC connectivity
        
        @param request: HelloWorldRequest with message
        @param context: gRPC context
        @returns: HelloWorldResponse with echo message
        
        Example usage from frontend:
        ```typescript
        const response = await window.electronGrpc.helloWorld("Hello from frontend!");
        console.log('Server response:', response.message);
        ```
        """
        try:
            print(f"🌍 HelloWorld request: '{request.message}'")
            
            # Create a simple echo response
            response_message = f"Hello! You sent: '{request.message}'. Server time: {time.strftime('%H:%M:%S')}"
            
            response = geospatial_pb2.HelloWorldResponse()
            response.message = response_message
            
            print(f"🌍 HelloWorld response: '{response.message}'")
            return response
            
        except Exception as e:
            print(f"❌ HelloWorld error: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"HelloWorld failed: {str(e)}")
            return geospatial_pb2.HelloWorldResponse()
    
    def EchoParameter(self, request, context):
        """
        Echo Parameter example - processes a value with an operation and returns result
        
        @param request: EchoParameterRequest with value and operation
        @param context: gRPC context  
        @returns: EchoParameterResponse with original and processed values
        
        Example usage from frontend:
        ```typescript
        const result = await window.electronGrpc.echoParameter(42, "square");
        console.log(`${result.originalValue} squared = ${result.processedValue}`);
        ```
        """
        try:
            print(f"🔄 EchoParameter request: {request.value} ({request.operation})")
            
            original_value = request.value
            operation = request.operation.lower()
            
            # Process the value based on operation
            if operation == "square":
                processed_value = original_value * original_value
            elif operation == "double":
                processed_value = original_value * 2
            elif operation == "half":
                processed_value = original_value / 2
            elif operation == "negate":
                processed_value = -original_value
            else:
                # Default operation
                processed_value = original_value + 1
                operation = "increment"
            
            response = geospatial_pb2.EchoParameterResponse()
            response.original_value = original_value
            response.processed_value = processed_value
            response.operation = operation
            
            print(f"🔄 EchoParameter response: {original_value} -> {processed_value} ({operation})")
            return response
            
        except Exception as e:
            print(f"❌ EchoParameter error: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"EchoParameter failed: {str(e)}")
            return geospatial_pb2.EchoParameterResponse()
    
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
        """Stream real-time geospatial data points using numpy data generator"""
        try:
            print(f"🔄 StreamData request: bounds={request.bounds.northeast.latitude},{request.bounds.northeast.longitude} to {request.bounds.southwest.latitude},{request.bounds.southwest.longitude}")
            print(f"🔄 Data types: {list(request.data_types)}, Max points/sec: {request.max_points_per_second}")
            
            # Prepare bounds for data generator
            bounds = {
                'lat_min': request.bounds.southwest.latitude,
                'lat_max': request.bounds.northeast.latitude,
                'lng_min': request.bounds.southwest.longitude,
                'lng_max': request.bounds.northeast.longitude
            }
            
            data_types = list(request.data_types) if request.data_types else ['elevation']
            max_points_per_second = request.max_points_per_second or 5
            
            print(f"🎯 Generating streaming {data_types[0]} data using numpy...")
            
            # Use data generator for streaming
            point_count = 0
            for data_point_dict in data_generator.generate_streaming_data(bounds, data_types, max_points_per_second):
                if context.is_active():
                    # Convert dict to protobuf DataPoint
                    data_point = geospatial_pb2.DataPoint(
                        id=data_point_dict['id'],
                        location=geospatial_pb2.Coordinate(
                            latitude=data_point_dict['latitude'],
                            longitude=data_point_dict['longitude'],
                            altitude=data_point_dict['altitude']
                        ),
                        value=data_point_dict['value'],
                        unit=data_point_dict['unit'],
                        timestamp=data_point_dict['timestamp'],
                        metadata=data_point_dict['metadata']
                    )
                    
                    yield data_point
                    point_count += 1
                else:
                    print("🛑 Client disconnected from stream")
                    break
            
            print(f"✅ StreamData finished, sent {point_count} data points using numpy {data_types[0]} generator")
            
        except Exception as e:
            print(f"❌ Error in StreamData: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Streaming error: {str(e)}")
    
    def GetBatchData(self, request, context):
        """Get batch geospatial data points using numpy data generator"""
        try:
            grpc_start_time = time.time()
            
            print(f"📦 GetBatchData request: bounds={request.bounds.northeast.latitude},{request.bounds.northeast.longitude} to {request.bounds.southwest.latitude},{request.bounds.southwest.longitude}")
            print(f"📦 Data types: {list(request.data_types)}, Max points: {request.max_points}, Resolution: {request.resolution}")
            
            # Prepare bounds for data generator
            bounds = {
                'lat_min': request.bounds.southwest.latitude,
                'lat_max': request.bounds.northeast.latitude,
                'lng_min': request.bounds.southwest.longitude,
                'lng_max': request.bounds.northeast.longitude
            }
            
            data_types = list(request.data_types) if request.data_types else ['elevation']
            max_points = request.max_points or 1000
            resolution = request.resolution or 20
            
            print(f"🎯 Generating batch {data_types[0]} data using numpy (resolution: {resolution})...")
            
            # Use data generator for batch data
            data_generation_start = time.time()
            data_points_list, generation_method = data_generator.generate_batch_data(
                bounds, data_types, max_points, resolution
            )
            data_generation_time = time.time() - data_generation_start
            
            # Convert to protobuf DataPoints
            protobuf_conversion_start = time.time()
            protobuf_data_points = []
            for data_point_dict in data_points_list:
                data_point = geospatial_pb2.DataPoint(
                    id=data_point_dict['id'],
                    location=geospatial_pb2.Coordinate(
                        latitude=data_point_dict['latitude'],
                        longitude=data_point_dict['longitude'],
                        altitude=data_point_dict['altitude']
                    ),
                    value=data_point_dict['value'],
                    unit=data_point_dict['unit'],
                    timestamp=data_point_dict['timestamp'],
                    metadata=data_point_dict['metadata']
                )
                protobuf_data_points.append(data_point)
            
            protobuf_conversion_time = time.time() - protobuf_conversion_start
            
            response = geospatial_pb2.GetBatchDataResponse(
                data_points=protobuf_data_points,
                total_count=len(protobuf_data_points),
                generation_method=generation_method
            )
            
            grpc_total_time = time.time() - grpc_start_time
            
            print(f"⏱️  gRPC Server Timing Breakdown:")
            print(f"   • Data generation: {data_generation_time:.3f}s")
            print(f"   • Protobuf conversion: {protobuf_conversion_time:.3f}s") 
            print(f"   • Total gRPC processing: {grpc_total_time:.3f}s")
            print(f"✅ GetBatchData finished, returning {len(protobuf_data_points)} data points using {generation_method}")
            
            return response
            
        except Exception as e:
            print(f"❌ Error in GetBatchData: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Batch data error: {str(e)}")
            return geospatial_pb2.GetBatchDataResponse()
    
    def GetBatchDataCompressed(self, request, context):
        """Get batch geospatial data points WITH gRPC compression"""
        try:
            grpc_start_time = time.time()
            
            print(f"🗜️  GetBatchDataCompressed request: Max points: {request.max_points}, Resolution: {request.resolution}")
            print(f"🗜️  Compression enabled on this call")
            
            # Same logic as GetBatchData, but client should use compression
            bounds = {
                'lat_min': request.bounds.southwest.latitude,
                'lat_max': request.bounds.northeast.latitude,
                'lng_min': request.bounds.southwest.longitude,
                'lng_max': request.bounds.northeast.longitude
            }
            
            data_types = list(request.data_types) if request.data_types else ['elevation']
            max_points = request.max_points if request.max_points > 0 else 1000
            resolution = request.resolution or 20
            
            print(f"🎯 Generating compressed batch {data_types[0]} data using numpy (resolution: {resolution})...")
            
            # Use data generator for batch data
            data_generation_start = time.time()
            data_points_list, generation_method = data_generator.generate_batch_data(
                bounds, data_types, max_points, resolution
            )
            data_generation_time = time.time() - data_generation_start
            
            # Convert to protobuf DataPoints (same as regular)
            protobuf_conversion_start = time.time()
            protobuf_data_points = []
            for data_point_dict in data_points_list:
                data_point = geospatial_pb2.DataPoint(
                    id=data_point_dict['id'],
                    location=geospatial_pb2.Coordinate(
                        latitude=data_point_dict['latitude'],
                        longitude=data_point_dict['longitude'],
                        altitude=data_point_dict['altitude']
                    ),
                    value=data_point_dict['value'],
                    unit=data_point_dict['unit'],
                    timestamp=data_point_dict['timestamp'],
                    metadata=data_point_dict['metadata']
                )
                protobuf_data_points.append(data_point)
            
            protobuf_conversion_time = time.time() - protobuf_conversion_start
            
            response = geospatial_pb2.GetBatchDataResponse(
                data_points=protobuf_data_points,
                total_count=len(protobuf_data_points),
                generation_method=f"{generation_method}_compressed"
            )
            
            grpc_total_time = time.time() - grpc_start_time
            
            print(f"⏱️  gRPC Compressed Server Timing:")
            print(f"   • Data generation: {data_generation_time:.3f}s")
            print(f"   • Protobuf conversion: {protobuf_conversion_time:.3f}s") 
            print(f"   • Total gRPC processing: {grpc_total_time:.3f}s")
            print(f"✅ GetBatchDataCompressed finished, returning {len(protobuf_data_points)} data points")
            
            return response
            
        except Exception as e:
            print(f"❌ Error in GetBatchDataCompressed: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Compressed batch data error: {str(e)}")
            return geospatial_pb2.GetBatchDataResponse()
    
    def GetBatchDataOptimized(self, request, context):
        """Get batch geospatial data points with OPTIMIZED data format (float32, flattened)"""
        try:
            grpc_start_time = time.time()
            
            print(f"⚡ GetBatchDataOptimized request: Max points: {request.max_points}, Resolution: {request.resolution}")
            print(f"⚡ Using optimized float32 format with flattened metadata")
            
            bounds = {
                'lat_min': request.bounds.southwest.latitude,
                'lat_max': request.bounds.northeast.latitude,
                'lng_min': request.bounds.southwest.longitude,
                'lng_max': request.bounds.northeast.longitude
            }
            
            data_types = list(request.data_types) if request.data_types else ['elevation']
            max_points = request.max_points if request.max_points > 0 else 1000
            resolution = request.resolution or 20
            
            print(f"🎯 Generating optimized batch {data_types[0]} data using numpy (resolution: {resolution})...")
            
            # Use data generator for batch data
            data_generation_start = time.time()
            data_points_list, generation_method = data_generator.generate_batch_data(
                bounds, data_types, max_points, resolution
            )
            data_generation_time = time.time() - data_generation_start
            
            # Convert to OPTIMIZED protobuf format
            protobuf_conversion_start = time.time()
            optimized_data_points = []
            for data_point_dict in data_points_list:
                # Use OptimizedDataPoint with float32 and flattened metadata
                optimized_point = geospatial_pb2.OptimizedDataPoint(
                    id=data_point_dict['id'],
                    latitude=float(data_point_dict['latitude']),    # Already float32 from generator
                    longitude=float(data_point_dict['longitude']),  # Already float32 from generator
                    altitude=float(data_point_dict['altitude']),    # Already float32 from generator
                    value=float(data_point_dict['value']),          # Already float32 from generator
                    unit=data_point_dict['unit'],
                    timestamp=data_point_dict['timestamp'],
                    generation_method=data_point_dict['metadata'].get('generation_method', data_types[0])
                )
                optimized_data_points.append(optimized_point)
            
            protobuf_conversion_time = time.time() - protobuf_conversion_start
            
            response = geospatial_pb2.GetBatchDataOptimizedResponse(
                data_points=optimized_data_points,
                total_count=len(optimized_data_points),
                generation_method=f"{generation_method}_optimized"
            )
            
            grpc_total_time = time.time() - grpc_start_time
            
            print(f"⏱️  gRPC Optimized Server Timing:")
            print(f"   • Data generation: {data_generation_time:.3f}s")
            print(f"   • Protobuf conversion: {protobuf_conversion_time:.3f}s") 
            print(f"   • Total gRPC processing: {grpc_total_time:.3f}s")
            print(f"✅ GetBatchDataOptimized finished, returning {len(optimized_data_points)} optimized data points")
            
            return response
            
        except Exception as e:
            print(f"❌ Error in GetBatchDataOptimized: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Optimized batch data error: {str(e)}")
            return geospatial_pb2.GetBatchDataOptimizedResponse()
    
    def GetBatchDataStreamed(self, request, context):
        """Get batch geospatial data points via CHUNKED STREAMING (no frontend freeze)"""
        try:
            grpc_start_time = time.time()
            
            print(f"🔄 GetBatchDataStreamed request: Max points: {request.max_points}, Resolution: {request.resolution}")
            print(f"🔄 Using chunked streaming to prevent frontend freeze")
            
            bounds = {
                'lat_min': request.bounds.southwest.latitude,
                'lat_max': request.bounds.northeast.latitude,
                'lng_min': request.bounds.southwest.longitude,
                'lng_max': request.bounds.northeast.longitude
            }
            
            data_types = list(request.data_types) if request.data_types else ['elevation']
            max_points = request.max_points if request.max_points > 0 else 1000
            resolution = request.resolution or 20
            
            print(f"🎯 Generating streamed batch {data_types[0]} data using numpy (resolution: {resolution})...")
            
            # Use data generator for batch data
            data_generation_start = time.time()
            data_points_list, generation_method = data_generator.generate_batch_data(
                bounds, data_types, max_points, resolution
            )
            data_generation_time = time.time() - data_generation_start
            
            # Stream data in chunks to prevent frontend freeze
            chunk_size = 25000  # 25K points per chunk
            total_points = len(data_points_list)
            total_chunks = (total_points + chunk_size - 1) // chunk_size  # Ceiling division
            
            print(f"📦 Streaming {total_points} points in {total_chunks} chunks of {chunk_size} points each")
            
            chunk_start_time = time.time()
            
            for chunk_num in range(total_chunks):
                start_idx = chunk_num * chunk_size
                end_idx = min(start_idx + chunk_size, total_points)
                chunk_data = data_points_list[start_idx:end_idx]
                
                # Convert chunk to protobuf DataPoints
                protobuf_data_points = []
                for data_point_dict in chunk_data:
                    data_point = geospatial_pb2.DataPoint(
                        id=data_point_dict['id'],
                        location=geospatial_pb2.Coordinate(
                            latitude=data_point_dict['latitude'],
                            longitude=data_point_dict['longitude'],
                            altitude=data_point_dict['altitude']
                        ),
                        value=data_point_dict['value'],
                        unit=data_point_dict['unit'],
                        timestamp=data_point_dict['timestamp'],
                        metadata=data_point_dict['metadata']
                    )
                    protobuf_data_points.append(data_point)
                
                # Create and yield chunk
                chunk = geospatial_pb2.GetBatchDataChunk(
                    data_points=protobuf_data_points,
                    chunk_number=chunk_num + 1,
                    total_chunks=total_chunks,
                    points_in_chunk=len(protobuf_data_points),
                    is_final_chunk=(chunk_num == total_chunks - 1),
                    generation_method=f"{generation_method}_streamed"
                )
                
                print(f"📡 Sending chunk {chunk_num + 1}/{total_chunks} ({len(protobuf_data_points)} points)")
                yield chunk
                
                # Small delay between chunks to allow frontend processing
                time.sleep(0.001)  # 1ms delay
            
            chunk_streaming_time = time.time() - chunk_start_time
            grpc_total_time = time.time() - grpc_start_time
            
            print(f"⏱️  gRPC Streamed Server Timing:")
            print(f"   • Data generation: {data_generation_time:.3f}s")
            print(f"   • Chunk streaming: {chunk_streaming_time:.3f}s")
            print(f"   • Total gRPC processing: {grpc_total_time:.3f}s")
            print(f"✅ GetBatchDataStreamed finished, streamed {total_points} data points in {total_chunks} chunks")
            
        except Exception as e:
            print(f"❌ Error in GetBatchDataStreamed: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Streamed batch data error: {str(e)}")
    
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
        
        # Create server with increased message size limits (500MB)
        options = [
            ('grpc.max_send_message_length', 500 * 1024 * 1024),  # 500MB
            ('grpc.max_receive_message_length', 500 * 1024 * 1024),  # 500MB
        ]
        server = grpc.server(futures.ThreadPoolExecutor(max_workers=10), options=options)
        
        # Add service to server
        geospatial_pb2_grpc.add_GeospatialServiceServicer_to_server(
            GeospatialServicer(), server
        )
        
        # Configure server
        listen_addr = f'127.0.0.1:{port}'
        server.add_insecure_port(listen_addr)
        
        # No need to write port file since we use fixed port 50077
        
        # Start server
        server.start()
        
        print(f"🚀 gRPC GeospatialService started on {listen_addr}")
        print("✅ Ready to accept connections")
        
        try:
            server.wait_for_termination()
        except KeyboardInterrupt:
            print("\n🛑 Shutting down gRPC server...")
            server.stop(grace=5)
                
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