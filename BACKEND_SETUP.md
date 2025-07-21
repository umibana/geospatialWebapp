# Django Backend Setup for Electron App

This guide will help you set up and bundle a Django backend with your Electron app using PyInstaller.

## Prerequisites

1. **Python 3.8+** installed on your system
2. **pip** package manager
3. **PyInstaller** for bundling

## Initial Setup

### 1. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
pip install pyinstaller
```

### 2. Initialize Django Database

```bash
cd backend
python manage.py migrate
```

### 3. Test Django Backend Separately

```bash
# From project root
npm run dev:backend
```

This should start the Django server and you can test it at `http://127.0.0.1:8000/api/health/`

## Development Workflow

### Running in Development Mode

1. **Start Django Backend** (Terminal 1):
```bash
npm run dev:backend
```

2. **Start Electron App** (Terminal 2):
```bash
npm start
```

The Electron app will automatically connect to the Django backend running in development mode.

### Testing the Integration

1. Start your Electron app with `npm start`
2. The HomePage should display a "Django Backend Status" section
3. Use the buttons to:
   - **Refresh Status**: Check if backend is running
   - **Restart Backend**: Restart the Django server
   - **Test API**: Make a sample API call

## Production Build

### 1. Build Django Backend Executable

```bash
npm run build:backend
```

This will create a standalone executable in `backend/dist/django-server/`

### 2. Build Complete Electron App

```bash
npm run build:full
```

This will:
1. Build the Django backend executable
2. Package the Electron app including the backend

## Available Scripts

- `npm run setup:backend` - Install Python dependencies
- `npm run dev:backend` - Run Django in development mode
- `npm run build:backend` - Build Django executable with PyInstaller
- `npm run build:full` - Build backend + package Electron app

## Backend API Endpoints

The Django backend provides these endpoints:

- `GET /api/health/` - Health check endpoint
- `GET /api/data/` - Sample data endpoint

## Customizing the Backend

### Adding New Endpoints

1. Edit `backend/api/views.py` to add new view functions
2. Update `backend/api/urls.py` to add URL patterns
3. Restart the backend to see changes

### Database Models

1. Create models in `backend/api/models.py`
2. Run migrations:
   ```bash
   cd backend
   python manage.py makemigrations
   python manage.py migrate
   ```

### Settings Configuration

Edit `backend/backend/settings.py` for:
- Database configuration
- CORS settings
- Security settings
- Installed apps

## Troubleshooting

### Common Issues

1. **Port conflicts**: The backend automatically finds free ports
2. **Python not found**: Ensure Python is in your PATH
3. **Dependencies missing**: Run `pip install -r requirements.txt`

### Backend Logs

Check the Electron console for Django backend logs:
- Stdout logs show server status
- Stderr logs show errors

### Manual Testing

Test backend endpoints directly:
```bash
curl http://127.0.0.1:8000/api/health/
curl http://127.0.0.1:8000/api/data/
```

## File Structure

```
backend/
├── manage.py                 # Django management script
├── server.py                 # Standalone server for Electron
├── requirements.txt          # Python dependencies
├── pyinstaller_spec.py       # PyInstaller configuration
├── backend/                  # Django project
│   ├── __init__.py
│   ├── settings.py          # Django settings
│   ├── urls.py              # Main URL configuration
│   └── wsgi.py              # WSGI configuration
└── api/                     # Django app
    ├── __init__.py
    ├── apps.py
    ├── urls.py              # API URL patterns
    └── views.py             # API view functions
```

## Next Steps

1. Customize the Django API for your specific needs
2. Add authentication if required
3. Implement your business logic in the views
4. Add database models as needed
5. Configure production settings for security

The backend is now fully integrated with your Electron app and will start/stop automatically with the main application. 