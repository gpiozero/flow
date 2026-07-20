import { SPECS, dynamicPinCount } from './catalog';
import type { DeviceData, NodeKind, ParamValue } from './types';

/**
 * Splitting multi-device components into their constituent devices:
 * TrafficLights becomes three LEDs on the red/amber/green pins, Robot
 * becomes two Motors, and so on — the inverse of dropping a board.
 * The parts keep the parent's pins and carried-over params; the part
 * kind follows pwm (LED vs PWMLED) where the parent has it.
 */

export interface SplitPart {
  kind: NodeKind;
  /** appended to the parent's name: lights -> lights_red */
  suffix: string;
  params: Record<string, ParamValue>;
}

function ledKind(pwm: ParamValue): NodeKind {
  return pwm ? 'pwmled' : 'led';
}

function dynamicPins(data: DeviceData): ParamValue[] {
  return Array.from(
    { length: dynamicPinCount(data.kind, data.params) },
    (_, i) => data.params[`pin${i + 1}`],
  );
}

export function splitParts(data: DeviceData): SplitPart[] | null {
  const p = data.params;
  switch (data.kind) {
    case 'trafficlights':
      return ['red', 'amber', 'green'].map((colour) => ({
        kind: ledKind(p.pwm),
        suffix: colour,
        params: { pin: p[colour], source_delay: p.source_delay },
      }));
    case 'rgbled':
      return ['red', 'green', 'blue'].map((colour) => ({
        kind: ledKind(p.pwm),
        suffix: colour,
        params: { pin: p[colour], active_high: p.active_high, source_delay: p.source_delay },
      }));
    case 'ledboard': {
      // _channelNames (e.g. PiHutXmasTree's star/red_1/red_2/...)
      // becomes the split names too: tree_star, tree_red_1, ...
      const channelNames =
        typeof p._channelNames === 'string' ? p._channelNames.split(',') : null;
      return dynamicPins(data).map((pin, i) => ({
        kind: ledKind(p.pwm),
        suffix: channelNames?.[i] ?? `${i + 1}`,
        params: {
          pin,
          active_high: p.active_high,
          // LEDBoard's initial_value is a bool; PWMLED's is a float
          initial_value: p.pwm ? Number(Boolean(p.initial_value)) : p.initial_value,
          source_delay: p.source_delay,
        },
      }));
    }
    case 'ledbargraph':
      // the graph's initial_value (a -1..1 fill fraction) has no
      // per-LED equivalent, so the parts start at their default
      return dynamicPins(data).map((pin, i) => ({
        kind: ledKind(p.pwm),
        suffix: `${i + 1}`,
        params: { pin, source_delay: p.source_delay },
      }));
    case 'buttonboard':
      return dynamicPins(data).map((pin, i) => ({
        kind: 'button',
        suffix: `${i + 1}`,
        params: { pin, pull_up: p.pull_up },
      }));
    case 'robot':
      return [
        {
          kind: 'motor',
          suffix: 'left',
          params: {
            forward: p.left_forward,
            backward: p.left_backward,
            source_delay: p.source_delay,
          },
        },
        {
          kind: 'motor',
          suffix: 'right',
          params: {
            forward: p.right_forward,
            backward: p.right_backward,
            source_delay: p.source_delay,
          },
        },
      ];
    default:
      return null;
  }
}

/** Button label for a splittable node: "3 LEDs", "2 Motors" — or null */
export function splitLabel(data: DeviceData): string | null {
  const parts = splitParts(data);
  if (!parts) return null;
  return `${parts.length} ${SPECS[parts[0].kind].label}s`;
}
