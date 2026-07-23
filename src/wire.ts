import type { Edge } from '@xyflow/react';
import { SPECS, isDevice, requiredPinParams } from './catalog';
import type { DeviceFlowNode, ParamSpec, ParamValue } from './types';

/**
 * Wire format for the Pi agent (gpiozero_flow/gpio_agent.py): each node as a
 * ready-to-instantiate spec, so gpiozero catalog knowledge stays here.
 * Param inclusion mirrors codegen.ts — what runs on the Pi is exactly
 * what the script preview shows.
 */

/** time params and Robot's motors need constructing Python-side, so travel tagged */
export type WireValue =
  | ParamValue
  | { __type__: 'time'; value: [number, number] }
  | { __type__: 'motor'; pins: [ParamValue, ParamValue] };

export interface WireNode {
  id: string;
  device: boolean;
  /** gpiozero class (devices) */
  cls?: string;
  name?: string;
  /** gpiozero.tools function (tools/sources) */
  fn?: string;
  /** positional args (dynamic pin lists) */
  args?: WireValue[];
  kwargs: Record<string, WireValue>;
  /** set as attributes after construction; live-settable without a rebuild */
  attrs?: Record<string, ParamValue>;
}

export interface WireGraph {
  type: 'graph';
  nodes: WireNode[];
  edges: { source: string; target: string }[];
}

function wireValue(p: ParamSpec, value: ParamValue): WireValue {
  if (p.type === 'time') {
    const [h, m] = String(value).split(':').map(Number);
    return { __type__: 'time', value: [h || 0, m || 0] };
  }
  return value;
}

export function serializeNode(node: DeviceFlowNode): WireNode {
  const spec = SPECS[node.data.kind];
  const params = node.data.params;
  if (!isDevice(node.data.kind)) {
    const kwargs: Record<string, WireValue> = {};
    for (const p of spec.params) {
      if (p.omit) continue;
      const value = params[p.name];
      if (p.required || value !== p.default) kwargs[p.name] = wireValue(p, value);
    }
    return { id: node.id, device: false, fn: spec.label, kwargs };
  }
  const args: WireValue[] = [];
  const kwargs: Record<string, WireValue> = {};
  const attrs: Record<string, ParamValue> = {};
  if (spec.dynamicPins) {
    for (const key of requiredPinParams(node.data.kind, params)) {
      args.push(params[key]);
    }
  }
  // Robot's pin params (marked omit) become two Motor kwargs
  if (node.data.kind === 'robot') {
    kwargs.left = { __type__: 'motor', pins: [params.left_forward, params.left_backward] };
    kwargs.right = { __type__: 'motor', pins: [params.right_forward, params.right_backward] };
  }
  for (const p of spec.params) {
    if (p.omit) continue;
    const value = params[p.name];
    // attrs always travel, defaults included, so reverting a param
    // back to its default reaches the live device too
    if (p.attr) {
      attrs[p.name] = value;
      continue;
    }
    const isPin = p.type === 'pin' || p.type === 'channel';
    if (isPin || p.required || value !== p.default) kwargs[p.name] = wireValue(p, value);
  }
  return { id: node.id, device: true, cls: spec.label, name: node.data.name, args, kwargs, attrs };
}

export function serializeGraph(nodes: DeviceFlowNode[], edges: Edge[]): WireGraph {
  const ids = new Set(nodes.map((n) => n.id));
  return {
    type: 'graph',
    nodes: nodes.map(serializeNode),
    edges: edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => ({ source: e.source, target: e.target })),
  };
}
