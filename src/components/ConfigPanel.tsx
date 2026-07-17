import { useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { GPIO_PINS, NAME_PATTERN, SPECS, requiredPinParams } from '../catalog';
import { deviceConstructor, toolCall } from '../codegen';
import type { DeviceFlowNode, ParamValue } from '../types';

interface Props {
  node: DeviceFlowNode | null;
  /** pins used by other nodes; shown disabled in the pin dropdown */
  takenPins: ReadonlySet<number>;
  /** names used by other nodes; duplicates are rejected */
  takenNames: ReadonlySet<string>;
  /** MCP3008 channels used by other nodes; shown disabled in channel dropdowns */
  takenChannels: ReadonlySet<number>;
  onChangeParam: (id: string, name: string, value: ParamValue) => void;
  onChangeName: (id: string, name: string) => void;
  /** copy this node: same params/state, fresh pins and name */
  onDuplicate: (id: string) => void;
}

export function ConfigPanel({
  node,
  takenPins,
  takenNames,
  takenChannels,
  onChangeParam,
  onChangeName,
  onDuplicate,
}: Props) {
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
  const pinNames = requiredPinParams(node.data.kind, node.data.params);

  // A pin dropdown disables pins used by other nodes and by this
  // node's own other pin params (e.g. Motor's forward/backward).
  const renderPinSelect = (name: string) => {
    const siblings = new Set(
      pinNames.filter((k) => k !== name).map((k) => Number(node.data.params[k])),
    );
    const pinTaken = (pin: number) => takenPins.has(pin) || siblings.has(pin);
    return (
      <select
        value={Number(node.data.params[name])}
        onChange={(e) => onChangeParam(node.id, name, Number(e.target.value))}
      >
        {GPIO_PINS.map((pin) => (
          <option key={pin} value={pin} disabled={pinTaken(pin)}>
            {pin}
            {pinTaken(pin) ? ' (in use)' : ''}
          </option>
        ))}
      </select>
    );
  };

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
              {p.type === 'pin' ? (
                renderPinSelect(p.name)
              ) : p.type === 'channel' ? (
                <select
                  value={Number(value)}
                  onChange={(e) => onChangeParam(node.id, p.name, Number(e.target.value))}
                >
                  {Array.from({ length: (p.max ?? 7) + 1 }, (_, channel) => (
                    <option key={channel} value={channel} disabled={takenChannels.has(channel)}>
                      {channel}
                      {takenChannels.has(channel) ? ' (in use)' : ''}
                    </option>
                  ))}
                </select>
              ) : p.choices ? (
                <select
                  value={Number(value)}
                  onChange={(e) => onChangeParam(node.id, p.name, Number(e.target.value))}
                >
                  {p.choices.map((choice) => (
                    <option key={choice} value={choice}>
                      {choice}
                    </option>
                  ))}
                </select>
              ) : p.type === 'text' ? (
                <input
                  type="text"
                  value={String(value)}
                  onChange={(e) => onChangeParam(node.id, p.name, e.target.value)}
                />
              ) : p.type === 'time' ? (
                <input
                  type="time"
                  value={String(value)}
                  onChange={(e) => e.target.value && onChangeParam(node.id, p.name, e.target.value)}
                />
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
      {spec.dynamicPins &&
        pinNames.map((name) => (
          <label key={name} className="config-field">
            <span>{name}</span>
            {renderPinSelect(name)}
          </label>
        ))}
      <div className="config-code">
        <code>{preview(node)}</code>
      </div>
      <button className="config-duplicate" onClick={() => onDuplicate(node.id)}>
        Duplicate node
      </button>
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

// Isolated single-node preview: for anonymous tools/sources this can't
// know the real wiring, so it stands a literal `values` placeholder in
// for whatever's actually connected (see codegen.ts for the full thing).
function preview(node: DeviceFlowNode): string {
  const spec = SPECS[node.data.kind];
  if (spec.section === 'tools' || spec.section === 'sources') {
    return toolCall(node, spec.hasInput ? ['values'] : []);
  }
  return deviceConstructor(node);
}
