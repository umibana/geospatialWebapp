import { exposeThemeContext } from "./theme/theme-context";
import { exposeWindowContext } from "./window/window-context";
import { exposeBackendContext } from "./backend/backend-context";
import { exposeAutoGrpcContext } from "../../grpc-auto/auto-context";

export default function exposeContexts() {
  exposeWindowContext();
  exposeThemeContext();
  exposeBackendContext();
  exposeAutoGrpcContext();
}
