import { exposeThemeContext } from "./theme/theme-context";
import { exposeWindowContext } from "./window/window-context";
import { exposeBackendContext } from "./backend/backend-context";
import { exposeGrpcContext } from "./grpc/grpc-context";

export default function exposeContexts() {
  exposeWindowContext();
  exposeThemeContext();
  exposeBackendContext();
  exposeGrpcContext();
}
