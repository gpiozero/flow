import { useRef } from 'react';
import type { PointerEvent } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { SPECS, barGraphLeds } from '../catalog';
import { useFlow } from '../store';
import type { DeviceFlowNode } from '../types';

// Pointer-downs shorter than this toggle the button; longer ones act
// as a momentary hold that releases on pointer-up.
const TAP_MS = 300;

export function DeviceNode({ id, data, selected, isConnectable }: NodeProps<DeviceFlowNode>) {
  const spec = SPECS[data.kind];
  const { deleteElements } = useReactFlow();
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
      case 'lightsensor':
      case 'distancesensor':
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
      case 'rotaryencoder':
        return (
          <input
            type="range"
            className="nodrag"
            min={-1}
            max={1}
            step={0.01}
            value={Number(data.state.level ?? 0)}
            onChange={(e) => updateNodeState(id, { level: Number(e.target.value) })}
          />
        );
      case 'motionsensor':
        return (
          <button
            className={`push-button nodrag${data.state.motion ? ' pressed' : ''}`}
            title="Click to toggle motion"
            onClick={() => updateNodeState(id, { motion: !data.state.motion })}
          >
            {data.state.motion ? 'motion' : 'still'}
          </button>
        );
      case 'linesensor':
        return (
          <button
            className={`push-button nodrag${data.state.detected ? ' pressed' : ''}`}
            title="Click to toggle line detection"
            onClick={() => updateNodeState(id, { detected: !data.state.detected })}
          >
            {data.state.detected ? 'line' : 'no line'}
          </button>
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
      case 'buzzer':
        return <div className={`buzzer${value !== 0 ? ' buzzing' : ''}`}>♪</div>;
      case 'servo':
      case 'angularservo':
        return (
          <div className="servo-gauge">
            <div className="servo-arm" style={{ transform: `rotate(${value * 90}deg)` }} />
            <div className="servo-hub" />
          </div>
        );
      case 'motor':
        return (
          <div className="motor-track">
            <div
              className="motor-fill"
              style={
                value >= 0
                  ? { left: '50%', width: `${value * 50}%` }
                  : { right: '50%', width: `${-value * 50}%` }
              }
            />
            <div className="motor-centre" />
          </div>
        );
      case 'ledbargraph': {
        const leds = barGraphLeds(data.params);
        const lit = Math.round(Math.abs(value) * leds);
        // negative values fill from the far end, as in gpiozero
        return (
          <div className="bar-graph">
            {Array.from({ length: leds }, (_, i) => {
              const on = value < 0 ? i >= leds - lit : i < lit;
              return <div key={i} className={`bar-led${on ? ' on' : ''}`} />;
            })}
          </div>
        );
      }
      default:
        return <div className="tool-fn">{spec.section === 'sources' ? '∿' : 'ƒ(x)'}</div>;
    }
  };

  const subtitle = () => {
    switch (data.kind) {
      case 'button':
      case 'led':
      case 'pwmled':
      case 'buzzer':
      case 'servo':
      case 'angularservo':
      case 'lightsensor':
      case 'motionsensor':
      case 'linesensor':
        return `pin ${data.params.pin}`;
      case 'motor':
        return `pins ${data.params.forward}/${data.params.backward}`;
      case 'distancesensor':
        return `pins ${data.params.echo}/${data.params.trigger}`;
      case 'rotaryencoder':
        return `pins ${data.params.a}/${data.params.b}`;
      case 'ledbargraph':
        return `${data.params.leds} leds`;
      case 'pot':
        return `channel ${data.params.channel}`;
      default:
        return spec.section === 'sources' ? 'artificial source' : 'source tool';
    }
  };

  return (
    <div className={`device-node section-${spec.section}${selected ? ' selected' : ''}`}>
      <button
        className="node-delete nodrag nopan"
        title="Delete node"
        onClick={(e) => {
          e.stopPropagation();
          deleteElements({ nodes: [{ id }] });
        }}
      >
        ×
      </button>
      {spec.hasInput && (
        <Handle id="in" type="target" position={Position.Left} isConnectable={isConnectable} />
      )}
      <div className="node-header">
        <span className="node-title">{data.name ?? spec.label}</span>
        <span className={`node-value${spec.valueKind === 'float' ? ' node-value-float' : ''}`}>
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
