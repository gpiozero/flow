import type { Node } from '@xyflow/react';

export type Section = 'inputs' | 'outputs' | 'tools' | 'sources';

export type NodeKind =
  | 'button'
  | 'pot'
  | 'led'
  | 'pwmled'
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
  type: 'int' | 'float' | 'bool';
  default: ParamValue;
  min?: number;
  max?: number;
  step?: number;
  /** set as an attribute after construction (e.g. source_delay), not a constructor arg */
  attr?: boolean;
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
