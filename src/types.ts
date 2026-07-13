import type { Node } from '@xyflow/react';

export type Section = 'inputs' | 'outputs' | 'tools';

export type NodeKind =
  | 'button'
  | 'pot'
  | 'led'
  | 'pwmled'
  | 'negated'
  | 'all_values'
  | 'scaled';

export type ParamValue = number | boolean;

export interface ParamSpec {
  name: string;
  label: string;
  type: 'int' | 'float' | 'bool';
  default: ParamValue;
  min?: number;
  max?: number;
  step?: number;
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
  params: ParamSpec[];
  /** interactive state for simulation, e.g. { pressed: false } */
  initialState?: Record<string, ParamValue>;
}

export interface DeviceData extends Record<string, unknown> {
  kind: NodeKind;
  params: Record<string, ParamValue>;
  state: Record<string, ParamValue>;
}

export type DeviceFlowNode = Node<DeviceData, 'device'>;
