import type { Node } from '@xyflow/react';

export type Section = 'inputs' | 'outputs' | 'tools' | 'sources';

export type NodeKind =
  | 'button'
  | 'pot'
  | 'lightsensor'
  | 'motionsensor'
  | 'led'
  | 'pwmled'
  | 'buzzer'
  | 'servo'
  | 'motor'
  | 'ledbargraph'
  | 'negated'
  | 'inverted'
  | 'all_values'
  | 'any_values'
  | 'summed'
  | 'scaled'
  | 'smoothed'
  | 'alternating_values'
  | 'cos_values'
  | 'sin_values'
  | 'random_values'
  | 'ramping_values';

export type ParamValue = number | boolean;

export interface ParamSpec {
  name: string;
  label: string;
  /**
   * 'pin' renders a GPIO pin dropdown and participates in unique pin
   * assignment; 'channel' does the same for MCP3008 channels 0-7
   */
  type: 'int' | 'float' | 'bool' | 'pin' | 'channel';
  default: ParamValue;
  min?: number;
  max?: number;
  step?: number;
  /** set as an attribute after construction (e.g. source_delay), not a constructor arg */
  attr?: boolean;
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
  hasInput: boolean;
  /** allow more than one incoming connection (e.g. all_values) */
  multiInput?: boolean;
  hasOutput: boolean;
  /** value depends on the simulation clock, not just on inputs */
  timeBased?: boolean;
  /** takes a variable-length pin list (pin1..pinN params) sized by the `leds` param */
  dynamicPins?: boolean;
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
