import { useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';

export interface HostSuggestion {
  host: string;
  /** the port to restore alongside the host: what a history entry
   * connected with, or the agent default for standing suggestions */
  port?: string;
}

interface HostComboProps {
  value: string;
  suggestions: HostSuggestion[];
  disabled: boolean;
  onChange: (value: string) => void;
  onPick: (suggestion: HostSuggestion) => void;
  onConnect: () => void;
}

/**
 * The Pi host field: a text input with a dropdown of connection history
 * and standing suggestions. A custom popover rather than a native
 * <datalist> so the full list is always browsable — browsers filter
 * datalist options against the current text, which hides everything
 * when the field already holds a non-matching host.
 */
export function HostCombo({
  value,
  suggestions,
  disabled,
  onChange,
  onPick,
  onConnect,
}: HostComboProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const choose = (suggestion: HostSuggestion) => {
    onPick(suggestion);
    close();
    inputRef.current?.focus();
  };

  // When focusing a value holding an IPv4 address, select just the
  // last octet — the usual edit is "same subnet, different Pi".
  // Deferred a frame so the browser's own click-caret placement
  // doesn't undo it.
  const selectLastOctet = (e: FocusEvent<HTMLInputElement>) => {
    const input = e.target;
    const m = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.)(\d{1,3})$/.exec(input.value);
    if (!m) return;
    const start = m[1].length;
    requestAnimationFrame(() => {
      if (document.activeElement === input) {
        input.setSelectionRange(start, input.value.length);
      }
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length === 0) return;
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setActive((prev) => (prev + delta + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      if (open && active >= 0) choose(suggestions[active]);
      else {
        close();
        onConnect();
      }
    } else if (e.key === 'Escape') {
      close();
    }
  };

  return (
    <div
      className="combo"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <input
        ref={inputRef}
        className="pi-address"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setActive(-1);
        }}
        onFocus={selectLastOctet}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder="raspberrypi.local"
        title="Pi agent host: name, IP address, or a full ws:// URL"
        aria-label="Pi agent host"
        role="combobox"
        aria-expanded={open}
      />
      <button
        type="button"
        className="combo-toggle"
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault() /* keep the input's focus */}
        onClick={() => {
          if (open) close();
          else {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
        title="Choose a host"
        aria-label="Show host suggestions"
      >
        ▾
      </button>
      {open && suggestions.length > 0 && (
        <ul className="combo-menu" role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={`${s.host}:${s.port ?? ''}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(s)}
              onMouseEnter={() => setActive(i)}
            >
              {s.host}
              {s.port !== undefined && <span className="pi-combo-port"> :{s.port}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
