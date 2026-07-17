import { createContext, useContext } from 'react';
import type { PinNumbering } from './pins';
import type { ParamValue, SimValue } from './types';

export interface FlowContextValue {
  /** current simulated value of every node, keyed by node id */
  values: Record<string, SimValue>;
  /** patch a node's interactive state (button pressed, pot level, ...) */
  updateNodeState: (id: string, patch: Record<string, ParamValue>) => void;
  /** how pins are displayed: BCM ints or BOARD header numbers */
  numbering: PinNumbering;
}

export const FlowContext = createContext<FlowContextValue>({
  values: {},
  updateNodeState: () => {},
  numbering: 'bcm',
});

export const useFlow = () => useContext(FlowContext);
