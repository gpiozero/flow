import { SPECS } from '../catalog';
import type { DeviceFlowNode, ParamValue } from '../types';

interface Props {
  node: DeviceFlowNode | null;
  onChangeParam: (id: string, name: string, value: ParamValue) => void;
}

export function ConfigPanel({ node, onChangeParam }: Props) {
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
              {p.type === 'bool' ? (
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
  if (spec.section === 'tools') return `${spec.label}(values)`;
  const params = node.data.params;
  const [first, ...rest] = spec.params;
  const args = [pyLiteral(params[first.name])];
  for (const p of rest) {
    const value = params[p.name];
    if (value !== p.default) args.push(`${p.name}=${pyLiteral(value)}`);
  }
  return `${spec.label}(${args.join(', ')})`;
}

function pyLiteral(value: ParamValue): string {
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  return String(value);
}
