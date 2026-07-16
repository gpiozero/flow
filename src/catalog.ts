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
      { name: 'pin', label: 'pin', type: 'pin', default: 2 },
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
      { name: 'channel', label: 'channel', type: 'channel', default: 0 },
    ],
    initialState: { level: 0.5 },
  },
  lightsensor: {
    kind: 'lightsensor',
    label: 'LightSensor',
    section: 'inputs',
    description: 'Light-dependent resistor',
    valueKind: 'float',
    hasInput: false,
    hasOutput: true,
    params: [{ name: 'pin', label: 'pin', type: 'pin', default: 9 }],
    initialState: { level: 0.5 },
  },
  motionsensor: {
    kind: 'motionsensor',
    label: 'MotionSensor',
    section: 'inputs',
    description: 'PIR motion sensor',
    valueKind: 'boolean',
    hasInput: false,
    hasOutput: true,
    params: [{ name: 'pin', label: 'pin', type: 'pin', default: 10 }],
    initialState: { motion: false },
  },
  linesensor: {
    kind: 'linesensor',
    label: 'LineSensor',
    section: 'inputs',
    description: 'Reflective line/edge sensor',
    valueKind: 'boolean',
    hasInput: false,
    hasOutput: true,
    params: [{ name: 'pin', label: 'pin', type: 'pin', default: 20 }],
    initialState: { detected: false },
  },
  distancesensor: {
    kind: 'distancesensor',
    label: 'DistanceSensor',
    section: 'inputs',
    description: 'HC-SR04 ultrasonic distance sensor',
    valueKind: 'float',
    hasInput: false,
    hasOutput: true,
    params: [
      { name: 'echo', label: 'echo', type: 'pin', default: 21 },
      { name: 'trigger', label: 'trigger', type: 'pin', default: 22 },
    ],
    initialState: { level: 0.5 },
  },
  rotaryencoder: {
    kind: 'rotaryencoder',
    label: 'RotaryEncoder',
    section: 'inputs',
    description: 'Incremental rotary encoder, -1 (CCW) to 1 (CW)',
    valueKind: 'float',
    hasInput: false,
    hasOutput: true,
    params: [
      { name: 'a', label: 'a', type: 'pin', default: 23 },
      { name: 'b', label: 'b', type: 'pin', default: 24 },
    ],
    initialState: { level: 0 },
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
      { name: 'pin', label: 'pin', type: 'pin', default: 17 },
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
      { name: 'pin', label: 'pin', type: 'pin', default: 18 },
      { name: 'active_high', label: 'active_high', type: 'bool', default: true },
      { name: 'initial_value', label: 'initial_value', type: 'float', default: 0, min: 0, max: 1, step: 0.01 },
      { name: 'frequency', label: 'frequency', type: 'int', default: 100, min: 1, max: 10000 },
      { name: 'source_delay', label: 'source_delay', type: 'float', default: 0.01, min: 0, max: 10, step: 0.01, attr: true },
    ],
  },
  buzzer: {
    kind: 'buzzer',
    label: 'Buzzer',
    section: 'outputs',
    description: 'Active piezo buzzer',
    valueKind: 'boolean',
    hasInput: true,
    hasOutput: true,
    params: [
      { name: 'pin', label: 'pin', type: 'pin', default: 11 },
      { name: 'active_high', label: 'active_high', type: 'bool', default: true },
      { name: 'initial_value', label: 'initial_value', type: 'bool', default: false },
      { name: 'source_delay', label: 'source_delay', type: 'float', default: 0.01, min: 0, max: 10, step: 0.01, attr: true },
    ],
  },
  servo: {
    kind: 'servo',
    label: 'Servo',
    section: 'outputs',
    description: 'Servo motor, positioned from -1 to 1',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    params: [
      { name: 'pin', label: 'pin', type: 'pin', default: 12 },
      { name: 'initial_value', label: 'initial_value', type: 'float', default: 0, min: -1, max: 1, step: 0.05 },
      { name: 'source_delay', label: 'source_delay', type: 'float', default: 0.01, min: 0, max: 10, step: 0.01, attr: true },
    ],
  },
  angularservo: {
    kind: 'angularservo',
    label: 'AngularServo',
    section: 'outputs',
    description: 'Servo positioned by angle in degrees',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    params: [
      { name: 'pin', label: 'pin', type: 'pin', default: 25 },
      { name: 'initial_angle', label: 'initial_angle', type: 'float', default: 0, step: 1 },
      { name: 'min_angle', label: 'min_angle', type: 'float', default: -90, step: 1 },
      { name: 'max_angle', label: 'max_angle', type: 'float', default: 90, step: 1 },
      { name: 'source_delay', label: 'source_delay', type: 'float', default: 0.01, min: 0, max: 10, step: 0.01, attr: true },
    ],
  },
  motor: {
    kind: 'motor',
    label: 'Motor',
    section: 'outputs',
    description: 'DC motor, speed from -1 (back) to 1 (forward)',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    params: [
      { name: 'forward', label: 'forward', type: 'pin', default: 13 },
      { name: 'backward', label: 'backward', type: 'pin', default: 19 },
      { name: 'source_delay', label: 'source_delay', type: 'float', default: 0.01, min: 0, max: 10, step: 0.01, attr: true },
    ],
  },
  ledbargraph: {
    kind: 'ledbargraph',
    label: 'LEDBarGraph',
    section: 'outputs',
    description: 'Row of LEDs displaying a value from -1 to 1',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    dynamicPins: true,
    params: [
      { name: 'leds', label: 'leds', type: 'int', default: 5, min: 1, max: 10, omit: true },
      { name: 'initial_value', label: 'initial_value', type: 'float', default: 0, min: -1, max: 1, step: 0.05 },
      { name: 'source_delay', label: 'source_delay', type: 'float', default: 0.01, min: 0, max: 10, step: 0.01, attr: true },
    ],
  },
  rgbled: {
    kind: 'rgbled',
    label: 'RGBLED',
    section: 'outputs',
    description: 'Full colour LED, driven by (r, g, b) tuples',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    inputShape: 'tuple',
    outputShape: 'tuple',
    params: [
      { name: 'red', label: 'red', type: 'pin', default: 5 },
      { name: 'green', label: 'green', type: 'pin', default: 6 },
      { name: 'blue', label: 'blue', type: 'pin', default: 7 },
      { name: 'active_high', label: 'active_high', type: 'bool', default: true },
      { name: 'source_delay', label: 'source_delay', type: 'float', default: 0.01, min: 0, max: 10, step: 0.01, attr: true },
    ],
  },
  trafficlights: {
    kind: 'trafficlights',
    label: 'TrafficLights',
    section: 'outputs',
    description: 'Red, amber and green LEDs, driven by 3-tuples',
    valueKind: 'boolean',
    hasInput: true,
    hasOutput: true,
    inputShape: 'tuple',
    outputShape: 'tuple',
    params: [
      { name: 'red', label: 'red', type: 'pin', default: 14 },
      { name: 'amber', label: 'amber', type: 'pin', default: 15 },
      { name: 'green', label: 'green', type: 'pin', default: 16 },
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
  scaled_full: {
    kind: 'scaled_full',
    label: 'scaled_full',
    section: 'tools',
    description: 'Convert a half-range (0..1) value to full-range (-1..1)',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    params: [],
  },
  scaled_half: {
    kind: 'scaled_half',
    label: 'scaled_half',
    section: 'tools',
    description: 'Convert a full-range (-1..1) value to half-range (0..1)',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    params: [],
  },
  clamped: {
    kind: 'clamped',
    label: 'clamped',
    section: 'tools',
    description: 'Clamp values to a range',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    params: [
      { name: 'output_min', label: 'output_min', type: 'float', default: 0, step: 0.1 },
      { name: 'output_max', label: 'output_max', type: 'float', default: 1, step: 0.1 },
    ],
  },
  absoluted: {
    kind: 'absoluted',
    label: 'absoluted',
    section: 'tools',
    description: 'Absolute value of a source',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    params: [],
  },
  quantized: {
    kind: 'quantized',
    label: 'quantized',
    section: 'tools',
    description: 'Quantize values into discrete steps',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    params: [
      { name: 'steps', label: 'steps', type: 'int', default: 4, min: 1, max: 100 },
      { name: 'input_min', label: 'input_min', type: 'float', default: 0, step: 0.1 },
      { name: 'input_max', label: 'input_max', type: 'float', default: 1, step: 0.1 },
    ],
  },
  booleanized: {
    kind: 'booleanized',
    label: 'booleanized',
    section: 'tools',
    description: 'True within a range, with optional hysteresis',
    valueKind: 'boolean',
    hasInput: true,
    hasOutput: true,
    params: [
      { name: 'min_value', label: 'min_value', type: 'float', default: 0.25, step: 0.05 },
      { name: 'max_value', label: 'max_value', type: 'float', default: 0.75, step: 0.05 },
      { name: 'hysteresis', label: 'hysteresis', type: 'float', default: 0, min: 0, step: 0.05 },
    ],
  },
  averaged: {
    kind: 'averaged',
    label: 'averaged',
    section: 'tools',
    description: 'Mean of all sources',
    valueKind: 'float',
    hasInput: true,
    multiInput: true,
    hasOutput: true,
    params: [],
  },
  multiplied: {
    kind: 'multiplied',
    label: 'multiplied',
    section: 'tools',
    description: 'Product of all sources',
    valueKind: 'float',
    hasInput: true,
    multiInput: true,
    hasOutput: true,
    params: [],
  },
  zip_values: {
    kind: 'zip_values',
    label: 'zip_values',
    section: 'tools',
    description: 'Combine sources into multi-channel tuples',
    valueKind: 'float',
    hasInput: true,
    multiInput: true,
    hasOutput: true,
    outputShape: 'tuple',
    params: [],
  },
};

export const SECTIONS: { id: Section; title: string; kinds: NodeKind[] }[] = [
  {
    id: 'inputs',
    title: 'Inputs',
    kinds: [
      'button',
      'pot',
      'lightsensor',
      'motionsensor',
      'linesensor',
      'distancesensor',
      'rotaryencoder',
    ],
  },
  {
    id: 'outputs',
    title: 'Outputs',
    kinds: [
      'led',
      'pwmled',
      'rgbled',
      'buzzer',
      'servo',
      'angularservo',
      'motor',
      'ledbargraph',
      'trafficlights',
    ],
  },
  {
    id: 'tools',
    title: 'Tools',
    kinds: [
      'negated',
      'inverted',
      'all_values',
      'any_values',
      'summed',
      'scaled',
      'scaled_full',
      'scaled_half',
      'clamped',
      'absoluted',
      'quantized',
      'booleanized',
      'averaged',
      'multiplied',
      'zip_values',
      'smoothed',
    ],
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

/** MCP3008 channels, in display and assignment order */
export const MCP_CHANNELS = Array.from({ length: 8 }, (_, i) => i);

export function nextFreeChannel(usedChannels: ReadonlySet<number>): number | null {
  for (const channel of MCP_CHANNELS) {
    if (!usedChannels.has(channel)) return channel;
  }
  return null;
}

/** Valid device name: lowercase letters, digits and underscores, not starting with a digit */
export const NAME_PATTERN = /^[a-z_][a-z0-9_]*$/;

export function inputShapeOf(kind: NodeKind): 'scalar' | 'tuple' {
  return SPECS[kind].inputShape ?? 'scalar';
}

export function outputShapeOf(kind: NodeKind): 'scalar' | 'tuple' {
  return SPECS[kind].outputShape ?? 'scalar';
}

export function isDevice(kind: NodeKind): boolean {
  const section = SPECS[kind].section;
  return section === 'inputs' || section === 'outputs';
}

export function nextDeviceName(kind: NodeKind, usedNames: ReadonlySet<string>): string {
  if (!usedNames.has(kind)) return kind;
  for (let i = 2; ; i++) {
    const name = `${kind}${i}`;
    if (!usedNames.has(name)) return name;
  }
}

/** LED count for a dynamic-pin device, clamped to its valid range */
export function barGraphLeds(params: Record<string, ParamValue>): number {
  const n = Math.floor(Number(params.leds));
  return Math.min(10, Math.max(1, n || 1));
}

/**
 * Names of the pin-valued params a node should carry: the spec's pin
 * params for most devices, or pin1..pinN sized by the leds param for
 * dynamic-pin devices like LEDBarGraph.
 */
export function requiredPinParams(
  kind: NodeKind,
  params: Record<string, ParamValue>,
): string[] {
  if (SPECS[kind].dynamicPins) {
    return Array.from({ length: barGraphLeds(params) }, (_, i) => `pin${i + 1}`);
  }
  return SPECS[kind].params.filter((p) => p.type === 'pin').map((p) => p.name);
}

export function defaultParams(kind: NodeKind): Record<string, ParamValue> {
  return Object.fromEntries(SPECS[kind].params.map((p) => [p.name, p.default]));
}

export function defaultState(kind: NodeKind): Record<string, ParamValue> {
  return { ...(SPECS[kind].initialState ?? {}) };
}
