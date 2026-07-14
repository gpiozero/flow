import { GPIO_PINS, SPECS } from '../catalog';
import type { DeviceFlowNode, ParamValue } from '../types';

interface Props {
  node: DeviceFlowNode | null;
  /** pins used by other nodes; shown disabled in the pin dropdown */
  takenPins: ReadonlySet<number>;
  onChangeParam: (id: string, name: string, value: ParamValue) => void;
}

export function ConfigPanel({ node, takenPins, onChangeParam }: Props) {
  if (!node) {
    return (
      <aside className="config-panel">
        <p className="config-empty">Select a node to configure it.</p>
        <p className="config-hint">
          Wires feed one device's values into another's source. Click a wire and hit its × (or
          double-click the wire) to remove it. Delete/Backspace removes selected nodes and wires.
        </p>
      </aside>
    );
  }

  const spec = SPECS[node.data.kind];
  return (
    <aside className="config-panel">
      <h2>{spec.label}</h2>
      <p className="config-desc">{spec.description}</p>
      {spec.params.length === 0 ? (
        <p className="config-empty">No parameters.</p>
      ) : (
        spec.params.map((p) => {
          const value = node.data.params[p.name];
          return (
            <label key={p.name} className="config-field">
              <span>{p.label}</span>
              {p.name === 'pin' ? (
                <select
                  value={Number(value)}
                  onChange={(e) => onChangeParam(node.id, p.name, Number(e.target.value))}
                >
                  {GPIO_PINS.map((pin) => (
                    <option key={pin} value={pin} disabled={takenPins.has(pin)}>
                      {pin}
                      {takenPins.has(pin) ? ' (in use)' : ''}
                    </option>
                  ))}
                </select>
              ) : p.type === 'bool' ? (
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(e) => onChangeParam(node.id, p.name, e.target.checked)}
                />
              ) : (
                <input
                  type="number"
                  value={Number(value)}
                  min={p.min}
                  max={p.max}
                  step={p.step ?? (p.type === 'int' ? 1 : 0.01)}
                  onChange={(e) => onChangeParam(node.id, p.name, Number(e.target.value))}
                />
              )}
            </label>
          );
        })
      )}
      <div className="config-code">
        <code>{preview(node)}</code>
      </div>
    </aside>
  );
}

function preview(node: DeviceFlowNode): string {
  const spec = SPECS[node.data.kind];
  const params = node.data.params;
  if (spec.section === 'tools' || spec.section === 'sources') {
    const args = spec.hasInput ? ['values'] : [];
    for (const p of spec.params) {
      if (params[p.name] !== p.default) args.push(`${p.name}=${pyLiteral(params[p.name])}`);
    }
    return `${spec.label}(${args.join(', ')})`;
  }
  const [first, ...rest] = spec.params;
  const args = [pyLiteral(params[first.name])];
  const attrs: string[] = [];
  for (const p of rest) {
    const value = params[p.name];
    if (value === p.default) continue;
    if (p.attr) attrs.push(`${node.data.kind}.${p.name} = ${pyLiteral(value)}`);
    else args.push(`${p.name}=${pyLiteral(value)}`);
  }
  const ctor = `${spec.label}(${args.join(', ')})`;
  // attributes like source_delay are set after construction, so give
  // the device a name when any of them appear
  return attrs.length ? [`${node.data.kind} = ${ctor}`, ...attrs].join('\n') : ctor;
}

function pyLiteral(value: ParamValue): string {
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  return String(value);
}
