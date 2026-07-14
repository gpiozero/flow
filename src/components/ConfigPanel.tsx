import { useState } from 'react';
import { GPIO_PINS, NAME_PATTERN, SPECS } from '../catalog';
import type { DeviceFlowNode, ParamValue } from '../types';

interface Props {
  node: DeviceFlowNode | null;
  /** pins used by other nodes; shown disabled in the pin dropdown */
  takenPins: ReadonlySet<number>;
  /** names used by other nodes; duplicates are rejected */
  takenNames: ReadonlySet<string>;
  onChangeParam: (id: string, name: string, value: ParamValue) => void;
  onChangeName: (id: string, name: string) => void;
}

export function ConfigPanel({ node, takenPins, takenNames, onChangeParam, onChangeName }: Props) {
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
      {typeof node.data.name === 'string' && (
        <NameField
          key={node.id}
          node={node}
          takenNames={takenNames}
          onChangeName={onChangeName}
        />
      )}
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

// The name doubles as the Python variable in the code preview, so it
// only commits while valid: lowercase letters, digits and underscores,
// no leading digit, and unique among the other nodes. The draft keeps
// what was typed so the user can edit through a transient collision.
function NameField({
  node,
  takenNames,
  onChangeName,
}: {
  node: DeviceFlowNode;
  takenNames: ReadonlySet<string>;
  onChangeName: (id: string, name: string) => void;
}) {
  const [draft, setDraft] = useState(node.data.name ?? '');
  const [error, setError] = useState<string | null>(null);

  const onChange = (raw: string) => {
    const value = raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setDraft(value);
    if (!value) setError('a name is required');
    else if (!NAME_PATTERN.test(value)) setError('names cannot start with a digit');
    else if (takenNames.has(value)) setError('name already in use');
    else {
      setError(null);
      onChangeName(node.id, value);
    }
  };

  return (
    <label className="config-field">
      <span>name</span>
      <input
        type="text"
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error !== null}
      />
      {error && <span className="config-error">{error}</span>}
    </label>
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
  const varName = node.data.name ?? node.data.kind;
  const [first, ...rest] = spec.params;
  const args = [pyLiteral(params[first.name])];
  const attrs: string[] = [];
  for (const p of rest) {
    const value = params[p.name];
    if (value === p.default) continue;
    // attributes like source_delay are set after construction
    if (p.attr) attrs.push(`${varName}.${p.name} = ${pyLiteral(value)}`);
    else args.push(`${p.name}=${pyLiteral(value)}`);
  }
  return [`${varName} = ${spec.label}(${args.join(', ')})`, ...attrs].join('\n');
}

function pyLiteral(value: ParamValue): string {
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  return String(value);
}
