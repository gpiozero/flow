import { useEffect, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  LED_COLORS,
  NAME_PATTERN,
  SPECS,
  deviceClassName,
  docsUrl,
  pinFieldLabel,
  requiredPinParams,
  valueSummary,
} from '../catalog';
import { pinDisplay, pinOptions } from '../pins';
import { splitLabel } from '../split';
import { convertTarget } from '../convert';
import type { PinNumbering } from '../pins';
import type { DeviceFlowNode, ParamValue } from '../types';

interface Props {
  node: DeviceFlowNode | null;
  /** pins used by other nodes; shown disabled in the pin dropdown */
  takenPins: ReadonlySet<number>;
  /** names used by other nodes; duplicates are rejected */
  takenNames: ReadonlySet<string>;
  /** MCP3008 channels used by other nodes; shown disabled in channel dropdowns */
  takenChannels: ReadonlySet<number>;
  numbering: PinNumbering;
  onChangeParam: (id: string, name: string, value: ParamValue) => void;
  onChangeName: (id: string, name: string) => void;
  /** copy this node: same params/state, fresh pins and name */
  onDuplicate: (id: string) => void;
  /** replace this node with its constituent devices on the same pins */
  onSplit: (id: string) => void;
  /** switch this node to its related kind (LED <-> PWMLED) in place */
  onConvert: (id: string) => void;
  /** the node's incoming wires in channel order: edge id + source label */
  inputs: { id: string; label: string }[];
  /** swap an incoming wire with its neighbour above (-1) or below (1) */
  onMoveInput: (edgeId: string, delta: -1 | 1) => void;
}

export function ConfigPanel({
  node,
  takenPins,
  takenNames,
  takenChannels,
  numbering,
  onChangeParam,
  onChangeName,
  onDuplicate,
  onSplit,
  onConvert,
  inputs,
  onMoveInput,
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
        {pinOptions(numbering).map((pin) => (
          <option key={pin} value={pin} disabled={pinTaken(pin)}>
            {pinDisplay(pin, numbering)}
            {pinTaken(pin) ? ' (in use)' : ''}
          </option>
        ))}
      </select>
    );
  };

  return (
    <aside className="config-panel">
      <h2>{deviceClassName(node.data.kind, node.data.params)}</h2>
      <p className="config-desc">{spec.description}</p>
      <a
        className="config-docs-link"
        href={docsUrl(node.data.kind, node.data.params)}
        target="_blank"
        rel="noopener noreferrer"
      >
        View gpiozero docs ↗
      </a>
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
              ) : p.type === 'color' ? (
                <select
                  value={String(value)}
                  onChange={(e) => onChangeParam(node.id, p.name, e.target.value)}
                >
                  {LED_COLORS.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
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
              ) : p.nullable ? (
                <>
                  <label className="config-nullable-toggle">
                    <input
                      type="checkbox"
                      checked={value === null}
                      onChange={(e) => onChangeParam(node.id, p.name, e.target.checked ? null : 0)}
                    />
                    disengaged
                  </label>
                  <NumberField
                    value={value === null ? 0 : Number(value)}
                    min={p.min}
                    max={p.max}
                    step={p.step ?? (p.type === 'int' ? 1 : 0.01)}
                    disabled={value === null}
                    onChange={(v) => onChangeParam(node.id, p.name, v)}
                  />
                </>
              ) : (
                <NumberField
                  value={Number(value)}
                  min={p.min}
                  max={p.max}
                  step={p.step ?? (p.type === 'int' ? 1 : 0.01)}
                  onChange={(v) => onChangeParam(node.id, p.name, v)}
                />
              )}
            </label>
          );
        })
      )}
      {spec.dynamicPins &&
        pinNames.map((name) => (
          <label key={name} className="config-field">
            <span>{pinFieldLabel(node.data.params, name)}</span>
            {renderPinSelect(name)}
          </label>
        ))}
      <ValueBlock node={node} />
      {spec.multiInput && inputs.length > 0 && (
        <div className="config-inputs">
          <span className="config-inputs-title">
            inputs{node.data.kind === 'zip_values' ? ' (channel order)' : ''}
          </span>
          {inputs.map((input, i) => (
            <div key={input.id} className="config-input-row">
              <span className="config-input-index">{i + 1}</span>
              <span className="config-input-label">{input.label}</span>
              <button
                type="button"
                disabled={i === 0}
                onClick={() => onMoveInput(input.id, -1)}
                aria-label={`Move ${input.label} up`}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={i === inputs.length - 1}
                onClick={() => onMoveInput(input.id, 1)}
                aria-label={`Move ${input.label} down`}
              >
                ↓
              </button>
            </div>
          ))}
        </div>
      )}
      <button className="config-duplicate" onClick={() => onDuplicate(node.id)}>
        Duplicate node
      </button>
      {splitLabel(node.data) && (
        <button className="config-duplicate" onClick={() => onSplit(node.id)}>
          Split into {splitLabel(node.data)}
        </button>
      )}
      {convertTarget(node.data.kind) && (
        <button className="config-duplicate" onClick={() => onConvert(node.id)}>
          Convert to {SPECS[convertTarget(node.data.kind)!].label}
        </button>
      )}
      <button
        className="config-delete"
        onClick={() => deleteElements({ nodes: [{ id: node.id }] })}
      >
        Delete node
      </button>
    </aside>
  );
}

// What the device's value looks like: tuple shape and channel names,
// per-channel range, and what the numbers mean. Devices only —
// valueSummary is null for tools and artificial sources.
function ValueBlock({ node }: { node: DeviceFlowNode }) {
  const summary = valueSummary(node.data.kind, node.data.params);
  if (!summary) return null;
  const channels =
    summary.channels &&
    (summary.channels.length <= 4
      ? summary.channels.join(', ')
      : `${summary.channels[0]}, …, ${summary.channels[summary.channels.length - 1]}`);
  return (
    <div className="config-value">
      <span className="config-value-title">value</span>
      <code>{channels ? `(${channels}) · each ${summary.range}` : summary.range}</code>
      <p>{summary.meaning}</p>
      {summary.note && <p className="config-value-note">{summary.note}</p>}
    </div>
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

  // Keeps the draft aligned with the committed name when it changes
  // from outside this field's own typing — e.g. undo/redo restoring a
  // previous name. A matching value from this field's own onChange is
  // a no-op here, so it doesn't disturb an in-progress edit.
  useEffect(() => {
    setDraft(node.data.name ?? '');
    setError(null);
  }, [node.data.name]);

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

// A plain controlled <input type="number"> snaps back to the last
// committed value the instant the field is cleared or holds a bare
// "-" (Number('') and Number('-') are 0/NaN), which stops a negative
// or decimal number ever being typed. Keeping the in-progress text in
// local state (only committing once it parses) lets the field pass
// through those intermediate states.
function NumberField({
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const onChangeDraft = (raw: string) => {
    const parsed = Number(raw);
    if (raw === '' || raw === '-' || Number.isNaN(parsed)) {
      setDraft(raw);
      return;
    }
    // clamp to the field's declared range (e.g. source_delay can't go
    // negative) - out-of-range digits still type through up to this
    // point, so a bound is enforced the moment a full number parses,
    // not just once the field is abandoned. Setting the clamped text
    // directly (rather than leaving it to the value-prop resync
    // effect) matters when the clamp lands back on the value already
    // committed — the prop wouldn't change, so that effect wouldn't
    // otherwise fire to overwrite the out-of-range text still on screen.
    const clamped = min !== undefined && parsed < min ? min : max !== undefined && parsed > max ? max : parsed;
    setDraft(clamped === parsed ? raw : String(clamped));
    onChange(clamped);
  };

  return (
    <input
      type="number"
      value={draft}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => onChangeDraft(e.target.value)}
      // abandoning a half-typed value (still just "-", or emptied
      // entirely) reverts the field to the last committed number
      // rather than leaving it stuck invalid
      onBlur={() => setDraft(String(value))}
    />
  );
}

