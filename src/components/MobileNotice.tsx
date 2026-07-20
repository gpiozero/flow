import '../landing.css';
import '../live.css';

/** Swapped in for the whole Editor when useIsMobile() is true — the canvas needs a mouse and a wider screen. */
export function MobileNotice() {
  return (
    <div className="landing">
      <header className="landing-header">
        <a className="landing-brand" href="/">
          <span className="brand-led" aria-hidden="true" />
          gpiozero flow
        </a>
      </header>

      <main className="live-content">
        <h1>Flow needs a bigger screen</h1>
        <p className="landing-subtitle">
          The editor is a drag-and-drop canvas, built for a mouse and a wider window — it isn't
          usable on a phone. Open this page on a laptop or desktop to build and simulate circuits.
        </p>
      </main>

      <footer className="landing-footer">
        <p>
          A project by <a href="https://bennuttall.com/">Ben Nuttall</a>.
        </p>
      </footer>
    </div>
  );
}
