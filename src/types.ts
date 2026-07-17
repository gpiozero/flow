import type { Node } from '@xyflow/react';

export type Section = 'inputs' | 'outputs' | 'tools' | 'sources' | 'internal';

export type NodeKind =
  | 'button'
  | 'rgbled'
  | 'trafficlights'
  | 'zip_values'
  | 'pot'
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
  | 'alternating_values'
  | 'cos_values'
  | 'sin_values'
  | 'random_values'
  | 'ramping_values';

export type ParamValue = number | boolean | string;

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
   * datetime.time in generated code.
   */
  type: 'int' | 'float' | 'bool' | 'pin' | 'channel' | 'text' | 'time';
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
