import type { Edge } from '@xyflow/react';
import type { DeviceFlowNode, ParamValue, SimValue } from './types';

/**
 * Runtime state for time-based nodes. The canvas advances `step` at 10
 * steps per second (the equivalent of gpiozero's source_delay=0.1);
 * artificial sources derive their value from it, and stateful tools
 * keep their per-node data here, keyed by node id.
 */
type BooleanizedState = 'below' | 'in' | 'above';

export interface SimState {
  step: number;
  smoothQueues: Map<string, number[]>;
  randoms: Map<string, number>;
  sourceSamples: Map<string, { step: number; value: SimValue }>;
  booleanizedStates: Map<string, BooleanizedState>;
}

/** Seconds per simulation clock step */
export const TICK_SECONDS = 0.1;

export function createSimState(): SimState {
  return {
    step: 0,
    smoothQueues: new Map(),
    randoms: new Map(),
    sourceSamples: new Map(),
    booleanizedStates: new Map(),
  };
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
): Record<string, SimValue> {
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

  const values: Record<string, SimValue> = {};
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
  for (const id of [...sim.sourceSamples.keys()]) {
    if (!byId.has(id)) sim.sourceSamples.delete(id);
  }
  for (const id of [...sim.booleanizedStates.keys()]) {
    if (!byId.has(id)) sim.booleanizedStates.delete(id);
  }

  return values;
}

function nodeValue(
  node: DeviceFlowNode,
  rawInputs: SimValue[],
  sim: SimState,
  advance: boolean,
): SimValue {
  const { kind, params, state } = node.data;
  // scalar view of the inputs; tuple-shaped kinds use rawInputs directly
  const inputs = rawInputs.map(toNumber);
  switch (kind) {
    case 'button':
      return state.pressed ? 1 : 0;
    case 'pot':
    case 'lightsensor':
    case 'distancesensor':
      return clamp(Number(state.level ?? 0), 0, 1);
    case 'motionsensor':
      return state.motion ? 1 : 0;
    case 'linesensor':
      return state.detected ? 1 : 0;
    case 'rotaryencoder':
      return clamp(Number(state.level ?? 0), -1, 1);
    case 'led':
    case 'buzzer':
      // value is boolean: any truthy (nonzero) source value turns it on
      if (inputs.length === 0) return params.initial_value ? 1 : 0;
      return toNumber(readSource(node, inputs[0], sim, advance)) !== 0 ? 1 : 0;
    case 'pwmled':
      if (inputs.length === 0) return clamp(Number(params.initial_value ?? 0), 0, 1);
      return clamp(toNumber(readSource(node, inputs[0], sim, advance)), 0, 1);
    case 'servo':
    case 'ledbargraph':
      if (inputs.length === 0) return clamp(Number(params.initial_value ?? 0), -1, 1);
      return clamp(toNumber(readSource(node, inputs[0], sim, advance)), -1, 1);
    case 'angularservo': {
      if (inputs.length === 0) {
        // mirror AngularServo's initial_angle -> Servo value conversion
        const minAngle = Number(params.min_angle);
        const angularRange = Number(params.max_angle) - minAngle;
        if (angularRange === 0) return 0;
        return clamp((2 * (Number(params.initial_angle) - minAngle)) / angularRange - 1, -1, 1);
      }
      return clamp(toNumber(readSource(node, inputs[0], sim, advance)), -1, 1);
    }
    case 'motor':
      if (inputs.length === 0) return 0;
      return clamp(toNumber(readSource(node, inputs[0], sim, advance)), -1, 1);
    case 'rgbled': {
      if (rawInputs.length === 0) return [0, 0, 0];
      const v = readSource(node, rawInputs[0], sim, advance);
      return channels(v, 3).map((c) => clamp(c, 0, 1));
    }
    case 'trafficlights': {
      // boolean LEDs: any truthy channel value lights that lamp
      if (rawInputs.length === 0) return [0, 0, 0];
      const v = readSource(node, rawInputs[0], sim, advance);
      return channels(v, 3).map((c) => (c !== 0 ? 1 : 0));
    }
    case 'zip_values':
      // one channel per wired source, in connection order
      return inputs;
    case 'negated':
      if (inputs.length === 0) return 0;
      return inputs[0] !== 0 ? 0 : 1;
    case 'inverted': {
      if (inputs.length === 0) return 0;
      return Number(params.input_min) + Number(params.input_max) - inputs[0];
    }
    case 'all_values':
      if (inputs.length === 0) return 0;
      return inputs.every((v) => v !== 0) ? 1 : 0;
    case 'any_values':
      if (inputs.length === 0) return 0;
      return inputs.some((v) => v !== 0) ? 1 : 0;
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
    case 'scaled_full':
      // half-range (0..1) to full-range (-1..1): scaled(values, -1, 1, 0, 1)
      if (inputs.length === 0) return 0;
      return inputs[0] * 2 - 1;
    case 'scaled_half':
      // full-range (-1..1) to half-range (0..1): scaled(values, 0, 1, -1, 1)
      if (inputs.length === 0) return 0;
      return (inputs[0] + 1) / 2;
    case 'clamped':
      if (inputs.length === 0) return 0;
      return clamp(inputs[0], Number(params.output_min), Number(params.output_max));
    case 'absoluted':
      if (inputs.length === 0) return 0;
      return Math.abs(inputs[0]);
    case 'quantized': {
      if (inputs.length === 0) return 0;
      const steps = Math.max(1, Math.floor(Number(params.steps)) || 1);
      const inputMin = Number(params.input_min);
      const inputMax = Number(params.input_max);
      if (inputMax === inputMin) return inputMin;
      const inputSize = inputMax - inputMin;
      const normalized = (inputs[0] - inputMin) / inputSize;
      return (Math.floor(normalized * steps) / steps) * inputSize + inputMin;
    }
    case 'booleanized': {
      if (inputs.length === 0) return 0;
      const v = inputs[0];
      const minValue = Number(params.min_value);
      const maxValue = Number(params.max_value);
      const hysteresis = Math.max(0, Number(params.hysteresis) || 0);
      const newState: BooleanizedState = v < minValue ? 'below' : v > maxValue ? 'above' : 'in';
      const lastState = sim.booleanizedStates.get(node.id) ?? null;
      let switchState = lastState === null || !hysteresis;
      if (!switchState && newState !== lastState) {
        if (lastState === 'below' && newState === 'in') switchState = v >= minValue + hysteresis;
        else if (lastState === 'in' && newState === 'below') switchState = v < minValue - hysteresis;
        else if (lastState === 'in' && newState === 'above') switchState = v > maxValue + hysteresis;
        else if (lastState === 'above' && newState === 'in') switchState = v <= maxValue - hysteresis;
        else switchState = true; // above <-> below directly
      }
      const finalState = switchState ? newState : lastState!;
      sim.booleanizedStates.set(node.id, finalState);
      return finalState === 'in' ? 1 : 0;
    }
    case 'averaged':
      if (inputs.length === 0) return 0;
      return inputs.reduce((a, b) => a + b, 0) / inputs.length;
    case 'multiplied':
      if (inputs.length === 0) return 0;
      return inputs.reduce((a, b) => a * b, 1);
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

/**
 * Read a device's wired source respecting its source_delay. Delays up
 * to one clock tick pass values straight through (the gpiozero default
 * of 0.01s is faster than the simulation can resolve); longer delays
 * hold the last sampled value until the delay has elapsed on the clock.
 */
function readSource(
  node: DeviceFlowNode,
  input: SimValue,
  sim: SimState,
  advance: boolean,
): SimValue {
  const delaySteps = Math.round(Number(node.data.params.source_delay ?? 0) / TICK_SECONDS);
  if (delaySteps <= 1) {
    sim.sourceSamples.delete(node.id);
    return input;
  }
  const last = sim.sourceSamples.get(node.id);
  if (last && !(advance && sim.step - last.step >= delaySteps)) return last.value;
  sim.sourceSamples.set(node.id, { step: sim.step, value: input });
  return input;
}

/** Scalar view of a wire value; tuples collapse to their first channel */
function toNumber(v: SimValue): number {
  return Array.isArray(v) ? (v[0] ?? 0) : v;
}

/** Tuple view of a wire value with exactly n channels (pad 0 / truncate) */
function channels(v: SimValue, n: number): number[] {
  const arr = Array.isArray(v) ? v : [v];
  return Array.from({ length: n }, (_, i) => arr[i] ?? 0);
}

export function anyChannelActive(v: SimValue | undefined): boolean {
  if (v === undefined) return false;
  return Array.isArray(v) ? v.some((c) => c !== 0) : v !== 0;
}

function periodOf(value: ParamValue | undefined): number {
  const period = Math.floor(Number(value));
  return period >= 2 ? period : 2;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
