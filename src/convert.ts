import { SPECS, defaultParams } from './catalog';
import type { DeviceData, NodeKind, ParamValue } from './types';

/**
 * In-place kind conversions between closely-related devices (LED <->
 * PWMLED): the node keeps its id, name, position and wires; params
 * carry over by name, coerced to the target param's type — so an LED's
 * initial_value False becomes a PWMLED's 0, and 0.7 comes back as True.
 */

const CONVERSIONS: Partial<Record<NodeKind, NodeKind>> = {
  led: 'pwmled',
  pwmled: 'led',
};

export function convertTarget(kind: NodeKind): NodeKind | null {
  return CONVERSIONS[kind] ?? null;
}

export function convertParams(
  data: DeviceData,
  target: NodeKind,
): Record<string, ParamValue> {
  const params = defaultParams(target);
  for (const p of SPECS[target].params) {
    const v = data.params[p.name];
    if (v === undefined) continue;
    params[p.name] =
      p.type === 'bool'
        ? Boolean(Number(v))
        : p.type === 'float' || p.type === 'int' || p.type === 'pin'
          ? Number(v)
          : v;
  }
  return params;
}
