import { useState } from 'react';
import type { DragEvent } from 'react';
import { SECTIONS, SPECS } from '../catalog';
import type { NodeKind } from '../types';

export const DRAG_MIME = 'application/gpiozero-node';

const DEFAULT_VISIBLE_COUNT = 2;

export function Sidebar() {
  const [query, setQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const onDragStart = (e: DragEvent<HTMLDivElement>, kind: NodeKind) => {
    e.dataTransfer.setData(DRAG_MIME, kind);
    e.dataTransfer.effectAllowed = 'move';
  };

  const toggleCollapsed = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpanded = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search"
      />
      {needle && visibleSections.length === 0 ? (
        <p className="sidebar-hint">No devices match "{query.trim()}".</p>
      ) : (
        <p className="sidebar-hint">Drag components onto the canvas, then wire them up.</p>
      )}
      {visibleSections.map((section) => {
        const isSearching = needle.length > 0;
        const isCollapsed = !isSearching && collapsedSections.has(section.id);
        const isExpanded = isSearching || expandedSections.has(section.id);
        const shownKinds = isExpanded ? section.kinds : section.kinds.slice(0, DEFAULT_VISIBLE_COUNT);
        const hasMore = section.kinds.length > DEFAULT_VISIBLE_COUNT;

        return (
          <section key={section.id} className="palette-section">
            <h2
              className="palette-section-header"
              onClick={() => toggleCollapsed(section.id)}
              role="button"
              aria-expanded={!isCollapsed}
            >
              <span className={`palette-section-arrow ${isCollapsed ? 'collapsed' : ''}`}>▾</span>
              {section.title}
            </h2>
            {!isCollapsed && (
              <>
                {shownKinds.map((kind) => {
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
                {!isSearching && hasMore && (
                  <button type="button" className="palette-section-toggle" onClick={() => toggleExpanded(section.id)}>
                    {isExpanded ? 'Show less' : `Show all (${section.kinds.length})`}
                  </button>
                )}
              </>
            )}
          </section>
        );
      })}
    </aside>
  );
}
