import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Edge } from '@xyflow/react';
import {
  SHARE_PARAM_LIMIT,
  SHARE_TOO_LARGE,
  buildShareJson,
  buildShareParam,
  encodeSharedCanvas,
  importSharedJson,
  nextIdCounter,
  untitledCanvasName,
} from './persist';
import type { CanvasStoreApi, TrashedCanvas } from './persist';
import type { DeviceFlowNode } from './types';

export interface ExportPreview {
  title: string;
  content: string;
  defaultFilename: string;
  extension: string;
  mimeType: string;
  /** module names a filename mustn't collide with, e.g. ['signal', 'gpiozero'] for a .py export */
  reservedNames?: string[];
}

/** A canvas name, trimmed to characters safe to use verbatim as a filename stem */
export function sanitizeFilename(name: string): string {
  return name.trim().replace(/[^a-z0-9_-]+/gi, '_') || 'canvas';
}

/**
 * Named-canvas management (switch/new/rename/delete/trash, autosave,
 * share link/JSON export/import) bound to a given CanvasStoreApi and a
 * given nodes/edges state. Used once for the Simulator/Live canvas and
 * once for Playground's own, separate canvas store — the two never mix.
 * Python export isn't included here since Playground doesn't offer it;
 * the Simulator/Live side wires its own `downloadPython` alongside this.
 */
export function useCanvasManager(params: {
  store: CanvasStoreApi;
  nodes: DeviceFlowNode[];
  edges: Edge[];
  setNodes: Dispatch<SetStateAction<DeviceFlowNode[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  setSelectedId: (id: string | null) => void;
  idCounterRef: MutableRefObject<number>;
  historyReset: () => void;
  simReset: () => void;
  showWarning: (message: string) => void;
  setExportPreview: (preview: ExportPreview | null) => void;
}) {
  const {
    store,
    nodes,
    edges,
    setNodes,
    setEdges,
    setSelectedId,
    idCounterRef,
    historyReset,
    simReset,
    showWarning,
    setExportPreview,
  } = params;

  const [canvasName, setCanvasName] = useState(store.currentCanvasName);
  const [canvasList, setCanvasList] = useState(store.listCanvases);
  const [trash, setTrash] = useState<TrashedCanvas[]>(store.listTrash);

  useEffect(() => {
    const timer = setTimeout(() => store.saveCanvas(canvasName, nodes, edges), 300);
    return () => clearTimeout(timer);
  }, [store, canvasName, nodes, edges]);

  // Trashed canvases expire on their own (see persist.ts); poll now and
  // then occasionally so a long-idle tab's trash badge/list still
  // reflects entries that have aged out.
  useEffect(() => {
    const interval = setInterval(() => setTrash(store.listTrash()), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [store]);

  // Make a stored canvas the one on screen: fresh simulation state and
  // id counter, nothing selected, and it becomes the current canvas.
  // Undo history is per-canvas, so switching away resets it.
  const applyCanvas = useCallback(
    (name: string) => {
      historyReset();
      const loaded = store.loadCanvas(name);
      simReset();
      idCounterRef.current = nextIdCounter(loaded.nodes);
      setNodes(loaded.nodes);
      setEdges(loaded.edges);
      setSelectedId(null);
      setCanvasName(name);
      store.setCurrentCanvas(name);
      setCanvasList(store.listCanvases());
    },
    [store, setNodes, setEdges, setSelectedId, idCounterRef, historyReset, simReset],
  );

  // Switching saves the outgoing canvas first, so the debounced
  // autosave being cancelled can't lose its last edits.
  const switchCanvas = useCallback(
    (name: string) => {
      if (name === canvasName) return;
      store.saveCanvas(canvasName, nodes, edges);
      applyCanvas(name);
    },
    [store, canvasName, nodes, edges, applyCanvas],
  );

  // A new canvas starts as "untitled canvas" (numbered if taken); the
  // picker selects the name so typing immediately renames it.
  const newCanvas = useCallback(() => {
    const name = untitledCanvasName(store.listCanvases());
    store.saveCanvas(canvasName, nodes, edges);
    store.saveCanvas(name, [], []);
    applyCanvas(name);
  }, [store, canvasName, nodes, edges, applyCanvas]);

  // Rename the current canvas to whatever was typed in the picker;
  // refused (with a toast) only when the name is already taken.
  const renameCurrentCanvas = useCallback(
    (name: string): boolean => {
      if (store.listCanvases().includes(name)) {
        showWarning(`A canvas named "${name}" already exists`);
        return false;
      }
      store.saveCanvas(canvasName, nodes, edges);
      store.renameCanvas(canvasName, name);
      setCanvasName(name);
      setCanvasList(store.listCanvases());
      return true;
    },
    [store, canvasName, nodes, edges, showWarning],
  );

  // No confirm dialog: the canvas lands in the trash (see persist.ts)
  // rather than being dropped immediately, so an accidental click is
  // recoverable — the trash button next to Delete is the way back.
  const deleteCurrentCanvas = useCallback(() => {
    store.deleteCanvas(canvasName);
    applyCanvas(store.currentCanvasName());
    setTrash(store.listTrash());
  }, [store, canvasName, applyCanvas]);

  // Delete any canvas from the switcher dropdown, not just the current
  // one. Deleting the active canvas switches away from it, same as the
  // toolbar's Delete; deleting any other canvas just drops it from the
  // list without disturbing what's on screen.
  const deleteCanvasByName = useCallback(
    (target: string) => {
      store.deleteCanvas(target);
      if (target === canvasName) applyCanvas(store.currentCanvasName());
      else setCanvasList(store.listCanvases());
      setTrash(store.listTrash());
    },
    [store, canvasName, applyCanvas],
  );

  // Bring a trashed canvas back and switch to it, saving the outgoing
  // canvas first like switchCanvas does.
  const restoreFromTrash = useCallback(
    (name: string) => {
      const restored = store.restoreCanvas(name);
      if (!restored) {
        showWarning(`"${name}" already expired from the trash`);
        setTrash(store.listTrash());
        return;
      }
      store.saveCanvas(canvasName, nodes, edges);
      applyCanvas(restored);
      setTrash(store.listTrash());
    },
    [store, canvasName, nodes, edges, applyCanvas, showWarning],
  );

  // Encoded (compressed) share-link size with/without interactive
  // state, so the picker can show a live size readout as the user
  // toggles the option. Compression is async, so this trails a render
  // behind nodes/edges rather than being a plain useMemo.
  const [exportSizeWithState, setExportSizeWithState] = useState(0);
  const [exportSizeWithoutState, setExportSizeWithoutState] = useState(0);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      buildShareParam(nodes, edges, canvasName, true),
      buildShareParam(nodes, edges, canvasName, false),
    ]).then(([withState, withoutState]) => {
      if (cancelled) return;
      setExportSizeWithState(withState.length);
      setExportSizeWithoutState(withoutState.length);
    });
    return () => {
      cancelled = true;
    };
  }, [nodes, edges, canvasName]);

  // Copy a `#canvas=` link encoding the current nodes/edges to the
  // clipboard. The payload is deflate-compressed before base64url —
  // see persist.ts — but a large enough canvas is still refused.
  const exportLink = useCallback(
    async (includeState: boolean) => {
      const encoded = await encodeSharedCanvas(nodes, edges, canvasName, includeState);
      if (encoded === SHARE_TOO_LARGE) {
        showWarning('This canvas is too large to share via a link');
        return;
      }
      const url = `${window.location.origin}${window.location.pathname}#canvas=${encoded}`;
      navigator.clipboard.writeText(url).then(
        () => showWarning('Shareable link copied to clipboard'),
        () => showWarning(url),
      );
    },
    [nodes, edges, canvasName, showWarning],
  );

  // Copy the raw (un-encoded) canvas JSON — no URL length limit, so
  // this is the fallback for a canvas too big to share as a link.
  const exportJson = useCallback(
    (includeState: boolean) => {
      const json = buildShareJson(nodes, edges, canvasName, includeState, true);
      navigator.clipboard.writeText(json).then(
        () => showWarning('Canvas JSON copied to clipboard'),
        () => showWarning('Could not copy to clipboard'),
      );
    },
    [nodes, edges, canvasName, showWarning],
  );

  // "Download JSON" opens a preview modal (same payload as "Copy raw
  // JSON") rather than downloading straight away, so the file can be
  // checked and renamed first.
  const downloadJson = useCallback(
    (includeState: boolean) => {
      setExportPreview({
        title: 'Canvas JSON',
        content: buildShareJson(nodes, edges, canvasName, includeState, true),
        defaultFilename: sanitizeFilename(canvasName),
        extension: '.json',
        mimeType: 'application/json',
      });
    },
    [nodes, edges, canvasName, setExportPreview],
  );

  // Import a canvas from pasted JSON (the counterpart to "copy raw
  // JSON"): lands as a new named canvas, current canvas saved first.
  // Returns whether the paste was valid, so the picker knows to clear
  // its textarea and close.
  const importCanvasJson = useCallback(
    (json: string): boolean => {
      const imported = importSharedJson(json);
      if (!imported) {
        showWarning('That JSON is not a valid canvas');
        return false;
      }
      const name = untitledCanvasName(store.listCanvases(), imported.name || 'imported canvas');
      store.saveCanvas(canvasName, nodes, edges);
      store.saveCanvas(name, imported.nodes, imported.edges);
      applyCanvas(name);
      return true;
    },
    [store, canvasName, nodes, edges, applyCanvas, showWarning],
  );

  return {
    canvasName,
    canvasList,
    trash,
    applyCanvas,
    switchCanvas,
    newCanvas,
    renameCurrentCanvas,
    deleteCurrentCanvas,
    deleteCanvasByName,
    restoreFromTrash,
    exportLink,
    exportJson,
    downloadJson,
    exportSizeWithState,
    exportSizeWithoutState,
    exportLimit: SHARE_PARAM_LIMIT,
    importCanvasJson,
  };
}
