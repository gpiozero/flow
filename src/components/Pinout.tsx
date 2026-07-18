import { requiredPinParams } from '../catalog';
import { BOARD_TO_BCM } from '../pins';
import type { PinNumbering } from '../pins';
import type { DeviceFlowNode } from '../types';

/**
 * The physical 40-pin J8 header, two columns of 20 like the board
 * itself, with pins taken by canvas devices highlighted and labelled
 * with the device's name. Clicking a used pin selects its device.
 */

const POWER_LABELS: Record<number, string> = {
  1: '3V3', 17: '3V3',
  2: '5V', 4: '5V',
  6: 'GND', 9: 'GND', 14: 'GND', 20: 'GND', 25: 'GND',
  30: 'GND', 34: 'GND', 39: 'GND',
};

interface PinUse {
  nodeId: string;
  deviceName: string;
}

interface Props {
  nodes: DeviceFlowNode[];
  numbering: PinNumbering;
  onSelectNode: (id: string) => void;
  onClose: () => void;
}

export function Pinout({ nodes, numbering, onSelectNode, onClose }: Props) {
  const uses = new Map<number, PinUse>();
  for (const n of nodes) {
    for (const param of requiredPinParams(n.data.kind, n.data.params)) {
      const bcm = Number(n.data.params[param]);
      if (!uses.has(bcm)) {
        uses.set(bcm, { nodeId: n.id, deviceName: String(n.data.name ?? n.data.kind) });
      }
    }
  }

  const renderPin = (phys: number, side: 'left' | 'right') => {
    const power = POWER_LABELS[phys];
    const bcm = BOARD_TO_BCM[phys];
    const use = bcm !== undefined ? uses.get(bcm) : undefined;
    const fn = power ?? (numbering === 'board' ? `BOARD${phys}` : `GPIO${bcm}`);
    const kind = power ? power.toLowerCase().replace('3v3', 'v33') : 'gpio';
    const title = power
      ? `${fn} (physical pin ${phys})`
      : `GPIO${bcm} (physical pin ${phys}) — ${use ? `used by ${use.deviceName}` : 'free'}`;
    const label = use ? use.deviceName : fn;
    return (
      <button
        type="button"
        className={`pinout-pin pinout-${side} pinout-${kind} ${use ? 'pinout-used' : ''}`}
        title={title}
        disabled={!use}
        onClick={() => use && onSelectNode(use.nodeId)}
      >
        <span className="pinout-label">{label}</span>
        <span className="pinout-circle">{phys}</span>
      </button>
    );
  };

  return (
    <aside className="pinout-panel" aria-label="GPIO pinout">
      <header className="pinout-header">
        <span>GPIO header</span>
        <button type="button" className="pinout-close" onClick={onClose} aria-label="Close pinout">
          ×
        </button>
      </header>
      <div className="pinout-grid">
        {Array.from({ length: 20 }, (_, row) => (
          <div key={row} className="pinout-row">
            {renderPin(2 * row + 1, 'left')}
            {renderPin(2 * row + 2, 'right')}
          </div>
        ))}
      </div>
    </aside>
  );
}
