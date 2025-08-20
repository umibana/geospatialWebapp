#!/usr/bin/env python
"""
Servidor de Servicio Geoespacial gRPC
Reemplaza la implementación ConnectRPC con gRPC nativo
Provee servicios para datos geoespaciales, proyectos y archivos
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

# Añadir el directorio actual al path de Python para encontrar archivos generados
script_dir = Path(__file__).parent.absolute()
sys.path.insert(0, str(script_dir))
sys.path.insert(0, str(script_dir / 'generated'))

import grpc

# Importar los archivos protobuf generados
import geospatial_pb2
import files_pb2
import projects_pb2
import main_service_pb2_grpc

# Importar el generador de datos y el gestor de base de datos
from data_generator import data_generator
from database import DatabaseManager


class GeospatialServicer(main_service_pb2_grpc.GeospatialServiceServicer):
    """Implementación del servicio GeospatialService
    Maneja todas las operaciones relacionadas con datos geoespaciales,
    proyectos y archivos a través de gRPC
    """
    
    def __init__(self):
        self.version = "1.0.0"
        self.db = DatabaseManager()
        print("🌍 GeospatialService inicializado con base de datos")
    
    def GetFeatures(self, request, context):
        """Obtiene características geoespaciales dentro de límites especificados
        
        Args:
            request: Solicitud con límites geográficos y filtros
            context: Contexto de la llamada gRPC
            
        Returns:
            Lista de características geoespaciales encontradas
        """
        try:
            print(f"📍 GetFeatures request: bounds={request.bounds.northeast.latitude},{request.bounds.northeast.longitude} to {request.bounds.southwest.latitude},{request.bounds.southwest.longitude}, limit={request.limit}")
            
            # Generar características de muestra para demostración
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
        """Transmite puntos de datos geoespaciales en tiempo real usando generador numpy
        
        Proporciona un stream continuo de datos geoespaciales generados dinámicamente.
        Ideal para demostrar capacidades de streaming y actualizaciones en vivo.
        
        Args:
            request: Solicitud con límites geográficos y configuración de streaming
            context: Contexto de la llamada gRPC para manejo de conexión
            
        Yields:
            Puntos de datos individuales como DataPoint protobuf messages
        """
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
            
            print(f"🎯 Generando datos de streaming {data_types[0]} usando numpy...")
            
            # Usar generador de datos para streaming
            point_count = 0
            for data_point_dict in data_generator.generate_streaming_data(bounds, data_types, max_points_per_second):
                if context.is_active():
                    # Convertir diccionario a DataPoint protobuf
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
                    print("🛑 Cliente desconectado del stream")
                    break
            
            print(f"✅ StreamData terminado, enviados {point_count} puntos de datos usando generador numpy {data_types[0]}")
            
        except Exception as e:
            print(f"❌ Error in StreamData: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Streaming error: {str(e)}")
    
    def GetBatchData(self, request, context):
        """Obtiene puntos de datos geoespaciales en lotes usando generador numpy
        
        Genera grandes cantidades de datos geoespaciales de forma eficiente.
        Optimizado para datasets grandes con control de resolución y tipos de datos.
        
        Args:
            request: Solicitud con límites, tipos de datos, puntos máximos y resolución
            context: Contexto de la llamada gRPC
            
        Returns:
            GetBatchDataResponse con lista de puntos de datos y metadatos
        """
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
            
            print(f"🎯 Generando datos en lotes {data_types[0]} usando numpy (resolución: {resolution})...")
            
            # Usar generador de datos para datos en lotes
            data_generation_start = time.time()
            data_points_list, generation_method = data_generator.generate_batch_data(
                bounds, data_types, max_points, resolution
            )
            data_generation_time = time.time() - data_generation_start
            
            # Convertir a DataPoints protobuf
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
    
    def AnalyzeCsv(self, request, context):
        """
        Analyze CSV file to detect column names and types from the first two rows
        
        @param request: AnalyzeCsvRequest with file_path, file_name, and rows_to_analyze
        @param context: gRPC context
        @returns: AnalyzeCsvResponse with column info and auto-detected mappings
        """
        try:
            import pandas as pd
            import numpy as np
            
            print(f"📊 AnalyzeCsv request: {request.file_path}")
            
            # Read only the first few rows for analysis
            rows_to_analyze = request.rows_to_analyze if request.rows_to_analyze > 0 else 2
            df_sample = pd.read_csv(request.file_path, nrows=rows_to_analyze)
            
            response = files_pb2.AnalyzeCsvResponse()
            response.success = True
            
            # Analyze each column
            auto_mapping = {}
            
            for col_name in df_sample.columns:
                column_info = response.columns.add()
                column_info.name = str(col_name)
                
                # Infer type from the first data row (skip header)
                if len(df_sample) > 0:
                    sample_value = df_sample[col_name].iloc[0]
                    try:
                        # Try to convert to numeric
                        pd.to_numeric(sample_value)
                        column_info.type = "number"
                    except (ValueError, TypeError):
                        column_info.type = "string"
                else:
                    column_info.type = "string"
                
                # Auto-detect mappings based on column names (case-insensitive)
                col_lower = str(col_name).lower()
                if any(x in col_lower for x in ['id', 'identifier', 'key']):
                    auto_mapping['id'] = str(col_name)
                    column_info.is_required = True
                elif any(x in col_lower for x in ['x', 'longitude', 'lng', 'long']):
                    auto_mapping['x'] = str(col_name)
                    column_info.is_required = True
                elif any(x in col_lower for x in ['y', 'latitude', 'lat']) and not any(k in col_lower for k in ['year', 'yr']):
                    auto_mapping['y'] = str(col_name)
                    column_info.is_required = True
                elif any(x in col_lower for x in ['z', 'elevation', 'height', 'altitude']):
                    auto_mapping['z'] = str(col_name)
                    column_info.is_required = True
                elif any(x in col_lower for x in ['depth', 'profundidad']):
                    auto_mapping['depth'] = str(col_name)
                    column_info.is_required = True
                else:
                    column_info.is_required = False
            
            # Set auto-detected mappings
            for key, value in auto_mapping.items():
                response.auto_detected_mapping[key] = value
            
            print(f"📊 AnalyzeCsv found {len(response.columns)} columns, auto-mapped: {auto_mapping}")
            return response
            
        except Exception as e:
            print(f"❌ AnalyzeCsv error: {e}")
            response = files_pb2.AnalyzeCsvResponse()
            response.success = False
            response.error_message = str(e)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"AnalyzeCsv failed: {str(e)}")
            return response

    def SendFile(self, request, context):
        """
        Process the complete CSV file with variable mappings and keep data in memory
        
        @param request: SendFileRequest with file path and variable mappings
        @param context: gRPC context
        @returns: SendFileResponse with processing statistics
        """
        try:
            import pandas as pd
            import numpy as np
            import time as time_module
            
            start_time = time_module.time()
            print(f"📂 SendFile request: {request.file_path}")
            print(f"   Variables: X={request.x_variable}, Y={request.y_variable}, Z={request.z_variable}, ID={request.id_variable}, DEPTH={request.depth_variable}")
            
            # Read the entire CSV file
            df = pd.read_csv(request.file_path)

            # Apply preview-driven overrides
            # 1) Include/skip the first data row (preview row)
            try:
                if hasattr(request, 'include_first_row') and not request.include_first_row and len(df) > 0:
                    df = df.iloc[1:].reset_index(drop=True)
            except Exception:
                # Be conservative and continue if field not present
                pass

            # 2) Enforce column types from preview where provided
            try:
                # request.column_types is a map<string, string>
                if hasattr(request, 'column_types') and request.column_types:
                    for col_name, col_type in request.column_types.items():
                        if col_name in df.columns:
                            if str(col_type).lower() == 'number':
                                df[col_name] = pd.to_numeric(df[col_name], errors='coerce')
                            else:
                                df[col_name] = df[col_name].astype(str)
            except Exception as e:
                print(f"⚠️ Column type enforcement failed: {e}")
            total_rows = len(df)
            
            # Validate that required columns exist
            required_cols = []
            if request.x_variable:
                required_cols.append(request.x_variable)
            if request.y_variable:
                required_cols.append(request.y_variable)
            
            missing_cols = [col for col in required_cols if col not in df.columns]
            if missing_cols:
                raise ValueError(f"Missing required columns: {missing_cols}")
            
            # If user selected specific columns, restrict to those (ensure mapping vars are included)
            try:
                if hasattr(request, 'included_columns') and request.included_columns:
                    keep_cols = [c for c in request.included_columns if c in df.columns]
                    # Always include mapping variables so required fields exist
                    for mvar in [request.x_variable, request.y_variable, request.z_variable, request.id_variable, request.depth_variable]:
                        if mvar and mvar in df.columns and mvar not in keep_cols:
                            keep_cols.append(mvar)
                    if keep_cols:
                        df = df[keep_cols]
            except Exception:
                pass

            # Filter and process the data
            valid_rows = 0
            invalid_rows = 0
            errors = []
            
            # Create a processed dataset (store in memory for now)
            processed_data = []
            
            for idx, row in df.iterrows():
                try:
                    data_point = {}
                    
                    # Map the variables
                    if request.x_variable and request.x_variable in row:
                        data_point['x'] = float(row[request.x_variable])
                    if request.y_variable and request.y_variable in row:
                        data_point['y'] = float(row[request.y_variable])
                    if request.z_variable and request.z_variable in row:
                        data_point['z'] = float(row[request.z_variable])
                    if request.id_variable and request.id_variable in row:
                        data_point['id'] = str(row[request.id_variable])
                    if request.depth_variable and request.depth_variable in row:
                        data_point['depth'] = float(row[request.depth_variable])

                    # Copy remaining columns so chunk API can expose metrics/attrs
                    try:
                        for col in df.columns:
                            if col in [request.x_variable, request.y_variable, request.z_variable, request.id_variable, request.depth_variable]:
                                continue
                            val = row[col]
                            # Skip NaN
                            try:
                                import math
                                if val is None or (isinstance(val, float) and math.isnan(val)):
                                    continue
                            except Exception:
                                pass
                            # Keep numeric vs string
                            if isinstance(val, (int, float, np.integer, np.floating)):
                                data_point[col] = float(val)
                            else:
                                data_point[col] = str(val)
                    except Exception as copy_err:
                        # Non-fatal, continue processing
                        pass
                    
                    # Validate required fields
                    if 'x' in data_point and 'y' in data_point:
                        processed_data.append(data_point)
                        valid_rows += 1
                    else:
                        invalid_rows += 1
                        if len(errors) < 10:  # Limit error messages
                            errors.append(f"Row {idx}: Missing X or Y coordinate")
                        
                except (ValueError, TypeError) as e:
                    invalid_rows += 1
                    if len(errors) < 10:
                        errors.append(f"Row {idx}: {str(e)}")
            
            # Store the processed data globally (in a real app, use a database)
            global loaded_csv_data
            loaded_csv_data = {
                'data': processed_data,
                'file_name': request.file_name,
                'file_path': request.file_path,
                'variable_mapping': {
                    'x': request.x_variable,
                    'y': request.y_variable,
                    'z': request.z_variable,
                    'id': request.id_variable,
                    'depth': request.depth_variable
                },
                'timestamp': time_module.time()
            }
            
            processing_time = time_module.time() - start_time
            
            response = files_pb2.SendFileResponse()
            response.total_rows_processed = total_rows
            response.valid_rows = valid_rows
            response.invalid_rows = invalid_rows
            response.errors.extend(errors[:10])  # Return up to 10 errors
            response.success = True
            response.processing_time = f"{processing_time:.2f}s"
            
            print(f"📂 SendFile completed: {valid_rows}/{total_rows} valid rows in {processing_time:.2f}s")
            return response
            
        except Exception as e:
            print(f"❌ SendFile error: {e}")
            response = files_pb2.SendFileResponse()
            response.success = False
            response.errors.append(str(e))
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"SendFile failed: {str(e)}")
            return response

    def GetLoadedDataStats(self, request, context):
        """
        Get statistics about the currently loaded CSV data
        
        @param request: GetLoadedDataStatsRequest (empty for now)
        @param context: gRPC context
        @returns: GetLoadedDataStatsResponse with statistics
        """
        try:
            global loaded_csv_data
            
            response = files_pb2.GetLoadedDataStatsResponse()
            
            if 'loaded_csv_data' not in globals() or not loaded_csv_data:
                response.has_data = False
                response.total_points = 0
                return response
                
            data = loaded_csv_data['data']
            response.has_data = True
            response.total_points = len(data)
            
            if data:
                # Calculate statistics for X, Y, Z
                x_values = [p['x'] for p in data if 'x' in p]
                y_values = [p['y'] for p in data if 'y' in p]
                z_values = [p['z'] for p in data if 'z' in p]
                
                if x_values:
                    response.x_stats['min'] = min(x_values)
                    response.x_stats['max'] = max(x_values)
                    response.x_stats['avg'] = sum(x_values) / len(x_values)
                    
                if y_values:
                    response.y_stats['min'] = min(y_values)
                    response.y_stats['max'] = max(y_values)
                    response.y_stats['avg'] = sum(y_values) / len(y_values)
                    
                if z_values:
                    response.z_stats['min'] = min(z_values)
                    response.z_stats['max'] = max(z_values)
                    response.z_stats['avg'] = sum(z_values) / len(z_values)
                
                # Available columns
                if loaded_csv_data.get('variable_mapping'):
                    mapping = loaded_csv_data['variable_mapping']
                    for key, value in mapping.items():
                        if value:  # Only add non-empty mappings
                            response.available_columns.append(f"{key}:{value}")
            
            print(f"📊 GetLoadedDataStats: {response.total_points} points loaded")
            return response
            
        except Exception as e:
            print(f"❌ GetLoadedDataStats error: {e}")
            response = files_pb2.GetLoadedDataStatsResponse()
            response.has_data = False
            response.total_points = 0
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"GetLoadedDataStats failed: {str(e)}")
            return response
    
    def GetBatchDataColumnar(self, request, context):
        """
        Get batch data in columnar format for efficient processing
        
        @param request: GetBatchDataRequest with bounds, data types, max points, and resolution
        @param context: gRPC context
        @returns: GetBatchDataColumnarResponse with columnar data chunks
        """
        try:
            print(f"📊 GetBatchDataColumnar request: Max points: {request.max_points}, Resolution: {request.resolution}")
            print(f"   Bounds: NE({request.bounds.northeast.latitude}, {request.bounds.northeast.longitude}) to SW({request.bounds.southwest.latitude}, {request.bounds.southwest.longitude})")
            print(f"   Data types: {list(request.data_types)}")
            
            start_time = time.time()
            
            # Use data generator to create columnar data
            bounds = {
                'lat_min': request.bounds.southwest.latitude,
                'lat_max': request.bounds.northeast.latitude,
                'lng_min': request.bounds.southwest.longitude,
                'lng_max': request.bounds.northeast.longitude
            }
            
            columnar_data, generation_method = data_generator.generate_columnar_data(
                bounds=bounds,
                data_types=list(request.data_types),
                max_points=request.max_points,
                resolution=request.resolution or 20
            )
            
            # Create response
            response = geospatial_pb2.GetBatchDataColumnarResponse()
            response.total_count = len(columnar_data['x'])
            response.generation_method = generation_method
            
            # Create columnar data chunk (single chunk for non-streaming)
            chunk = response.columnar_data
            chunk.id.extend(columnar_data['id'])
            chunk.x.extend(columnar_data['x'])
            chunk.y.extend(columnar_data['y'])
            chunk.z.extend(columnar_data['z'])
            chunk.id_value.extend(columnar_data['id_value'])
            chunk.generation_method = generation_method
            chunk.chunk_number = 0
            chunk.total_chunks = 1
            chunk.points_in_chunk = len(columnar_data['x'])
            chunk.is_final_chunk = True
            
            # Add additional data columns
            for key, values in columnar_data.get('additional_data', {}).items():
                double_array = geospatial_pb2.DoubleArray()
                double_array.values.extend(values)
                chunk.additional_data[key].CopyFrom(double_array)
            
            print(f"✅ GetBatchDataColumnar finished, returning {response.total_count} points in columnar format")
            return response
            
        except Exception as e:
            print(f"❌ Error in GetBatchDataColumnar: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Columnar batch data error: {str(e)}")
            return geospatial_pb2.GetBatchDataColumnarResponse()
    
    def GetBatchDataColumnarStreamed(self, request, context):
        """
        Stream batch data in columnar format with chunking
        
        @param request: GetBatchDataRequest with bounds, data types, max points, and resolution
        @param context: gRPC context
        @yields: ColumnarDataChunk messages
        """
        try:
            print(f"🔄 GetBatchDataColumnarStreamed request: Max points: {request.max_points}, Resolution: {request.resolution}")
            
            start_time = time.time()
            
            # Use data generator to create columnar data
            bounds = {
                'lat_min': request.bounds.southwest.latitude,
                'lat_max': request.bounds.northeast.latitude,
                'lng_min': request.bounds.southwest.longitude,
                'lng_max': request.bounds.northeast.longitude
            }
            
            columnar_data, generation_method = data_generator.generate_columnar_data(
                bounds=bounds,
                data_types=list(request.data_types),
                max_points=request.max_points,
                resolution=request.resolution or 20
            )
            
            total_points = len(columnar_data['x'])
            chunk_size = 25000  # 25K points per chunk
            total_chunks = (total_points + chunk_size - 1) // chunk_size
            
            print(f"🔄 Streaming {total_points} points in {total_chunks} chunks of {chunk_size} each")
            
            # Stream data in chunks
            for chunk_index in range(total_chunks):
                start_idx = chunk_index * chunk_size
                end_idx = min(start_idx + chunk_size, total_points)
                
                # Create chunk
                chunk = geospatial_pb2.ColumnarDataChunk()
                chunk.chunk_number = chunk_index
                chunk.total_chunks = total_chunks
                chunk.points_in_chunk = end_idx - start_idx
                chunk.is_final_chunk = (chunk_index == total_chunks - 1)
                chunk.generation_method = generation_method
                
                # Add data for this chunk
                chunk.id.extend(columnar_data['id'][start_idx:end_idx])
                chunk.x.extend(columnar_data['x'][start_idx:end_idx])
                chunk.y.extend(columnar_data['y'][start_idx:end_idx])
                chunk.z.extend(columnar_data['z'][start_idx:end_idx])
                chunk.id_value.extend(columnar_data['id_value'][start_idx:end_idx])
                
                # Add additional data columns
                for key, values in columnar_data.get('additional_data', {}).items():
                    double_array = geospatial_pb2.DoubleArray()
                    double_array.values.extend(values[start_idx:end_idx])
                    chunk.additional_data[key].CopyFrom(double_array)
                
                yield chunk
                
                # Brief pause between chunks to prevent overwhelming
                if chunk_index < total_chunks - 1:
                    time.sleep(0.001)  # 1ms pause
            
            processing_time = time.time() - start_time
            print(f"✅ GetBatchDataColumnarStreamed finished, streamed {total_points} points in {total_chunks} chunks ({processing_time:.3f}s)")
            
        except Exception as e:
            print(f"❌ Error in GetBatchDataColumnarStreamed: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Columnar streamed data error: {str(e)}")

    # ========== Project Management Methods ==========
    
    def CreateProject(self, request, context):
        """Create a new project"""
        try:
            print(f"📁 Creating project: {request.name}")
            
            project_data = self.db.create_project(request.name, request.description)
            
            response = projects_pb2.CreateProjectResponse()
            response.success = True
            
            # Populate project data
            project = response.project
            project.id = project_data['id']
            project.name = project_data['name']
            project.description = project_data['description']
            project.created_at = project_data['created_at']
            project.updated_at = project_data['updated_at']
            
            print(f"✅ Project created: {project.id}")
            return response
            
        except Exception as e:
            print(f"❌ Error creating project: {e}")
            response = projects_pb2.CreateProjectResponse()
            response.success = False
            response.error_message = str(e)
            return response
    
    def GetProjects(self, request, context):
        """Get projects with pagination"""
        try:
            print(f"📁 Getting projects: limit={request.limit}, offset={request.offset}")
            
            projects_data, total_count = self.db.get_projects(request.limit or 100, request.offset)
            
            response = projects_pb2.GetProjectsResponse()
            response.total_count = total_count
            
            for project_data in projects_data:
                project = response.projects.add()
                project.id = project_data['id']
                project.name = project_data['name']
                project.description = project_data['description']
                project.created_at = project_data['created_at']
                project.updated_at = project_data['updated_at']
            
            print(f"✅ Retrieved {len(projects_data)} projects")
            return response
            
        except Exception as e:
            print(f"❌ Error getting projects: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return projects_pb2.GetProjectsResponse()
    
    def GetProject(self, request, context):
        """Get a single project"""
        try:
            print(f"📁 Getting project: {request.project_id}")
            
            project_data = self.db.get_project(request.project_id)
            
            response = projects_pb2.GetProjectResponse()
            if project_data:
                response.success = True
                project = response.project
                project.id = project_data['id']
                project.name = project_data['name']
                project.description = project_data['description']
                project.created_at = project_data['created_at']
                project.updated_at = project_data['updated_at']
            else:
                response.success = False
                response.error_message = "Project not found"
            
            return response
            
        except Exception as e:
            print(f"❌ Error getting project: {e}")
            response = projects_pb2.GetProjectResponse()
            response.success = False
            response.error_message = str(e)
            return response
    
    def UpdateProject(self, request, context):
        """Update a project"""
        try:
            print(f"📁 Updating project: {request.project_id}")
            
            success = self.db.update_project(request.project_id, request.name, request.description)
            
            response = projects_pb2.UpdateProjectResponse()
            if success:
                # Get updated project data
                project_data = self.db.get_project(request.project_id)
                if project_data:
                    response.success = True
                    project = response.project
                    project.id = project_data['id']
                    project.name = project_data['name']
                    project.description = project_data['description']
                    project.created_at = project_data['created_at']
                    project.updated_at = project_data['updated_at']
                else:
                    response.success = False
                    response.error_message = "Project not found after update"
            else:
                response.success = False
                response.error_message = "Project not found"
            
            return response
            
        except Exception as e:
            print(f"❌ Error updating project: {e}")
            response = projects_pb2.UpdateProjectResponse()
            response.success = False
            response.error_message = str(e)
            return response
    
    def DeleteProject(self, request, context):
        """Delete a project"""
        try:
            print(f"📁 Deleting project: {request.project_id}")
            
            success = self.db.delete_project(request.project_id)
            
            response = projects_pb2.DeleteProjectResponse()
            response.success = success
            if not success:
                response.error_message = "Project not found"
            
            return response
            
        except Exception as e:
            print(f"❌ Error deleting project: {e}")
            response = projects_pb2.DeleteProjectResponse()
            response.success = False
            response.error_message = str(e)
            return response
    
    # ========== File Management Methods ==========
    
    def CreateFile(self, request, context):
        """Create a new file"""
        try:
            print(f"📄 Creating file: {request.name} for project {request.project_id}")
            
            file_data = self.db.create_file(
                request.project_id,
                request.name,
                int(request.dataset_type),
                request.original_filename,
                request.file_content
            )
            
            response = projects_pb2.CreateFileResponse()
            response.success = True
            
            # Populate file data
            file = response.file
            file.id = file_data['id']
            file.project_id = file_data['project_id']
            file.name = file_data['name']
            file.dataset_type = file_data['dataset_type']
            file.original_filename = file_data['original_filename']
            file.file_size = file_data['file_size']
            file.created_at = file_data['created_at']
            
            print(f"✅ File created: {file.id}")
            return response
            
        except Exception as e:
            print(f"❌ Error creating file: {e}")
            response = projects_pb2.CreateFileResponse()
            response.success = False
            response.error_message = str(e)
            return response
    
    def GetProjectFiles(self, request, context):
        """Get all files for a project"""
        try:
            print(f"📄 Getting files for project: {request.project_id}")
            
            files_data = self.db.get_project_files(request.project_id)
            
            response = projects_pb2.GetProjectFilesResponse()
            
            for file_data in files_data:
                file = response.files.add()
                file.id = file_data['id']
                file.project_id = file_data['project_id']
                file.name = file_data['name']
                file.dataset_type = file_data['dataset_type']
                file.original_filename = file_data['original_filename']
                file.file_size = file_data['file_size']
                file.created_at = file_data['created_at']
            
            print(f"✅ Retrieved {len(files_data)} files")
            return response
            
        except Exception as e:
            print(f"❌ Error getting project files: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return projects_pb2.GetProjectFilesResponse()

    def GetProjectDatasets(self, request, context):
        """Get all datasets for a project"""
        try:
            print(f"📊 Getting datasets for project: {request.project_id}")
            
            datasets = self.db.get_datasets_by_project(request.project_id)
            
            response = projects_pb2.GetProjectDatasetsResponse()
            
            for dataset_data in datasets:
                dataset = response.datasets.add()
                dataset.id = dataset_data['id']
                dataset.file_id = dataset_data['file_id']
                dataset.file_name = dataset_data['file_name']
                dataset.dataset_type = dataset_data['dataset_type']
                dataset.original_filename = dataset_data['original_filename']
                dataset.total_rows = dataset_data['total_rows']
                dataset.created_at = dataset_data['created_at']
                
                # Add column mappings
                for mapping in dataset_data['column_mappings']:
                    col_mapping = dataset.column_mappings.add()
                    col_mapping.column_name = mapping['column_name']
                    col_mapping.column_type = mapping['column_type']
                    col_mapping.mapped_field = mapping['mapped_field']
                    col_mapping.is_coordinate = mapping['is_coordinate']
            
            print(f"✅ Found {len(datasets)} datasets")
            return response
            
        except Exception as e:
            print(f"❌ Error getting project datasets: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return projects_pb2.GetProjectDatasetsResponse()
    
    def DeleteFile(self, request, context):
        """Delete a file"""
        try:
            print(f"📄 Deleting file: {request.file_id}")
            
            success = self.db.delete_file(request.file_id)
            
            response = projects_pb2.DeleteFileResponse()
            response.success = success
            if not success:
                response.error_message = "File not found"
            
            return response
            
        except Exception as e:
            print(f"❌ Error deleting file: {e}")
            response = projects_pb2.DeleteFileResponse()
            response.success = False
            response.error_message = str(e)
            return response
    
    # ========== Enhanced CSV Processing Methods ==========
    
    def AnalyzeCsvForProject(self, request, context):
        """Analyze CSV file for project with enhanced column type detection"""
        try:
            print(f"📊 Analyzing CSV for project file: {request.file_id}")
            
            # Get file content
            file_content = self.db.get_file_content(request.file_id)
            if not file_content:
                response = projects_pb2.AnalyzeCsvForProjectResponse()
                response.success = False
                response.error_message = "File not found"
                return response
            
            # Analyze CSV content (reusing existing CSV logic)
            import csv
            import io
            
            csv_text = file_content.decode('utf-8')
            csv_reader = csv.reader(io.StringIO(csv_text))
            
            headers = next(csv_reader)
            preview_rows = []
            row_count = 0
            
            for i, row in enumerate(csv_reader):
                if i < 5:  # Preview first 5 rows
                    preview_row = projects_pb2.PreviewRow()
                    preview_row.values.extend(row)
                    preview_rows.append(preview_row)
                row_count += 1
            
            # Simple type detection
            suggested_types = []
            suggested_mappings = {}
            
            for header in headers:
                # Try to detect numeric vs categorical
                is_numeric = False
                # Simple heuristics for column type detection
                if any(keyword in header.lower() for keyword in ['x', 'east', 'longitude', 'lon']):
                    suggested_types.append(projects_pb2.COLUMN_TYPE_NUMERIC)
                    suggested_mappings[header] = "x"
                elif any(keyword in header.lower() for keyword in ['y', 'north', 'latitude', 'lat']):
                    suggested_types.append(projects_pb2.COLUMN_TYPE_NUMERIC)
                    suggested_mappings[header] = "y"
                elif any(keyword in header.lower() for keyword in ['z', 'elevation', 'height', 'depth']):
                    suggested_types.append(projects_pb2.COLUMN_TYPE_NUMERIC)
                    suggested_mappings[header] = "z"
                elif any(keyword in header.lower() for keyword in ['id', 'name', 'type', 'category']):
                    suggested_types.append(projects_pb2.COLUMN_TYPE_CATEGORICAL)
                    suggested_mappings[header] = ""
                else:
                    suggested_types.append(projects_pb2.COLUMN_TYPE_NUMERIC)  # Default to numeric
                    suggested_mappings[header] = ""
            
            response = projects_pb2.AnalyzeCsvForProjectResponse()
            response.success = True
            response.headers.extend(headers)
            response.preview_rows.extend(preview_rows)
            response.suggested_types.extend(suggested_types)
            response.suggested_mappings.update(suggested_mappings)
            response.total_rows = row_count
            
            print(f"✅ CSV analyzed: {len(headers)} columns, {row_count} rows")
            return response
            
        except Exception as e:
            print(f"❌ Error analyzing CSV: {e}")
            response = projects_pb2.AnalyzeCsvForProjectResponse()
            response.success = False
            response.error_message = str(e)
            return response
    
    def ProcessDataset(self, request, context):
        """Process dataset with column mappings"""
        try:
            print(f"📊 Processing dataset for file: {request.file_id}")
            
            # Get file content
            file_content = self.db.get_file_content(request.file_id)
            if not file_content:
                response = projects_pb2.ProcessDatasetResponse()
                response.success = False
                response.error_message = "File not found"
                return response
            
            # Process CSV with column mappings
            import csv
            import io
            
            csv_text = file_content.decode('utf-8')
            csv_reader = csv.reader(io.StringIO(csv_text))
            
            headers = next(csv_reader)
            
            # Create mapping dict
            column_map = {}
            for mapping in request.column_mappings:
                if mapping.column_type != projects_pb2.COLUMN_TYPE_UNUSED:
                    column_map[mapping.column_name] = {
                        'type': mapping.column_type,
                        'field': mapping.mapped_field,
                        'is_coordinate': mapping.is_coordinate
                    }
            
            # Process data rows
            processed_rows = []
            row_count = 0
            
            for row in csv_reader:
                if len(row) != len(headers):
                    continue  # Skip malformed rows
                
                processed_row = {}
                
                for i, (header, value) in enumerate(zip(headers, row)):
                    if header in column_map:
                        mapping = column_map[header]
                        field_name = mapping['field'] if mapping['field'] else header
                        
                        # Type conversion
                        if mapping['type'] == projects_pb2.COLUMN_TYPE_NUMERIC:
                            try:
                                processed_row[field_name] = str(float(value))
                            except ValueError:
                                processed_row[field_name] = "0.0"
                        else:  # CATEGORICAL
                            processed_row[field_name] = str(value)
                
                processed_rows.append(processed_row)
                row_count += 1
            
            # Create dataset record
            column_mappings_list = []
            for mapping in request.column_mappings:
                mapping_dict = {
                    'column_name': mapping.column_name,
                    'column_type': int(mapping.column_type),
                    'mapped_field': mapping.mapped_field,
                    'is_coordinate': mapping.is_coordinate
                }
                column_mappings_list.append(mapping_dict)
            
            dataset_data = self.db.create_dataset(request.file_id, row_count, column_mappings_list)
            
            # Store processed data
            self.db.store_dataset_data(dataset_data['id'], processed_rows)
            
            response = projects_pb2.ProcessDatasetResponse()
            response.success = True
            response.processed_rows = row_count
            
            # Populate dataset data
            dataset = response.dataset
            dataset.id = dataset_data['id']
            dataset.file_id = dataset_data['file_id']
            dataset.total_rows = dataset_data['total_rows']
            dataset.current_page = dataset_data['current_page']
            dataset.created_at = dataset_data['created_at']
            
            # Add column mappings
            for mapping_dict in dataset_data['column_mappings']:
                mapping = dataset.column_mappings.add()
                mapping.column_name = mapping_dict['column_name']
                mapping.column_type = mapping_dict['column_type']
                mapping.mapped_field = mapping_dict['mapped_field']
                mapping.is_coordinate = mapping_dict['is_coordinate']
            
            print(f"✅ Dataset processed: {row_count} rows")
            return response
            
        except Exception as e:
            print(f"❌ Error processing dataset: {e}")
            response = projects_pb2.ProcessDatasetResponse()
            response.success = False
            response.error_message = str(e)
            return response
    
    def GetDatasetData(self, request, context):
        """Get dataset data with pagination"""
        try:
            print(f"📊 Getting dataset data: {request.dataset_id}, page {request.page}")
            
            # Get dataset info first
            dataset = self.db.get_dataset_by_id(request.dataset_id)
            if not dataset:
                response = projects_pb2.GetDatasetDataResponse()
                return response
            
            # Get paginated data
            rows, total_rows, total_pages = self.db.get_dataset_data(
                request.dataset_id, 
                request.page or 1, 
                request.page_size or 100
            )
            
            response = projects_pb2.GetDatasetDataResponse()
            response.total_rows = total_rows
            response.current_page = request.page or 1
            response.total_pages = total_pages
            
            # Add rows
            for row_data in rows:
                row = response.rows.add()
                row.fields.update(row_data)
            
            # Add column mappings
            for mapping_dict in dataset['column_mappings']:
                mapping = response.column_mappings.add()
                mapping.column_name = mapping_dict['column_name']
                mapping.column_type = mapping_dict['column_type']
                mapping.mapped_field = mapping_dict['mapped_field']
                mapping.is_coordinate = mapping_dict['is_coordinate']
            
            # Calculate and add data boundaries for efficient chart scaling
            # Always calculate for chart visualization (page_size <= 15000)
            if request.page_size <= 15000:  
                print(f"📐 Calculating boundaries for dataset {request.dataset_id}")
                boundaries = self.db.get_dataset_boundaries(request.dataset_id)
                print(f"📐 Found {len(boundaries)} column boundaries: {list(boundaries.keys())}")
                
                for col_name, boundary_data in boundaries.items():
                    boundary = response.data_boundaries.add()
                    boundary.column_name = col_name
                    boundary.min_value = boundary_data['min_value']
                    boundary.max_value = boundary_data['max_value']
                    boundary.valid_count = boundary_data['valid_count']
                    print(f"   📐 {col_name}: {boundary_data['min_value']:.2f} to {boundary_data['max_value']:.2f} ({boundary_data['valid_count']} values)")
            else:
                print(f"📐 Skipping boundaries calculation for large request (page_size={request.page_size})")
            
            print(f"✅ Retrieved {len(rows)} dataset rows")
            return response
            
        except Exception as e:
            print(f"❌ Error getting dataset data: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return projects_pb2.GetDatasetDataResponse()

    # Note: Data boundaries are now calculated directly in GetDatasetData method above
    # No separate boundaries method needed - simpler and more efficient!


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
        main_service_pb2_grpc.add_GeospatialServiceServicer_to_server(
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