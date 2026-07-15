import { useState } from 'react';
import type { DragEvent } from 'react';
import { SECTIONS, SPECS } from '../catalog';
import type { NodeKind } from '../types';

export const DRAG_MIME = 'application/gpiozero-node';

export function Sidebar() {
  const [query, setQuery] = useState('');

  const onDragStart = (e: DragEvent<HTMLDivElement>, kind: NodeKind) => {
    e.dataTransfer.setData(DRAG_MIME, kind);
    e.dataTransfer.effectAllowed = 'move';
  };

  const needle = query.trim().toLowerCase();
  const matches = (kind: NodeKind) => {
    if (!needle) return true;
    const spec = SPECS[kind];
    return spec.label.toLowerCase().includes(needle) || spec.description.toLowerCase().includes(needle);
  };
  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    kinds: section.kinds.filter(matches),
  })).filter((section) => section.kinds.length > 0);

  return (
    <aside className="sidebar">
      <input
        type="search"
        className="sidebar-search"
        placeholder="Search devices…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search devices"
      />
      {needle && visibleSections.length === 0 ? (
        <p className="sidebar-hint">No devices match "{query.trim()}".</p>
      ) : (
        <p className="sidebar-hint">Drag components onto the canvas, then wire them up.</p>
      )}
      {visibleSections.map((section) => (
        <section key={section.id}>
          <h2>{section.title}</h2>
          {section.kinds.map((kind) => {
            const spec = SPECS[kind];
            return (
              <div
                key={kind}
                className={`palette-item section-${section.id}`}
                draggable
                onDragStart={(e) => onDragStart(e, kind)}
              >
                <span className="palette-label">{spec.label}</span>
                <span className="palette-desc">{spec.description}</span>
              </div>
            );
          })}
        </section>
      ))}
    </aside>
  );
}
