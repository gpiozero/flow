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
  IsValidConnection,
  OnSelectionChangeParams,
} from '@xyflow/react';
import type { DragEvent } from 'react';
import '@xyflow/react/dist/style.css';

import { ConfigPanel } from './components/ConfigPanel';
import { DeviceNode } from './components/DeviceNode';
import { ScriptModal } from './components/ScriptModal';
import { DRAG_MIME, Sidebar } from './components/Sidebar';
import { WireEdge } from './components/WireEdge';
import {
  PIN_ASSIGN_ORDER,
  SPECS,
  barGraphLeds,
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
import { TICK_SECONDS, anyChannelActive, computeValues, createSimState } from './simulation';
import { FlowContext } from './store';
import type { DeviceFlowNode, NodeKind, ParamValue } from './types';

const nodeTypes = { device: DeviceNode };
const edgeTypes = { wire: WireEdge };

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

function Editor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<DeviceFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);
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
  const idCounter = useRef(1);

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

  const values = useMemo(() => {
    const advance = tick !== lastTickRef.current;
    lastTickRef.current = tick;
    if (advance) simRef.current.step++;
    return computeValues(nodes, edges, simRef.current, advance);
  }, [nodes, edges, tick]);

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
      setNodes((ns) =>
        ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, name } } : n)),
      );
    },
    [setNodes],
  );

  // Changing a dynamic-pin device's led count grows or shrinks its
  // pin1..pinN params, assigning free pins to new entries. The stored
  // count is canonicalised to however many pins could be assigned.
  const updateNodeParam = useCallback(
    (id: string, name: string, value: ParamValue) => {
      setNodes((ns) => {
        const usedPins = pinsInUse(ns);
        return ns.map((n) => {
          if (n.id !== id) return n;
          const params = { ...n.data.params, [name]: value };
          if (SPECS[n.data.kind].dynamicPins && name === 'leds') {
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
                    `Not enough free GPIO pins — LED count capped at ${count}`,
                  );
                  break;
                }
                params[key] = pin;
                usedPins.add(pin);
              }
              count++;
            }
            params.leds = count;
          }
          return { ...n, data: { ...n.data, params } };
        });
      });
    },
    [setNodes, showWarning],
  );

  const flowContext = useMemo(() => ({ values, updateNodeState }), [values, updateNodeState]);

  // Setting a device's source replaces any previous source, so single-input
  // targets drop their existing wire when a new one is connected.
  const onConnect = useCallback(
    (conn: Connection) => {
      const target = nodes.find((n) => n.id === conn.target);
      const multiInput = target ? SPECS[target.data.kind].multiInput : false;
      setEdges((eds) =>
        addEdge({ ...conn, type: 'wire' }, multiInput ? eds : eds.filter((e) => e.target !== conn.target)),
      );
    },
    [nodes, setEdges],
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
      if (SPECS[kind].dynamicPins && freePins >= 1 && barGraphLeds(params) > freePins) {
        params.leds = freePins;
        showWarning(
          `Only ${freePins} free GPIO pin${freePins === 1 ? '' : 's'} — ` +
            `${SPECS[kind].label} created with ${freePins} LED${freePins === 1 ? '' : 's'}`,
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
      const usedChannels = channelsInUse(nodes);
      for (const p of SPECS[kind].params) {
        if (p.type !== 'channel') continue;
        const channel = nextFreeChannel(usedChannels);
        if (channel === null) {
          showWarning(`${SPECS[kind].label} needs a free ADC channel, but all 8 are in use`);
          return;
        }
        params[p.name] = channel;
        usedChannels.add(channel);
      }
      const node: DeviceFlowNode = {
        id: `${kind}-${idCounter.current++}`,
        type: 'device',
        position,
        data: {
          kind,
          ...(isDevice(kind) ? { name: nextDeviceName(kind, namesInUse(nodes)) } : {}),
          params,
          state: base ? { ...base.state } : defaultState(kind),
        },
      };
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
    [nodes, setNodes, showWarning],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData(DRAG_MIME) as NodeKind | '';
      if (!kind || !(kind in SPECS)) return;
      materialiseNode(kind, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    },
    [materialiseNode, screenToFlowPosition],
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || scriptOpen) return;
      // leave copy/paste alone inside text fields and dropdowns
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key.toLowerCase() === 'c') copySelected();
      else if (e.key.toLowerCase() === 'v') pasteClipboard();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [copySelected, pasteClipboard, scriptOpen]);

  const onSelectionChange = useCallback(({ nodes: selected }: OnSelectionChangeParams) => {
    setSelectedId(selected.length === 1 ? selected[0].id : null);
  }, []);

  // Nothing is persisted, so clearing loses the whole canvas: confirm.
  const clearCanvas = useCallback(() => {
    if (!window.confirm('Clear the canvas? All nodes and wires will be removed.')) return;
    setNodes([]);
    setEdges([]);
    setSelectedId(null);
  }, [setNodes, setEdges]);

  const onEdgeDoubleClick = useCallback(
    (_: unknown, edge: Edge) => {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    },
    [setEdges],
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
  const takenChannels = useMemo(
    () => channelsInUse(nodes.filter((n) => n.id !== selectedId)),
    [nodes, selectedId],
  );

  return (
    <FlowContext.Provider value={flowContext}>
      <div className="app">
        <header className="topbar">
          <h1>gpiozero flow</h1>
          <span className="topbar-note">MVP — simulated in the browser, no real GPIO</span>
          <button
            className="topbar-clear"
            onClick={clearCanvas}
            disabled={nodes.length === 0}
          >
            Clear
          </button>
          <button className="topbar-script" onClick={() => setScriptOpen(true)}>
            View Python script
          </button>
        </header>
        {scriptOpen && (
          <ScriptModal nodes={nodes} edges={edges} onClose={() => setScriptOpen(false)} />
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
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
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
          </div>
          <ConfigPanel
            node={selectedNode}
            takenPins={takenPins}
            takenNames={takenNames}
            takenChannels={takenChannels}
            onChangeParam={updateNodeParam}
            onChangeName={updateNodeName}
            onDuplicate={duplicateNode}
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
