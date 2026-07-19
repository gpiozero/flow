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
 *
 * Deleting a canvas moves it to a short-lived trash (TRASH_TTL_MS)
 * rather than dropping it immediately, so an accidental delete is
 * recoverable without a confirm dialog. Expired entries are swept out
 * whenever the store is read.
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

interface TrashEntry {
  canvas: SavedCanvas;
  deletedAt: number;
}

interface CanvasStore {
  current: string;
  canvases: Record<string, SavedCanvas>;
  trash: Record<string, TrashEntry>;
}

export const TRASH_TTL_MS = 24 * 60 * 60 * 1000;

/** Drop trash entries past their TTL; returns whether anything changed */
function pruneTrash(trash: Record<string, TrashEntry>): boolean {
  const now = Date.now();
  let pruned = false;
  for (const [name, entry] of Object.entries(trash)) {
    if (now - entry.deletedAt > TRASH_TTL_MS) {
      delete trash[name];
      pruned = true;
    }
  }
  return pruned;
}

function readStore(): CanvasStore {
  let store: CanvasStore | null = null;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CanvasStore>;
      if (parsed && typeof parsed.canvases === 'object' && parsed.canvases !== null) {
        const canvases = parsed.canvases;
        const trash =
          typeof parsed.trash === 'object' && parsed.trash !== null ? parsed.trash : {};
        const names = Object.keys(canvases);
        const current =
          typeof parsed.current === 'string' && parsed.current in canvases
            ? parsed.current
            : names[0] ?? DEFAULT_CANVAS;
        store = { current, canvases, trash };
      }
    }
  } catch {
    // unreadable store: fall through to legacy/empty
  }
  if (!store) {
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const saved = JSON.parse(legacy) as SavedCanvas;
        store = { current: DEFAULT_CANVAS, canvases: { [DEFAULT_CANVAS]: saved }, trash: {} };
      }
    } catch {
      // unreadable legacy canvas: start empty
    }
  }
  if (!store) store = { current: DEFAULT_CANVAS, canvases: {}, trash: {} };
  if (pruneTrash(store.trash)) writeStore(store);
  return store;
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

/**
 * Move a canvas to the trash (see TRASH_TTL_MS); current falls back to
 * the first remaining name. An empty canvas has nothing worth
 * recovering, so it's dropped outright instead of trashed.
 */
export function deleteCanvas(name: string): void {
  const store = readStore();
  const canvas = store.canvases[name];
  if (!canvas) return;
  delete store.canvases[name];
  if (canvas.nodes.length > 0) {
    store.trash[name] = { canvas, deletedAt: Date.now() };
  }
  if (store.current === name) {
    store.current = Object.keys(store.canvases)[0] ?? DEFAULT_CANVAS;
  }
  writeStore(store);
}

export interface TrashedCanvas {
  name: string;
  deletedAt: number;
}

/** Trashed canvases, most recently deleted first */
export function listTrash(): TrashedCanvas[] {
  const { trash } = readStore();
  return Object.entries(trash)
    .map(([name, entry]) => ({ name, deletedAt: entry.deletedAt }))
    .sort((a, b) => b.deletedAt - a.deletedAt);
}

/**
 * Bring a trashed canvas back; renamed with a "(restored)" suffix if
 * its name has since been reused. Returns the name it was restored
 * under, or null if it had already expired out of the trash.
 */
export function restoreCanvas(name: string): string | null {
  const store = readStore();
  const entry = store.trash[name];
  if (!entry) return null;
  delete store.trash[name];
  let restoredName = name;
  if (restoredName in store.canvases) {
    restoredName = `${name} (restored)`;
    for (let i = 2; restoredName in store.canvases; i++) {
      restoredName = `${name} (restored ${i})`;
    }
  }
  store.canvases[restoredName] = entry.canvas;
  writeStore(store);
  return restoredName;
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
