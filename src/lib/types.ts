// Electron API types
import type { GrpcContext } from '../helpers/ipc/grpc/grpc-context';

declare global {
  interface Window {
    electronGrpc: GrpcContext;
    electronBackend: {
      getBackendUrl: () => Promise<string>;
    };
  }
}