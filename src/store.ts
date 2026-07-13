import { createContext, useContext } from 'react';
import type { ParamValue } from './types';

export interface FlowContextValue {
  /** current simulated value of every node, keyed by node id */
  values: Record<string, number>;
  /** patch a node's interactive state (button pressed, pot level, ...) */
  updateNodeState: (id: string, patch: Record<string, ParamValue>) => void;
}

export const FlowContext = createContext<FlowContextValue>({
  values: {},
  updateNodeState: () => {},
});

export const useFlow = () => useContext(FlowContext);
