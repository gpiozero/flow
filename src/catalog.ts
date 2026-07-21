import type { NodeKind, NodeSpec, ParamValue, Section } from './types';

/**
 * Simulation-only LED colours: gpiozero's LED/PWMLED have no colour of
 * their own (any physical colour is just whatever's wired up), so this
 * is purely a config-panel dropdown driving the node's glow — the
 * 'color' param is always omit: true, never emitted by codegen.
 */
export const LED_COLORS: { name: string; hex: string }[] = [
  { name: 'red', hex: '#ef4444' },
  { name: 'orange', hex: '#f97316' },
  { name: 'yellow', hex: '#eab308' },
  { name: 'green', hex: '#22c55e' },
  { name: 'cyan', hex: '#06b6d4' },
  { name: 'blue', hex: '#3b82f6' },
  { name: 'magenta', hex: '#d946ef' },
  { name: 'white', hex: '#fde68a' },
];

/** Hex for a LED_COLORS name; falls back to red for an unrecognised or unset value */
export function ledColorHex(name: ParamValue | undefined): string {
  return LED_COLORS.find((c) => c.name === name)?.hex ?? LED_COLORS[0].hex;
}

/**
 * An MCP3xxx ADC spec: multi-channel chips get a channel dropdown
 * (sized by the chip) and a differential toggle; single-channel chips
 * (MCP3001/3201/3301) are inherently differential and take neither.
 */
function adcSpec(
  kind: NodeKind,
  label: string,
  description: string,
  channels: number,
  signed = false,
): NodeSpec {
  return {
    kind,
    label,
    section: 'adc',
    description,
    valueKind: 'float',
    hasInput: false,
    hasOutput: true,
    params:
      channels > 1
        ? [
            { name: 'channel', label: 'channel', type: 'channel', default: 0, max: channels - 1 },
            { name: 'differential', label: 'differential', type: 'bool', default: false },
          ]
        : [],
    initialState: { level: signed ? 0 : 0.5 },
  };
}

/** Lower bound of an ADC's value: MCP33xx chips are signed when differential */
export function adcMin(kind: NodeKind, params: Record<string, ParamValue>): number {
  if (kind === 'mcp3301') return -1;
  if ((kind === 'mcp3302' || kind === 'mcp3304') && params.differential) return -1;
  return 0;
}

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
  mcp3008: {
    kind: 'mcp3008',
    label: 'MCP3008',
    section: 'adc',
    description: 'Potentiometer via MCP3008 ADC: 10-bit, 8 channels',
    valueKind: 'float',
    hasInput: false,
    hasOutput: true,
    params: [
      { name: 'channel', label: 'channel', type: 'channel', default: 0, max: 7 },
      { name: 'differential', label: 'differential', type: 'bool', default: false },
    ],
    initialState: { level: 0.5 },
  },
  mcp3001: adcSpec('mcp3001', 'MCP3001', '10-bit ADC, single differential input', 1),
  mcp3002: adcSpec('mcp3002', 'MCP3002', '10-bit ADC with 2 channels', 2),
  mcp3004: adcSpec('mcp3004', 'MCP3004', '10-bit ADC with 4 channels', 4),
  mcp3201: adcSpec('mcp3201', 'MCP3201', '12-bit ADC, single differential input', 1),
  mcp3202: adcSpec('mcp3202', 'MCP3202', '12-bit ADC with 2 channels', 2),
  mcp3204: adcSpec('mcp3204', 'MCP3204', '12-bit ADC with 4 channels', 4),
  mcp3208: adcSpec('mcp3208', 'MCP3208', '12-bit ADC with 8 channels', 8),
  mcp3301: adcSpec('mcp3301', 'MCP3301', '13-bit ADC, single signed differential input (-1..1)', 1, true),
  mcp3302: adcSpec('mcp3302', 'MCP3302', '13-bit ADC, 4 channels; signed -1..1 when differential', 4),
  mcp3304: adcSpec('mcp3304', 'MCP3304', '13-bit ADC, 8 channels; signed -1..1 when differential', 8),
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
      { name: 'max_steps', label: 'max_steps', type: 'int', default: 16, min: 0 },
      { name: 'wrap', label: 'wrap', type: 'bool', default: false },
    ],
    initialState: { steps: 0 },
  },
  buttonboard: {
    kind: 'buttonboard',
    label: 'ButtonBoard',
    section: 'inputs',
    description: 'Bank of push buttons, one channel each',
    valueKind: 'boolean',
    hasInput: false,
    hasOutput: true,
    outputShape: 'tuple',
    dynamicPins: 'buttons',
    params: [
      { name: 'buttons', label: 'buttons', type: 'int', default: 4, min: 1, max: 10, omit: true },
      { name: 'pull_up', label: 'pull_up', type: 'bool', default: true },
    ],
    // pressed1..pressedN state keys are created lazily on first press
    initialState: {},
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
      { name: 'color', label: 'color', type: 'color', default: 'red', omit: true },
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
      { name: 'color', label: 'color', type: 'color', default: 'red', omit: true },
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
  tonalbuzzer: {
    kind: 'tonalbuzzer',
    label: 'TonalBuzzer',
    section: 'outputs',
    description: 'Buzzer playing a tone around A4, -1 (low) to 1 (high)',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    params: [
      { name: 'pin', label: 'pin', type: 'pin', default: 12 },
      { name: 'octaves', label: 'octaves', type: 'int', default: 1, min: 1, max: 4 },
      { name: 'initial_value', label: 'initial_value', type: 'float', default: null, min: -1, max: 1, step: 0.05, nullable: true },
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
      // None means disengaged (no pulses sent, servo free to move) —
      // distinct from 0, which actively holds the centre position
      { name: 'initial_value', label: 'initial_value', type: 'float', default: null, min: -1, max: 1, step: 0.05, nullable: true },
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
      // None means disengaged (no pulses sent, servo free to move) —
      // distinct from an angle of 0, which actively holds that position
      { name: 'initial_angle', label: 'initial_angle', type: 'float', default: null, step: 1, nullable: true },
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
  phaseenablemotor: {
    kind: 'phaseenablemotor',
    label: 'PhaseEnableMotor',
    section: 'outputs',
    description: 'DC motor via a phase/enable driver, -1 (back) to 1 (forward)',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    params: [
      { name: 'phase', label: 'phase', type: 'pin', default: 26 },
      { name: 'enable', label: 'enable', type: 'pin', default: 27 },
      { name: 'source_delay', label: 'source_delay', type: 'float', default: 0.01, min: 0, max: 10, step: 0.01, attr: true },
    ],
  },
  energenie: {
    kind: 'energenie',
    label: 'Energenie',
    section: 'outputs',
    description: 'Energenie radio-controlled mains socket',
    valueKind: 'boolean',
    hasInput: true,
    hasOutput: true,
    params: [
      { name: 'socket', label: 'socket', type: 'int', default: 1, min: 1, max: 4, positional: true, required: true },
      { name: 'initial_value', label: 'initial_value', type: 'bool', default: false },
      { name: 'source_delay', label: 'source_delay', type: 'float', default: 0.01, min: 0, max: 10, step: 0.01, attr: true },
    ],
  },
  cputemperature: {
    kind: 'cputemperature',
    label: 'CPUTemperature',
    section: 'internal',
    description: "The Pi's CPU temperature, scaled min_temp..max_temp",
    valueKind: 'float',
    hasInput: false,
    hasOutput: true,
    params: [
      { name: 'min_temp', label: 'min_temp', type: 'float', default: 0, step: 1 },
      { name: 'max_temp', label: 'max_temp', type: 'float', default: 100, step: 1 },
    ],
    // state.level is the simulated sensor reading in °C (0..100 on the
    // slider), not a pre-scaled fraction — matches gpiozero, where the
    // value is computed from a real temperature reading, not set directly
    initialState: { level: 50 },
  },
  loadaverage: {
    kind: 'loadaverage',
    label: 'LoadAverage',
    section: 'internal',
    description: 'System load average, scaled between min and max',
    valueKind: 'float',
    hasInput: false,
    hasOutput: true,
    params: [
      { name: 'min_load_average', label: 'min_load_average', type: 'float', default: 0, step: 0.1 },
      { name: 'max_load_average', label: 'max_load_average', type: 'float', default: 1, step: 0.1 },
      { name: 'minutes', label: 'minutes', type: 'int', default: 5, choices: [1, 5, 15] },
    ],
    initialState: { level: 0.5 },
  },
  diskusage: {
    kind: 'diskusage',
    label: 'DiskUsage',
    section: 'internal',
    description: 'How full a filesystem is, 0 (empty) to 1 (full)',
    valueKind: 'float',
    hasInput: false,
    hasOutput: true,
    params: [
      { name: 'filesystem', label: 'filesystem', type: 'text', default: '/', positional: true },
    ],
    initialState: { level: 0.5 },
  },
  timeofday: {
    kind: 'timeofday',
    label: 'TimeOfDay',
    section: 'internal',
    description: 'On between two times of day, off otherwise',
    valueKind: 'boolean',
    hasInput: false,
    hasOutput: true,
    timeBased: true,
    params: [
      { name: 'start_time', label: 'start_time', type: 'time', default: '09:00', positional: true, required: true },
      { name: 'end_time', label: 'end_time', type: 'time', default: '17:00', positional: true, required: true },
      { name: 'utc', label: 'utc', type: 'bool', default: true },
    ],
  },
  pingserver: {
    kind: 'pingserver',
    label: 'PingServer',
    section: 'internal',
    description: 'On while a host answers ping',
    valueKind: 'boolean',
    hasInput: false,
    hasOutput: true,
    params: [
      { name: 'host', label: 'host', type: 'text', default: 'localhost', positional: true, required: true },
    ],
    initialState: { up: true },
  },
  ledbargraph: {
    kind: 'ledbargraph',
    label: 'LEDBarGraph',
    section: 'outputs',
    description: 'Row of LEDs displaying a value from -1 to 1',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    dynamicPins: 'leds',
    params: [
      { name: 'leds', label: 'leds', type: 'int', default: 5, min: 1, max: 10, omit: true },
      { name: 'pwm', label: 'pwm', type: 'bool', default: false },
      { name: 'initial_value', label: 'initial_value', type: 'float', default: 0, min: -1, max: 1, step: 0.05 },
      { name: 'source_delay', label: 'source_delay', type: 'float', default: 0.01, min: 0, max: 10, step: 0.01, attr: true },
    ],
  },
  ledboard: {
    kind: 'ledboard',
    label: 'LEDBoard',
    section: 'outputs',
    description: 'Bank of LEDs, each driven by its own channel',
    valueKind: 'boolean',
    hasInput: true,
    hasOutput: true,
    inputShape: 'tuple',
    outputShape: 'tuple',
    dynamicPins: 'leds',
    params: [
      // 25: enough for PiHutXmasTree (24 LEDs + star)
      { name: 'leds', label: 'leds', type: 'int', default: 4, min: 1, max: 25, omit: true },
      { name: 'pwm', label: 'pwm', type: 'bool', default: false },
      { name: 'active_high', label: 'active_high', type: 'bool', default: true },
      { name: 'initial_value', label: 'initial_value', type: 'bool', default: false },
      { name: 'source_delay', label: 'source_delay', type: 'float', default: 0.01, min: 0, max: 10, step: 0.01, attr: true },
    ],
  },
  robot: {
    kind: 'robot',
    label: 'Robot',
    section: 'outputs',
    description: 'Dual-motor robot driven by (left, right) speed tuples',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    inputShape: 'tuple',
    outputShape: 'tuple',
    // the pins are omitted from the generic codegen: deviceConstructor
    // renders them as Robot(left=Motor(...), right=Motor(...))
    params: [
      { name: 'left_forward', label: 'left_forward', type: 'pin', default: 4, omit: true },
      { name: 'left_backward', label: 'left_backward', type: 'pin', default: 14, omit: true },
      { name: 'right_forward', label: 'right_forward', type: 'pin', default: 17, omit: true },
      { name: 'right_backward', label: 'right_backward', type: 'pin', default: 18, omit: true },
      { name: 'source_delay', label: 'source_delay', type: 'float', default: 0.01, min: 0, max: 10, step: 0.01, attr: true },
    ],
  },
  phaseenablerobot: {
    kind: 'phaseenablerobot',
    label: 'PhaseEnableRobot',
    section: 'outputs',
    description: 'Dual-motor robot via phase/enable drivers, (left, right) speed tuples',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    inputShape: 'tuple',
    outputShape: 'tuple',
    // the pins are omitted from the generic codegen: deviceConstructor
    // renders them as PhaseEnableRobot(left=(...), right=(...)) — or,
    // when they match the Pololu DRV8835 kit exactly, PololuDRV8835Robot()
    params: [
      { name: 'left_phase', label: 'left_phase', type: 'pin', default: 16, omit: true },
      { name: 'left_enable', label: 'left_enable', type: 'pin', default: 20, omit: true },
      { name: 'right_phase', label: 'right_phase', type: 'pin', default: 21, omit: true },
      { name: 'right_enable', label: 'right_enable', type: 'pin', default: 26, omit: true },
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
      { name: 'pwm', label: 'pwm', type: 'bool', default: true },
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
      { name: 'pwm', label: 'pwm', type: 'bool', default: false },
      { name: 'initial_value', label: 'initial_value', type: 'bool', default: false },
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
  queued: {
    kind: 'queued',
    label: 'queued',
    section: 'tools',
    description: 'Delay line: emits values from qsize steps ago',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    timeBased: true,
    params: [{ name: 'qsize', label: 'qsize', type: 'int', default: 5, min: 1, max: 100, required: true }],
  },
  pre_delayed: {
    kind: 'pre_delayed',
    label: 'pre_delayed',
    section: 'tools',
    description: 'Wait delay seconds before each value',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    timeBased: true,
    params: [{ name: 'delay', label: 'delay', type: 'float', default: 1, min: 0, max: 10, step: 0.1, required: true }],
  },
  post_delayed: {
    kind: 'post_delayed',
    label: 'post_delayed',
    section: 'tools',
    description: 'Wait delay seconds after each value',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    timeBased: true,
    params: [{ name: 'delay', label: 'delay', type: 'float', default: 1, min: 0, max: 10, step: 0.1, required: true }],
  },
  pre_periodic_filtered: {
    kind: 'pre_periodic_filtered',
    label: 'pre_periodic_filtered',
    section: 'tools',
    description: 'Block the first block values, repeating every repeat_after',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    timeBased: true,
    params: [
      { name: 'block', label: 'block', type: 'int', default: 5, min: 1, max: 100, required: true },
      { name: 'repeat_after', label: 'repeat_after', type: 'int', default: 0, min: 0, max: 100, required: true },
    ],
  },
  post_periodic_filtered: {
    kind: 'post_periodic_filtered',
    label: 'post_periodic_filtered',
    section: 'tools',
    description: 'After every repeat_after values, block the next block',
    valueKind: 'float',
    hasInput: true,
    hasOutput: true,
    timeBased: true,
    // gpiozero's signature takes repeat_after before block here
    params: [
      { name: 'repeat_after', label: 'repeat_after', type: 'int', default: 5, min: 1, max: 100, required: true },
      { name: 'block', label: 'block', type: 'int', default: 5, min: 1, max: 100, required: true },
    ],
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
      { name: 'output_min', label: 'output_min', type: 'float', default: 0, step: 0.1, required: true },
      { name: 'output_max', label: 'output_max', type: 'float', default: 1, step: 0.1, required: true },
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
      { name: 'steps', label: 'steps', type: 'int', default: 4, min: 1, max: 100, required: true },
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
      { name: 'min_value', label: 'min_value', type: 'float', default: 0.25, step: 0.05, required: true },
      { name: 'max_value', label: 'max_value', type: 'float', default: 0.75, step: 0.05, required: true },
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

/**
 * Human summary of a device's value, for the config panel: the range
 * each channel moves in, what the number means, and any special
 * values. Param-dependent (signed ADCs, pwm toggles, channel counts),
 * so it takes the node's params. Tools and artificial sources return
 * null: their output is described by their own params and description.
 */
export interface ValueSummary {
  /** tuple channel names in order, e.g. ['left', 'right']; absent for scalars */
  channels?: string[];
  /** per-channel range, e.g. '0 or 1', '-1 … 1' */
  range: string;
  /** what the value represents, endpoints included */
  meaning: string;
  /** extra semantics, e.g. 'None = silent' */
  note?: string;
}

export function valueSummary(
  kind: NodeKind,
  params: Record<string, ParamValue>,
): ValueSummary | null {
  const BOOL = '0 or 1';
  const HALF = '0 … 1';
  const FULL = '-1 … 1';
  const channelNames = (base: string) =>
    Array.from({ length: dynamicPinCount(kind, params) }, (_, i) => `${base}${i + 1}`);
  switch (kind) {
    case 'button':
      return { range: BOOL, meaning: '1 = pressed, 0 = released' };
    case 'lightsensor':
      return { range: HALF, meaning: 'amount of light: 0 = dark, 1 = bright' };
    case 'motionsensor':
      return { range: BOOL, meaning: '1 = motion detected' };
    case 'linesensor':
      return { range: BOOL, meaning: '1 = line detected' };
    case 'distancesensor':
      return { range: HALF, meaning: 'distance: 0 = touching, 1 = max range or beyond' };
    case 'rotaryencoder':
      return {
        range: FULL,
        meaning: 'position: steps / max_steps, -1 = full anticlockwise, 1 = full clockwise',
        note: Number(params.max_steps) > 0 ? undefined : 'max_steps = 0: steps are unbounded and value stays 0',
      };
    case 'buttonboard':
      return {
        channels: channelNames('button'),
        range: BOOL,
        meaning: 'each channel is one button: 1 = pressed',
      };
    case 'mcp3008':
    case 'mcp3001':
    case 'mcp3002':
    case 'mcp3004':
    case 'mcp3201':
    case 'mcp3202':
    case 'mcp3204':
    case 'mcp3208':
    case 'mcp3301':
    case 'mcp3302':
    case 'mcp3304':
      return {
        range: adcMin(kind, params) === -1 ? FULL : HALF,
        meaning: 'voltage as a fraction of the reference voltage',
      };
    case 'led':
      return { range: BOOL, meaning: '0 = off, 1 = on' };
    case 'pwmled':
      return { range: HALF, meaning: 'brightness: 0 = off, 1 = full' };
    case 'rgbled':
      return {
        channels: ['red', 'green', 'blue'],
        range: params.pwm ? HALF : BOOL,
        meaning: params.pwm
          ? 'brightness of each colour channel'
          : 'each colour channel on or off (pwm=False)',
      };
    case 'buzzer':
      return { range: BOOL, meaning: '0 = silent, 1 = buzzing' };
    case 'tonalbuzzer':
      return {
        range: FULL,
        meaning: `pitch: 0 = mid tone, ±1 = ${params.octaves} octave${Number(params.octaves) === 1 ? '' : 's'} either side`,
        note: 'silent when unwired (gpiozero: value None)',
      };
    case 'servo':
      return {
        range: FULL,
        meaning: 'position: -1 = min, 0 = mid, 1 = max',
        note: 'gpiozero: value None = detached (no pulses)',
      };
    case 'angularservo':
      return {
        range: FULL,
        meaning: `position: -1 = ${params.min_angle}°, 1 = ${params.max_angle}°`,
        note: 'gpiozero: value None = detached (no pulses)',
      };
    case 'motor':
    case 'phaseenablemotor':
      return {
        range: FULL,
        meaning: 'speed: -1 = full backward, 0 = stopped, 1 = full forward',
      };
    case 'robot':
    case 'phaseenablerobot':
      return {
        channels: ['left', 'right'],
        range: FULL,
        meaning: 'speed of each wheel: -1 = full backward, 1 = full forward',
      };
    case 'energenie':
      return { range: BOOL, meaning: '0 = socket off, 1 = socket on' };
    case 'ledbargraph':
      return {
        range: FULL,
        meaning: 'fraction of LEDs lit; negative values light from the far end',
      };
    case 'ledboard':
      return {
        // _channelNames: visual only, for boards whose LEDs have real
        // names (e.g. PiHutXmasTree's star/red_1/red_2/...)
        channels:
          typeof params._channelNames === 'string'
            ? requiredPinParams(kind, params).map((p) => pinFieldLabel(params, p))
            : channelNames('led'),
        range: params.pwm ? HALF : BOOL,
        meaning: params.pwm ? 'brightness of each LED' : 'each LED on or off',
      };
    case 'trafficlights':
      return {
        channels: ['red', 'amber', 'green'],
        range: params.pwm ? HALF : BOOL,
        meaning: params.pwm ? 'brightness of each light' : 'each light on or off',
      };
    case 'cputemperature':
      return {
        range: '0 … 1, or beyond',
        meaning: `temperature scaled: 0 = ${params.min_temp}°C, 1 = ${params.max_temp}°C — outside that range, the value goes with it`,
      };
    case 'loadaverage':
      return {
        range: HALF,
        meaning: `load average scaled: 0 = ${params.min_load_average}, 1 = ${params.max_load_average}`,
      };
    case 'diskusage':
      return { range: HALF, meaning: 'how full the filesystem is: 0 = empty, 1 = full' };
    case 'timeofday':
      return { range: BOOL, meaning: '1 = between start_time and end_time' };
    case 'pingserver':
      return { range: BOOL, meaning: '1 = host answering ping' };
    default:
      return null;
  }
}

export const SECTIONS: { id: Section; title: string; kinds: NodeKind[] }[] = [
  {
    id: 'inputs',
    title: 'Inputs',
    kinds: [
      'button',
      'lightsensor',
      'motionsensor',
      'linesensor',
      'distancesensor',
      'rotaryencoder',
      'buttonboard',
    ],
  },
  {
    id: 'adc',
    title: 'ADCs',
    kinds: [
      'mcp3008',
      'mcp3001',
      'mcp3002',
      'mcp3004',
      'mcp3201',
      'mcp3202',
      'mcp3204',
      'mcp3208',
      'mcp3301',
      'mcp3302',
      'mcp3304',
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
      'tonalbuzzer',
      'servo',
      'angularservo',
      'motor',
      'phaseenablemotor',
      'robot',
      'phaseenablerobot',
      'energenie',
      'ledbargraph',
      'ledboard',
      'trafficlights',
    ],
  },
  {
    id: 'internal',
    title: 'Internal devices',
    kinds: ['cputemperature', 'loadaverage', 'diskusage', 'timeofday', 'pingserver'],
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
      'queued',
      'pre_delayed',
      'post_delayed',
      'pre_periodic_filtered',
      'post_periodic_filtered',
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

/**
 * Lowest free channel on a chip with `count` channels. Channel pools
 * are per device kind: each ADC kind models one physical chip.
 */
export function nextFreeChannel(
  usedChannels: ReadonlySet<number>,
  count: number,
): number | null {
  for (let channel = 0; channel < count; channel++) {
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
  return (
    section === 'inputs' || section === 'outputs' || section === 'internal' || section === 'adc'
  );
}

export function nextDeviceName(base: string, usedNames: ReadonlySet<string>): string {
  if (!usedNames.has(base)) return base;
  for (let i = 2; ; i++) {
    const name = `${base}_${i}`;
    if (!usedNames.has(name)) return name;
  }
}

/** Pin count for a dynamic-pin device, clamped to its valid range */
export function dynamicPinCount(kind: NodeKind, params: Record<string, ParamValue>): number {
  const paramName = SPECS[kind].dynamicPins!;
  const max = SPECS[kind].params.find((p) => p.name === paramName)?.max ?? 10;
  const n = Math.floor(Number(params[paramName]));
  return Math.min(max, Math.max(1, n || 1));
}

/**
 * Names of the pin-valued params a node should carry: the spec's pin
 * params for most devices, or pin1..pinN sized by the count param for
 * dynamic-pin devices like LEDBarGraph.
 */
export function requiredPinParams(
  kind: NodeKind,
  params: Record<string, ParamValue>,
): string[] {
  if (SPECS[kind].dynamicPins) {
    return Array.from({ length: dynamicPinCount(kind, params) }, (_, i) => `pin${i + 1}`);
  }
  return SPECS[kind].params.filter((p) => p.type === 'pin').map((p) => p.name);
}

/**
 * Display label for a dynamic-pin param field (e.g. "pin3") — the
 * matching _channelNames override entry (e.g. "red_2") if the board
 * set one, else the raw param name. Used for both the config panel's
 * per-pin field labels and the value line's channel list, so they
 * always agree.
 */
export function pinFieldLabel(params: Record<string, ParamValue>, paramName: string): string {
  if (typeof params._channelNames !== 'string') return paramName;
  const match = paramName.match(/^pin(\d+)$/);
  if (!match) return paramName;
  const names = params._channelNames.split(',');
  return names[Number(match[1]) - 1] ?? paramName;
}

export function defaultParams(kind: NodeKind): Record<string, ParamValue> {
  return Object.fromEntries(SPECS[kind].params.map((p) => [p.name, p.default]));
}

export function defaultState(kind: NodeKind): Record<string, ParamValue> {
  return { ...(SPECS[kind].initialState ?? {}) };
}

/**
 * Which gpiozero docs page (under /en/stable/) each kind's API entry
 * lives on. Devices link to their class (#gpiozero.ClassName); tools
 * link to their function under gpiozero.tools. Doesn't follow section
 * 1:1 — several "outputs"/"inputs" kinds (boards, composite devices)
 * are documented on api_boards.html instead of api_output.html/api_input.html.
 */
const DOCS_PAGE: Record<NodeKind, string> = {
  button: 'api_input',
  mcp3008: 'api_spi',
  mcp3001: 'api_spi',
  mcp3002: 'api_spi',
  mcp3004: 'api_spi',
  mcp3201: 'api_spi',
  mcp3202: 'api_spi',
  mcp3204: 'api_spi',
  mcp3208: 'api_spi',
  mcp3301: 'api_spi',
  mcp3302: 'api_spi',
  mcp3304: 'api_spi',
  lightsensor: 'api_input',
  motionsensor: 'api_input',
  linesensor: 'api_input',
  distancesensor: 'api_input',
  rotaryencoder: 'api_input',
  buttonboard: 'api_boards',
  led: 'api_output',
  pwmled: 'api_output',
  buzzer: 'api_output',
  tonalbuzzer: 'api_output',
  servo: 'api_output',
  angularservo: 'api_output',
  motor: 'api_output',
  phaseenablemotor: 'api_output',
  energenie: 'api_boards',
  cputemperature: 'api_internal',
  loadaverage: 'api_internal',
  diskusage: 'api_internal',
  timeofday: 'api_internal',
  pingserver: 'api_internal',
  ledbargraph: 'api_boards',
  ledboard: 'api_boards',
  robot: 'api_boards',
  phaseenablerobot: 'api_boards',
  rgbled: 'api_output',
  trafficlights: 'api_boards',
  negated: 'api_tools',
  inverted: 'api_tools',
  all_values: 'api_tools',
  any_values: 'api_tools',
  summed: 'api_tools',
  smoothed: 'api_tools',
  queued: 'api_tools',
  pre_delayed: 'api_tools',
  post_delayed: 'api_tools',
  pre_periodic_filtered: 'api_tools',
  post_periodic_filtered: 'api_tools',
  alternating_values: 'api_tools',
  random_values: 'api_tools',
  sin_values: 'api_tools',
  cos_values: 'api_tools',
  ramping_values: 'api_tools',
  scaled: 'api_tools',
  scaled_full: 'api_tools',
  scaled_half: 'api_tools',
  clamped: 'api_tools',
  absoluted: 'api_tools',
  quantized: 'api_tools',
  booleanized: 'api_tools',
  averaged: 'api_tools',
  multiplied: 'api_tools',
  zip_values: 'api_tools',
};

/**
 * scaled_full/scaled_half are this app's own presets (fixed-parameter
 * scaled() calls), not real gpiozero.tools functions — link to scaled
 * itself, the closest real API entry.
 */
const DOCS_LABEL_OVERRIDE: Partial<Record<NodeKind, string>> = {
  scaled_full: 'scaled',
  scaled_half: 'scaled',
};

/**
 * gpiozero boards that are just a generic device on fixed pins, with a
 * dedicated subclass wrapping them so pins needn't be specified
 * (RyanteckRobot, LedBorg, PiTraffic, ...) — every one of these takes
 * no pin args at all, wiring being hardcoded in its own __init__.
 * Matched against a node's params to tell whether it happens to be
 * wired exactly like one of these, in which case codegen, the config
 * panel title, and the docs link should all name the specific
 * subclass rather than the generic class it's built from.
 *
 * extraGuard covers params the dedicated subclass can't override at
 * all (e.g. LedBorg has no active_high argument) — without it, using
 * the subclass name would silently drop a non-default setting.
 */
const FIXED_PIN_BOARD_PRESETS: {
  kind: NodeKind;
  className: string;
  pins: Record<string, number>;
  extraGuard?: (params: Record<string, ParamValue>) => boolean;
}[] = [
  {
    kind: 'robot',
    className: 'RyanteckRobot',
    pins: { left_forward: 17, left_backward: 18, right_forward: 22, right_backward: 23 },
  },
  {
    kind: 'robot',
    className: 'CamJamKitRobot',
    pins: { left_forward: 9, left_backward: 10, right_forward: 7, right_backward: 8 },
  },
  {
    kind: 'phaseenablerobot',
    className: 'PololuDRV8835Robot',
    pins: { left_phase: 5, left_enable: 12, right_phase: 6, right_enable: 13 },
  },
  {
    kind: 'rgbled',
    className: 'LedBorg',
    pins: { red: 17, green: 27, blue: 22 },
    extraGuard: (params) => params.active_high !== false,
  },
  { kind: 'trafficlights', className: 'PiTraffic', pins: { red: 9, amber: 10, green: 11 } },
  { kind: 'trafficlights', className: 'TrafficpHat', pins: { red: 25, amber: 24, green: 23 } },
  {
    kind: 'ledboard',
    className: 'PiLiter',
    pins: { leds: 8, pin1: 4, pin2: 17, pin3: 27, pin4: 18, pin5: 22, pin6: 23, pin7: 24, pin8: 25 },
  },
  {
    kind: 'ledbargraph',
    className: 'PiLiterBarGraph',
    pins: { leds: 8, pin1: 4, pin2: 17, pin3: 27, pin4: 18, pin5: 22, pin6: 23, pin7: 24, pin8: 25 },
  },
  {
    kind: 'ledboard',
    className: 'PiHutXmasTree',
    pins: {
      leds: 25,
      pin1: 2,
      pin2: 4,
      pin3: 15,
      pin4: 13,
      pin5: 21,
      pin6: 25,
      pin7: 8,
      pin8: 5,
      pin9: 10,
      pin10: 16,
      pin11: 17,
      pin12: 27,
      pin13: 26,
      pin14: 24,
      pin15: 9,
      pin16: 12,
      pin17: 6,
      pin18: 20,
      pin19: 19,
      pin20: 14,
      pin21: 18,
      pin22: 11,
      pin23: 7,
      pin24: 23,
      pin25: 22,
    },
  },
];

function boardPreset(kind: NodeKind, params: Record<string, ParamValue>) {
  return FIXED_PIN_BOARD_PRESETS.find(
    (preset) =>
      preset.kind === kind &&
      Object.entries(preset.pins).every(([key, value]) => Number(params[key]) === value) &&
      (preset.extraGuard?.(params) ?? true),
  );
}

/** Whether this node's pins (and any params its dedicated class can't override) match a known fixed-pin board exactly */
export function isFixedPinBoard(kind: NodeKind, params: Record<string, ParamValue>): boolean {
  return boardPreset(kind, params) !== undefined;
}

/**
 * The real gpiozero class/function this node constructs — usually just
 * spec.label, but robot/phaseenablerobot construct plain Robot (or
 * PhaseEnableRobot) and some devices' pins happen to match a known
 * fixed-pin board exactly (see FIXED_PIN_BOARD_PRESETS), in which case
 * that more specific subclass — e.g. CamJamKitRobot, LedBorg — is the
 * correct one. Used for the config panel title, codegen, and (via
 * docsUrl) the docs link, so all three always agree on which real
 * class a node currently represents.
 */
export function deviceClassName(kind: NodeKind, params: Record<string, ParamValue> = {}): string {
  const preset = boardPreset(kind, params);
  if (preset) return preset.className;
  if (kind === 'phaseenablerobot') return 'PhaseEnableRobot';
  return SPECS[kind].label;
}

/** Direct link to this kind's class or function in the gpiozero docs (stable) */
export function docsUrl(kind: NodeKind, params: Record<string, ParamValue> = {}): string {
  // every FIXED_PIN_BOARD_PRESETS subclass lives on the boards docs
  // page, even when the generic class it's built from (e.g. RGBLED)
  // doesn't
  const page = boardPreset(kind, params) ? 'api_boards' : DOCS_PAGE[kind];
  const label = DOCS_LABEL_OVERRIDE[kind] ?? deviceClassName(kind, params);
  const anchor = page === 'api_tools' ? `gpiozero.tools.${label}` : `gpiozero.${label}`;
  return `https://gpiozero.readthedocs.io/en/stable/${page}.html#${anchor}`;
}
