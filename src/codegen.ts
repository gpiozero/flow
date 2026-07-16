import type { Edge } from '@xyflow/react';
import { SPECS, isDevice, requiredPinParams } from './catalog';
import type { DeviceFlowNode, NodeKind, ParamValue } from './types';

export function pyLiteral(value: ParamValue): string {
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  return String(value);
}

/** `varname = Class(args...)` plus any attr params (e.g. source_delay) on their own lines. */
export function deviceConstructor(node: DeviceFlowNode): string {
  const spec = SPECS[node.data.kind];
  const params = node.data.params;
  const varName = node.data.name ?? node.data.kind;
  const args: string[] = [];
  const attrs: string[] = [];
  // dynamic pin lists (LEDBarGraph's *pins) come first, positionally
  if (spec.dynamicPins) {
    for (const key of requiredPinParams(node.data.kind, params)) {
      args.push(pyLiteral(params[key]));
    }
  }
  spec.params.forEach((p, i) => {
    if (p.omit) return;
    const value = params[p.name];
    // attributes like source_delay are set after construction
    if (p.attr) {
      if (value !== p.default) attrs.push(`${varName}.${p.name} = ${pyLiteral(value)}`);
      return;
    }
    if (i === 0) args.push(pyLiteral(value));
    else if (p.type === 'pin' || value !== p.default) args.push(`${p.name}=${pyLiteral(value)}`);
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
    if (value !== p.default) args.push(`${p.name}=${pyLiteral(value)}`);
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
export function generateScript(nodes: DeviceFlowNode[], edges: Edge[]): string {
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    const list = incoming.get(e.target);
    if (list) list.push(e.source);
    else incoming.set(e.target, [e.source]);
  }

  // gpiozero's zip_values takes device objects (it reads their .values
  // itself); with anonymous tool expressions in the mix, builtin zip
  // over the resolved iterators is the equivalent.
  const allDevices = (ids: string[]) => ids.every((i) => isDevice(nodesById.get(i)!.data.kind));

  const exprCache = new Map<string, string>();
  const exprFor = (id: string): string => {
    const cached = exprCache.get(id);
    if (cached !== undefined) return cached;
    const node = nodesById.get(id)!;
    const preds = incoming.get(id) ?? [];
    let expr: string;
    if (isDevice(node.data.kind)) expr = `${node.data.name}.values`;
    else if (node.data.kind === 'zip_values' && allDevices(preds))
      expr = `zip_values(${preds.map((p) => nodesById.get(p)!.data.name).join(', ')})`;
    else if (node.data.kind === 'zip_values') expr = `zip(${preds.map(exprFor).join(', ')})`;
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

  const deviceImports = [...new Set(deviceNodes.map((n) => SPECS[n.data.kind].label))].sort();
  const toolImports = [...usedTools].map((k) => SPECS[k].label).sort();

  const lines: string[] = [];
  if (deviceImports.length) lines.push(`from gpiozero import ${deviceImports.join(', ')}`);
  if (toolImports.length) lines.push(`from gpiozero.tools import ${toolImports.join(', ')}`);
  lines.push('from signal import pause');

  if (deviceNodes.length) {
    lines.push('', ...deviceNodes.map(deviceConstructor));
  }

  const wiring = deviceNodes
    .filter((n) => (incoming.get(n.id) ?? []).length > 0)
    .map((n) => `${n.data.name}.source = ${exprFor(incoming.get(n.id)![0])}`);
  if (wiring.length) lines.push('', ...wiring);

  lines.push('', 'pause()');
  return lines.join('\n');
}
