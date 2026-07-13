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
  { id: 'tools', title: 'Tools', kinds: ['negated', 'all_values', 'scaled'] },
];

export function defaultParams(kind: NodeKind): Record<string, ParamValue> {
  return Object.fromEntries(SPECS[kind].params.map((p) => [p.name, p.default]));
}

export function defaultState(kind: NodeKind): Record<string, ParamValue> {
  return { ...(SPECS[kind].initialState ?? {}) };
}
