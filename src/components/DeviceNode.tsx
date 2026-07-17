import { useEffect, useRef } from 'react';
import type { PointerEvent, ReactElement } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { SPECS, adcMin, dynamicPinCount } from '../catalog';
import { pinDisplay } from '../pins';
import { useFlow } from '../store';
import type { DeviceFlowNode, NodeKind, ParamValue } from '../types';

// Pointer-downs shorter than this toggle the button; longer ones act
// as a momentary hold that releases on pointer-up.
const TAP_MS = 300;

// Rotary encoder detent size: 20 steps per revolution, like a KY-040
const DEG_PER_STEP = 18;

// Motor wheel speed at full value: one revolution per second
const WHEEL_DEG_PER_SEC = 360;

// note names for the tonal buzzer's readout; its mid tone is A4
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

const waveIcon = (d: string) => (
  <svg className="wave-icon" viewBox="0 0 40 16" aria-hidden="true">
    <path d={d} />
  </svg>
);

// Artificial sources show the waveform they emit; tools that reshape a
// signal show the shape they produce, and arithmetic/logic tools show a
// glyph. Anything absent falls back to ∿ / ƒ(x) by section.
const NODE_ICONS: Partial<Record<NodeKind, ReactElement | string>> = {
  sin_values: waveIcon('M0 8 Q5 -2 10 8 Q15 18 20 8 Q25 -2 30 8 Q35 18 40 8'),
  // the sine path shifted a quarter period, so it starts on a peak
  cos_values: waveIcon('M0 3 Q2.5 3 5 8 Q10 18 15 8 Q20 -2 25 8 Q30 18 35 8 Q37.5 3 40 3'),
  alternating_values: waveIcon('M0 12 H5 V4 H15 V12 H25 V4 H35 V12 H40'),
  ramping_values: waveIcon('M0 12 L10 4 L20 12 L30 4 L40 12'),
  random_values: waveIcon('M0 8 L4 3 L8 11 L12 5 L16 13 L20 4 L24 9 L28 2 L32 10 L36 6 L40 8'),
  negated: '!',
  inverted: '1-x',
  // a sine clipped flat where it hits the limits
  clamped: waveIcon('M0 4 H10 C14 4 14 12 18 12 H28 C32 12 32 4 36 4 H40'),
  quantized: waveIcon('M0 14 H10 V10 H20 V6 H30 V2 H40'),
  // a sine snapping to a square wave at the threshold
  booleanized: waveIcon('M0 8 Q5 -2 10 8 Q15 18 20 8 V4 H30 V12 H40'),
  // noise settling into a gentle wave
  smoothed: waveIcon('M0 8 L4 4 L8 11 L12 5 L16 10 L20 8 Q25 5 30 8 Q35 11 40 8'),
  // a sine arriving late: flat while the queue fills
  queued: waveIcon('M0 8 H14 Q19 -2 24 8 Q29 18 34 8 Q39 0 40 4'),
  // a long wait, then the signal; and the signal, then the wait
  pre_delayed: waveIcon('M0 12 H22 V4 H40'),
  post_delayed: waveIcon('M0 4 H18 V12 H40'),
  // gaps where values are blocked: leading gap vs trailing gaps
  pre_periodic_filtered: waveIcon('M8 8 H18 M28 8 H38'),
  post_periodic_filtered: waveIcon('M0 8 H12 M22 8 H34'),
  // half-range wave growing to full range, and the reverse
  scaled_full: waveIcon('M0 8 Q5 5 10 8 Q15 11 20 8 Q25 -2 30 8 Q35 18 40 8'),
  scaled_half: waveIcon('M0 8 Q5 -2 10 8 Q15 18 20 8 Q25 5 30 8 Q35 11 40 8'),
  // two wires merging into one
  zip_values: waveIcon('M0 3 C12 3 12 8 24 8 H40 M0 13 C12 13 12 8 24 8'),
  summed: 'Σ',
  multiplied: 'Π',
  averaged: 'x̄',
  absoluted: '|x|',
  all_values: '&',
  any_values: '≥1',
};

// A wheel turning via direct DOM writes from a rAF loop: the angle
// accumulates at a rate set by the speed, so speed changes and
// reversals stay smooth without re-rendering every frame.
function MotorWheel({ speed, small }: { speed: number; small?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const angle = useRef(0);
  useEffect(() => {
    if (speed === 0) return;
    let last = performance.now();
    let raf = requestAnimationFrame(function turn(now: number) {
      angle.current =
        (angle.current + ((now - last) / 1000) * speed * WHEEL_DEG_PER_SEC) % 360;
      last = now;
      if (ref.current) ref.current.style.transform = `rotate(${angle.current}deg)`;
      raf = requestAnimationFrame(turn);
    });
    return () => cancelAnimationFrame(raf);
  }, [speed]);
  return (
    <div className={`motor-wheel${small ? ' small' : ''}`} ref={ref}>
      <div className="motor-spoke" />
      <div className="motor-spoke cross" />
      <div className="motor-hub" />
    </div>
  );
}

export function DeviceNode({ id, data, selected, isConnectable }: NodeProps<DeviceFlowNode>) {
  const spec = SPECS[data.kind];
  const { deleteElements } = useReactFlow();
  const { values, updateNodeState, numbering } = useFlow();
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
            className={`tactile-button nodrag${data.state.pressed ? ' pressed' : ''}`}
            title="Click to toggle; hold for a momentary press"
            aria-pressed={Boolean(data.state.pressed)}
            aria-label="push button"
            onPointerDown={onButtonDown}
            onPointerUp={onButtonUp}
            onPointerCancel={() => {
              pressInfo.current = null;
              updateNodeState(id, { pressed: false });
            }}
          >
            <span className="tactile-cap" />
          </button>
        );
      case 'pot':
      case 'mcp3001':
      case 'mcp3002':
      case 'mcp3004':
      case 'mcp3201':
      case 'mcp3202':
      case 'mcp3204':
      case 'mcp3208':
      case 'mcp3301':
      case 'mcp3302':
      case 'mcp3304':
      case 'lightsensor':
      case 'distancesensor':
      case 'cputemperature':
      case 'loadaverage':
      case 'diskusage': {
        const level = Number(data.state.level ?? 0);
        // signed ADCs (MCP33xx in differential mode) slide -1..1
        const min = spec.section === 'adc' ? adcMin(data.kind, data.params) : 0;
        const slider = (
          <input
            type="range"
            className="nodrag"
            min={min}
            max={1}
            step={0.01}
            value={level}
            onChange={(e) => updateNodeState(id, { level: Number(e.target.value) })}
          />
        );
        if (spec.section === 'adc') {
          const fraction = (level - min) / (1 - min);
          return (
            <div className="widget-stack">
              <div className="pot-icon">
                <div
                  className="pot-slot"
                  style={{ transform: `rotate(${(fraction - 0.5) * 270}deg)` }}
                />
              </div>
              {slider}
            </div>
          );
        }
        if (data.kind === 'distancesensor')
          return (
            <div className="widget-stack">
              <div className="sonar">
                <div className="sonar-board" />
                <div className="sonar-target" style={{ left: `${16 + level * 91}px` }} />
              </div>
              {slider}
            </div>
          );
        if (data.kind === 'cputemperature')
          return (
            <div className="widget-stack">
              <div className="thermo">
                <div className="thermo-fill" style={{ height: `${level * 100}%` }} />
              </div>
              {slider}
            </div>
          );
        if (data.kind === 'loadaverage')
          return (
            <div className="widget-stack">
              <div className="load-bars">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="load-bar">
                    <div
                      className="load-fill"
                      style={{ height: `${Math.min(1, Math.max(0, level * 3 - i)) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
              {slider}
            </div>
          );
        if (data.kind === 'diskusage')
          return (
            <div className="widget-stack">
              <div
                className="disk-donut"
                style={{
                  background: `conic-gradient(#f59e0b ${level * 360}deg, #e2e8f0 0deg)`,
                }}
              >
                <div className="disk-hole" />
              </div>
              {slider}
            </div>
          );
        return (
          <div className="widget-stack">
            <div className="light-sun">
              <div className="light-rays" style={{ opacity: level }} />
              <div className="light-glow" style={{ opacity: level }} />
            </div>
            {slider}
          </div>
        );
      }
      case 'pingserver':
        return (
          <button
            className={`ping-server nodrag${data.state.up ? ' up' : ''}`}
            title="Click to toggle reachability"
            aria-pressed={Boolean(data.state.up)}
            aria-label="host reachable"
            onClick={() => updateNodeState(id, { up: !data.state.up })}
          >
            <span className="ping-slot" />
            <span className="ping-slot" />
            <span className="ping-led" />
          </button>
        );
      case 'timeofday': {
        // a live clock face; the dial glows while inside the window
        const now = new Date();
        const h = data.params.utc ? now.getUTCHours() : now.getHours();
        const m = data.params.utc ? now.getUTCMinutes() : now.getMinutes();
        return (
          <div className={`clock${value > 0 ? ' active' : ''}`}>
            <div
              className="clock-hand hour"
              style={{ transform: `rotate(${(h % 12) * 30 + m / 2}deg)` }}
            />
            <div className="clock-hand minute" style={{ transform: `rotate(${m * 6}deg)` }} />
          </div>
        );
      }
      case 'energenie':
        // a BS 1363 plug face: earth pin up top, live/neutral below
        return (
          <div className={`uk-plug${value > 0 ? ' on' : ''}`}>
            <span className="plug-pin earth" />
            <span className="plug-pin live" />
            <span className="plug-pin neutral" />
          </div>
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
            className={`pir nodrag${data.state.motion ? ' active' : ''}`}
            title="Click to toggle motion"
            aria-pressed={Boolean(data.state.motion)}
            aria-label="motion"
            onClick={() => updateNodeState(id, { motion: !data.state.motion })}
          >
            <span className="pir-dome" />
          </button>
        );
      case 'linesensor':
        return (
          <button
            className={`line-sensor nodrag${data.state.detected ? ' active' : ''}`}
            title="Click to toggle line detection"
            aria-pressed={Boolean(data.state.detected)}
            aria-label="line detected"
            onClick={() => updateNodeState(id, { detected: !data.state.detected })}
          >
            <span className="line-eye emitter" />
            <span className="line-eye detector" />
            <span className="line-indicator" />
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
        return <div className={`buzzer${value !== 0 ? ' buzzing' : ''}`} />;
      case 'tonalbuzzer': {
        // value 0 is A4 (midi 69); ±1 spans `octaves` octaves either way
        const playing = !Number.isNaN(value);
        let note = '—';
        if (playing) {
          const midi = 69 + Math.round(value * 12 * Number(data.params.octaves));
          note = `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
        }
        return (
          <div className="widget-stack">
            <div className={`buzzer${playing ? ' buzzing' : ''}`} />
            <span className="tone-note">{note}</span>
          </div>
        );
      }
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
      case 'angularservo': {
        // the horn shows the real angle: AngularServo maps -1..1 onto
        // its min_angle..max_angle range, plain Servo onto ±90°
        let angle = value * 90;
        if (data.kind === 'angularservo') {
          const minAngle = Number(data.params.min_angle);
          const maxAngle = Number(data.params.max_angle);
          angle = minAngle + ((value + 1) / 2) * (maxAngle - minAngle);
        }
        return (
          <div className="servo">
            <div className="servo-shaft">
              <div className="servo-horn" style={{ transform: `rotate(${angle}deg)` }} />
            </div>
          </div>
        );
      }
      case 'motor':
      case 'phaseenablemotor':
        return <MotorWheel speed={value} />;
      case 'robot':
        return (
          <div className="robot">
            <MotorWheel speed={channel(0)} small />
            <div className="robot-chassis" />
            <MotorWheel speed={channel(1)} small />
          </div>
        );
      case 'buttonboard':
        return (
          <div className="board-row">
            {Array.from({ length: dynamicPinCount(data.kind, data.params) }, (_, i) => {
              const key = `pressed${i + 1}`;
              return (
                <button
                  key={i}
                  className={`tactile-button mini nodrag${data.state[key] ? ' pressed' : ''}`}
                  title="Click to toggle"
                  aria-pressed={Boolean(data.state[key])}
                  aria-label={`button ${i + 1}`}
                  onClick={() => updateNodeState(id, { [key]: !data.state[key] })}
                >
                  <span className="tactile-cap" />
                </button>
              );
            })}
          </div>
        );
      case 'ledboard':
        return (
          <div className="board-row">
            {Array.from({ length: dynamicPinCount(data.kind, data.params) }, (_, i) => {
              const brightness = channel(i);
              if (!data.params.pwm)
                return <div key={i} className={`led-dot small${brightness !== 0 ? ' lit' : ''}`} />;
              return (
                <div key={i} className="led-dot small">
                  <div
                    className="pwm-fill"
                    style={{
                      opacity: brightness,
                      boxShadow: `0 0 ${8 * brightness}px ${2 * brightness}px rgba(239, 68, 68, ${0.6 * brightness})`,
                    }}
                  />
                </div>
              );
            })}
          </div>
        );
      case 'ledbargraph': {
        const leds = dynamicPinCount(data.kind, data.params);
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
        return (
          <div className="tool-fn">
            {NODE_ICONS[data.kind] ?? (spec.section === 'sources' ? '∿' : 'ƒ(x)')}
          </div>
        );
    }
  };

  const subtitle = () => {
    const pin = (v: ParamValue | undefined) => pinDisplay(Number(v), numbering);
    switch (data.kind) {
      case 'button':
      case 'led':
      case 'pwmled':
      case 'buzzer':
      case 'tonalbuzzer':
      case 'servo':
      case 'angularservo':
      case 'lightsensor':
      case 'motionsensor':
      case 'linesensor':
        return `pin ${pin(data.params.pin)}`;
      case 'motor':
        return `pins ${pin(data.params.forward)}/${pin(data.params.backward)}`;
      case 'phaseenablemotor':
        return `pins ${pin(data.params.phase)}/${pin(data.params.enable)}`;
      case 'energenie':
        return `socket ${data.params.socket}`;
      case 'cputemperature': {
        const min = Number(data.params.min_temp);
        return `${(min + value * (Number(data.params.max_temp) - min)).toFixed(1)}°C`;
      }
      case 'loadaverage': {
        const min = Number(data.params.min_load_average);
        return `load ${(min + value * (Number(data.params.max_load_average) - min)).toFixed(2)}`;
      }
      case 'diskusage':
        return `${data.params.filesystem} ${(value * 100).toFixed(0)}% full`;
      case 'timeofday':
        return `${data.params.start_time}–${data.params.end_time} ${data.params.utc ? 'UTC' : 'local'}`;
      case 'pingserver':
        return `${data.params.host}`;
      case 'robot':
        return `pins ${pin(data.params.left_forward)}/${pin(data.params.left_backward)}, ${pin(data.params.right_forward)}/${pin(data.params.right_backward)}`;
      case 'rgbled':
        return `pins ${pin(data.params.red)}/${pin(data.params.green)}/${pin(data.params.blue)}`;
      case 'trafficlights':
        return `pins ${pin(data.params.red)}/${pin(data.params.amber)}/${pin(data.params.green)}`;
      case 'distancesensor':
        return `pins ${pin(data.params.echo)}/${pin(data.params.trigger)}`;
      case 'rotaryencoder':
        return `pins ${pin(data.params.a)}/${pin(data.params.b)}`;
      case 'ledbargraph':
      case 'ledboard':
        return `${data.params.leds} leds`;
      case 'buttonboard':
        return `${data.params.buttons} buttons`;
      case 'pot':
      case 'mcp3002':
      case 'mcp3004':
      case 'mcp3202':
      case 'mcp3204':
      case 'mcp3208':
      case 'mcp3302':
      case 'mcp3304':
        return `channel ${data.params.channel}${data.params.differential ? ' (diff)' : ''}`;
      case 'mcp3001':
      case 'mcp3201':
      case 'mcp3301':
        return 'differential input';
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
            ? // channels pad to a fixed width so a sign flipping negative
              // doesn't change the node's width
              `(${tuple.map((c) => ((data.params.pwm ?? spec.valueKind === 'float') ? c.toFixed(1).padStart(4) : c !== 0 ? '1' : '0')).join(', ')})`
            : spec.valueKind === 'float'
              ? Number.isNaN(value)
                ? '–' // a silent TonalBuzzer: gpiozero's value None
                : value.toFixed(2)
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
