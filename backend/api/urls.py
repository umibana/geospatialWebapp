from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health_check, name='health_check'),
    path('connectrpc-port/', views.connectrpc_port, name='connectrpc_port'),
    path('data/', views.get_data, name='get_data'),
] 