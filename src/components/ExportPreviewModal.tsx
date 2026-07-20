import { useState } from 'react';

interface Props {
  title: string;
  content: string;
  /** filename stem, without the extension */
  defaultFilename: string;
  /** e.g. '.py' — included verbatim in the downloaded filename */
  extension: string;
  mimeType: string;
  /** module names the filename mustn't collide with (e.g. a .py script's own imports) */
  reservedNames?: string[];
  onClose: () => void;
}

/** Previews exported text (a Python script, canvas JSON, …) with a download action */
export function ExportPreviewModal({
  title,
  content,
  defaultFilename,
  extension,
  mimeType,
  reservedNames,
  onClose,
}: Props) {
  const [filename, setFilename] = useState(defaultFilename);

  const escapedExtension = extension.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stem = filename.trim().replace(new RegExp(`${escapedExtension}$`, 'i'), '') || defaultFilename;
  // a script named e.g. gpiozero.py shadows the real module, breaking its own import
  const collision = reservedNames?.find((m) => m.toLowerCase() === stem.toLowerCase());

  const onDownload = () => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${stem}${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <pre className="config-code modal-code">
          <code>{content}</code>
        </pre>
        {collision && (
          <p className="modal-warning">
            "{stem}{extension}" would shadow the <code>{collision}</code> module this script
            imports — its own import would fail. Choose a different name.
          </p>
        )}
        <div className="modal-actions">
          <label className="modal-filename">
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              aria-label="Filename"
            />
            <span>{extension}</span>
          </label>
          <button className="modal-download" onClick={onDownload} disabled={!!collision}>
            Download {extension}
          </button>
        </div>
      </div>
    </div>
  );
}
