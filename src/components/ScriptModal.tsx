import { useMemo, useState } from 'react';
import type { Edge } from '@xyflow/react';
import { generateScript } from '../codegen';
import type { DeviceFlowNode } from '../types';

const DEFAULT_FILENAME = 'gpiozero_flow';

interface Props {
  nodes: DeviceFlowNode[];
  edges: Edge[];
  onClose: () => void;
}

export function ScriptModal({ nodes, edges, onClose }: Props) {
  const script = useMemo(() => generateScript(nodes, edges), [nodes, edges]);
  const [filename, setFilename] = useState(DEFAULT_FILENAME);

  const onDownload = () => {
    const stem = filename.trim().replace(/\.py$/i, '') || DEFAULT_FILENAME;
    const blob = new Blob([script], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${stem}.py`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Python script</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <pre className="config-code modal-code">
          <code>{script}</code>
        </pre>
        <div className="modal-actions">
          <label className="modal-filename">
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              aria-label="Filename"
            />
            <span>.py</span>
          </label>
          <button className="modal-download" onClick={onDownload}>
            Download .py
          </button>
        </div>
      </div>
    </div>
  );
}
