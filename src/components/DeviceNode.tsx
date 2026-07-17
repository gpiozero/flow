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

// Rotary encoder detent size: 20 steps per revolution, like a KY-040
const DEG_PER_STEP = 18;

export function DeviceNode({ id, data, selected, isConnectable }: NodeProps<DeviceFlowNode>) {
  const spec = SPECS[data.kind];
  const { deleteElements } = useReactFlow();
  const { values, updateNodeState } = useFlow();
  const raw = values[id] ?? 0;
  // scalar view for single-channel visuals; tuple set for multi-channel nodes
  const value = Array.isArray(raw) ? (raw[0] ?? 0) : raw;
  const tuple = Array.isArray(raw) ? raw : null;
  const channel = (i: number) => (tuple ? (tuple[i] ?? 0) : 0);
  const pressInfo = useRef<{ wasPressed: boolean; at: number } | null>(null);
  // last pointer angle plus rotation not yet big enough to be a step
  const knobDrag = useRef<{ angle: number; remainder: number } | null>(null);
  // authoritative step count: rapid wheel/drag events can outpace the
  // re-render, so reading steps back from props would drop increments
  const knobSteps = useRef<number | null>(null);

  const rotate = (change: number) => {
    const maxSteps = Math.floor(Number(data.params.max_steps));
    let steps = (knobSteps.current ?? Number(data.state.steps ?? 0)) + change;
    if (maxSteps > 0) {
      if (data.params.wrap)
        steps = ((((steps + maxSteps) % (2 * maxSteps)) + 2 * maxSteps) % (2 * maxSteps)) - maxSteps;
      else steps = Math.min(maxSteps, Math.max(-maxSteps, steps));
    }
    knobSteps.current = steps;
    updateNodeState(id, { steps });
  };

  const pointerAngle = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };

  const onKnobDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    knobDrag.current = { angle: pointerAngle(e), remainder: 0 };
  };

  const onKnobMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = knobDrag.current;
    if (!drag) return;
    const angle = pointerAngle(e);
    let delta = angle - drag.angle;
    // take the short way round so crossing ±180° isn't a near-full turn
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    drag.angle = angle;
    drag.remainder += delta;
    const change = Math.trunc(drag.remainder / DEG_PER_STEP);
    if (change !== 0) {
      drag.remainder -= change * DEG_PER_STEP;
      rotate(change);
    }
  };

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
          <div
            className="encoder-knob nodrag nowheel"
            title="Drag round to rotate; scroll to step"
            onPointerDown={onKnobDown}
            onPointerMove={onKnobMove}
            onPointerUp={() => (knobDrag.current = null)}
            onPointerCancel={() => (knobDrag.current = null)}
            onWheel={(e) => rotate(e.deltaY < 0 ? 1 : -1)}
          >
            <div
              className="encoder-pointer"
              style={{
                transform: `rotate(${Number(data.state.steps ?? 0) * DEG_PER_STEP}deg)`,
              }}
            />
          </div>
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
      case 'rgbled': {
        const [r, g, b] = [channel(0), channel(1), channel(2)];
        const on = r > 0 || g > 0 || b > 0;
        const colour = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
        return (
          <div className="led-dot">
            {on && (
              <div
                className="rgb-fill"
                style={{
                  background: colour,
                  boxShadow: `0 0 14px 4px rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, 0.6)`,
                }}
              />
            )}
          </div>
        );
      }
      case 'trafficlights':
        return (
          <div className="traffic-light">
            {['red', 'amber', 'green'].map((colour, i) => (
              <div key={colour} className={`traffic-lamp ${colour}`}>
                <div className="traffic-fill" style={{ opacity: channel(i) }} />
              </div>
            ))}
          </div>
        );
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
        const mag = Math.abs(value) * leds;
        return (
          <div className="bar-graph">
            {Array.from({ length: leds }, (_, i) => {
              // negative values fill from the far end, as in gpiozero;
              // with pwm the LED the value only partly covers is dimmed
              const slot = value < 0 ? leds - 1 - i : i;
              const brightness = Math.min(1, Math.max(0, mag - slot + 1e-9));
              if (!data.params.pwm)
                return <div key={i} className={`bar-led${brightness >= 1 ? ' on' : ''}`} />;
              return (
                <div key={i} className="bar-led">
                  <div className="bar-fill" style={{ opacity: brightness }} />
                </div>
              );
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
      case 'rgbled':
        return `pins ${data.params.red}/${data.params.green}/${data.params.blue}`;
      case 'trafficlights':
        return `pins ${data.params.red}/${data.params.amber}/${data.params.green}`;
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
        <span
          className={`node-value${tuple ? ' node-value-tuple' : spec.valueKind === 'float' ? ' node-value-float' : ''}`}
        >
          {tuple
            ? `(${tuple.map((c) => ((data.params.pwm ?? spec.valueKind === 'float') ? c.toFixed(1) : c !== 0 ? '1' : '0')).join(', ')})`
            : spec.valueKind === 'float'
              ? value.toFixed(2)
              : value > 0
                ? '1'
                : '0'}
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
