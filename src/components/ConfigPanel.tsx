import { useState } from 'react';
import { useReactFlow } from '@xyflow/react';
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
  const { deleteElements } = useReactFlow();

  if (!node) {
    return (
      <aside className="config-panel">
        <p className="config-empty">Select a node to configure it.</p>
        <p className="config-hint">
          Wires feed one device's values into another's source. Click a wire and hit its × (or
          double-click the wire) to remove it. Nodes have an × too, or press Delete/Backspace to
          remove whatever is selected.
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
          // pins used by this node's other pin params (e.g. Motor's
          // forward/backward must differ)
          const siblingPins = new Set(
            spec.params
              .filter((q) => q.type === 'pin' && q.name !== p.name)
              .map((q) => Number(node.data.params[q.name])),
          );
          const pinTaken = (pin: number) => takenPins.has(pin) || siblingPins.has(pin);
          return (
            <label key={p.name} className="config-field">
              <span>{p.label}</span>
              {p.type === 'pin' ? (
                <select
                  value={Number(value)}
                  onChange={(e) => onChangeParam(node.id, p.name, Number(e.target.value))}
                >
                  {GPIO_PINS.map((pin) => (
                    <option key={pin} value={pin} disabled={pinTaken(pin)}>
                      {pin}
                      {pinTaken(pin) ? ' (in use)' : ''}
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
      <button
        className="config-delete"
        onClick={() => deleteElements({ nodes: [{ id: node.id }] })}
      >
        Delete node
      </button>
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
  const args: string[] = [];
  const attrs: string[] = [];
  spec.params.forEach((p, i) => {
    if (p.omit) return;
    const value = params[p.name];
    // attributes like source_delay are set after construction
    if (p.attr) {
      if (value !== p.default) attrs.push(`${varName}.${p.name} = ${pyLiteral(value)}`);
      return;
    }
    if (i === 0) args.push(pyLiteral(value));
    else if (p.type === 'pin' || value !== p.default) args.push(`${p.name}=${pyLiteral(value)}`);
  });
  // devices with simulation-only pin layouts (e.g. LEDBarGraph's *pins)
  // leave a placeholder where the pins would go
  if (spec.params.some((p) => p.omit)) args.unshift('...');
  return [`${varName} = ${spec.label}(${args.join(', ')})`, ...attrs].join('\n');
}

function pyLiteral(value: ParamValue): string {
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  return String(value);
}
