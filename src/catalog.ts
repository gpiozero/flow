import type { NodeKind, NodeSpec, ParamValue, Section } from './types';

export const SPECS: Record<NodeKind, NodeSpec> = {
  button: {
    kind: 'button',
    label: 'Button',
    section: 'inputs',
    description: 'Momentary push button',
    valueKind: 'boolean',
    hasInput: false,
    hasOutput: true,
    params: [
      { name: 'pin', label: 'pin', type: 'int', default: 2, min: 0, max: 27 },
      { name: 'pull_up', label: 'pull_up', type: 'bool', default: true },
    ],
    initialState: { pressed: false },
  },
  pot: {
    kind: 'pot',
    label: 'MCP3008',
    section: 'inputs',
    description: 'Potentiometer via MCP3008 ADC',
    valueKind: 'float',
    hasInput: false,
    hasOutput: true,
    params: [
      { name: 'channel', label: 'channel', type: 'int', default: 0, min: 0, max: 7 },
    ],
    initialState: { level: 0.5 },
  },
  led: {
    kind: 'led',
    label: 'LED',
    section: 'outputs',
    description: 'On/off LED',
    valueKind: 'boolean',
    hasInput: true,
    hasOutput: true,
    params: [
      { name: 'pin', label: 'pin', type: 'int', default: 17, min: 0, max: 27 },
      { name: 'active_high', label: 'active_high', type: 'bool', default: true },
      { name: 'initial_value', label: 'initial_value', type: 'bool', default: false },
      { name: 'source_delay', label: 'source_delay', type: 'float', default: 0.01, min: 0, max: 10, step: 0.01, attr: true },
    ],
  },
  pwmled: {
    kind: 'pwmled',
    label: 'PWMLED',
    section: 'outputs',
    description: 'LED with variable brightness',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    params: [
      { name: 'pin', label: 'pin', type: 'int', default: 18, min: 0, max: 27 },
      { name: 'active_high', label: 'active_high', type: 'bool', default: true },
      { name: 'initial_value', label: 'initial_value', type: 'float', default: 0, min: 0, max: 1, step: 0.01 },
      { name: 'frequency', label: 'frequency', type: 'int', default: 100, min: 1, max: 10000 },
      { name: 'source_delay', label: 'source_delay', type: 'float', default: 0.01, min: 0, max: 10, step: 0.01, attr: true },
    ],
  },
  negated: {
    kind: 'negated',
    label: 'negated',
    section: 'tools',
    description: 'Invert a boolean source',
    valueKind: 'boolean',
    hasInput: true,
    hasOutput: true,
    params: [],
  },
  inverted: {
    kind: 'inverted',
    label: 'inverted',
    section: 'tools',
    description: 'Invert values within a range',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    params: [
      { name: 'input_min', label: 'input_min', type: 'float', default: 0, step: 0.1 },
      { name: 'input_max', label: 'input_max', type: 'float', default: 1, step: 0.1 },
    ],
  },
  all_values: {
    kind: 'all_values',
    label: 'all_values',
    section: 'tools',
    description: 'On when every source is on (AND)',
    valueKind: 'boolean',
    hasInput: true,
    multiInput: true,
    hasOutput: true,
    params: [],
  },
  any_values: {
    kind: 'any_values',
    label: 'any_values',
    section: 'tools',
    description: 'On when any source is on (OR)',
    valueKind: 'boolean',
    hasInput: true,
    multiInput: true,
    hasOutput: true,
    params: [],
  },
  summed: {
    kind: 'summed',
    label: 'summed',
    section: 'tools',
    description: 'Sum of all sources',
    valueKind: 'float',
    hasInput: true,
    multiInput: true,
    hasOutput: true,
    params: [],
  },
  smoothed: {
    kind: 'smoothed',
    label: 'smoothed',
    section: 'tools',
    description: 'Rolling average of recent values',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    timeBased: true,
    params: [{ name: 'qsize', label: 'qsize', type: 'int', default: 5, min: 1, max: 100 }],
  },
  alternating_values: {
    kind: 'alternating_values',
    label: 'alternating_values',
    section: 'sources',
    description: 'Alternates on/off each step',
    valueKind: 'boolean',
    hasInput: false,
    hasOutput: true,
    timeBased: true,
    params: [{ name: 'initial_value', label: 'initial_value', type: 'bool', default: false }],
  },
  random_values: {
    kind: 'random_values',
    label: 'random_values',
    section: 'sources',
    description: 'Random value each step',
    valueKind: 'float',
    hasInput: false,
    hasOutput: true,
    timeBased: true,
    params: [],
  },
  sin_values: {
    kind: 'sin_values',
    label: 'sin_values',
    section: 'sources',
    description: 'Sine wave from -1 to 1',
    valueKind: 'float',
    hasInput: false,
    hasOutput: true,
    timeBased: true,
    params: [{ name: 'period', label: 'period', type: 'int', default: 36, min: 2, max: 3600 }],
  },
  cos_values: {
    kind: 'cos_values',
    label: 'cos_values',
    section: 'sources',
    description: 'Cosine wave from -1 to 1',
    valueKind: 'float',
    hasInput: false,
    hasOutput: true,
    timeBased: true,
    params: [{ name: 'period', label: 'period', type: 'int', default: 36, min: 2, max: 3600 }],
  },
  ramping_values: {
    kind: 'ramping_values',
    label: 'ramping_values',
    section: 'sources',
    description: 'Ramp from 0 to 1 and back',
    valueKind: 'float',
    hasInput: false,
    hasOutput: true,
    timeBased: true,
    params: [{ name: 'period', label: 'period', type: 'int', default: 36, min: 2, max: 3600 }],
  },
  scaled: {
    kind: 'scaled',
    label: 'scaled',
    section: 'tools',
    description: 'Scale values between ranges',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    params: [
      { name: 'output_min', label: 'output_min', type: 'float', default: 0, step: 0.1 },
      { name: 'output_max', label: 'output_max', type: 'float', default: 1, step: 0.1 },
      { name: 'input_min', label: 'input_min', type: 'float', default: 0, step: 0.1 },
      { name: 'input_max', label: 'input_max', type: 'float', default: 1, step: 0.1 },
    ],
  },
};

export const SECTIONS: { id: Section; title: string; kinds: NodeKind[] }[] = [
  { id: 'inputs', title: 'Inputs', kinds: ['button', 'pot'] },
  { id: 'outputs', title: 'Outputs', kinds: ['led', 'pwmled'] },
  {
    id: 'tools',
    title: 'Tools',
    kinds: ['negated', 'inverted', 'all_values', 'any_values', 'summed', 'scaled', 'smoothed'],
  },
  {
    id: 'sources',
    title: 'Artificial sources',
    kinds: ['alternating_values', 'random_values', 'sin_values', 'cos_values', 'ramping_values'],
  },
];

/** All usable GPIO pins, in display order */
export const GPIO_PINS = Array.from({ length: 28 }, (_, i) => i);

/** Assignment order for new devices: 4-27 first, 0-3 as a last resort */
export const PIN_ASSIGN_ORDER = [...GPIO_PINS.slice(4), 0, 1, 2, 3];

export function nextFreePin(usedPins: ReadonlySet<number>): number | null {
  for (const pin of PIN_ASSIGN_ORDER) {
    if (!usedPins.has(pin)) return pin;
  }
  return null;
}

export function defaultParams(kind: NodeKind): Record<string, ParamValue> {
  return Object.fromEntries(SPECS[kind].params.map((p) => [p.name, p.default]));
}

export function defaultState(kind: NodeKind): Record<string, ParamValue> {
  return { ...(SPECS[kind].initialState ?? {}) };
}
