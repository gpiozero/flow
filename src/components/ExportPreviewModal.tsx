import { useState } from 'react';

interface Props {
  title: string;
  content: string;
  /** filename stem, without the extension */
  defaultFilename: string;
  /** e.g. '.py' — included verbatim in the downloaded filename */
  extension: string;
  mimeType: string;
  onClose: () => void;
}

/** Previews exported text (a Python script, canvas JSON, …) with a download action */
export function ExportPreviewModal({
  title,
  content,
  defaultFilename,
  extension,
  mimeType,
  onClose,
}: Props) {
  const [filename, setFilename] = useState(defaultFilename);

  const onDownload = () => {
    const escaped = extension.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const stem = filename.trim().replace(new RegExp(`${escaped}$`, 'i'), '') || defaultFilename;
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
          <button className="modal-download" onClick={onDownload}>
            Download {extension}
          </button>
        </div>
      </div>
    </div>
  );
}
