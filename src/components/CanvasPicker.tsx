import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { TrashedCanvas } from '../persist';

interface Props {
  name: string;
  canvases: string[];
  onSwitch: (name: string) => void;
  /** commit a rename; returns false if rejected (e.g. duplicate name) */
  onRename: (name: string) => boolean;
  onNew: () => void;
  onClear: () => void;
  clearDisabled: boolean;
  onDelete: () => void;
  deleteDisabled: boolean;
  /** recently deleted canvases, most recent first; empty hides the trash button entirely */
  trash: TrashedCanvas[];
  onRestore: (name: string) => void;
}

/** "just now", "5m ago", "3h ago", "2d ago" */
function timeAgo(at: number): string {
  const seconds = Math.floor((Date.now() - at) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * The canvas name field: overtype the name to rename the current
 * canvas (committed on Enter/blur, Escape reverts), with a dropdown of
 * saved canvases to switch between, plus New and Delete. Same combo
 * pattern as HostCombo.
 */
export function CanvasPicker({
  name,
  canvases,
  onSwitch,
  onRename,
  onNew,
  onClear,
  clearDisabled,
  onDelete,
  deleteDisabled,
  trash,
  onRestore,
}: Props) {
  const [draft, setDraft] = useState(name);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [trashOpen, setTrashOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter/Escape settle the draft themselves, then blur; the blur
  // handler must not commit again — it would run with stale state
  // (blur() fires it synchronously, before React re-renders).
  const settledRef = useRef(false);

  // the canvas changed under us (switch/new/delete): show its name
  useEffect(() => setDraft(name), [name]);

  // the last trashed entry was restored/expired while the popover was open
  useEffect(() => {
    if (trash.length === 0) setTrashOpen(false);
  }, [trash.length]);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const commit = () => {
    const next = draft.trim();
    if (next && next !== name && onRename(next)) return;
    setDraft(name);
  };

  const choose = (target: string) => {
    close();
    onSwitch(target);
  };

  const createNew = () => {
    close();
    onNew();
    // once the fresh "untitled canvas" name lands in the input, select
    // it so naming the canvas is just typing
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (canvases.length === 0) return;
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setActive((prev) => (prev + delta + canvases.length) % canvases.length);
    } else if (e.key === 'Enter') {
      if (open && active >= 0) choose(canvases[active]);
      else {
        commit();
        settledRef.current = true;
        inputRef.current?.blur();
      }
    } else if (e.key === 'Escape') {
      if (open) close();
      else {
        setDraft(name);
        settledRef.current = true;
        inputRef.current?.blur();
      }
    }
  };

  return (
    <div className="canvas-picker">
      <div
        className="combo"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            close();
            if (settledRef.current) settledRef.current = false;
            else commit();
          }
        }}
      >
        <input
          ref={inputRef}
          className="canvas-name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          title="Canvas name — type to rename"
          aria-label="Canvas name"
          role="combobox"
          aria-expanded={open}
        />
        <button
          type="button"
          className="combo-toggle"
          onMouseDown={(e) => e.preventDefault() /* keep the input's focus */}
          onClick={() => {
            if (open) close();
            else {
              setOpen(true);
              inputRef.current?.focus();
            }
          }}
          title="Switch canvas"
          aria-label="Show saved canvases"
        >
          ▾
        </button>
        {open && canvases.length > 0 && (
          <ul className="combo-menu" role="listbox">
            {canvases.map((c, i) => (
              <li
                key={c}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'active' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(c)}
                onMouseEnter={() => setActive(i)}
              >
                {c}
                {c === name && <span className="canvas-current"> ✓</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button onClick={createNew} title="Create a new empty canvas">
        New
      </button>
      <button
        className="canvas-clear"
        onClick={onClear}
        title="Remove every node and wire from this canvas"
        disabled={clearDisabled}
      >
        Clear
      </button>
      <button onClick={onDelete} title="Delete this canvas" disabled={deleteDisabled}>
        Delete
      </button>
      {trash.length > 0 && (
        <div
          className="combo canvas-trash"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setTrashOpen(false);
          }}
        >
          <button
            className="canvas-trash-toggle"
            onClick={() => setTrashOpen((o) => !o)}
            title="Recently deleted canvases"
            aria-label="Recently deleted canvases"
            aria-expanded={trashOpen}
          >
            Trash <span className="canvas-trash-count">{trash.length}</span>
          </button>
          {trashOpen && (
            <ul className="combo-menu canvas-trash-menu" role="listbox">
              {trash.map((t) => (
                <li key={t.name}>
                  <span className="canvas-trash-name">{t.name}</span>
                  <span className="canvas-trash-age">{timeAgo(t.deletedAt)}</span>
                  <button
                    className="canvas-trash-restore"
                    onClick={() => {
                      setTrashOpen(false);
                      onRestore(t.name);
                    }}
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
