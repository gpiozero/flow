import { useEffect, useState } from 'react';
import type { Edge } from '@xyflow/react';
import type { DeviceFlowNode } from '../types';
import { encodeSharedCanvas, SHARE_TOO_LARGE } from '../persist';
import { DEFAULT_APP_PORT } from '../pi';

interface Props {
  onClose: () => void;
  nodes: DeviceFlowNode[];
  edges: Edge[];
  canvasName: string;
}

const STORAGE_KEY = 'gpio-webapp.pi-app-address';

interface StoredAppLink {
  host: string;
  port: string;
}

function loadStored(): StoredAppLink {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { host: '', port: DEFAULT_APP_PORT };
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAppLink>;
    return {
      host: typeof parsed.host === 'string' ? parsed.host : '',
      port: typeof parsed.port === 'string' ? parsed.port : DEFAULT_APP_PORT,
    };
  } catch {
    return { host: '', port: DEFAULT_APP_PORT };
  }
}

/**
 * Shown instead of the Pi-connect UI when the page can't open ws://
 * (see liveModeSupported in pi.ts). If the app is *also* running on the
 * Pi (docs/hosted-deployment.md option 1), that copy is reachable over
 * plain HTTP, where Live mode isn't blocked — so instead of connecting
 * a websocket from here, "Switch to Pi" opens the Pi's own copy of the
 * app with the current canvas attached as a `#canvas=` share link, in a
 * new tab. That's a page navigation, not a connection — the actual
 * websocket "Connect to Pi" happens once you're there.
 */
export function LiveModeModal({ onClose, nodes, edges, canvasName }: Props) {
  const [link, setLink] = useState(loadStored);
  const [encoded, setEncoded] = useState<string | typeof SHARE_TOO_LARGE | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(link));
  }, [link]);

  // Interactive state travels with the link (includeState=true) so the
  // Pi's copy opens showing the same values, rather than resetting to
  // catalog defaults while waiting for the agent to reconnect.
  useEffect(() => {
    let cancelled = false;
    encodeSharedCanvas(nodes, edges, canvasName, true).then((result) => {
      if (!cancelled) setEncoded(result);
    });
    return () => {
      cancelled = true;
    };
  }, [nodes, edges, canvasName]);

  const host = link.host.trim();
  const port = link.port.trim() || DEFAULT_APP_PORT;
  const href =
    host && encoded && encoded !== SHARE_TOO_LARGE
      ? `http://${host}:${port}/app/#canvas=${encoded}`
      : undefined;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Live mode</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="modal-text">
          Live mode needs your Pi reachable directly, which this hosted site can't do —
          browsers block that kind of connection from a page served over HTTPS. If the app is
          also running on the Pi itself, switch to that copy with this canvas attached — it's
          plain HTTP, so you can connect to the Pi from there as normal.
        </p>
        <div className="live-modal-address">
          <input
            className="pi-address"
            value={link.host}
            onChange={(e) => setLink((prev) => ({ ...prev, host: e.target.value }))}
            placeholder="raspberrypi.local"
            title="The Pi's address"
            aria-label="Pi address"
          />
          <span className="pi-port-sep" aria-hidden="true">
            :
          </span>
          <input
            className="pi-port"
            value={link.port}
            onChange={(e) => setLink((prev) => ({ ...prev, port: e.target.value }))}
            placeholder={DEFAULT_APP_PORT}
            inputMode="numeric"
            title="The port the web app is running on, on the Pi"
            aria-label="Pi app port"
          />
        </div>
        {href ? (
          <a className="modal-download" href={href} target="_blank" rel="noopener noreferrer">
            Switch to Pi ↗
          </a>
        ) : (
          <button className="modal-download" disabled>
            Switch to Pi
          </button>
        )}
        {encoded === SHARE_TOO_LARGE && (
          <p className="modal-warning">This canvas is too large to carry over in the link.</p>
        )}
        <a className="modal-download modal-download-secondary" href="/live/">
          How to run it locally →
        </a>
      </div>
    </div>
  );
}
