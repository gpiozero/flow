import { useState } from 'react';
import type { DragEvent } from 'react';
import { SECTIONS, SPECS } from '../catalog';
import { BOARD_LIST } from '../boards';
import type { NodeKind } from '../types';

export const DRAG_MIME = 'application/gpiozero-node';
export const BOARD_MIME = 'application/gpiozero-board';

const DEFAULT_VISIBLE_COUNT = 2;

/** A draggable palette row: a catalog device or an add-on board */
interface PaletteEntry {
  key: string;
  label: string;
  description: string;
  mime: string;
  payload: string;
}

interface PaletteSectionDef {
  id: string;
  title: string;
  entries: PaletteEntry[];
}

/** The Boards drawer slots in after this section */
const BOARDS_AFTER = 'outputs';

function buildSections(): PaletteSectionDef[] {
  const sections: PaletteSectionDef[] = [];
  for (const section of SECTIONS) {
    sections.push({
      id: section.id,
      title: section.title,
      entries: section.kinds.map((kind: NodeKind) => ({
        key: kind,
        label: SPECS[kind].label,
        description: SPECS[kind].description,
        mime: DRAG_MIME,
        payload: kind,
      })),
    });
    if (section.id === BOARDS_AFTER) {
      sections.push({
        id: 'boards',
        title: 'Boards',
        entries: BOARD_LIST.map((board) => ({
          key: board.id,
          label: board.label,
          description: board.description,
          mime: BOARD_MIME,
          payload: board.id,
        })),
      });
    }
  }
  return sections;
}

const ALL_SECTIONS = buildSections();

export function Sidebar() {
  const [query, setQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const onDragStart = (e: DragEvent<HTMLDivElement>, entry: PaletteEntry) => {
    e.dataTransfer.setData(entry.mime, entry.payload);
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
  const matches = (entry: PaletteEntry) => {
    if (!needle) return true;
    return (
      entry.label.toLowerCase().includes(needle) ||
      entry.description.toLowerCase().includes(needle)
    );
  };
  const visibleSections = ALL_SECTIONS.map((section) => ({
    ...section,
    entries: section.entries.filter(matches),
  })).filter((section) => section.entries.length > 0);

  return (
    <aside className="sidebar">
      <div className="sidebar-search-wrap">
        <input
          type="search"
          className="sidebar-search"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search"
        />
        {query && (
          <button
            type="button"
            className="sidebar-search-clear"
            onClick={() => setQuery('')}
            title="Clear search"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
      {needle && visibleSections.length === 0 ? (
        <p className="sidebar-hint">No devices match "{query.trim()}".</p>
      ) : (
        <p className="sidebar-hint">Drag components onto the canvas, then wire them up.</p>
      )}
      {visibleSections.map((section) => {
        const isSearching = needle.length > 0;
        const isCollapsed = !isSearching && collapsedSections.has(section.id);
        const isExpanded = isSearching || expandedSections.has(section.id);
        const shownEntries = isExpanded
          ? section.entries
          : section.entries.slice(0, DEFAULT_VISIBLE_COUNT);
        const hasMore = section.entries.length > DEFAULT_VISIBLE_COUNT;

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
                {shownEntries.map((entry) => (
                  <div
                    key={entry.key}
                    className={`palette-item section-${section.id}`}
                    draggable
                    onDragStart={(e) => onDragStart(e, entry)}
                  >
                    <span className="palette-label">{entry.label}</span>
                    <span className="palette-desc">{entry.description}</span>
                  </div>
                ))}
                {!isSearching && hasMore && (
                  <button type="button" className="palette-section-toggle" onClick={() => toggleExpanded(section.id)}>
                    {isExpanded ? 'Show less' : `Show all (${section.entries.length})`}
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
