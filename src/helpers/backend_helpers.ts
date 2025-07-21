import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

interface BackendConfig {
  port: number;
  process: ChildProcess | null;
  isRunning: boolean;
}

class BackendManager {
  private config: BackendConfig = {
    port: 8000,
    process: null,
    isRunning: false,
  };

  private getBackendPath(): string {
    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      // In development, use Python directly
      return path.join(process.cwd(), 'backend', 'server.py');
    } else {
      // In production, use the bundled executable
      const resourcesPath = process.resourcesPath;
      return path.join(resourcesPath, 'django-server', 'django-server');
    }
  }

    private async waitForPortFile(timeout = 10000): Promise<number> {
    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      // In development, Django always uses port 8077
      const expectedPort = 8077;
      
      // Wait for the server to actually start by trying to connect
      const startTime = Date.now();
      
      return new Promise((resolve, reject) => {
        const checkConnection = async () => {
          if (Date.now() - startTime > timeout) {
            reject(new Error(`Timeout waiting for Django server on port ${expectedPort}`));
            return;
          }

          try {
            // Try to fetch from the health endpoint to verify server is running
            const response = await fetch(`http://127.0.0.1:${expectedPort}/api/health/`);
            if (response.ok) {
              console.log(`✅ Django server ready on port ${expectedPort}`);
              resolve(expectedPort);
              return;
            }
          } catch (error) {
            // Server not ready yet, continue checking
          }
          
          setTimeout(checkConnection, 500);
        };
        checkConnection();
      });
    } else {
      // In production, read from port file
      let portFilePath: string;
      const backendPath = this.getBackendPath();
      portFilePath = path.join(path.dirname(backendPath), 'server_port.txt');
      
      console.log('Looking for port file at:', portFilePath);
      const startTime = Date.now();

      return new Promise((resolve, reject) => {
        const checkFile = () => {
          if (Date.now() - startTime > timeout) {
            reject(new Error('Timeout waiting for server port file'));
            return;
          }

          if (fs.existsSync(portFilePath)) {
            try {
              const port = parseInt(fs.readFileSync(portFilePath, 'utf8').trim());
              if (!isNaN(port) && port > 0) {
                resolve(port);
                return;
              }
            } catch {
              // File exists but not readable yet, continue checking
            }
          }
          
          // Check for error file
          const errorFilePath = path.join(path.dirname(portFilePath), 'server_error.txt');
          if (fs.existsSync(errorFilePath)) {
            try {
              const errorContent = fs.readFileSync(errorFilePath, 'utf8');
              reject(new Error(`Django server failed: ${errorContent}`));
              return;
            } catch {
              // Ignore error reading error file
            }
          }
          
          setTimeout(checkFile, 100);
        };
        checkFile();
      });
    }
  }

  async startBackend(): Promise<{ port: number; url: string }> {
    if (this.config.isRunning) {
      return {
        port: this.config.port,
        url: `http://127.0.0.1:${this.config.port}`,
      };
    }

    try {
      // Clean up any existing process first
      await this.stopBackend();

      const isDev = process.env.NODE_ENV === 'development';
      const backendPath = this.getBackendPath();

      console.log('Starting Django backend...', { isDev, backendPath });

      // Ensure we're in the right directory
      const cwd = isDev ? path.join(process.cwd(), 'backend') : path.dirname(backendPath);
      
      if (isDev) {
        // In development, run the combined server (Django + gRPC)
        this.config.process = spawn('python', ['combined_server.py'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: cwd,
          env: { ...process.env, PYTHONUNBUFFERED: '1' },
        });
      } else {
        // In production, run the executable
        this.config.process = spawn(backendPath, [], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: cwd,
        });
      }

      let errorOutput = '';

      // Handle process events
      this.config.process.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log(`Django stdout: ${output}`);
      });

      this.config.process.stderr?.on('data', (data) => {
        const output = data.toString();
        console.error(`Django stderr: ${output}`);
        errorOutput += output;
      });

      this.config.process.on('close', (code) => {
        console.log(`Django process exited with code ${code}`);
        if (errorOutput) {
          console.error('Django process error output:', errorOutput);
        }
        this.config.isRunning = false;
        this.config.process = null;
      });

      this.config.process.on('error', (error) => {
        console.error('Failed to start Django process:', error);
        this.config.isRunning = false;
        this.config.process = null;
        throw error;
      });

      // Wait for the server to start and get the port (with shorter timeout)
      console.log('Waiting for Django server to start...');
      this.config.port = await this.waitForPortFile(10000); // Reduce to 10 seconds
      
      // Give the server a moment to fully initialize
      await new Promise(resolve => setTimeout(resolve, 1000)); // Reduce to 1 second
      
      this.config.isRunning = true;
      console.log(`Django backend started successfully on port ${this.config.port}`);

      return {
        port: this.config.port,
        url: `http://127.0.0.1:${this.config.port}`,
      };
    } catch (error) {
      console.error('Error starting Django backend:', error);
      this.config.isRunning = false;
      this.config.process = null;
      throw error;
    }
  }

  async stopBackend(): Promise<void> {
    if (this.config.process && this.config.isRunning) {
      console.log('Stopping Django backend...');
      this.config.process.kill('SIGTERM');
      
      // Wait a bit for graceful shutdown
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // Force kill if still running
      if (this.config.process && !this.config.process.killed) {
        this.config.process.kill('SIGKILL');
      }
      
      this.config.isRunning = false;
      this.config.process = null;
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.config.isRunning) {
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`http://127.0.0.1:${this.config.port}/api/health/`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('Backend health check failed:', error);
      return false;
    }
  }

  getBackendUrl(): string | null {
    if (this.config.isRunning) {
      return `http://127.0.0.1:${this.config.port}`;
    }
    return null;
  }

  isBackendRunning(): boolean {
    return this.config.isRunning;
  }
}

// Export singleton instance
export const backendManager = new BackendManager();

// Convenience functions
export async function startDjangoBackend() {
  return await backendManager.startBackend();
}

export async function stopDjangoBackend() {
  return await backendManager.stopBackend();
}

export async function getBackendUrl() {
  return backendManager.getBackendUrl();
}

export async function isBackendHealthy() {
  return await backendManager.healthCheck();
} 