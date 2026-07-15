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
import { DRAG_MIME, Sidebar } from './components/Sidebar';
import { WireEdge } from './components/WireEdge';
import {
  SPECS,
  defaultParams,
  defaultState,
  isDevice,
  nextDeviceName,
  nextFreeChannel,
  nextFreePin,
  requiredPinParams,
} from './catalog';
import { TICK_SECONDS, computeValues, createSimState } from './simulation';
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
                if (pin === null) break; // out of pins
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
    [setNodes],
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

  // Reject self-connections and anything that would create a cycle.
  const isValidConnection: IsValidConnection<Edge> = useCallback(
    (conn) => {
      const { source, target } = conn;
      if (!source || !target || source === target) return false;
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
    [edges],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData(DRAG_MIME) as NodeKind | '';
      if (!kind || !(kind in SPECS)) return;
      const params = defaultParams(kind);
      const usedPins = pinsInUse(nodes);
      for (const name of requiredPinParams(kind, params)) {
        const pin = nextFreePin(usedPins);
        if (pin === null) return; // every GPIO pin is taken
        params[name] = pin;
        usedPins.add(pin);
      }
      const usedChannels = channelsInUse(nodes);
      for (const p of SPECS[kind].params) {
        if (p.type !== 'channel') continue;
        const channel = nextFreeChannel(usedChannels);
        if (channel === null) return; // all 8 ADC channels are taken
        params[p.name] = channel;
        usedChannels.add(channel);
      }
      const node: DeviceFlowNode = {
        id: `${kind}-${idCounter.current++}`,
        type: 'device',
        position: screenToFlowPosition({ x: e.clientX, y: e.clientY }),
        data: {
          kind,
          ...(isDevice(kind) ? { name: nextDeviceName(kind, namesInUse(nodes)) } : {}),
          params,
          state: defaultState(kind),
        },
      };
      setNodes((ns) => [...ns, node]);
    },
    [nodes, screenToFlowPosition, setNodes],
  );

  const onSelectionChange = useCallback(({ nodes: selected }: OnSelectionChangeParams) => {
    setSelectedId(selected.length === 1 ? selected[0].id : null);
  }, []);

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
        const active = (values[e.source] ?? 0) !== 0;
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
        </header>
        <div className="workspace">
          <Sidebar />
          <div className="canvas" onDrop={onDrop} onDragOver={onDragOver}>
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
