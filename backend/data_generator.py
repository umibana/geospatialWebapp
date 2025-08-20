#!/usr/bin/env python
"""
Módulo de generación de datos para crear datos geoespaciales sintéticos usando numpy.
Genera datos de coordenadas X,Y,Z para varios escenarios geoespaciales.
Soporta generación en lotes y formato columnar para eficiencia.
"""
import numpy as np
import time
import math
from typing import Iterator, List, Tuple, Dict, Any


class GeospatialDataGenerator:
    """Genera datos geoespaciales sintéticos usando numpy para varios escenarios.
    
    Soporta diferentes tipos de datos:
    - elevation: Datos de elevación del terreno
    - temperature: Datos de temperatura con gradientes
    - pressure: Datos de presión atmosférica
    - noise: Datos de ruido para pruebas
    - sine_wave: Ondas senoidales para patrones
    """
    
    def __init__(self):
        self.generation_methods = {
            'elevation': self._generate_elevation_data,
            'temperature': self._generate_temperature_data,
            'pressure': self._generate_pressure_data,
            'noise': self._generate_noise_data,
            'sine_wave': self._generate_sine_wave_data
        }
    
    def generate_batch_data(
        self, 
        bounds: Dict[str, float], 
        data_types: List[str], 
        max_points: int = 1000, 
        resolution: int = 20
    ) -> Tuple[List[Dict[str, Any]], str]:
        """Genera datos geoespaciales en lotes
        
        Args:
            bounds: Límites geográficos (northeast/southwest con lat/lng)
            data_types: Lista de tipos de datos a generar
            max_points: Máximo número de puntos a generar
            resolution: Resolución de la cuadrícula (mayor = más detalle)
            
        Returns:
            Tupla con (lista de puntos de datos, método de generación usado)
        """
        lat_min, lat_max = bounds['lat_min'], bounds['lat_max']
        lng_min, lng_max = bounds['lng_min'], bounds['lng_max']
        
        # Elegir el primer tipo de dato disponible
        data_type = data_types[0] if data_types else 'elevation'
        method = self.generation_methods.get(data_type, self._generate_elevation_data)
        
        # Generar coordenadas de cuadrícula - calcular resolución para lograr el conteo deseado
        if max_points <= resolution * resolution:
            # Si los puntos solicitados caben en la cuadrícula de resolución, usar la resolución
            actual_resolution = resolution
        else:
            # Si necesitamos más puntos de los que la cuadrícula puede proveer,
            # calcular la resolución mínima necesaria
            actual_resolution = max(resolution, int(math.sqrt(max_points)) + 1)
        
        lat_grid = np.linspace(lat_min, lat_max, actual_resolution, dtype=np.float32)
        lng_grid = np.linspace(lng_min, lng_max, actual_resolution, dtype=np.float32)
        lat_mesh, lng_mesh = np.meshgrid(lat_grid, lng_grid)
        
        print(f"🔢 Generación de datos: solicitados={max_points}, resolución={resolution}, resolución_real={actual_resolution}, max_posible={actual_resolution*actual_resolution}")
        
        # Iniciar cronometraje de generación de datos
        generation_start = time.time()
        
        # Generar valores Z usando el método seleccionado (convertir a float32 para eficiencia de memoria)
        z_values = method(lat_mesh, lng_mesh, lat_min, lat_max, lng_min, lng_max).astype(np.float32)
        
        z_generation_time = time.time() - generation_start
        print(f"⏱️  Generación de valores Z tomó: {z_generation_time:.3f}s")
        
        # Convertir a puntos de datos
        data_points = []
        point_id = 0
        data_point_start = time.time()
        
        for i in range(actual_resolution):
            for j in range(actual_resolution):
                if len(data_points) >= max_points:
                    break
                    
                # Usar ID más corto para datasets grandes para reducir tamaño de mensaje
                if max_points > 50000:
                    point_id_str = str(point_id)
                else:
                    point_id_str = f'{data_type}_{i}_{j}_{int(time.time())}'
                
                data_point = {
                    'id': point_id_str,
                    'latitude': float(np.float32(lat_mesh[i, j])),
                    'longitude': float(np.float32(lng_mesh[i, j])),
                    'altitude': float(np.float32(0.0)),  # Optional, could be varied
                    'value': float(np.float32(z_values[i, j])),
                    'unit': data_type,
                    'timestamp': int(time.time() * 1000),
                    'metadata': {
                        'generation_method': data_type,
                        'grid_position': f'{i},{j}' if max_points <= 50000 else f'{i},{j}',
                        'resolution': str(actual_resolution),
                        'batch_generated': 'true'
                    } if max_points <= 50000 else {
                        'generation_method': data_type
                    }
                }
                data_points.append(data_point)
                point_id += 1
            
            if len(data_points) >= max_points:
                break
        
        data_point_time = time.time() - data_point_start
        total_time = time.time() - generation_start
        
        print(f"⏱️  Data point creation took: {data_point_time:.3f}s")
        print(f"⏱️  Total backend generation time: {total_time:.3f}s for {len(data_points)} points")
        print(f"⏱️  Generation rate: {len(data_points)/total_time:.0f} points/second")
        
        return data_points, f'numpy_{data_type}_batch'
    
    def generate_columnar_data(
        self, 
        bounds: Dict[str, float], 
        data_types: List[str], 
        max_points: int = 1000, 
        resolution: int = 20
    ) -> Tuple[Dict[str, Any], str]:
        """
        Generate geospatial data in efficient columnar format for large datasets.
        
        Args:
            bounds: Dictionary with 'lat_min', 'lat_max', 'lng_min', 'lng_max'
            data_types: List of data types to generate
            max_points: Maximum number of points to generate
            resolution: Grid resolution for data generation
            
        Returns:
            Tuple of (columnar_data_dict, generation_method)
        """
        lat_min, lat_max = bounds['lat_min'], bounds['lat_max']
        lng_min, lng_max = bounds['lng_min'], bounds['lng_max']
        
        # Choose the first available data type for primary Z values
        primary_data_type = data_types[0] if data_types else 'elevation'
        
        # Calculate resolution to achieve desired point count
        if max_points <= resolution * resolution:
            actual_resolution = resolution
        else:
            actual_resolution = max(resolution, int(math.sqrt(max_points)) + 1)
        
        lat_grid = np.linspace(lat_min, lat_max, actual_resolution, dtype=np.float64)
        lng_grid = np.linspace(lng_min, lng_max, actual_resolution, dtype=np.float64)
        lat_mesh, lng_mesh = np.meshgrid(lat_grid, lng_grid)
        
        print(f"🔢 Columnar data generation: requested={max_points}, resolution={resolution}, actual_resolution={actual_resolution}, max_possible={actual_resolution*actual_resolution}")
        
        generation_start = time.time()
        
        # Generate primary Z values
        primary_method = self.generation_methods.get(primary_data_type, self._generate_elevation_data)
        z_values = primary_method(lat_mesh, lng_mesh, lat_min, lat_max, lng_min, lng_max).astype(np.float64)
        
        # Flatten to 1D arrays and limit to max_points
        flat_lat = lat_mesh.flatten()[:max_points]
        flat_lng = lng_mesh.flatten()[:max_points]
        flat_z = z_values.flatten()[:max_points]
        
        actual_count = len(flat_lat)
        
        # Create columnar data structure
        columnar_data = {
            'id': [f'point_{i}' for i in range(actual_count)],
            'x': flat_lng.tolist(),  # X = longitude
            'y': flat_lat.tolist(),  # Y = latitude
            'z': flat_z.tolist(),    # Z = primary value
            'id_value': [f'{primary_data_type}_sensor_{i % 10}' for i in range(actual_count)],
            'additional_data': {}
        }
        
        # Generate additional data types if requested
        for data_type in data_types[1:]:  # Skip the first one (already used for Z)
            if data_type in self.generation_methods:
                method = self.generation_methods[data_type]
                additional_values = method(lat_mesh, lng_mesh, lat_min, lat_max, lng_min, lng_max).astype(np.float64)
                flat_additional = additional_values.flatten()[:max_points]
                columnar_data['additional_data'][data_type] = flat_additional.tolist()
        
        # Add some extra useful columns
        if 'elevation' not in data_types:
            elevation_values = self._generate_elevation_data(lat_mesh, lng_mesh, lat_min, lat_max, lng_min, lng_max).astype(np.float64)
            flat_elevation = elevation_values.flatten()[:max_points]
            columnar_data['additional_data']['elevation'] = flat_elevation.tolist()
            
        if 'temperature' not in data_types:
            temp_values = self._generate_temperature_data(lat_mesh, lng_mesh, lat_min, lat_max, lng_min, lng_max).astype(np.float64)
            flat_temp = temp_values.flatten()[:max_points]
            columnar_data['additional_data']['temperature'] = flat_temp.tolist()
        
        generation_time = time.time() - generation_start
        
        print(f"⏱️  Columnar data generation took: {generation_time:.3f}s for {actual_count} points")
        print(f"⏱️  Generation rate: {actual_count/generation_time:.0f} points/second")
        print(f"📊 Generated columns: id, x, y, z, id_value + {len(columnar_data['additional_data'])} additional columns")
        
        return columnar_data, f'numpy_columnar_{primary_data_type}'
    
    def generate_streaming_data(
        self, 
        bounds: Dict[str, float], 
        data_types: List[str], 
        max_points_per_second: int = 5
    ) -> Iterator[Dict[str, Any]]:
        """Genera puntos de datos geoespaciales en streaming
        
        Produce puntos de datos de forma continua para simular datos en tiempo real.
        Útil para demostrar capacidades de streaming y actualizaciones en vivo.
        
        Args:
            bounds: Diccionario con 'lat_min', 'lat_max', 'lng_min', 'lng_max'
            data_types: Lista de tipos de datos a generar
            max_points_per_second: Velocidad de generación de datos (puntos por segundo)
            
        Yields:
            Puntos de datos individuales para procesamiento en tiempo real
        """
        lat_min, lat_max = bounds['lat_min'], bounds['lat_max']
        lng_min, lng_max = bounds['lng_min'], bounds['lng_max']
        
        data_type = data_types[0] if data_types else 'elevation'
        method = self.generation_methods.get(data_type, self._generate_elevation_data)
        
        interval = 1.0 / max_points_per_second
        point_count = 0
        
        # Generar datos de streaming por 30 segundos
        start_time = time.time()
        while time.time() - start_time < 30:
            # Generar coordenadas aleatorias dentro de los límites
            lat = np.random.uniform(lat_min, lat_max)
            lng = np.random.uniform(lng_min, lng_max)
            
            # Generate single point using the method
            lat_array = np.array([[lat]])
            lng_array = np.array([[lng]])
            z_value = method(lat_array, lng_array, lat_min, lat_max, lng_min, lng_max)[0, 0]
            
            data_point = {
                'id': f'{data_type}_stream_{point_count}_{int(time.time())}',
                'latitude': float(np.float32(lat)),
                'longitude': float(np.float32(lng)),
                'altitude': float(np.float32(np.random.uniform(0, 100))),  # Random altitude
                'value': float(np.float32(z_value)),
                'unit': data_type,
                'timestamp': int(time.time() * 1000),
                'metadata': {
                    'generation_method': data_type,
                    'stream_point': str(point_count),
                    'streaming': 'true'
                }
            }
            
            yield data_point
            point_count += 1
            time.sleep(interval)
    
    def _generate_elevation_data(self, lat_mesh, lng_mesh, lat_min, lat_max, lng_min, lng_max):
        """Genera datos sintéticos de elevación del terreno
        
        Crea un terreno montañoso usando ondas senoidales múltiples y ruido aleatorio.
        Simula variaciones realistas de altura del terreno con picos y valles.
        
        Returns:
            Array numpy con valores de elevación en metros sobre el nivel del mar
        """
        # Crear terreno montañoso usando ondas senoidales y ruido
        lat_range = lat_max - lat_min
        lng_range = lng_max - lng_min
        
        # Normalizar coordenadas a [0, 1]
        lat_norm = (lat_mesh - lat_min) / lat_range
        lng_norm = (lng_mesh - lng_min) / lng_range
        
        # Generar elevación usando múltiples ondas senoidales + ruido
        elevation = (
            500 * np.sin(lat_norm * 2 * np.pi) * np.cos(lng_norm * 2 * np.pi) +  # Ondas principales
            200 * np.sin(lat_norm * 4 * np.pi) +                                 # Variación latitudinal
            150 * np.cos(lng_norm * 3 * np.pi) +                                # Variación longitudinal
            np.random.normal(0, 50, lat_mesh.shape)                            # Añadir ruido realista
        )
        
        # Asegurar que la elevación sea positiva (sobre el nivel del mar)
        elevation = np.maximum(elevation, 0) + 100  # Mínimo 100m sobre el nivel del mar
        
        return elevation
    
    def _generate_temperature_data(self, lat_mesh, lng_mesh, lat_min, lat_max, lng_min, lng_max):
        """Genera datos sintéticos de temperatura
        
        Simula variaciones de temperatura basadas en latitud, variación diaria
        y fluctuaciones climáticas. Temperaturas más frías en latitudes altas.
        
        Returns:
            Array numpy con temperaturas en grados Celsius
        """
        # La temperatura varía con la latitud (más frío en latitudes altas)
        lat_range = lat_max - lat_min
        lat_norm = (lat_mesh - lat_min) / lat_range
        
        # Temperatura base con gradiente latitudinal + variación diaria + ruido
        temperature = (
            25 - (lat_norm * 30) +                                             # Efecto de latitud
            5 * np.sin((time.time() % 86400) / 86400 * 2 * np.pi) +           # Variación diaria
            np.random.normal(0, 3, lat_mesh.shape)                            # Ruido climático
        )
        
        return temperature
    
    def _generate_pressure_data(self, lat_mesh, lng_mesh, lat_min, lat_max, lng_min, lng_max):
        """Genera datos sintéticos de presión atmosférica
        
        Simula patrones de presión atmosférica con sistemas de alta y baja presión.
        Incluye variaciones climáticas y patrones meteorológicos.
        
        Returns:
            Array numpy con presión atmosférica en hPa (hectopascales)
        """
        # La presión varía con patrones meteorológicos
        lat_range = lat_max - lat_min
        lng_range = lng_max - lng_min
        
        lat_norm = (lat_mesh - lat_min) / lat_range
        lng_norm = (lng_mesh - lng_min) / lng_range
        
        # Generar patrones de presión
        pressure = (
            1013.25 +                                                          # Presión atmosférica estándar
            10 * np.sin(lat_norm * 3 * np.pi) * np.cos(lng_norm * 2 * np.pi) +  # Patrones de alta/baja presión
            np.random.normal(0, 5, lat_mesh.shape)                            # Variaciones meteorológicas
        )
        
        return pressure
    
    def _generate_noise_data(self, lat_mesh, lng_mesh, lat_min, lat_max, lng_min, lng_max):
        """Genera datos de ruido aleatorio para pruebas
        
        Crea valores completamente aleatorios para probar el rendimiento
        del sistema con datos sin patrones específicos.
        
        Returns:
            Array numpy con valores aleatorios entre 0 y 100
        """
        return np.random.uniform(0, 100, lat_mesh.shape)
    
    def _generate_sine_wave_data(self, lat_mesh, lng_mesh, lat_min, lat_max, lng_min, lng_max):
        """Genera datos con patrón de onda senoidal
        
        Crea un patrón de interferencia de ondas senoidales que produce
        patrones geométricos regulares. Útil para visualizar patrones matemáticos.
        
        Returns:
            Array numpy con patrón de ondas senoidales
        """
        lat_range = lat_max - lat_min
        lng_range = lng_max - lng_min
        
        lat_norm = (lat_mesh - lat_min) / lat_range
        lng_norm = (lng_mesh - lng_min) / lng_range
        
        # Crear patrón de onda senoidal
        wave_data = (
            50 + 30 * np.sin(lat_norm * 4 * np.pi) * np.sin(lng_norm * 4 * np.pi)  # Interferencia de ondas
        )
        
        return wave_data


# Instancia global del generador de datos
# Se utiliza como singleton para mantener consistencia en la generación
data_generator = GeospatialDataGenerator()