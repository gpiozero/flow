import { useRef } from 'react';
import type { PointerEvent } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { SPECS } from '../catalog';
import { useFlow } from '../store';
import type { DeviceFlowNode } from '../types';

// Pointer-downs shorter than this toggle the button; longer ones act
// as a momentary hold that releases on pointer-up.
const TAP_MS = 300;

export function DeviceNode({ id, data, selected, isConnectable }: NodeProps<DeviceFlowNode>) {
  const spec = SPECS[data.kind];
  const { values, updateNodeState } = useFlow();
  const value = values[id] ?? 0;
  const pressInfo = useRef<{ wasPressed: boolean; at: number } | null>(null);

  const onButtonDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pressInfo.current = { wasPressed: Boolean(data.state.pressed), at: performance.now() };
    updateNodeState(id, { pressed: true });
  };

  const onButtonUp = () => {
    const info = pressInfo.current;
    pressInfo.current = null;
    // A quick tap on an unpressed button leaves it latched on;
    // anything else (tap while latched, or a long hold) releases.
    const latching = info && !info.wasPressed && performance.now() - info.at < TAP_MS;
    if (!latching) updateNodeState(id, { pressed: false });
  };

  const body = () => {
    switch (data.kind) {
      case 'button':
        return (
          <button
            className={`push-button nodrag${data.state.pressed ? ' pressed' : ''}`}
            title="Click to toggle; hold for a momentary press"
            onPointerDown={onButtonDown}
            onPointerUp={onButtonUp}
            onPointerCancel={() => {
              pressInfo.current = null;
              updateNodeState(id, { pressed: false });
            }}
          >
            {data.state.pressed ? 'release' : 'press'}
          </button>
        );
      case 'pot':
        return (
          <input
            type="range"
            className="nodrag"
            min={0}
            max={1}
            step={0.01}
            value={Number(data.state.level ?? 0)}
            onChange={(e) => updateNodeState(id, { level: Number(e.target.value) })}
          />
        );
      case 'led':
        return <div className={`led-dot${value > 0 ? ' lit' : ''}`} />;
      case 'pwmled':
        return (
          <div className="led-dot">
            <div
              className="pwm-fill"
              style={{
                opacity: value,
                boxShadow: `0 0 ${14 * value}px ${4 * value}px rgba(239, 68, 68, ${0.6 * value})`,
              }}
            />
          </div>
        );
      default:
        return <div className="tool-fn">{spec.section === 'sources' ? '∿' : 'ƒ(x)'}</div>;
    }
  };

  const subtitle = () => {
    switch (data.kind) {
      case 'button':
      case 'led':
      case 'pwmled':
        return `pin ${data.params.pin}`;
      case 'pot':
        return `channel ${data.params.channel}`;
      default:
        return spec.section === 'sources' ? 'artificial source' : 'source tool';
    }
  };

  return (
    <div className={`device-node section-${spec.section}${selected ? ' selected' : ''}`}>
      {spec.hasInput && (
        <Handle id="in" type="target" position={Position.Left} isConnectable={isConnectable} />
      )}
      <div className="node-header">
        <span className="node-title">{data.name ?? spec.label}</span>
        <span className="node-value">
          {spec.valueKind === 'float' ? value.toFixed(2) : value > 0 ? '1' : '0'}
        </span>
      </div>
      <div className="node-body">{body()}</div>
      <div className="node-sub">{subtitle()}</div>
      {spec.hasOutput && (
        <Handle id="out" type="source" position={Position.Right} isConnectable={isConnectable} />
      )}
    </div>
  );
}
