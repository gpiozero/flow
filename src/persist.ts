import type { Edge } from '@xyflow/react';
import { SPECS } from './catalog';
import type { DeviceFlowNode } from './types';

/**
 * Canvas persistence: named canvases in one localStorage blob, plus
 * which one is current. The current canvas is saved on every change
 * (debounced in App) and restored on load; the topbar picker switches
 * between, creates, renames and deletes canvases. Only the durable
 * parts travel — id, position and data for nodes, endpoints for
 * edges — so runtime flags like `selected` never stick.
 */

const STORE_KEY = 'gpio-webapp.canvases';
/** pre-naming key holding a single anonymous canvas */
const LEGACY_KEY = 'gpio-webapp.canvas';

export const DEFAULT_CANVAS = 'untitled canvas';

/** A fresh untitled name: 'untitled canvas', then 'untitled canvas 2', … */
export function untitledCanvasName(existing: readonly string[]): string {
  if (!existing.includes(DEFAULT_CANVAS)) return DEFAULT_CANVAS;
  for (let i = 2; ; i++) {
    const name = `${DEFAULT_CANVAS} ${i}`;
    if (!existing.includes(name)) return name;
  }
}

interface SavedCanvas {
  nodes: { id: string; position: { x: number; y: number }; data: DeviceFlowNode['data'] }[];
  edges: { id: string; source: string; target: string }[];
}

interface CanvasStore {
  current: string;
  canvases: Record<string, SavedCanvas>;
}

function readStore(): CanvasStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CanvasStore>;
      if (parsed && typeof parsed.canvases === 'object' && parsed.canvases !== null) {
        const canvases = parsed.canvases;
        const names = Object.keys(canvases);
        const current =
          typeof parsed.current === 'string' && parsed.current in canvases
            ? parsed.current
            : names[0] ?? DEFAULT_CANVAS;
        return { current, canvases };
      }
    }
  } catch {
    // unreadable store: fall through to legacy/empty
  }
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const saved = JSON.parse(legacy) as SavedCanvas;
      return { current: DEFAULT_CANVAS, canvases: { [DEFAULT_CANVAS]: saved } };
    }
  } catch {
    // unreadable legacy canvas: start empty
  }
  return { current: DEFAULT_CANVAS, canvases: {} };
}

function writeStore(store: CanvasStore): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  localStorage.removeItem(LEGACY_KEY);
}

export function currentCanvasName(): string {
  return readStore().current;
}

/** Saved canvas names, with the (possibly not-yet-saved) current one first */
export function listCanvases(): string[] {
  const store = readStore();
  const names = Object.keys(store.canvases);
  return names.includes(store.current)
    ? names
    : [store.current, ...names];
}

export function setCurrentCanvas(name: string): void {
  const store = readStore();
  store.current = name;
  writeStore(store);
}

export function loadCanvas(name: string): { nodes: DeviceFlowNode[]; edges: Edge[] } {
  const empty = { nodes: [], edges: [] };
  const saved = readStore().canvases[name];
  if (!saved || !Array.isArray(saved.nodes) || !Array.isArray(saved.edges)) return empty;
  const nodes: DeviceFlowNode[] = saved.nodes
    .filter(
      (n) =>
        n &&
        typeof n.id === 'string' &&
        typeof n.position?.x === 'number' &&
        typeof n.position?.y === 'number' &&
        // a kind that has since left the catalog is dropped, not crashed on
        typeof n.data?.kind === 'string' &&
        n.data.kind in SPECS,
    )
    .map((n) => ({ id: n.id, type: 'device', position: n.position, data: n.data }));
  const ids = new Set(nodes.map((n) => n.id));
  const edges: Edge[] = saved.edges
    .filter(
      (e) =>
        e && typeof e.id === 'string' && ids.has(e.source) && ids.has(e.target),
    )
    .map((e) => ({ id: e.id, source: e.source, target: e.target, type: 'wire' }));
  return { nodes, edges };
}

export function saveCanvas(name: string, nodes: DeviceFlowNode[], edges: Edge[]): void {
  const store = readStore();
  store.canvases[name] = {
    nodes: nodes.map((n) => ({ id: n.id, position: n.position, data: n.data })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
  writeStore(store);
}

export function renameCanvas(from: string, to: string): void {
  const store = readStore();
  if (from in store.canvases) {
    store.canvases[to] = store.canvases[from];
    delete store.canvases[from];
  }
  if (store.current === from) store.current = to;
  writeStore(store);
}

/** Remove a canvas; current falls back to the first remaining name */
export function deleteCanvas(name: string): void {
  const store = readStore();
  delete store.canvases[name];
  if (store.current === name) {
    store.current = Object.keys(store.canvases)[0] ?? DEFAULT_CANVAS;
  }
  writeStore(store);
}

/** First id counter value that can't collide with a restored node id */
export function nextIdCounter(nodes: DeviceFlowNode[]): number {
  let max = 0;
  for (const n of nodes) {
    const m = /-(\d+)$/.exec(n.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}
