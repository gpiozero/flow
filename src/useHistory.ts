import { useCallback, useRef, useState } from 'react';
import type { Edge } from '@xyflow/react';
import type { DeviceFlowNode } from './types';

export interface HistorySnapshot {
  nodes: DeviceFlowNode[];
  edges: Edge[];
}

const HISTORY_LIMIT = 100;
// A burst of commits sharing the same group key (e.g. every keystroke
// in one text field) within this window collapses onto the snapshot
// from the start of the burst, so undoing a retyped name or param
// takes one step rather than one per character.
const COALESCE_MS = 500;

/**
 * Undo/redo over the canvas's nodes/edges. `commit()` must be called
 * with the state as it stands *before* a structural mutation (add,
 * remove, connect, param/name edit, ...) - interactive/simulation
 * state (button presses, pot levels) is deliberately not tracked here.
 */
export function useHistory(nodes: DeviceFlowNode[], edges: Edge[]) {
  // always-current refs so commit/undo/redo stay referentially stable
  // (no nodes/edges dependency) while still reading the latest state
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const past = useRef<HistorySnapshot[]>([]);
  const future = useRef<HistorySnapshot[]>([]);
  const lastCommitAt = useRef(0);
  const lastGroupKey = useRef<string | null>(null);
  // guards against one user action pushing twice in the same tick, e.g.
  // deleting a node cascades a 'remove' change to its edges alongside it
  const settledTick = useRef(true);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const commit = useCallback((groupKey?: string) => {
    if (!settledTick.current) return;
    settledTick.current = false;
    queueMicrotask(() => {
      settledTick.current = true;
    });

    const now = performance.now();
    const coalesces =
      groupKey !== undefined &&
      groupKey === lastGroupKey.current &&
      now - lastCommitAt.current < COALESCE_MS;
    lastCommitAt.current = now;
    lastGroupKey.current = groupKey ?? null;
    if (coalesces) return;

    future.current = [];
    past.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    if (past.current.length > HISTORY_LIMIT) past.current.shift();
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const reset = useCallback(() => {
    past.current = [];
    future.current = [];
    lastGroupKey.current = null;
    lastCommitAt.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  const undo = useCallback((): HistorySnapshot | null => {
    const prev = past.current.pop();
    if (!prev) return null;
    lastGroupKey.current = null;
    future.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    setCanUndo(past.current.length > 0);
    setCanRedo(true);
    return prev;
  }, []);

  const redo = useCallback((): HistorySnapshot | null => {
    const next = future.current.pop();
    if (!next) return null;
    lastGroupKey.current = null;
    past.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    setCanUndo(true);
    setCanRedo(future.current.length > 0);
    return next;
  }, []);

  return { commit, undo, redo, reset, canUndo, canRedo };
}
