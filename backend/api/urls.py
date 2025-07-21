from django.urls import path
from . import views

urlpatterns = [
    path('data/', views.data, name='data'),
    path('health/', views.health, name='health'),
    path('grpc-port/', views.grpc_port, name='grpc_port'),
    
    # JSON gRPC proxy endpoints
    path('grpc/features/', views.grpc_get_features, name='grpc_get_features'),
    path('grpc/stream/', views.grpc_stream_data, name='grpc_stream_data'),
    path('grpc/health/', views.grpc_health_check, name='grpc_health_check'),
    
    # Protobuf gRPC proxy endpoints
    path('grpc/features/protobuf/', views.grpc_get_features_protobuf, name='grpc_get_features_protobuf'),
    path('grpc/stream/protobuf/', views.grpc_stream_data_protobuf, name='grpc_stream_data_protobuf'),
    path('grpc/health/protobuf/', views.grpc_health_check_protobuf, name='grpc_health_check_protobuf'),
] 