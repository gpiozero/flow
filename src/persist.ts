import type { Edge } from '@xyflow/react';
import { SPECS } from './catalog';
import type { DeviceFlowNode } from './types';

/**
 * Canvas persistence: nodes and edges saved to localStorage on every
 * change (debounced in App), restored on load. Only the durable parts
 * travel — id, position and data for nodes, endpoints for edges —
 * so runtime flags like `selected` never stick.
 */

const KEY = 'gpio-webapp.canvas';

interface SavedCanvas {
  nodes: { id: string; position: { x: number; y: number }; data: DeviceFlowNode['data'] }[];
  edges: { id: string; source: string; target: string }[];
}

export function loadCanvas(): { nodes: DeviceFlowNode[]; edges: Edge[] } {
  const empty = { nodes: [], edges: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const saved = JSON.parse(raw) as Partial<SavedCanvas>;
    if (!Array.isArray(saved.nodes) || !Array.isArray(saved.edges)) return empty;
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
  } catch {
    return empty;
  }
}

export function saveCanvas(nodes: DeviceFlowNode[], edges: Edge[]): void {
  const saved: SavedCanvas = {
    nodes: nodes.map((n) => ({ id: n.id, position: n.position, data: n.data })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
  localStorage.setItem(KEY, JSON.stringify(saved));
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
