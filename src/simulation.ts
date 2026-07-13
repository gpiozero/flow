import type { Edge } from '@xyflow/react';
import type { DeviceFlowNode, ParamValue } from './types';

/**
 * Runtime state for time-based nodes. The canvas advances `step` at 10
 * steps per second (the equivalent of gpiozero's source_delay=0.1);
 * artificial sources derive their value from it, and stateful tools
 * keep their per-node data here, keyed by node id.
 */
export interface SimState {
  step: number;
  smoothQueues: Map<string, number[]>;
  randoms: Map<string, number>;
}

export function createSimState(): SimState {
  return { step: 0, smoothQueues: new Map(), randoms: new Map() };
}

/**
 * Compute the current value of every node by propagating values from
 * source devices through the wires, mirroring gpiozero's source/values
 * semantics. The graph is kept acyclic by connection validation, so a
 * single topological pass suffices; any node left unprocessed (which
 * would mean a cycle slipped through) defaults to 0.
 *
 * `advance` is true when this call represents a clock tick: stateful
 * tools take a sample and random sources redraw. Recomputes caused by
 * user interaction pass false so they don't perturb time-based state.
 */
export function computeValues(
  nodes: DeviceFlowNode[],
  edges: Edge[],
  sim: SimState,
  advance: boolean,
): Record<string, number> {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  const byId = new Map<string, DeviceFlowNode>();

  for (const n of nodes) {
    incoming.set(n.id, []);
    outgoing.set(n.id, []);
    indegree.set(n.id, 0);
    byId.set(n.id, n);
  }
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    incoming.get(e.target)!.push(e.source);
    outgoing.get(e.source)!.push(e.target);
    indegree.set(e.target, indegree.get(e.target)! + 1);
  }

  const values: Record<string, number> = {};
  const queue = nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);
  while (queue.length) {
    const id = queue.shift()!;
    const inputs = incoming.get(id)!.map((s) => values[s] ?? 0);
    values[id] = nodeValue(byId.get(id)!, inputs, sim, advance);
    for (const t of outgoing.get(id)!) {
      const d = indegree.get(t)! - 1;
      indegree.set(t, d);
      if (d === 0) queue.push(t);
    }
  }
  for (const n of nodes) {
    if (!(n.id in values)) values[n.id] = 0;
  }

  // drop runtime state belonging to deleted nodes
  for (const id of [...sim.smoothQueues.keys()]) {
    if (!byId.has(id)) sim.smoothQueues.delete(id);
  }
  for (const id of [...sim.randoms.keys()]) {
    if (!byId.has(id)) sim.randoms.delete(id);
  }

  return values;
}

function nodeValue(
  node: DeviceFlowNode,
  inputs: number[],
  sim: SimState,
  advance: boolean,
): number {
  const { kind, params, state } = node.data;
  switch (kind) {
    case 'button':
      return state.pressed ? 1 : 0;
    case 'pot':
      return clamp01(Number(state.level ?? 0));
    case 'led':
      // LED.value is boolean: any truthy source value turns it on
      if (inputs.length === 0) return params.initial_value ? 1 : 0;
      return inputs[0] > 0 ? 1 : 0;
    case 'pwmled':
      if (inputs.length === 0) return clamp01(Number(params.initial_value ?? 0));
      return clamp01(inputs[0]);
    case 'negated':
      if (inputs.length === 0) return 0;
      return inputs[0] > 0 ? 0 : 1;
    case 'inverted': {
      if (inputs.length === 0) return 0;
      return Number(params.input_min) + Number(params.input_max) - inputs[0];
    }
    case 'all_values':
      if (inputs.length === 0) return 0;
      return inputs.every((v) => v > 0) ? 1 : 0;
    case 'any_values':
      if (inputs.length === 0) return 0;
      return inputs.some((v) => v > 0) ? 1 : 0;
    case 'summed':
      return inputs.reduce((a, b) => a + b, 0);
    case 'scaled': {
      if (inputs.length === 0) return 0;
      const inputMin = Number(params.input_min);
      const inputMax = Number(params.input_max);
      const outputMin = Number(params.output_min);
      const outputMax = Number(params.output_max);
      if (inputMax === inputMin) return outputMin;
      return outputMin + ((inputs[0] - inputMin) / (inputMax - inputMin)) * (outputMax - outputMin);
    }
    case 'smoothed': {
      const window = sim.smoothQueues.get(node.id) ?? [];
      const qsize = Math.max(1, Math.floor(Number(params.qsize)) || 1);
      if (advance) window.push(inputs.length ? inputs[0] : 0);
      while (window.length > qsize) window.shift();
      sim.smoothQueues.set(node.id, window);
      if (window.length === 0) return 0;
      return window.reduce((a, b) => a + b, 0) / window.length;
    }
    case 'alternating_values': {
      const base = params.initial_value ? 1 : 0;
      return sim.step % 2 === 0 ? base : 1 - base;
    }
    case 'random_values':
      if (advance || !sim.randoms.has(node.id)) sim.randoms.set(node.id, Math.random());
      return sim.randoms.get(node.id)!;
    case 'sin_values':
      return Math.sin((2 * Math.PI * sim.step) / periodOf(params.period));
    case 'cos_values':
      return Math.cos((2 * Math.PI * sim.step) / periodOf(params.period));
    case 'ramping_values': {
      const period = periodOf(params.period);
      const pos = sim.step % period;
      return pos < period / 2 ? (pos * 2) / period : 2 - (pos * 2) / period;
    }
  }
}

function periodOf(value: ParamValue | undefined): number {
  const period = Math.floor(Number(value));
  return period >= 2 ? period : 2;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
