interface Props {
  onClose: () => void;
}

/** Shown instead of the Pi-connect UI when the page can't open ws:// (see liveModeSupported in pi.ts) */
export function LiveModeModal({ onClose }: Props) {
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
          Live mode needs your Pi reachable directly, which a hosted site can't do — browsers
          block that kind of connection from a page served over HTTPS.
        </p>
        <a className="modal-download" href="/live/">
          How to run it locally →
        </a>
      </div>
    </div>
  );
}
