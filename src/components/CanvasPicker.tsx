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
  /** copy a shareable link for the current canvas to the clipboard */
  onExportLink: (includeState: boolean) => void;
  /** copy the raw canvas JSON — no size limit, the fallback for a link that's too big */
  onExportJson: (includeState: boolean) => void;
  /** download the canvas as a .json file */
  onDownloadJson: (includeState: boolean) => void;
  /** download the canvas as the equivalent gpiozero .py script */
  onDownloadPython: () => void;
  /** encoded share-link length (chars) with/without interactive state, for the size readout */
  exportSizeWithState: number;
  exportSizeWithoutState: number;
  /** encoded length past which a share link is rejected as too large */
  exportLimit: number;
  /** import a canvas from pasted JSON; returns whether it was valid */
  onImport: (json: string) => boolean;
  /** recently deleted canvases, most recent first; the button stays visible, disabled, when empty */
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
  onExportLink,
  onExportJson,
  onDownloadJson,
  onDownloadPython,
  exportSizeWithState,
  exportSizeWithoutState,
  exportLimit,
  onImport,
  trash,
  onRestore,
}: Props) {
  const [draft, setDraft] = useState(name);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [trashOpen, setTrashOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  // configuration only by default — the more portable, more shareable option
  const [includeState, setIncludeState] = useState(false);
  const exportSize = includeState ? exportSizeWithState : exportSizeWithoutState;
  const linkTooLarge = exportSize > exportLimit;
  // too big regardless of the toggle: no point offering it as a choice
  const bothTooLarge = exportSizeWithState > exportLimit && exportSizeWithoutState > exportLimit;
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importDragOver, setImportDragOver] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const importContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter/Escape settle the draft themselves, then blur; the blur
  // handler must not commit again — it would run with stale state
  // (blur() fires it synchronously, before React re-renders).
  const settledRef = useRef(false);

  // the canvas changed under us (switch/new/delete): show its name
  useEffect(() => setDraft(name), [name]);

  // Closed on an actual click elsewhere, not onBlur: dragging a file in
  // means switching to a file manager window first, which blurs the
  // page (OS focus moving outside the DOM) well before any drag
  // reaches the dropzone — onBlur closed the popover out from under
  // that every time, which is the bug being fixed here.
  useEffect(() => {
    if (!importOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!importContainerRef.current?.contains(e.target as Node)) setImportOpen(false);
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setImportOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [importOpen]);

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

  // Shared by the Load button and file drop/browse: show the text in
  // the textarea (so an invalid file's contents can be seen and fixed)
  // and clear/close only once onImport confirms it's valid.
  const loadImportText = (text: string) => {
    setImportText(text);
    if (onImport(text)) {
      setImportText('');
      setImportOpen(false);
    }
  };

  const handleImportFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    // the native file dialog (Choose file) blurs the popover shut before
    // this runs — reopen it so a failure's warning has the textarea
    // visible for context, same as a failed paste
    setImportOpen(true);
    // an unhandled rejection here (unreadable file) would otherwise fail
    // silently — route it through the normal invalid-JSON warning instead
    file.text().then(loadImportText, () => loadImportText(''));
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
          disabled={trash.length === 0}
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
      <div
        className="combo canvas-export"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setExportOpen(false);
        }}
      >
        <button
          className="canvas-export-toggle"
          onClick={() => setExportOpen((o) => !o)}
          title="Export this canvas as a link, JSON, or a Python script"
          aria-expanded={exportOpen}
        >
          Export
        </button>
        {exportOpen && (
          <div className="combo-menu canvas-export-menu" role="menu">
            {bothTooLarge ? (
              <div className="canvas-export-size over-limit">
                Too big to share via a link — copy or download the JSON instead
              </div>
            ) : (
              <>
                <label
                  className="canvas-export-option"
                  onMouseDown={(e) => e.preventDefault() /* keep focus, so blur doesn't close the popover before the click lands */}
                >
                  <input
                    type="checkbox"
                    checked={includeState}
                    onChange={(e) => setIncludeState(e.target.checked)}
                  />
                  Include current state
                </label>
                {linkTooLarge && (
                  <div className="canvas-export-size over-limit">Too large to share via a link</div>
                )}
                <button
                  className="canvas-export-copy"
                  onClick={() => {
                    onExportLink(includeState);
                    setExportOpen(false);
                  }}
                  disabled={linkTooLarge}
                >
                  Copy sharing link
                </button>
              </>
            )}
            <button
              className="canvas-export-copy-json"
              onClick={() => {
                onExportJson(includeState);
                setExportOpen(false);
              }}
              title="Copy the raw canvas JSON — no size limit, for when the link is too big to share"
            >
              Copy raw JSON
            </button>
            <button
              className="canvas-export-download-json"
              onClick={() => {
                onDownloadJson(includeState);
                setExportOpen(false);
              }}
            >
              Download JSON
            </button>
            <button
              className="canvas-export-download-python"
              onClick={() => {
                onDownloadPython();
                setExportOpen(false);
              }}
              title="Download the equivalent gpiozero Python script"
            >
              Download Python
            </button>
          </div>
        )}
      </div>
      <div className="combo canvas-import" ref={importContainerRef}>
        <button
          className="canvas-import-toggle"
          onClick={() => setImportOpen((o) => !o)}
          title="Import a canvas from pasted JSON or a dropped file"
          aria-expanded={importOpen}
        >
          Import
        </button>
        {/*
          Always mounted, regardless of importOpen: if it only existed
          inside the conditional block below, an OS-focus-loss close
          (see the click-outside effect above) while the native file
          picker is still open would unmount it mid-selection, so the
          change event from picking a file would have nothing to land
          on — a silent no-op.
        */}
        <input
          ref={importFileInputRef}
          type="file"
          accept="application/json,.json"
          className="canvas-import-file-input"
          onChange={(e) => {
            handleImportFiles(e.target.files);
            e.target.value = '';
          }}
        />
        {importOpen && (
          <div className="combo-menu canvas-import-menu" role="menu">
            <div
              className={`canvas-import-dropzone${importDragOver ? ' drag-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setImportDragOver(true);
              }}
              onDragLeave={() => setImportDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setImportDragOver(false);
                handleImportFiles(e.dataTransfer.files);
              }}
            >
              <textarea
                className="canvas-import-textarea"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste canvas JSON, or drop a .json file here"
                aria-label="Canvas JSON to import"
              />
              <button
                type="button"
                className="canvas-import-browse"
                onClick={() => importFileInputRef.current?.click()}
              >
                Choose file…
              </button>
            </div>
            <button
              className="canvas-import-load"
              onClick={() => loadImportText(importText)}
              disabled={importText.trim() === ''}
            >
              Load
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
