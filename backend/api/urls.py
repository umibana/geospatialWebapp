from django.urls import path
from . import views

urlpatterns = [
    path('data/', views.data, name='data'),
    path('grpc-port/', views.grpc_port, name='grpc_port'),
] 