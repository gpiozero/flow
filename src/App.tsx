import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import type {
  Connection,
  Edge,
  EdgeChange,
  IsValidConnection,
  NodeChange,
  OnSelectionChangeParams,
} from '@xyflow/react';
import type { DragEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import '@xyflow/react/dist/style.css';

import { ConfigPanel } from './components/ConfigPanel';
import { Pinout } from './components/Pinout';
import { DeviceNode } from './components/DeviceNode';
import { HostCombo } from './components/HostCombo';
import { BOARD_MIME, DRAG_MIME, Sidebar } from './components/Sidebar';
import { WireEdge } from './components/WireEdge';
import { generateScript, scriptModules } from './codegen';
import {
  PIN_ASSIGN_ORDER,
  SPECS,
  dynamicPinCount,
  defaultParams,
  defaultState,
  inputShapeOf,
  isDevice,
  nextDeviceName,
  nextFreeChannel,
  nextFreePin,
  outputShapeOf,
  requiredPinParams,
} from './catalog';
import {
  TICK_SECONDS,
  anyChannelActive,
  computeValues,
  createSimState,
  resetNodeState,
} from './simulation';
import { DEFAULT_PORT, liveModeSupported, usePiLink } from './pi';
import { BOARDS } from './boards';
import type { BoardSpec } from './boards';
import { pinDisplay } from './pins';
import type { PinNumbering } from './pins';
import { splitParts } from './split';
import {
  buildShareJson,
  buildShareParam,
  currentCanvasName,
  decodeSharedCanvas,
  deleteCanvas,
  encodeSharedCanvas,
  importSharedJson,
  listCanvases,
  listTrash,
  loadCanvas,
  nextIdCounter,
  renameCanvas,
  restoreCanvas,
  saveCanvas,
  SHARE_PARAM_LIMIT,
  SHARE_TOO_LARGE,
  setCurrentCanvas,
  untitledCanvasName,
} from './persist';
import type { TrashedCanvas } from './persist';
import { CanvasPicker } from './components/CanvasPicker';
import { ExportPreviewModal } from './components/ExportPreviewModal';
import { LiveModeModal } from './components/LiveModeModal';
import { MobileNotice } from './components/MobileNotice';
import { convertParams, convertTarget } from './convert';
import { FlowContext } from './store';
import type { DeviceFlowNode, NodeKind, ParamValue } from './types';
import { useIsMobile } from './useIsMobile';
import { useHistory } from './useHistory';
import type { HistorySnapshot } from './useHistory';

const nodeTypes = { device: DeviceNode };
const edgeTypes = { wire: WireEdge };

const STANDING_HOSTS = ['raspberrypi.local', 'localhost'];

function namesInUse(nodes: DeviceFlowNode[]): Set<string> {
  const names = new Set<string>();
  for (const n of nodes) {
    if (typeof n.data.name === 'string') names.add(n.data.name);
  }
  return names;
}

function channelsInUse(nodes: DeviceFlowNode[]): Set<number> {
  const channels = new Set<number>();
  for (const n of nodes) {
    for (const p of SPECS[n.data.kind].params) {
      if (p.type !== 'channel') continue;
      const channel = n.data.params[p.name];
      if (typeof channel === 'number') channels.add(channel);
    }
  }
  return channels;
}

function pinsInUse(nodes: DeviceFlowNode[]): Set<number> {
  const pins = new Set<number>();
  for (const n of nodes) {
    for (const name of requiredPinParams(n.data.kind, n.data.params)) {
      const pin = n.data.params[name];
      if (typeof pin === 'number') pins.add(pin);
    }
  }
  return pins;
}

/** The payload of a `#canvas=<payload>[&live=1]` fragment left by a share link, if any */
function shareHashParam(): { canvas: string; live: boolean } | null {
  const match = /^#canvas=([^&]+)(&live=1)?$/.exec(window.location.hash);
  return match ? { canvas: match[1], live: Boolean(match[2]) } : null;
}

/** A canvas name, trimmed to characters safe to use verbatim as a filename stem */
function sanitizeFilename(name: string): string {
  return name.trim().replace(/[^a-z0-9_-]+/gi, '_') || 'canvas';
}

interface ExportPreview {
  title: string;
  content: string;
  defaultFilename: string;
  extension: string;
  mimeType: string;
  /** module names a filename mustn't collide with, e.g. ['signal', 'gpiozero'] for a .py export */
  reservedNames?: string[];
}

function Editor() {
  const isMobile = useIsMobile();

  // the current canvas survives reloads: restored once here, saved on
  // change below; the topbar picker switches between named canvases
  const [canvasName, setCanvasName] = useState(currentCanvasName);
  const [canvasList, setCanvasList] = useState(listCanvases);
  const [trash, setTrash] = useState<TrashedCanvas[]>(listTrash);
  const [initialCanvas] = useState(() => loadCanvas(canvasName));
  const [nodes, setNodes, onNodesChange] = useNodesState<DeviceFlowNode>(initialCanvas.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialCanvas.edges);
  const {
    commit: historyCommit,
    undo: historyUndo,
    redo: historyRedo,
    reset: historyReset,
    canUndo,
    canRedo,
  } = useHistory(nodes, edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pinoutOpen, setPinoutOpen] = useState(false);
  // "Download JSON"/"Download Python" open this preview modal rather
  // than downloading straight away, so the file can be checked and
  // renamed first.
  const [exportPreview, setExportPreview] = useState<ExportPreview | null>(null);
  // Pins are stored as BCM ints throughout (params, pin assignment,
  // the Pi wire format); the numbering only changes how they're shown
  // and how generated code spells them (17 vs 'BOARD11').
  const [numbering, setNumbering] = useState<PinNumbering>(() =>
    localStorage.getItem('gpio-webapp.numbering') === 'board' ? 'board' : 'bcm',
  );
  const changeNumbering = useCallback((n: PinNumbering) => {
    localStorage.setItem('gpio-webapp.numbering', n);
    setNumbering(n);
  }, []);
  const [warning, setWarning] = useState<string | null>(null);
  const warningTimer = useRef<number | undefined>(undefined);

  // Transient warning toast for actions that can't be honoured (e.g.
  // dropping a device when there aren't enough free pins for it).
  const showWarning = useCallback((message: string) => {
    setWarning(message);
    window.clearTimeout(warningTimer.current);
    warningTimer.current = window.setTimeout(() => setWarning(null), 5000);
  }, []);

  useEffect(() => () => window.clearTimeout(warningTimer.current), []);

  const { screenToFlowPosition } = useReactFlow();
  const idCounter = useRef(nextIdCounter(initialCanvas.nodes));

  useEffect(() => {
    const timer = setTimeout(() => saveCanvas(canvasName, nodes, edges), 300);
    return () => clearTimeout(timer);
  }, [canvasName, nodes, edges]);

  // Trashed canvases expire on their own (see persist.ts); poll now
  // and then occasionally so a long-idle tab's trash badge/list still
  // reflects entries that have aged out.
  useEffect(() => {
    const interval = setInterval(() => setTrash(listTrash()), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // The simulation clock runs at 10 steps/s whenever a time-based node
  // is on the canvas, or a device's source_delay is long enough that
  // its next source read must be scheduled. Each tick advances
  // artificial sources and stateful tools; recomputes caused by
  // interaction reuse the current step without advancing.
  const simRef = useRef(createSimState());
  const lastTickRef = useRef(-1);
  const [tick, setTick] = useState(0);
  const needsClock = useMemo(
    () =>
      nodes.some(
        (n) =>
          SPECS[n.data.kind].timeBased ||
          Number(n.data.params.source_delay ?? 0) > TICK_SECONDS,
      ),
    [nodes],
  );

  useEffect(() => {
    if (!needsClock) return;
    const interval = setInterval(() => setTick((t) => t + 1), TICK_SECONDS * 1000);
    return () => clearInterval(interval);
  }, [needsClock]);

  const simValues = useMemo(() => {
    const advance = tick !== lastTickRef.current;
    lastTickRef.current = tick;
    if (advance) simRef.current.step++;
    return computeValues(nodes, edges, simRef.current, advance);
  }, [nodes, edges, tick]);

  const pi = usePiLink(nodes, edges, showWarning);
  // ws:// is blocked as mixed content on a page loaded over https — see
  // docs/hosted-deployment.md. The toggle itself stays visible either
  // way; only the connect UI underneath is swapped for an explainer.
  const liveModeAvailable = liveModeSupported();

  // Simulator hides the Pi connection panel entirely; switching away
  // from Live disconnects, so leaving the panel open behind it can't
  // leave a live link running unseen.
  const [mode, setMode] = useState<'simulator' | 'live'>('simulator');
  const changeMode = useCallback(
    (m: 'simulator' | 'live') => {
      setMode(m);
      if (m === 'simulator') {
        if (pi.status !== 'disconnected') pi.disconnect();
        setHighlightConnect(false);
      }
    },
    [pi.status, pi.disconnect],
  );

  // Set when a `&live=1` share link lands us in Live mode already
  // configured — draws the eye to "Connect to Pi" so that final step
  // isn't missed, since everything up to it happened automatically.
  const [highlightConnect, setHighlightConnect] = useState(false);
  const connectToPi = useCallback(() => {
    setHighlightConnect(false);
    pi.connect();
  }, [pi.connect]);

  const connectOnEnter = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && pi.status === 'disconnected') connectToPi();
  };

  // While connected to a Pi, device nodes show real hardware values
  // (tools keep their simulated values — they're anonymous generators
  // on the Pi, so have nothing to report).
  const values = useMemo(
    () => (pi.status === 'connected' ? { ...simValues, ...pi.liveValues } : simValues),
    [simValues, pi.status, pi.liveValues],
  );

  const updateNodeState = useCallback(
    (id: string, patch: Record<string, ParamValue>) => {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, state: { ...n.data.state, ...patch } } } : n,
        ),
      );
    },
    [setNodes],
  );

  const updateNodeName = useCallback(
    (id: string, name: string) => {
      historyCommit(`name:${id}`);
      setNodes((ns) =>
        ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, name } } : n)),
      );
    },
    [setNodes, historyCommit],
  );

  // Changing a dynamic-pin device's count param grows or shrinks its
  // pin1..pinN params, assigning free pins to new entries. The stored
  // count is canonicalised to however many pins could be assigned.
  const updateNodeParam = useCallback(
    (id: string, name: string, value: ParamValue) => {
      historyCommit(`param:${id}:${name}`);
      // new params mean a fresh generator in gpiozero terms: restart
      // the node's queues, delay/filter phases and hysteresis
      resetNodeState(simRef.current, id);
      setNodes((ns) => {
        const usedPins = pinsInUse(ns);
        return ns.map((n) => {
          if (n.id !== id) return n;
          const params = { ...n.data.params, [name]: value };
          if (SPECS[n.data.kind].dynamicPins === name) {
            const wanted = requiredPinParams(n.data.kind, params);
            for (const key of Object.keys(params)) {
              if (/^pin\d+$/.test(key) && !wanted.includes(key)) delete params[key];
            }
            let count = 0;
            for (const key of wanted) {
              if (!(key in params)) {
                const pin = nextFreePin(usedPins);
                if (pin === null) {
                  showWarning(
                    `Not enough free GPIO pins — ${name} capped at ${count}`,
                  );
                  break;
                }
                params[key] = pin;
                usedPins.add(pin);
              }
              count++;
            }
            params[name] = count;
          }
          return { ...n, data: { ...n.data, params } };
        });
      });
    },
    [setNodes, showWarning, historyCommit],
  );

  const flowContext = useMemo(
    () => ({ values, updateNodeState, numbering }),
    [values, updateNodeState, numbering],
  );

  // Setting a device's source replaces any previous source, so single-input
  // targets drop their existing wire when a new one is connected.
  const onConnect = useCallback(
    (conn: Connection) => {
      historyCommit();
      const target = nodes.find((n) => n.id === conn.target);
      const multiInput = target ? SPECS[target.data.kind].multiInput : false;
      setEdges((eds) =>
        addEdge({ ...conn, type: 'wire' }, multiInput ? eds : eds.filter((e) => e.target !== conn.target)),
      );
    },
    [nodes, setEdges, historyCommit],
  );

  // Reject self-connections, shape mismatches (a tuple wire into a
  // scalar input or vice versa) and anything that would create a cycle.
  const isValidConnection: IsValidConnection<Edge> = useCallback(
    (conn) => {
      const { source, target } = conn;
      if (!source || !target || source === target) return false;
      const sourceNode = nodes.find((n) => n.id === source);
      const targetNode = nodes.find((n) => n.id === target);
      if (!sourceNode || !targetNode) return false;
      if (outputShapeOf(sourceNode.data.kind) !== inputShapeOf(targetNode.data.kind)) return false;
      const adjacency = new Map<string, string[]>();
      for (const e of edges) {
        const list = adjacency.get(e.source);
        if (list) list.push(e.target);
        else adjacency.set(e.source, [e.target]);
      }
      const stack = [target];
      const seen = new Set<string>();
      while (stack.length) {
        const id = stack.pop()!;
        if (id === source) return false;
        if (seen.has(id)) continue;
        seen.add(id);
        stack.push(...(adjacency.get(id) ?? []));
      }
      return true;
    },
    [nodes, edges],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Create a node at `position`, either fresh from the catalog or (when
  // duplicating/pasting) seeded with an existing node's params and
  // state. Pins and channels are always assigned fresh from the free
  // pool, and the copy gets its own name; dynamic-pin devices shrink to
  // the available pins rather than refusing (LEDBarGraph works from 1
  // LED up).
  const materialiseNode = useCallback(
    (
      kind: NodeKind,
      position: { x: number; y: number },
      base?: { params: Record<string, ParamValue>; state: Record<string, ParamValue> },
    ) => {
      const params = base ? { ...base.params } : defaultParams(kind);
      const usedPins = pinsInUse(nodes);
      const freePins = PIN_ASSIGN_ORDER.length - usedPins.size;
      const countParam = SPECS[kind].dynamicPins;
      if (countParam && freePins >= 1 && dynamicPinCount(kind, params) > freePins) {
        params[countParam] = freePins;
        showWarning(
          `Only ${freePins} free GPIO pin${freePins === 1 ? '' : 's'} — ` +
            `${SPECS[kind].label} created with ${countParam} = ${freePins}`,
        );
      }
      const neededPins = requiredPinParams(kind, params);
      if (neededPins.length > freePins) {
        showWarning(
          `${SPECS[kind].label} needs ${neededPins.length} free GPIO ` +
            `pin${neededPins.length === 1 ? '' : 's'}, but ` +
            `${freePins === 0 ? 'none are' : freePins === 1 ? 'only 1 is' : `only ${freePins} are`} left`,
        );
        return;
      }
      // drop pin params a copied bar graph no longer needs after shrinking
      if (SPECS[kind].dynamicPins) {
        for (const key of Object.keys(params)) {
          if (/^pin\d+$/.test(key) && !neededPins.includes(key)) delete params[key];
        }
      }
      for (const name of neededPins) {
        const pin = nextFreePin(usedPins);
        if (pin === null) return; // unreachable: checked above
        params[name] = pin;
        usedPins.add(pin);
      }
      // each ADC kind is one chip, so channel pools are per kind
      const usedChannels = channelsInUse(nodes.filter((n) => n.data.kind === kind));
      let channel: number | null = null;
      for (const p of SPECS[kind].params) {
        if (p.type !== 'channel') continue;
        const count = (p.max ?? 7) + 1;
        channel = nextFreeChannel(usedChannels, count);
        if (channel === null) {
          showWarning(
            `${SPECS[kind].label} needs a free ADC channel, but all ${count} are in use`,
          );
          return;
        }
        params[p.name] = channel;
        usedChannels.add(channel);
      }
      // multi-channel ADCs default to e.g. mcp3008_0 so the channel is
      // obvious at a glance; other devices just get the bare kind
      const nameBase = channel !== null ? `${kind}_${channel}` : kind;
      const node: DeviceFlowNode = {
        id: `${kind}-${idCounter.current++}`,
        type: 'device',
        position,
        data: {
          kind,
          ...(isDevice(kind) ? { name: nextDeviceName(nameBase, namesInUse(nodes)) } : {}),
          params,
          state: base ? { ...base.state } : defaultState(kind),
        },
      };
      historyCommit();
      // select the copy: it takes over the selection z-elevation (so it
      // isn't hidden under the still-selected original) and the panel
      if (base) {
        node.selected = true;
        setSelectedId(node.id);
        setNodes((ns) => [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), node]);
      } else {
        setNodes((ns) => [...ns, node]);
      }
    },
    [nodes, setNodes, showWarning, historyCommit],
  );

  // Expand a board recipe: create every component on its fixed pins,
  // or refuse with a warning if any of those pins is already taken —
  // unlike loose components, a board's pins are physically wired.
  const materialiseBoard = useCallback(
    (board: BoardSpec, position: { x: number; y: number }) => {
      const usedPins = pinsInUse(nodes);
      const conflicts = new Set<number>();
      for (const c of board.components) {
        const params = { ...defaultParams(c.kind), ...c.params };
        for (const name of requiredPinParams(c.kind, params)) {
          const pin = Number(params[name]);
          if (usedPins.has(pin)) conflicts.add(pin);
        }
      }
      if (conflicts.size > 0) {
        const pins = [...conflicts]
          .sort((a, b) => a - b)
          .map((p) => pinDisplay(p, numbering))
          .join(', ');
        showWarning(
          `${board.label} needs ${conflicts.size === 1 ? 'pin' : 'pins'} ${pins}, ` +
            `already in use`,
        );
        return;
      }
      const usedNames = namesInUse(nodes);
      const created: DeviceFlowNode[] = board.components.map((c) => {
        const name = nextDeviceName(c.name, usedNames);
        usedNames.add(name);
        return {
          id: `${c.kind}-${idCounter.current++}`,
          type: 'device',
          position: { x: position.x + c.offset.x, y: position.y + c.offset.y },
          data: {
            kind: c.kind,
            name,
            params: { ...defaultParams(c.kind), ...c.params },
            state: defaultState(c.kind),
          },
        };
      });
      historyCommit();
      setNodes((ns) => [...ns, ...created]);
    },
    [nodes, setNodes, showWarning, numbering, historyCommit],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const boardId = e.dataTransfer.getData(BOARD_MIME);
      if (boardId && boardId in BOARDS) {
        materialiseBoard(BOARDS[boardId], position);
        return;
      }
      const kind = e.dataTransfer.getData(DRAG_MIME) as NodeKind | '';
      if (!kind || !(kind in SPECS)) return;
      materialiseNode(kind, position);
    },
    [materialiseNode, materialiseBoard, screenToFlowPosition],
  );

  // Copy/paste: Ctrl/Cmd+C snapshots the selected node, each Ctrl/Cmd+V
  // materialises a copy stepped diagonally from the original. The copy
  // keeps params and interactive state but gets fresh pins and a fresh
  // name, since those must be unique.
  const clipboardRef = useRef<{
    kind: NodeKind;
    params: Record<string, ParamValue>;
    state: Record<string, ParamValue>;
    position: { x: number; y: number };
  } | null>(null);
  const pasteCount = useRef(0);

  const copySelected = useCallback(() => {
    const node = nodes.find((n) => n.id === selectedId);
    if (!node) return;
    clipboardRef.current = {
      kind: node.data.kind,
      params: { ...node.data.params },
      state: { ...node.data.state },
      position: { ...node.position },
    };
    pasteCount.current = 0;
  }, [nodes, selectedId]);

  const pasteClipboard = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip) return;
    const offset = 24 * ++pasteCount.current;
    materialiseNode(
      clip.kind,
      { x: clip.position.x + offset, y: clip.position.y + offset },
      clip,
    );
  }, [materialiseNode]);

  const duplicateNode = useCallback(
    (id: string) => {
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      materialiseNode(
        node.data.kind,
        { x: node.position.x + 24, y: node.position.y + 24 },
        { params: node.data.params, state: node.data.state },
      );
    },
    [nodes, materialiseNode],
  );

  // Convert a node to its related kind (LED <-> PWMLED) in place: same
  // id, so its name, position and wires survive.
  const convertNode = useCallback(
    (id: string) => {
      historyCommit();
      setNodes((ns) =>
        ns.map((n) => {
          if (n.id !== id) return n;
          const target = convertTarget(n.data.kind);
          if (!target) return n;
          return {
            ...n,
            data: {
              ...n.data,
              kind: target,
              params: convertParams(n.data, target),
              state: defaultState(target),
            },
          };
        }),
      );
    },
    [setNodes, historyCommit],
  );

  // Split a multi-device component into its constituent devices on the
  // same pins (TrafficLights -> 3 LEDs). The parent is replaced, so the
  // pins never conflict; its wires can't be meaningfully remapped onto
  // scalar parts, so they're removed (with a note if there were any).
  const splitNode = useCallback(
    (id: string) => {
      const node = nodes.find((n) => n.id === id);
      const parts = node && splitParts(node.data);
      if (!node || !parts) return;
      const usedNames = namesInUse(nodes.filter((n) => n.id !== id));
      const created: DeviceFlowNode[] = parts.map((part, i) => {
        const name = nextDeviceName(`${node.data.name}_${part.suffix}`, usedNames);
        usedNames.add(name);
        return {
          id: `${part.kind}-${idCounter.current++}`,
          type: 'device',
          position: {
            x: node.position.x + Math.floor(i / 5) * 230,
            y: node.position.y + (i % 5) * 130,
          },
          data: {
            kind: part.kind,
            name,
            params: { ...defaultParams(part.kind), ...part.params },
            state: defaultState(part.kind),
          },
        };
      });
      if (edges.some((e) => e.source === id || e.target === id)) {
        showWarning(`Wires to ${node.data.name} were removed`);
      }
      historyCommit();
      setNodes((ns) => [...ns.filter((n) => n.id !== id), ...created]);
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
      setSelectedId(null);
    },
    [nodes, edges, setNodes, setEdges, showWarning, historyCommit],
  );

  // Undo/redo restore a past nodes/edges snapshot; selection is derived
  // from the restored nodes' own `.selected` flags, same as React
  // Flow's own onSelectionChange would report for that state.
  const applyHistorySnapshot = useCallback(
    (snapshot: HistorySnapshot) => {
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      const selected = snapshot.nodes.filter((n) => n.selected);
      setSelectedId(selected.length === 1 ? selected[0].id : null);
    },
    [setNodes, setEdges],
  );

  const undo = useCallback(() => {
    const snapshot = historyUndo();
    if (snapshot) applyHistorySnapshot(snapshot);
  }, [historyUndo, applyHistorySnapshot]);

  const redo = useCallback(() => {
    const snapshot = historyRedo();
    if (snapshot) applyHistorySnapshot(snapshot);
  }, [historyRedo, applyHistorySnapshot]);

  useEffect(() => {
    const liveModalOpen = mode === 'live' && !liveModeAvailable;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || exportPreview || liveModalOpen) return;
      const key = e.key.toLowerCase();
      // Undo/redo take priority over the browser's own per-field undo
      // (e.g. right after typing a name/param) — our history already
      // coalesces a field edit into one step, so this is never worse.
      if (key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }
      if (key === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (key === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      // leave copy/paste alone inside text fields and dropdowns
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable]')) return;
      if (key === 'c') copySelected();
      else if (key === 'v') pasteClipboard();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [copySelected, pasteClipboard, undo, redo, exportPreview, mode, liveModeAvailable]);

  const onSelectionChange = useCallback(({ nodes: selected }: OnSelectionChangeParams) => {
    setSelectedId(selected.length === 1 ? selected[0].id : null);
  }, []);

  // Select a node from outside React Flow (e.g. clicking a pinout pin)
  const selectNode = useCallback(
    (id: string) => {
      setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === id })));
      setSelectedId(id);
    },
    [setNodes],
  );

  // Clearing empties the saved canvas too — it's unrecoverable via the
  // trash, so CanvasPicker confirms with its own popover before calling
  // this; Ctrl+Z still offers a way back in the same session.
  const clearCanvas = useCallback(() => {
    historyCommit();
    setNodes([]);
    setEdges([]);
    setSelectedId(null);
  }, [setNodes, setEdges, historyCommit]);

  // Make a stored canvas the one on screen: fresh simulation state and
  // id counter, nothing selected, and it becomes the current canvas.
  // Undo history is per-canvas, so switching away resets it.
  const applyCanvas = useCallback(
    (name: string) => {
      historyReset();
      const loaded = loadCanvas(name);
      simRef.current = createSimState();
      idCounter.current = nextIdCounter(loaded.nodes);
      setNodes(loaded.nodes);
      setEdges(loaded.edges);
      setSelectedId(null);
      setCanvasName(name);
      setCurrentCanvas(name);
      setCanvasList(listCanvases());
    },
    [setNodes, setEdges, historyReset],
  );

  // A share link is imported as a new named canvas once decoded (async,
  // since the payload is deflate-compressed — see persist.ts); the
  // fragment is scrubbed immediately so a refresh doesn't re-import it
  // or leak it into browser history beyond this one entry. The `&live=1`
  // suffix is how the "Switch to Pi" link (LiveModeModal) asks to land
  // straight in Live mode instead of Simulator.
  useEffect(() => {
    const param = shareHashParam();
    if (!param) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    decodeSharedCanvas(param.canvas).then((imported) => {
      if (!imported) {
        showWarning('This share link is invalid or corrupted');
        return;
      }
      const name = untitledCanvasName(listCanvases(), imported.name || 'shared canvas');
      saveCanvas(name, imported.nodes, imported.edges);
      applyCanvas(name);
      if (param.live) {
        setMode('live');
        setHighlightConnect(true);
      }
      showWarning(`Imported shared canvas as "${name}"`);
    });
    // mount-only
  }, []);

  // Switching saves the outgoing canvas first, so the debounced
  // autosave being cancelled can't lose its last edits.
  const switchCanvas = useCallback(
    (name: string) => {
      if (name === canvasName) return;
      saveCanvas(canvasName, nodes, edges);
      applyCanvas(name);
    },
    [canvasName, nodes, edges, applyCanvas],
  );

  // A new canvas starts as "untitled canvas" (numbered if taken); the
  // picker selects the name so typing immediately renames it.
  const newCanvas = useCallback(() => {
    const name = untitledCanvasName(listCanvases());
    saveCanvas(canvasName, nodes, edges);
    saveCanvas(name, [], []);
    applyCanvas(name);
  }, [canvasName, nodes, edges, applyCanvas]);

  // Rename the current canvas to whatever was typed in the picker;
  // refused (with a toast) only when the name is already taken.
  const renameCurrentCanvas = useCallback(
    (name: string): boolean => {
      if (listCanvases().includes(name)) {
        showWarning(`A canvas named "${name}" already exists`);
        return false;
      }
      saveCanvas(canvasName, nodes, edges);
      renameCanvas(canvasName, name);
      setCanvasName(name);
      setCanvasList(listCanvases());
      return true;
    },
    [canvasName, nodes, edges, showWarning],
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

  // "Download JSON"/"Download Python" open a preview modal (same
  // payload as "Copy raw JSON", or the equivalent gpiozero .py script)
  // rather than downloading straight away, so the file can be checked
  // and renamed first.
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
    [nodes, edges, canvasName],
  );

  const downloadPython = useCallback(() => {
    setExportPreview({
      title: 'Python script',
      content: generateScript(nodes, edges, numbering),
      defaultFilename: sanitizeFilename(canvasName),
      extension: '.py',
      mimeType: 'text/x-python',
      reservedNames: scriptModules(nodes),
    });
  }, [nodes, edges, numbering, canvasName]);

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
      const name = untitledCanvasName(listCanvases(), imported.name || 'imported canvas');
      saveCanvas(canvasName, nodes, edges);
      saveCanvas(name, imported.nodes, imported.edges);
      applyCanvas(name);
      return true;
    },
    [canvasName, nodes, edges, applyCanvas, showWarning],
  );

  // No confirm dialog: the canvas lands in the trash (see persist.ts)
  // rather than being dropped immediately, so an accidental click is
  // recoverable — the trash button next to Delete is the way back.
  const deleteCurrentCanvas = useCallback(() => {
    deleteCanvas(canvasName);
    applyCanvas(currentCanvasName());
    setTrash(listTrash());
  }, [canvasName, applyCanvas]);

  // Delete any canvas from the switcher dropdown, not just the current
  // one. Deleting the active canvas switches away from it, same as the
  // toolbar's Delete; deleting any other canvas just drops it from the
  // list without disturbing what's on screen.
  const deleteCanvasByName = useCallback(
    (target: string) => {
      deleteCanvas(target);
      if (target === canvasName) applyCanvas(currentCanvasName());
      else setCanvasList(listCanvases());
      setTrash(listTrash());
    },
    [canvasName, applyCanvas],
  );

  // Bring a trashed canvas back and switch to it, saving the outgoing
  // canvas first like switchCanvas does.
  const restoreFromTrash = useCallback(
    (name: string) => {
      const restored = restoreCanvas(name);
      if (!restored) {
        showWarning(`"${name}" already expired from the trash`);
        setTrash(listTrash());
        return;
      }
      saveCanvas(canvasName, nodes, edges);
      applyCanvas(restored);
      setTrash(listTrash());
    },
    [canvasName, nodes, edges, applyCanvas, showWarning],
  );

  const onEdgeDoubleClick = useCallback(
    (_: unknown, edge: Edge) => {
      historyCommit();
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    },
    [setEdges, historyCommit],
  );

  // Wires light up while a value is flowing across them.
  const styledEdges = useMemo(
    () =>
      edges.map((e) => {
        const active = anyChannelActive(values[e.source]);
        return {
          ...e,
          animated: active,
          style: { stroke: active ? '#2f9e44' : '#94a3b8', strokeWidth: active ? 2 : 1.5 },
        };
      }),
    [edges, values],
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  // The selected node's incoming wires in channel order (= edge array
  // order, which simulation, codegen and the agent all follow), for
  // the config panel's reorderable inputs list.
  const selectedInputs = useMemo(() => {
    if (!selectedNode) return [];
    return edges
      .filter((e) => e.target === selectedNode.id)
      .map((e) => {
        const src = nodes.find((n) => n.id === e.source);
        return {
          id: e.id,
          label: src ? String(src.data.name ?? SPECS[src.data.kind].label) : '?',
        };
      });
  }, [edges, nodes, selectedNode]);

  // Move one incoming wire up or down among its siblings by swapping
  // the two edges' positions in the global array — their relative
  // order is the only thing simulation/codegen/agent read.
  const moveInput = useCallback(
    (edgeId: string, delta: -1 | 1) => {
      historyCommit();
      setEdges((es) => {
        const edge = es.find((e) => e.id === edgeId);
        if (!edge) return es;
        const siblings = es
          .map((e, index) => ({ e, index }))
          .filter((x) => x.e.target === edge.target);
        const pos = siblings.findIndex((x) => x.e.id === edgeId);
        const other = pos + delta;
        if (other < 0 || other >= siblings.length) return es;
        const next = [...es];
        [next[siblings[pos].index], next[siblings[other].index]] = [
          next[siblings[other].index],
          next[siblings[pos].index],
        ];
        return next;
      });
    },
    [setEdges, historyCommit],
  );

  // Node drags fire a 'position' change on every pointer-move frame;
  // only the one where dragging flips true->false (i.e. the start of a
  // drag, since we want the pre-drag position) should count as an
  // undoable step, not each intermediate frame. Node removal (Delete
  // key, the node's own × button) commits immediately.
  const wasDraggingRef = useRef(false);
  const onNodesChangeWithHistory = useCallback(
    (changes: NodeChange<DeviceFlowNode>[]) => {
      const dragging = changes.some((c) => c.type === 'position' && c.dragging);
      if (changes.some((c) => c.type === 'remove') || (dragging && !wasDraggingRef.current)) {
        historyCommit();
      }
      wasDraggingRef.current = dragging;
      onNodesChange(changes);
    },
    [onNodesChange, historyCommit],
  );

  const onEdgesChangeWithHistory = useCallback(
    (changes: EdgeChange[]) => {
      if (changes.some((c) => c.type === 'remove')) historyCommit();
      onEdgesChange(changes);
    },
    [onEdgesChange, historyCommit],
  );

  // Pins and names used by every node except the selected one, so the
  // config panel can offer only free pins and reject duplicate names.
  const takenPins = useMemo(
    () => pinsInUse(nodes.filter((n) => n.id !== selectedId)),
    [nodes, selectedId],
  );
  const takenNames = useMemo(
    () => namesInUse(nodes.filter((n) => n.id !== selectedId)),
    [nodes, selectedId],
  );
  // channels clash only within the same chip kind
  const takenChannels = useMemo(
    () =>
      channelsInUse(
        nodes.filter(
          (n) => n.id !== selectedId && n.data.kind === selectedNode?.data.kind,
        ),
      ),
    [nodes, selectedId, selectedNode],
  );

  if (isMobile) return <MobileNotice />;

  return (
    <FlowContext.Provider value={flowContext}>
      <div className="app">
        <header className={`topbar ${liveModeAvailable ? 'topbar-insecure' : ''}`}>
          <a className="app-brand" href="/">
            <span className="brand-led" aria-hidden="true" />
            <h1>gpiozero flow</h1>
          </a>
          <CanvasPicker
            name={canvasName}
            canvases={canvasList}
            onSwitch={switchCanvas}
            onRename={renameCurrentCanvas}
            onNew={newCanvas}
            onClear={clearCanvas}
            clearDisabled={nodes.length === 0}
            onDelete={deleteCurrentCanvas}
            deleteDisabled={canvasList.length < 2 && nodes.length === 0}
            onDeleteCanvas={deleteCanvasByName}
            onExportLink={exportLink}
            onExportJson={exportJson}
            onDownloadJson={downloadJson}
            onDownloadPython={downloadPython}
            exportSizeWithState={exportSizeWithState}
            exportSizeWithoutState={exportSizeWithoutState}
            exportLimit={SHARE_PARAM_LIMIT}
            onImport={importCanvasJson}
            trash={trash}
            onRestore={restoreFromTrash}
          />
          <div className="history-toggle" role="group" aria-label="Undo/redo">
            <button
              className="topbar-script"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              ↶
            </button>
            <button
              className="topbar-script"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              aria-label="Redo"
            >
              ↷
            </button>
          </div>
          <div className="mode-toggle" role="group" aria-label="Mode">
            <button
              className={mode === 'simulator' ? 'active' : ''}
              onClick={() => changeMode('simulator')}
              title="Simulate devices in the browser"
            >
              Simulator
            </button>
            <button
              className={mode === 'live' ? 'active' : ''}
              onClick={() => changeMode('live')}
              title="Connect to a Pi and drive real devices"
            >
              Live
            </button>
          </div>
          {mode === 'live' && liveModeAvailable && (
            <div className="topbar-pi">
              <span
                className={`pi-dot pi-dot-${pi.status}`}
                role="status"
                aria-label={
                  pi.status === 'connected'
                    ? 'Connected — devices running on the Pi'
                    : pi.status === 'connecting'
                      ? 'Connecting'
                      : 'Not connected'
                }
                title={
                  pi.status === 'connected'
                    ? 'Connected — devices running on the Pi'
                    : pi.status === 'connecting'
                      ? 'Connecting…'
                      : 'Not connected'
                }
              />
              <HostCombo
                value={pi.host}
                onChange={pi.setHost}
                onPick={(s) => {
                  pi.setHost(s.host);
                  if (s.port !== undefined) pi.setPort(s.port);
                }}
                suggestions={[
                  ...pi.history,
                  ...STANDING_HOSTS.filter(
                    (h) => !pi.history.some((e) => e.host === h),
                  ).map((host) => ({ host, port: DEFAULT_PORT })),
                ]}
                disabled={pi.status !== 'disconnected'}
                onConnect={connectToPi}
              />
              <span className="pi-port-sep" aria-hidden="true">
                :
              </span>
              <input
                className="pi-port"
                value={pi.port}
                onChange={(e) => pi.setPort(e.target.value)}
                onKeyDown={connectOnEnter}
                disabled={pi.status !== 'disconnected'}
                placeholder="8765"
                inputMode="numeric"
                title="Pi agent port"
                aria-label="Pi agent port"
              />
              {pi.status === 'disconnected' ? (
                <button
                  className={`topbar-script ${highlightConnect ? 'topbar-script-highlight' : ''}`}
                  onClick={connectToPi}
                >
                  Connect to Pi
                </button>
              ) : (
                <button className="topbar-script" onClick={pi.disconnect}>
                  {pi.status === 'connecting' ? 'Cancel' : 'Disconnect'}
                </button>
              )}
            </div>
          )}
          <div className="numbering-toggle" role="group" aria-label="Pin numbering">
            <button
              className={numbering === 'bcm' ? 'active' : ''}
              onClick={() => changeNumbering('bcm')}
              title="Broadcom GPIO numbers, e.g. 17"
            >
              BCM
            </button>
            <button
              className={numbering === 'board' ? 'active' : ''}
              onClick={() => changeNumbering('board')}
              title="Physical header pin numbers, e.g. BOARD11"
            >
              BOARD
            </button>
          </div>
          <button
            className={`topbar-script ${pinoutOpen ? 'active' : ''}`}
            onClick={() => setPinoutOpen((open) => !open)}
          >
            Pinout
          </button>
        </header>
        {mode === 'live' && !liveModeAvailable && (
          <LiveModeModal
            onClose={() => changeMode('simulator')}
            nodes={nodes}
            edges={edges}
            canvasName={canvasName}
          />
        )}
        {exportPreview && (
          <ExportPreviewModal
            title={exportPreview.title}
            content={exportPreview.content}
            defaultFilename={exportPreview.defaultFilename}
            extension={exportPreview.extension}
            mimeType={exportPreview.mimeType}
            reservedNames={exportPreview.reservedNames}
            onClose={() => setExportPreview(null)}
          />
        )}
        <div className="workspace">
          <Sidebar />
          <div className="canvas" onDrop={onDrop} onDragOver={onDragOver}>
            {warning && (
              <div className="canvas-warning" role="alert">
                <span>⚠ {warning}</span>
                <button
                  className="canvas-warning-close"
                  aria-label="Dismiss warning"
                  onClick={() => setWarning(null)}
                >
                  ×
                </button>
              </div>
            )}
            <ReactFlow
              nodes={nodes}
              edges={styledEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChangeWithHistory}
              onEdgesChange={onEdgesChangeWithHistory}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              onSelectionChange={onSelectionChange}
              onEdgeDoubleClick={onEdgeDoubleClick}
              deleteKeyCode={['Backspace', 'Delete']}
            >
              <Background gap={16} />
              <Controls />
              <MiniMap />
            </ReactFlow>
            {pinoutOpen && (
              <Pinout
                nodes={nodes}
                numbering={numbering}
                onSelectNode={selectNode}
                onClose={() => setPinoutOpen(false)}
              />
            )}
          </div>
          <ConfigPanel
            node={selectedNode}
            takenPins={takenPins}
            takenNames={takenNames}
            takenChannels={takenChannels}
            numbering={numbering}
            inputs={selectedInputs}
            onChangeParam={updateNodeParam}
            onChangeName={updateNodeName}
            onDuplicate={duplicateNode}
            onSplit={splitNode}
            onConvert={convertNode}
            onMoveInput={moveInput}
          />
        </div>
      </div>
    </FlowContext.Provider>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}
