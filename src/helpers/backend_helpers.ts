import { spawn, ChildProcess } from 'child_process';
import path from 'path';

interface BackendConfig {
  process: ChildProcess | null;
  isRunning: boolean;
}

class BackendManager {
  private config: BackendConfig = {
    process: null,
    isRunning: false,
  };

  private getBackendPath(): string {
    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      // In development, use Python directly
      return path.join(process.cwd(), 'backend', 'grpc_server.py');
    } else {
      // In production, use the bundled executable
      const resourcesPath = process.resourcesPath;
      return path.join(resourcesPath, 'grpc-server', 'grpc-server');
    }
  }

  private async waitForGrpcServer(timeout = 10000): Promise<void> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkConnection = () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for gRPC server on port 50077`));
          return;
        }

        // For now, just wait a reasonable amount of time for the server to start
        // The main process will handle gRPC connection testing
        if (Date.now() - startTime > 3000) { // 3 seconds
          console.log(`✅ gRPC server should be ready on port 50077`);
          resolve();
          return;
        }
        
        setTimeout(checkConnection, 500);
      };
      checkConnection();
    });
  }

  async startBackend(): Promise<void> {
    if (this.config.isRunning) {
      return;
    }

    try {
      // Clean up any existing process first
      await this.stopBackend();

      const isDev = process.env.NODE_ENV === 'development';
      const backendPath = this.getBackendPath();

      console.log('Starting gRPC backend...', { isDev, backendPath });

      // Ensure we're in the right directory
      const cwd = isDev ? path.join(process.cwd(), 'backend') : path.dirname(backendPath);
      
      if (isDev) {
        // In development, run the gRPC server directly
        this.config.process = spawn('python', ['grpc_server.py'], {
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
        console.log(`gRPC stdout: ${output}`);
      });

      this.config.process.stderr?.on('data', (data) => {
        const output = data.toString();
        console.error(`gRPC stderr: ${output}`);
        errorOutput += output;
      });

      this.config.process.on('close', (code) => {
        console.log(`gRPC process exited with code ${code}`);
        if (errorOutput) {
          console.error('gRPC process error output:', errorOutput);
        }
        this.config.isRunning = false;
        this.config.process = null;
      });

      this.config.process.on('error', (error) => {
        console.error('Failed to start gRPC process:', error);
        this.config.isRunning = false;
        this.config.process = null;
        throw error;
      });

      // Wait for the gRPC server to start
      console.log('Waiting for gRPC server to start...');
      await this.waitForGrpcServer(15000); // 15 seconds timeout
      
      // Give the server a moment to fully initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.config.isRunning = true;
      console.log(`gRPC backend started successfully on port 50077`);

    } catch (error) {
      console.error('Error starting gRPC backend:', error);
      this.config.isRunning = false;
      this.config.process = null;
      throw error;
    }
  }

  async stopBackend(): Promise<void> {
    if (this.config.process && this.config.isRunning) {
      console.log('Stopping gRPC backend...');
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
    return this.config.isRunning;
  }

  getBackendUrl(): string | null {
    // gRPC doesn't have a URL like REST API, but we can return the server address for reference
    if (this.config.isRunning) {
      return 'grpc://127.0.0.1:50077';
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
export async function startGrpcBackend() {
  return await backendManager.startBackend();
}

export async function stopGrpcBackend() {
  return await backendManager.stopBackend();
}

export async function getBackendUrl() {
  return backendManager.getBackendUrl();
}

export async function isBackendHealthy() {
  return await backendManager.healthCheck();
}