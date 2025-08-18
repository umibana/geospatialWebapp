#!/usr/bin/env python
"""
Data generation module for creating synthetic geospatial data using numpy.
Generates X,Y,Z coordinate data for various geospatial scenarios.
"""
import numpy as np
import time
import math
from typing import Iterator, List, Tuple, Dict, Any


class GeospatialDataGenerator:
    """Generates synthetic geospatial data using numpy for various scenarios."""
    
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
        """
        Generate a batch of geospatial data points within specified bounds.
        
        Args:
            bounds: Dictionary with 'lat_min', 'lat_max', 'lng_min', 'lng_max'
            data_types: List of data types to generate
            max_points: Maximum number of points to generate
            resolution: Grid resolution for data generation
            
        Returns:
            Tuple of (data_points_list, generation_method)
        """
        lat_min, lat_max = bounds['lat_min'], bounds['lat_max']
        lng_min, lng_max = bounds['lng_min'], bounds['lng_max']
        
        # Choose the first available data type
        data_type = data_types[0] if data_types else 'elevation'
        method = self.generation_methods.get(data_type, self._generate_elevation_data)
        
        # Generate grid coordinates - calculate resolution to achieve desired point count
        if max_points <= resolution * resolution:
            # If requested points fit in the resolution grid, use the resolution
            actual_resolution = resolution
        else:
            # If we need more points than the resolution grid can provide,
            # calculate the minimum resolution needed
            actual_resolution = max(resolution, int(math.sqrt(max_points)) + 1)
        
        lat_grid = np.linspace(lat_min, lat_max, actual_resolution, dtype=np.float32)
        lng_grid = np.linspace(lng_min, lng_max, actual_resolution, dtype=np.float32)
        lat_mesh, lng_mesh = np.meshgrid(lat_grid, lng_grid)
        
        print(f"🔢 Data generation: requested={max_points}, resolution={resolution}, actual_resolution={actual_resolution}, max_possible={actual_resolution*actual_resolution}")
        
        # Start timing data generation
        generation_start = time.time()
        
        # Generate Z values using the selected method (convert to float32 for memory efficiency)
        z_values = method(lat_mesh, lng_mesh, lat_min, lat_max, lng_min, lng_max).astype(np.float32)
        
        z_generation_time = time.time() - generation_start
        print(f"⏱️  Z-values generation took: {z_generation_time:.3f}s")
        
        # Convert to data points
        data_points = []
        point_id = 0
        data_point_start = time.time()
        
        for i in range(actual_resolution):
            for j in range(actual_resolution):
                if len(data_points) >= max_points:
                    break
                    
                # Use shorter ID for large datasets to reduce message size
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
        """
        Generate streaming geospatial data points.
        
        Args:
            bounds: Dictionary with 'lat_min', 'lat_max', 'lng_min', 'lng_max'
            data_types: List of data types to generate
            max_points_per_second: Rate of data generation
            
        Yields:
            Individual data points
        """
        lat_min, lat_max = bounds['lat_min'], bounds['lat_max']
        lng_min, lng_max = bounds['lng_min'], bounds['lng_max']
        
        data_type = data_types[0] if data_types else 'elevation'
        method = self.generation_methods.get(data_type, self._generate_elevation_data)
        
        interval = 1.0 / max_points_per_second
        point_count = 0
        
        # Generate streaming data for 30 seconds
        start_time = time.time()
        while time.time() - start_time < 30:
            # Generate random coordinates within bounds
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
        """Generate synthetic elevation data."""
        # Create a mountainous terrain using sine waves and noise
        lat_range = lat_max - lat_min
        lng_range = lng_max - lng_min
        
        # Normalize coordinates to [0, 1]
        lat_norm = (lat_mesh - lat_min) / lat_range
        lng_norm = (lng_mesh - lng_min) / lng_range
        
        # Generate elevation using multiple sine waves + noise
        elevation = (
            500 * np.sin(lat_norm * 2 * np.pi) * np.cos(lng_norm * 2 * np.pi) +
            200 * np.sin(lat_norm * 4 * np.pi) +
            150 * np.cos(lng_norm * 3 * np.pi) +
            np.random.normal(0, 50, lat_mesh.shape)  # Add noise
        )
        
        # Ensure elevation is positive (above sea level)
        elevation = np.maximum(elevation, 0) + 100
        
        return elevation
    
    def _generate_temperature_data(self, lat_mesh, lng_mesh, lat_min, lat_max, lng_min, lng_max):
        """Generate synthetic temperature data."""
        # Temperature varies with latitude (cooler at higher latitudes)
        lat_range = lat_max - lat_min
        lat_norm = (lat_mesh - lat_min) / lat_range
        
        # Base temperature with latitude gradient + daily variation + noise
        temperature = (
            25 - (lat_norm * 30) +  # Latitude effect
            5 * np.sin((time.time() % 86400) / 86400 * 2 * np.pi) +  # Daily variation
            np.random.normal(0, 3, lat_mesh.shape)  # Weather noise
        )
        
        return temperature
    
    def _generate_pressure_data(self, lat_mesh, lng_mesh, lat_min, lat_max, lng_min, lng_max):
        """Generate synthetic atmospheric pressure data."""
        # Pressure varies with weather patterns
        lat_range = lat_max - lat_min
        lng_range = lng_max - lng_min
        
        lat_norm = (lat_mesh - lat_min) / lat_range
        lng_norm = (lng_mesh - lng_min) / lng_range
        
        # Generate pressure patterns
        pressure = (
            1013.25 +  # Standard atmospheric pressure
            10 * np.sin(lat_norm * 3 * np.pi) * np.cos(lng_norm * 2 * np.pi) +
            np.random.normal(0, 5, lat_mesh.shape)  # Weather variations
        )
        
        return pressure
    
    def _generate_noise_data(self, lat_mesh, lng_mesh, lat_min, lat_max, lng_min, lng_max):
        """Generate random noise data for testing."""
        return np.random.uniform(0, 100, lat_mesh.shape)
    
    def _generate_sine_wave_data(self, lat_mesh, lng_mesh, lat_min, lat_max, lng_min, lng_max):
        """Generate sine wave pattern data."""
        lat_range = lat_max - lat_min
        lng_range = lng_max - lng_min
        
        lat_norm = (lat_mesh - lat_min) / lat_range
        lng_norm = (lng_mesh - lng_min) / lng_range
        
        # Create sine wave pattern
        wave_data = (
            50 + 30 * np.sin(lat_norm * 4 * np.pi) * np.sin(lng_norm * 4 * np.pi)
        )
        
        return wave_data


# Global instance
data_generator = GeospatialDataGenerator()