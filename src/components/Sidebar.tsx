import type { DragEvent } from 'react';
import { SECTIONS, SPECS } from '../catalog';
import type { NodeKind } from '../types';

export const DRAG_MIME = 'application/gpiozero-node';

export function Sidebar() {
  const onDragStart = (e: DragEvent<HTMLDivElement>, kind: NodeKind) => {
    e.dataTransfer.setData(DRAG_MIME, kind);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="sidebar">
      <p className="sidebar-hint">Drag components onto the canvas, then wire them up.</p>
      {SECTIONS.map((section) => (
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
