# -*- mode: python ; coding: utf-8 -*-

import os
import sys
from pathlib import Path
from PyInstaller.building.build_main import Analysis
from PyInstaller.building.datastruct import PYZ
from PyInstaller.building.api import EXE, COLLECT

# Add Django project to Python path
project_dir = Path(__file__).parent
sys.path.insert(0, str(project_dir))

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Import Django to trigger setup
import django
django.setup()

block_cipher = None

a = Analysis(
    ['server.py'],
    pathex=[str(project_dir)],
    binaries=[],
    datas=[
        ('backend/settings.py', 'backend'),
        ('backend/urls.py', 'backend'),
        ('backend/wsgi.py', 'backend'),
        ('backend/__init__.py', 'backend'),
        ('api/*.py', 'api'),
    ],
    hiddenimports=[
        'django',
        'django.core.management',
        'django.core.management.commands',
        'django.core.management.commands.runserver',
        'django.contrib.auth',
        'django.contrib.contenttypes',
        'django.contrib.sessions',
        'django.contrib.messages',
        'django.contrib.staticfiles',
        'django.contrib.admin',
        'corsheaders',
        'rest_framework',
        'backend.settings',
        'backend.urls',
        'backend.wsgi',
        'api.apps',
        'api.urls',
        'api.views',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='django-server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='django-server'
) 