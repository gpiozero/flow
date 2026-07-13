import type { Edge } from '@xyflow/react';
import type { DeviceFlowNode } from './types';

/**
 * Compute the current value of every node by propagating values from
 * source devices through the wires, mirroring gpiozero's source/values
 * semantics. The graph is kept acyclic by connection validation, so a
 * single topological pass suffices; any node left unprocessed (which
 * would mean a cycle slipped through) defaults to 0.
 */
export function computeValues(nodes: DeviceFlowNode[], edges: Edge[]): Record<string, number> {
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
    values[id] = nodeValue(byId.get(id)!, inputs);
    for (const t of outgoing.get(id)!) {
      const d = indegree.get(t)! - 1;
      indegree.set(t, d);
      if (d === 0) queue.push(t);
    }
  }
  for (const n of nodes) {
    if (!(n.id in values)) values[n.id] = 0;
  }
  return values;
}

function nodeValue(node: DeviceFlowNode, inputs: number[]): number {
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
    case 'all_values':
      if (inputs.length === 0) return 0;
      return inputs.every((v) => v > 0) ? 1 : 0;
    case 'scaled': {
      if (inputs.length === 0) return 0;
      const inputMin = Number(params.input_min);
      const inputMax = Number(params.input_max);
      const outputMin = Number(params.output_min);
      const outputMax = Number(params.output_max);
      if (inputMax === inputMin) return outputMin;
      return outputMin + ((inputs[0] - inputMin) / (inputMax - inputMin)) * (outputMax - outputMin);
    }
  }
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
