import type { Node } from '@xyflow/react';

export type Section = 'inputs' | 'outputs' | 'tools' | 'sources' | 'internal' | 'adc';

export type NodeKind =
  | 'button'
  | 'rgbled'
  | 'trafficlights'
  | 'zip_values'
  | 'mcp3008'
  | 'mcp3001'
  | 'mcp3002'
  | 'mcp3004'
  | 'mcp3201'
  | 'mcp3202'
  | 'mcp3204'
  | 'mcp3208'
  | 'mcp3301'
  | 'mcp3302'
  | 'mcp3304'
  | 'lightsensor'
  | 'motionsensor'
  | 'linesensor'
  | 'distancesensor'
  | 'rotaryencoder'
  | 'led'
  | 'pwmled'
  | 'buzzer'
  | 'tonalbuzzer'
  | 'servo'
  | 'angularservo'
  | 'motor'
  | 'phaseenablemotor'
  | 'energenie'
  | 'ledbargraph'
  | 'ledboard'
  | 'buttonboard'
  | 'robot'
  | 'phaseenablerobot'
  | 'cputemperature'
  | 'loadaverage'
  | 'diskusage'
  | 'timeofday'
  | 'pingserver'
  | 'negated'
  | 'inverted'
  | 'all_values'
  | 'any_values'
  | 'summed'
  | 'scaled'
  | 'scaled_full'
  | 'scaled_half'
  | 'clamped'
  | 'absoluted'
  | 'quantized'
  | 'booleanized'
  | 'averaged'
  | 'multiplied'
  | 'smoothed'
  | 'queued'
  | 'pre_delayed'
  | 'post_delayed'
  | 'pre_periodic_filtered'
  | 'post_periodic_filtered'
  | 'alternating_values'
  | 'cos_values'
  | 'sin_values'
  | 'random_values'
  | 'ramping_values';

/** null represents gpiozero's `None` — e.g. Servo/TonalBuzzer's
 * initial_value=None, meaning genuinely disengaged/silent rather than
 * a numeric value of 0. Only params marked `nullable` ever hold it. */
export type ParamValue = number | boolean | string | null;

/**
 * What a wire carries: most nodes emit a scalar, but multi-channel
 * nodes (zip_values, RGBLED, TrafficLights) emit a tuple of channels.
 */
export type SimValue = number | number[];

export interface ParamSpec {
  name: string;
  label: string;
  /**
   * 'pin' renders a GPIO pin dropdown and participates in unique pin
   * assignment; 'channel' does the same for MCP3008 channels 0-7.
   * 'text' is a free string (e.g. PingServer's host); 'time' is a
   * "HH:MM" string rendered as a time picker and emitted as a
   * datetime.time in generated code. 'color' is a dropdown over
   * LED_COLORS, simulation-only — gpiozero LEDs have no colour of
   * their own, so it's always omit: true.
   */
  type: 'int' | 'float' | 'bool' | 'pin' | 'channel' | 'text' | 'time' | 'color';
  default: ParamValue;
  min?: number;
  max?: number;
  step?: number;
  /** restrict an int param to these values; renders as a dropdown */
  choices?: number[];
  /** set as an attribute after construction (e.g. source_delay), not a constructor arg */
  attr?: boolean;
  /** required by the gpiozero signature: always emitted, even at its default */
  required?: boolean;
  /** emitted as a positional arg (e.g. Energenie's socket), not name=value */
  positional?: boolean;
  /** simulation-only param with no gpiozero equivalent; left out of the code preview */
  omit?: boolean;
  /**
   * Can hold `null` (gpiozero's None) as a distinct "disengaged" state
   * alongside a normal number — renders as a checkbox next to the
   * number field. Always emitted in codegen (never omitted at its
   * default), since the underlying gpiozero default may not be None.
   */
  nullable?: boolean;
}

export interface NodeSpec {
  kind: NodeKind;
  /** gpiozero class or tool name, e.g. "Button", "negated" */
  label: string;
  section: Section;
  description: string;
  valueKind: 'boolean' | 'float';
  /**
   * Shape of the value on each handle: 'scalar' (the default) or
   * 'tuple' for multi-channel wires. Connections require matching
   * shapes, mirroring gpiozero, where e.g. RGBLED's source must yield
   * (r, g, b) tuples and scalar tools would choke on them.
   */
  inputShape?: 'scalar' | 'tuple';
  outputShape?: 'scalar' | 'tuple';
  hasInput: boolean;
  /** allow more than one incoming connection (e.g. all_values) */
  multiInput?: boolean;
  hasOutput: boolean;
  /** value depends on the simulation clock, not just on inputs */
  timeBased?: boolean;
  /**
   * Takes a variable-length pin list (pin1..pinN params), sized by the
   * named count param (e.g. 'leds' for LEDBarGraph, 'buttons' for
   * ButtonBoard).
   */
  dynamicPins?: string;
  params: ParamSpec[];
  /** interactive state for simulation, e.g. { pressed: false } */
  initialState?: Record<string, ParamValue>;
}

export interface DeviceData extends Record<string, unknown> {
  kind: NodeKind;
  /** unique variable name; devices (inputs/outputs) only, tools are anonymous */
  name?: string;
  params: Record<string, ParamValue>;
  state: Record<string, ParamValue>;
}

export type DeviceFlowNode = Node<DeviceData, 'device'>;
