"""
SQLite database manager for project, file, and dataset management.
"""

import sqlite3
import uuid
import time
import json
import os
import math
from typing import List, Dict, Any, Optional, Tuple, Union
from contextlib import contextmanager

class DatabaseManager:
    def __init__(self, db_path: str = "geospatial.db"):
        """Initialize the database manager with SQLite database."""
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize database tables."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Projects table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            ''')
            
            # Files table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS files (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    dataset_type INTEGER NOT NULL,
                    original_filename TEXT NOT NULL,
                    file_size INTEGER NOT NULL,
                    file_content BLOB,
                    created_at INTEGER NOT NULL,
                    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
                )
            ''')
            
            # Datasets table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS datasets (
                    id TEXT PRIMARY KEY,
                    file_id TEXT NOT NULL,
                    total_rows INTEGER NOT NULL,
                    current_page INTEGER DEFAULT 0,
                    column_mappings TEXT,  -- JSON string
                    created_at INTEGER NOT NULL,
                    FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE
                )
            ''')
            
            # Dataset data table - for actual processed data
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS dataset_data (
                    id TEXT PRIMARY KEY,
                    dataset_id TEXT NOT NULL,
                    row_index INTEGER NOT NULL,
                    data TEXT NOT NULL,  -- JSON string
                    FOREIGN KEY (dataset_id) REFERENCES datasets (id) ON DELETE CASCADE
                )
            ''')
            
            # Create indexes for better performance
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_datasets_file_id ON datasets(file_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_dataset_data_dataset_id ON dataset_data(dataset_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_dataset_data_row_index ON dataset_data(row_index)')
            
            conn.commit()
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Enable dict-like access to rows
        try:
            yield conn
        finally:
            conn.close()
    
    def generate_id(self) -> str:
        """Generate a unique UUID string."""
        return str(uuid.uuid4())
    
    def get_timestamp(self) -> int:
        """Get current Unix timestamp."""
        return int(time.time())
    
    # ========== Project Management ==========
    
    def create_project(self, name: str, description: str = "") -> Dict[str, Any]:
        """Create a new project."""
        project_id = self.generate_id()
        timestamp = self.get_timestamp()
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
                (project_id, name, description, timestamp, timestamp)
            )
            conn.commit()
        
        return {
            'id': project_id,
            'name': name,
            'description': description,
            'created_at': timestamp,
            'updated_at': timestamp
        }
    
    def get_projects(self, limit: int = 100, offset: int = 0) -> Tuple[List[Dict[str, Any]], int]:
        """Get projects with pagination."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Get total count
            cursor.execute('SELECT COUNT(*) FROM projects')
            total_count = cursor.fetchone()[0]
            
            # Get paginated results
            cursor.execute(
                'SELECT * FROM projects ORDER BY updated_at DESC LIMIT ? OFFSET ?',
                (limit, offset)
            )
            projects = [dict(row) for row in cursor.fetchall()]
        
        return projects, total_count
    
    def get_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get a single project by ID."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM projects WHERE id = ?', (project_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def update_project(self, project_id: str, name: str, description: str) -> bool:
        """Update a project."""
        timestamp = self.get_timestamp()
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?',
                (name, description, timestamp, project_id)
            )
            conn.commit()
            return cursor.rowcount > 0
    
    def delete_project(self, project_id: str) -> bool:
        """Delete a project and all associated files/datasets."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM projects WHERE id = ?', (project_id,))
            conn.commit()
            return cursor.rowcount > 0
    
    # ========== File Management ==========
    
    def create_file(self, project_id: str, name: str, dataset_type: int, 
                   original_filename: str, file_content: bytes) -> Dict[str, Any]:
        """Create a new file."""
        file_id = self.generate_id()
        timestamp = self.get_timestamp()
        file_size = len(file_content)
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                '''INSERT INTO files (id, project_id, name, dataset_type, original_filename, 
                   file_size, file_content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                (file_id, project_id, name, dataset_type, original_filename, file_size, file_content, timestamp)
            )
            conn.commit()
        
        return {
            'id': file_id,
            'project_id': project_id,
            'name': name,
            'dataset_type': dataset_type,
            'original_filename': original_filename,
            'file_size': file_size,
            'created_at': timestamp
        }
    
    def get_project_files(self, project_id: str) -> List[Dict[str, Any]]:
        """Get all files for a project."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT id, project_id, name, dataset_type, original_filename, file_size, created_at FROM files WHERE project_id = ? ORDER BY created_at DESC',
                (project_id,)
            )
            return [dict(row) for row in cursor.fetchall()]
    
    def get_file_content(self, file_id: str) -> Optional[bytes]:
        """Get file content by ID."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT file_content FROM files WHERE id = ?', (file_id,))
            row = cursor.fetchone()
            return row[0] if row else None

    def get_datasets_by_project(self, project_id: str) -> List[Dict[str, Any]]:
        """Get all datasets for a project (via files)."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT d.id, d.file_id, d.total_rows, d.current_page, 
                       d.column_mappings, d.created_at, f.name as file_name,
                       f.dataset_type, f.original_filename
                FROM datasets d
                JOIN files f ON d.file_id = f.id
                WHERE f.project_id = ?
                ORDER BY d.created_at DESC
            ''', (project_id,))
            
            datasets = []
            for row in cursor.fetchall():
                dataset = dict(row)
                # Parse JSON column mappings
                dataset['column_mappings'] = json.loads(dataset['column_mappings']) if dataset['column_mappings'] else []
                datasets.append(dataset)
            
            return datasets
    
    def delete_file(self, file_id: str) -> bool:
        """Delete a file and all associated datasets."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM files WHERE id = ?', (file_id,))
            conn.commit()
            return cursor.rowcount > 0
    
    # ========== Dataset Management ==========
    
    def create_dataset(self, file_id: str, total_rows: int, column_mappings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create a new dataset."""
        dataset_id = self.generate_id()
        timestamp = self.get_timestamp()
        
        # Convert column mappings to JSON string
        mappings_json = json.dumps(column_mappings)
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO datasets (id, file_id, total_rows, current_page, column_mappings, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                (dataset_id, file_id, total_rows, 0, mappings_json, timestamp)
            )
            conn.commit()
        
        return {
            'id': dataset_id,
            'file_id': file_id,
            'total_rows': total_rows,
            'current_page': 0,
            'column_mappings': column_mappings,
            'created_at': timestamp
        }
    
    def get_dataset_by_file(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get dataset by file ID."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM datasets WHERE file_id = ?', (file_id,))
            row = cursor.fetchone()
            if row:
                dataset = dict(row)
                dataset['column_mappings'] = json.loads(dataset['column_mappings'])
                return dataset
            return None
    
    def get_dataset_by_id(self, dataset_id: str) -> Optional[Dict[str, Any]]:
        """Get dataset by dataset ID."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM datasets WHERE id = ?', (dataset_id,))
            row = cursor.fetchone()
            if row:
                dataset = dict(row)
                dataset['column_mappings'] = json.loads(dataset['column_mappings'])
                return dataset
            return None
    
    def store_dataset_data(self, dataset_id: str, data_rows: List[Dict[str, str]]):
        """Store processed dataset data."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Clear existing data
            cursor.execute('DELETE FROM dataset_data WHERE dataset_id = ?', (dataset_id,))
            
            # Insert new data
            for i, row in enumerate(data_rows):
                row_id = self.generate_id()
                data_json = json.dumps(row)
                cursor.execute(
                    'INSERT INTO dataset_data (id, dataset_id, row_index, data) VALUES (?, ?, ?, ?)',
                    (row_id, dataset_id, i, data_json)
                )
            
            conn.commit()
    
    def get_dataset_data(self, dataset_id: str, page: int = 1, page_size: int = 100) -> Tuple[List[Dict[str, str]], int, int]:
        """Get dataset data with pagination."""
        offset = (page - 1) * page_size
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Get total count
            cursor.execute('SELECT COUNT(*) FROM dataset_data WHERE dataset_id = ?', (dataset_id,))
            total_rows = cursor.fetchone()[0]
            
            # Get paginated data
            cursor.execute(
                'SELECT data FROM dataset_data WHERE dataset_id = ? ORDER BY row_index LIMIT ? OFFSET ?',
                (dataset_id, page_size, offset)
            )
            
            rows = []
            for row in cursor.fetchall():
                data = json.loads(row[0])
                rows.append(data)
            
            total_pages = (total_rows + page_size - 1) // page_size
            
            return rows, total_rows, total_pages
    
    def get_dataset_boundaries(self, dataset_id: str, column_names: List[str] = None) -> Dict[str, Dict[str, Union[float, int]]]:
        """
        Calculate min/max boundaries for numeric columns in a dataset.
        
        Args:
            dataset_id: The dataset ID
            column_names: Specific columns to analyze (None = all numeric columns)
            
        Returns:
            Dict mapping column names to {min_value, max_value, valid_count}
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Get column mappings to know which columns are numeric
                cursor.execute('SELECT column_mappings FROM datasets WHERE id = ?', (dataset_id,))
                dataset_row = cursor.fetchone()
                
                if not dataset_row:
                    return {}
                
                column_mappings = json.loads(dataset_row[0])
                
                # Determine which columns to analyze
                target_columns = []
                if column_names:
                    # Use specified columns
                    target_columns = column_names
                else:
                    # Use all numeric/coordinate columns
                    target_columns = [
                        mapping['column_name'] 
                        for mapping in column_mappings 
                        if mapping['column_type'] in [1, 2] or mapping['is_coordinate']  # NUMERIC or CATEGORICAL or coordinates
                    ]
                
                print(f"📐 Database boundaries calculation:")
                print(f"   Dataset: {dataset_id}")
                print(f"   Column mappings: {len(column_mappings)}")
                print(f"   Target columns: {target_columns}")
                
                if not target_columns:
                    print(f"   ❌ No target columns found for boundaries calculation")
                    return {}
                
                # Get all dataset data for boundary calculation
                cursor.execute('SELECT data FROM dataset_data WHERE dataset_id = ?', (dataset_id,))
                
                # Initialize boundary tracking
                boundaries = {}
                for col in target_columns:
                    boundaries[col] = {
                        'values': [],
                        'min_value': float('inf'),
                        'max_value': float('-inf'),
                        'valid_count': 0
                    }
                
                # Process all rows to calculate boundaries
                for row in cursor.fetchall():
                    data = json.loads(row[0])
                    
                    for col in target_columns:
                        if col in data:
                            try:
                                # Try to convert to float
                                value = float(data[col])
                                if not (math.isnan(value) or math.isinf(value)):
                                    boundaries[col]['min_value'] = min(boundaries[col]['min_value'], value)
                                    boundaries[col]['max_value'] = max(boundaries[col]['max_value'], value)
                                    boundaries[col]['valid_count'] += 1
                            except (ValueError, TypeError):
                                # Skip non-numeric values
                                pass
                
                # Clean up results and handle edge cases
                result = {}
                for col, boundary in boundaries.items():
                    if boundary['valid_count'] > 0:
                        # Handle single value case
                        if boundary['min_value'] == boundary['max_value']:
                            # Add small padding for single values
                            padding = abs(boundary['min_value']) * 0.1 if boundary['min_value'] != 0 else 1.0
                            result[col] = {
                                'min_value': boundary['min_value'] - padding,
                                'max_value': boundary['max_value'] + padding,
                                'valid_count': boundary['valid_count']
                            }
                        else:
                            # Add 5% padding to the range for better visualization
                            value_range = boundary['max_value'] - boundary['min_value']
                            padding = value_range * 0.05
                            result[col] = {
                                'min_value': boundary['min_value'] - padding,
                                'max_value': boundary['max_value'] + padding,
                                'valid_count': boundary['valid_count']
                            }
                
                return result
                
        except Exception as e:
            print(f"Error calculating dataset boundaries: {e}")
            return {}