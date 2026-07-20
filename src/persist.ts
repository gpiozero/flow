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

/** A fresh name off `base`: `base`, then `base 2`, `base 3`, … */
export function untitledCanvasName(existing: readonly string[], base = DEFAULT_CANVAS): string {
  if (!existing.includes(base)) return base;
  for (let i = 2; ; i++) {
    const name = `${base} ${i}`;
    if (!existing.includes(name)) return name;
  }
}

interface SavedCanvas {
  nodes: {
    id: string;
    position: { x: number; y: number };
    data: {
      // spelled out field-by-field, not Omit<DeviceFlowNode['data'], 'state'>:
      // DeviceData extends Record<string, unknown>, so its index signature
      // collapses keyof to `string` and Omit degenerates to `{}`
      kind: DeviceFlowNode['data']['kind'];
      name?: DeviceFlowNode['data']['name'];
      params: DeviceFlowNode['data']['params'];
      // optional here only: a share link without it falls back to the
      // node's catalog default, filled in on load by fromSaved
      state?: DeviceFlowNode['data']['state'];
    };
  }[];
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

/**
 * Whether a value is even shaped like a SavedCanvas — distinct from
 * "shaped right but happens to have zero nodes", so a malformed import
 * (e.g. JSON that isn't from this app at all) can be told apart from a
 * legitimately empty one and rejected with a warning instead of
 * silently landing as a blank canvas.
 */
function isSavedCanvasShape(value: unknown): value is SavedCanvas {
  const v = value as Partial<SavedCanvas> | null | undefined;
  return !!v && Array.isArray(v.nodes) && Array.isArray(v.edges);
}

/** Validate and coerce a possibly-untrusted SavedCanvas-shaped value */
function fromSaved(saved: unknown): { nodes: DeviceFlowNode[]; edges: Edge[] } {
  if (!isSavedCanvasShape(saved)) return { nodes: [], edges: [] };
  const s = saved;
  const nodes: DeviceFlowNode[] = s.nodes
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
    .map((n) => ({
      id: n.id,
      type: 'device' as const,
      position: n.position,
      data: { ...n.data, state: n.data.state ?? { ...(SPECS[n.data.kind].initialState ?? {}) } },
    }));
  const ids = new Set(nodes.map((n) => n.id));
  const edges: Edge[] = s.edges
    .filter(
      (e) =>
        e && typeof e.id === 'string' && ids.has(e.source) && ids.has(e.target),
    )
    .map((e) => ({ id: e.id, source: e.source, target: e.target, type: 'wire' }));
  return { nodes, edges };
}

export function loadCanvas(name: string): { nodes: DeviceFlowNode[]; edges: Edge[] } {
  return fromSaved(readStore().canvases[name]);
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

/**
 * Sharing a canvas via URL: the SavedCanvas JSON, deflate-compressed
 * and then base64url-encoded into a `#canvas=` fragment (a fragment,
 * not a query param, so it never reaches a server's access logs).
 * Still a hard ceiling — no backend storage — but compression buys
 * several times the node count before SHARE_TOO_LARGE kicks in, since
 * this JSON's repeated keys (`kind`, `position`, `params`, …) compress
 * well. CompressionStream/DecompressionStream are Promise-based, so
 * encoding and decoding a share link are both async.
 */
export const SHARE_PARAM_LIMIT = 1800;
export const SHARE_TOO_LARGE = Symbol('canvas too large to share via URL');

async function deflateToBase64Url(s: string): Promise<string> {
  const bytes = new TextEncoder().encode(s);
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = '';
  for (const b of compressed) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function inflateFromBase64Url(param: string): Promise<string> {
  const padded = param.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + '='.repeat(pad));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const decompressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return new TextDecoder().decode(decompressed);
}

/**
 * The share payload for nodes/edges, as plain JSON — always produced
 * regardless of length, so the UI can show a size readout even when
 * the URL form is over the limit, and so it can be copied raw as a
 * fallback for canvases too big for a link. `includeState` false drops
 * each node's interactive state from the payload entirely (e.g. a
 * pressed button un-presses) rather than carrying the sender's
 * in-progress simulation across the link; fromSaved fills it back in
 * with the node's catalog default on load. `pretty` indents for human
 * reading (Copy raw JSON, Download JSON); the compressed link form
 * always passes false to keep the pre-compression payload compact.
 */
export function buildShareJson(
  nodes: DeviceFlowNode[],
  edges: Edge[],
  includeState: boolean,
  pretty = false,
): string {
  const saved: SavedCanvas = {
    nodes: nodes.map((n) => {
      if (includeState) return { id: n.id, position: n.position, data: n.data };
      const { state: _state, ...rest } = n.data;
      return { id: n.id, position: n.position, data: rest };
    }),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
  return JSON.stringify(saved, null, pretty ? 2 : undefined);
}

/** Compressed, base64url-encoded form of buildShareJson, for the `#canvas=` link and its length check */
export function buildShareParam(
  nodes: DeviceFlowNode[],
  edges: Edge[],
  includeState: boolean,
): Promise<string> {
  return deflateToBase64Url(buildShareJson(nodes, edges, includeState));
}

/** Encode nodes/edges for a share link; SHARE_TOO_LARGE if it won't fit a URL */
export async function encodeSharedCanvas(
  nodes: DeviceFlowNode[],
  edges: Edge[],
  includeState: boolean,
): Promise<string | typeof SHARE_TOO_LARGE> {
  const encoded = await buildShareParam(nodes, edges, includeState);
  return encoded.length > SHARE_PARAM_LIMIT ? SHARE_TOO_LARGE : encoded;
}

/** Decode a `#canvas=` payload; null if it's missing, malformed, or unparseable */
export async function decodeSharedCanvas(
  param: string,
): Promise<{ nodes: DeviceFlowNode[]; edges: Edge[] } | null> {
  try {
    const parsed: unknown = JSON.parse(await inflateFromBase64Url(param));
    return isSavedCanvasShape(parsed) ? fromSaved(parsed) : null;
  } catch {
    return null;
  }
}

/** Import a canvas from pasted raw JSON (the `buildShareJson` shape); null if unparseable */
export function importSharedJson(json: string): { nodes: DeviceFlowNode[]; edges: Edge[] } | null {
  try {
    const parsed: unknown = JSON.parse(json);
    return isSavedCanvasShape(parsed) ? fromSaved(parsed) : null;
  } catch {
    return null;
  }
}
