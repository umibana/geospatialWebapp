/// <reference lib="webworker" />

type Row = {
  x?: number;
  y?: number;
  z?: number;
  id?: string;
  metrics?: Record<string, number>;
  attrs?: Record<string, string>;
};

type InitMessage = {
  type: 'init';
  payload: { xKey: 'x' | 'y' | 'z'; yKey: 'x' | 'y' | 'z'; metrics: string[] };
};

type ChunkMessage = { type: 'chunk'; payload: { rows: Row[] } };
type FinalizeMessage = { type: 'finalize' };

type OutProgress = { type: 'progress'; processed: number };
type OutComplete = {
  type: 'complete';
  series: Record<string, Array<[number, number, number, string | undefined]>>; // [x,y,value,id]
  ranges: Record<string, { min: number; max: number }>;
  total: number;
};

let xKey: 'x' | 'y' | 'z' = 'x';
let yKey: 'x' | 'y' | 'z' = 'y';
let metrics: string[] = [];
let processed = 0;
const series: Record<string, Array<[number, number, number, string | undefined]>> = {};
const ranges: Record<string, { min: number; max: number }> = {};

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

self.onmessage = (e: MessageEvent<InitMessage | ChunkMessage | FinalizeMessage>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    xKey = msg.payload.xKey;
    yKey = msg.payload.yKey;
    metrics = msg.payload.metrics;
    processed = 0;
    for (const m of metrics) {
      series[m] = [];
      ranges[m] = { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY };
    }
    return;
  }

  if (msg.type === 'chunk') {
    const rows = msg.payload.rows || [];
    for (const row of rows) {
      const xv = (row as any)[xKey] as number | undefined;
      const yv = (row as any)[yKey] as number | undefined;
      if (!isFiniteNumber(xv) || !isFiniteNumber(yv)) continue;
      const id = row.id;
      const mMap = row.metrics || {};
      for (const m of metrics) {
        const mv = mMap[m];
        if (!isFiniteNumber(mv)) continue;
        series[m].push([xv, yv, mv, id]);
        const r = ranges[m];
        if (mv < r.min) r.min = mv;
        if (mv > r.max) r.max = mv;
      }
    }
    processed += rows.length;
    const out: OutProgress = { type: 'progress', processed };
    (self as any).postMessage(out);
    return;
  }

  if (msg.type === 'finalize') {
    const out: OutComplete = { type: 'complete', series, ranges, total: processed };
    (self as any).postMessage(out);
    return;
  }
};


