import type { Edge } from '@xyflow/react';
import { SPECS, isDevice, requiredPinParams } from './catalog';
import { pyPin } from './pins';
import type { PinNumbering } from './pins';
import type { DeviceFlowNode, NodeKind, ParamSpec, ParamValue } from './types';

export function pyLiteral(value: ParamValue): string {
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'string')
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  return String(value);
}

/** A param's Python value: time params become datetime.time literals,
 * pins follow the numbering (17 or 'BOARD11') */
function pyParam(p: ParamSpec, value: ParamValue, numbering: PinNumbering): string {
  if (p.type === 'pin') return pyPin(value, numbering);
  if (p.type === 'time') {
    const [h, m] = String(value).split(':').map(Number);
    return `time(${h || 0}, ${m || 0})`;
  }
  return pyLiteral(value);
}

/** `varname = Class(args...)` plus any attr params (e.g. source_delay) on their own lines. */
export function deviceConstructor(
  node: DeviceFlowNode,
  numbering: PinNumbering = 'bcm',
): string {
  const spec = SPECS[node.data.kind];
  const params = node.data.params;
  const varName = node.data.name ?? node.data.kind;
  const args: string[] = [];
  const attrs: string[] = [];
  // dynamic pin lists (LEDBarGraph's *pins) come first, positionally
  if (spec.dynamicPins) {
    for (const key of requiredPinParams(node.data.kind, params)) {
      args.push(pyPin(params[key], numbering));
    }
  }
  // Robot wraps its pins in two Motor instances; the pin params are
  // marked omit so the generic loop below leaves them alone
  if (node.data.kind === 'robot') {
    args.push(
      `left=Motor(${pyPin(params.left_forward, numbering)}, ${pyPin(params.left_backward, numbering)})`,
    );
    args.push(
      `right=Motor(${pyPin(params.right_forward, numbering)}, ${pyPin(params.right_backward, numbering)})`,
    );
  }
  // a lone pin is idiomatic positionally (LED(17)); once there are
  // several, name them all so the reader needn't recall the order.
  // ADC channels are always named (MCP3008(channel=0)).
  const pinCount = spec.params.filter((p) => p.type === 'pin' || p.type === 'channel').length;
  spec.params.forEach((p, i) => {
    if (p.omit) return;
    const value = params[p.name];
    // attributes like source_delay are set after construction
    if (p.attr) {
      if (value !== p.default) attrs.push(`${varName}.${p.name} = ${pyLiteral(value)}`);
      return;
    }
    const isPin = p.type === 'pin' || p.type === 'channel';
    if (i === 0 && pinCount <= 1 && p.type === 'pin') args.push(pyPin(value, numbering));
    else if (p.positional) {
      if (p.required || value !== p.default) args.push(pyParam(p, value, numbering));
    } else if (isPin || p.required || value !== p.default)
      args.push(`${p.name}=${pyParam(p, value, numbering)}`);
  });
  return [`${varName} = ${spec.label}(${args.join(', ')})`, ...attrs].join('\n');
}

/** Anonymous tool/source call, e.g. `negated(button.values)`; inputExprs are its already-resolved sources. */
export function toolCall(node: DeviceFlowNode, inputExprs: string[]): string {
  const spec = SPECS[node.data.kind];
  const params = node.data.params;
  const args = [...inputExprs];
  for (const p of spec.params) {
    if (p.omit) continue;
    const value = params[p.name];
    if (p.required || value !== p.default) args.push(`${p.name}=${pyLiteral(value)}`);
  }
  return `${spec.label}(${args.join(', ')})`;
}

/**
 * Full gpiozero script for the canvas: imports, every device's
 * constructor (plus source_delay attrs), and each wired device's
 * `.source =` assignment. Anonymous tool/source nodes have no variable
 * of their own — they're inlined recursively at each point they're
 * referenced, same as calling gpiozero's source/values tools directly.
 */
export function generateScript(
  nodes: DeviceFlowNode[],
  edges: Edge[],
  numbering: PinNumbering = 'bcm',
): string {
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    const list = incoming.get(e.target);
    if (list) list.push(e.source);
    else incoming.set(e.target, [e.source]);
  }

  // Devices are referenced bare (led.source = button, negated(button)):
  // source setters and gpiozero.tools normalise them to .values, the
  // recommended style since gpiozero 1.5. gpiozero's zip_values takes
  // device objects too; with anonymous tool expressions in the mix,
  // builtin zip is the equivalent, but being plain zip it needs the
  // .values iterators spelt out for any devices among its arguments.
  const allDevices = (ids: string[]) => ids.every((i) => isDevice(nodesById.get(i)!.data.kind));
  const iterExprFor = (id: string): string => {
    const node = nodesById.get(id)!;
    return isDevice(node.data.kind) ? `${node.data.name}.values` : exprFor(id);
  };

  const exprCache = new Map<string, string>();
  const exprFor = (id: string): string => {
    const cached = exprCache.get(id);
    if (cached !== undefined) return cached;
    const node = nodesById.get(id)!;
    const preds = incoming.get(id) ?? [];
    let expr: string;
    if (isDevice(node.data.kind)) expr = `${node.data.name}`;
    else if (node.data.kind === 'zip_values' && allDevices(preds))
      expr = `zip_values(${preds.map((p) => nodesById.get(p)!.data.name).join(', ')})`;
    else if (node.data.kind === 'zip_values') expr = `zip(${preds.map(iterExprFor).join(', ')})`;
    else expr = toolCall(node, preds.map(exprFor));
    exprCache.set(id, expr);
    return expr;
  };

  const deviceNodes = nodes.filter((n) => isDevice(n.data.kind));

  // Tool/source kinds actually reachable from some device's source
  // (unwired ones on the canvas contribute no code, so are left out).
  const usedTools = new Set<NodeKind>();
  const visited = new Set<string>();
  const markUsed = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const node = nodesById.get(id)!;
    if (isDevice(node.data.kind)) return;
    // the builtin-zip fallback needs no gpiozero.tools import
    if (node.data.kind !== 'zip_values' || allDevices(incoming.get(id) ?? []))
      usedTools.add(node.data.kind);
    for (const pred of incoming.get(id) ?? []) markUsed(pred);
  };
  for (const n of deviceNodes) {
    for (const pred of incoming.get(n.id) ?? []) markUsed(pred);
  }

  // Robot's constructor references Motor even without a Motor node
  const deviceImports = [
    ...new Set([
      ...deviceNodes.map((n) => SPECS[n.data.kind].label),
      ...(deviceNodes.some((n) => n.data.kind === 'robot') ? ['Motor'] : []),
    ]),
  ].sort();
  const toolImports = [...usedTools].map((k) => SPECS[k].label).sort();

  const lines: string[] = [];
  // TimeOfDay's start/end params are datetime.time instances
  if (deviceNodes.some((n) => SPECS[n.data.kind].params.some((p) => p.type === 'time')))
    lines.push('from datetime import time');
  if (deviceImports.length) lines.push(`from gpiozero import ${deviceImports.join(', ')}`);
  if (toolImports.length) lines.push(`from gpiozero.tools import ${toolImports.join(', ')}`);
  lines.push('from signal import pause');

  if (deviceNodes.length) {
    lines.push('', ...deviceNodes.map((n) => deviceConstructor(n, numbering)));
  }

  const wiring = deviceNodes
    .filter((n) => (incoming.get(n.id) ?? []).length > 0)
    .map((n) => `${n.data.name}.source = ${exprFor(incoming.get(n.id)![0])}`);
  if (wiring.length) lines.push('', ...wiring);

  lines.push('', 'pause()');
  return lines.join('\n');
}
