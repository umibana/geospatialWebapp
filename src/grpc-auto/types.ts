// Auto-generated TypeScript interfaces from protos/*
// DO NOT EDIT - This file is auto-generated

export interface Coordinate {
  latitude: number;
  longitude: number;
  altitude: number;
}

export interface BoundingBox {
  northeast: Coordinate;
  southwest: Coordinate;
}

export interface GeospatialFeature {
  id: string;
  name: string;
  location: Coordinate;
  timestamp: number;
}

export interface DataPoint {
  id: string;
  location: Coordinate;
  value: number;
  unit: string;
  timestamp: number;
}

export interface OptimizedDataPoint {
  id: string;
  latitude: number;
  longitude: number;
  altitude: number;
  value: number;
  unit: string;
  timestamp: number;
  generation_method: string;
}

export interface GetBatchDataChunk {
  data_points: DataPoint;
  chunk_number: number;
  total_chunks: number;
  points_in_chunk: number;
  is_final_chunk: boolean;
  generation_method: string;
}

export interface HelloWorldRequest {
  message: string;
}

export interface HelloWorldResponse {
  message: string;
}

export interface EchoParameterRequest {
  value: number;
  operation: string;
}

export interface EchoParameterResponse {
  original_value: number;
  processed_value: number;
  operation: string;
}

export interface HealthCheckResponse {
  healthy: boolean;
  version: string;
}

export interface GetFeaturesRequest {
  bounds: BoundingBox;
  feature_types: string;
  limit: number;
}

export interface GetFeaturesResponse {
  features: GeospatialFeature;
  total_count: number;
}

export interface StreamDataRequest {
  bounds: BoundingBox;
  data_types: string;
  max_points_per_second: number;
}

export interface GetBatchDataRequest {
  bounds: BoundingBox;
  data_types: string;
  max_points: number;
  resolution: number;
}

export interface GetBatchDataResponse {
  data_points: DataPoint;
  total_count: number;
  generation_method: string;
}

export interface GetBatchDataOptimizedResponse {
  data_points: OptimizedDataPoint;
  total_count: number;
  generation_method: string;
}
