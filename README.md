# Aplicación Geoespacial de Escritorio

Aplicación de alto rendimiento construida con Electron + React (renderer), un backend Python gRPC y una selección inteligente de procesamiento (Worker Threads vs Worker Stream) para manejar datasets masivos sin bloquear la UI.

## Visión General de la Arquitectura

Procesos y responsabilidades:
- Proceso Principal (Electron): gestiona la ventana, ciclo de vida del backend, cliente gRPC y Worker Threads para procesamiento pesado.
- Preload (contextBridge): expone `window.grpc` tipado y funciones auxiliares; desacopla Renderer del entorno Node.
- Renderer (React): consume `window.grpc` y muestra resultados/progreso.
- Backend (Python gRPC): genera/entrega datos en streaming por chunks.

Flujo simplificado:
1) Renderer llama a `window.grpc.getBatchDataOptimized(...)`.
2) Preload decide la estrategia por umbral: `<50K` → worker_stream; `≥50K` → worker_threads.
3) Main usa el cliente gRPC para obtener chunks y procesa en Worker Threads (reservoir sampling + estadísticas). Progreso coalescido (~100ms).
4) La respuesta final incluye solo metadatos del gráfico; los datos completos del gráfico se solicitan por chunks vía IPC para evitar bloqueos.

## Tecnologías Clave
- Electron 36, React 19, TypeScript 5, Vite.
- gRPC con `@grpc/grpc-js` (cliente en Main) y Python gRPC (servidor).
- TailwindCSS + shadcn/ui para UI moderna.
- Worker Threads (Node.js) para procesamiento paralelo real.

## Estructura del Proyecto (resumen)
```plaintext
src/
  components/           # UI (incluye GrpcDemo y ChildProcessVisualization)
  helpers/
    backend_helpers.ts  # Ciclo de vida del backend gRPC (arranque/paro)
    mainProcessWorker.ts# Lógica Worker Threads (procesamiento pesado)
    ipc/                # Canales y listeners IPC (backend/theme/window)
  grpc-auto/
    auto-main-client.ts # Cliente gRPC del proceso principal
  lib/types.ts          # Tipos compartidos (OptimizedResult, progress, etc.)
  preload.ts            # Puente seguro: expone window.grpc tipado
main.ts                 # Entrada del proceso principal (IPC + coalescer)
backend/                # Servidor Python gRPC
```

## Puente Preload (API pública)
`window.grpc` expone métodos seguros (tipados en `src/lib/types.ts`):
- `healthCheck()`
- `helloWorld({ message })`
- `echoParameter({ value, operation })`
- `getFeatures({ bounds, featureTypes, limit })`
- `getBatchDataOptimized(bounds, dataTypes, maxPoints, resolution?, onProgress?, onChunkData?, options?)`
  - Devuelve `OptimizedResult` con `strategy: 'worker_stream' | 'worker_threads'`.
  - Para `worker_stream`: incluye `totalProcessed`, `processingTime`, `summary`, `dataSample?`.
  - Para `worker_threads`: incluye `stats` (totalProcessed, pointsPerSecond, etc.) y `chartConfig` (metadatos + data luego via chunks).

Progreso: se entrega como `{ processed, total, percentage, phase }` y está amortiguado en preload (~100ms). En el main también hay coalescing para `grpc-child-process-progress`.

## Uso en Renderer (ejemplos)
```ts
// Selección automática (recomendada)
const result = await window.grpc.getBatchDataOptimized(
  bounds,
  ['elevation'],
  120_000, // ≥ 50K ⇒ Worker Threads
  20,
  (p) => setProgress(p.percentage)
);

// Utilidades para tratar resultados de forma uniforme
import { extractTotalProcessed, extractProcessingTimeSeconds, extractPointsPerSecond } from '@/lib/types';
const total = extractTotalProcessed(result);
const secs = extractProcessingTimeSeconds(result);
const pps  = extractPointsPerSecond(result);
```

## Desarrollo
```bash
npm install
npm run setup:backend   # Python deps del backend
npm run dev             # Inicia backend + frontend con generación de protos
```
Scripts útiles:
- `npm start` (solo app Electron)
- `npm run dev:backend` (solo backend Python)
- `npm run generate:protos` (regenera protos TS + Python)
- `npm run build:backend` (PyInstaller)
- `npm run make` (paquetes)

## Empaquetado y Distribución (macOS / Windows / Linux)

Requisitos previos:
- macOS: Xcode Command Line Tools instaladas (para firmar si aplica). Para `.dmg` basta con `npm run make`.
- Windows: Visual Studio Build Tools + `windows-build-tools` si fuese necesario; `npm run make` genera instaladores Squirrel (`.exe`).
- Linux: Paquetes de empaquetado (`dpkg`, `rpm`) según distro.

Comandos típicos:
```bash
# 1) Construir backend Python (PyInstaller)
npm run build:backend

# 2) Empaquetar aplicación Electron para tu plataforma
npm run make

# 3) (Opcional) Solo empaquetar sin instaladores
npm run package
```

Salidas habituales:
- macOS: `out/make/zip/darwin/x64/*.zip` y/o `out/make/*.dmg` (según maker configurado).
- Windows: `out/make/squirrel.windows/*.exe` (instalador Squirrel) y `out/*-win32-*` (carpetas empaquetadas).
- Linux: `out/make/*.deb`, `out/make/*.rpm` según makers habilitados.

Notas:
- Si necesitas firmar binarios, usa Electron Forge Fuses/Code Signing según tu plataforma.
- Si cambias `main.ts`/`preload.ts`, vuelve a ejecutar `npm run make`.

## Cómo extender con nuevas funciones pesadas
1) Backend (Python): añade `GetXyzDataStreamed(request)` devolviendo chunks.
2) Cliente gRPC (main): agrega `autoMainGrpcClient.getXyzDataStreamed(request)` copiando el patrón de `getBatchDataStreamed`.
3) Main IPC: crea handler `grpc-start-xyz-child-process-stream` que:
   - Obtenga chunks (gRPC)
   - Normalice a `{ data_points: [...] }` si es necesario
   - Llame a `MainProcessWorker.getInstance().processLargeDataset(chunks, requestId, onProgress)`
   - Envíe progreso (coalescer) y final solo con metadatos; datos del gráfico vía `grpc-get-chart-data` por chunks.
4) Preload: añade `getXyzDataChildProcessStreamed` y `getXyzDataOptimized` (umbral configurable).
5) Renderer: usa solo `getXyzDataOptimized`, mostrando `strategy` y métricas.

Notas para Worker genérico:
- Entrada esperada: `chunks[]` con `data_points: { location{lat,lng}, value, unit, metadata }`.
- Salida: `{ stats, chartConfig }` con reservoir sampling (≤ 10k puntos).
- Para otros tipos (heatmap/line), añade una opción `mode` y mapea a la estructura de gráfico adecuada sin cambiar el armazón.

## Regenerar Protocol Buffers tras cambios de esquema

Cuando edites `.proto` (por ejemplo `protos/*.proto`), regenera los stubs TS/Python:

```bash
# Genera stubs TS (renderer/main) y Python (backend)
npm run generate:protos

# (Opcional) Solo frontend
npm run generate:protos:frontend

# (Opcional) Solo backend
npm run generate:protos:backend
```

Consejos:
- Reinicia la app tras generar protos (`Ctrl+C` y `npm run dev` de nuevo).
- Si añades nuevos servicios/mensajes, actualiza preload (`src/preload.ts`) y tipos (`src/lib/types.ts`) si aplica.
- Verifica compatibilidad de versiones de `@grpc/grpc-js` y `grpc_tools` en `backend/requirements.txt`.

## Rendimiento y Estabilidad
- Progreso coalescido (main) y amortiguado (preload) para reducir tráfico IPC.
- Backpressure sencillo en streaming gRPC para evitar sobre-bufering.
- Carga del backend con espera por socket (exponencial), apagado con SIGTERM/SIGKILL.

## Seguridad
- Context Isolation activo.
- Renderer sin acceso directo a Node/gRPC.
- Toda comunicación con backend vía IPC segura.

## Licencia
MIT.
