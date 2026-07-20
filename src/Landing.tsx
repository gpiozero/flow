import './landing.css';

const FEATURES = [
  {
    color: 'var(--c-inputs)',
    title: 'Drag & drop devices',
    body: 'LEDs, buttons, sensors, ADCs and boards from a categorised sidebar onto a canvas.',
  },
  {
    color: 'var(--c-tools)',
    title: 'Wire them together',
    body: "Connect a device's output to another's source, same as gpiozero's source/values API.",
  },
  {
    color: 'var(--c-outputs)',
    title: 'Simulate live',
    body: 'Press a button, drag a slider — values flow through the wires in the browser, no Pi needed.',
  },
  {
    color: 'var(--c-adc)',
    title: 'Connect to a Pi',
    body: "Switch to Live and point the app at a Pi's address — the same wiring now drives real GPIO hardware remotely.",
  },
];

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-brand">
          <span className="landing-dot" />
          gpiozero flow
        </div>
        <a className="landing-nav-link" href="/app">
          Open the app
        </a>
      </header>

      <main className="landing-hero">
        <h1>Connect GPIO devices with drag &amp; drop</h1>
        <p className="landing-subtitle">
          Flow is a visual, node-based studio for <a href="https://gpiozero.readthedocs.io/">gpiozero</a> devices.
        </p>
        <p className="landing-subtitle">
          Drag components onto a canvas, wire them up, and watch values flow. Flow runs in the browser, and can connect to a Raspberry Pi to control real GPIO devices remotely.
        </p>
        <a className="landing-cta" href="/app">
          Start building →
        </a>
      </main>

      <section className="landing-features">
        {FEATURES.map((f) => (
          <div className="landing-feature" key={f.title}>
            <span className="landing-feature-dot" style={{ background: f.color }} />
            <h2>{f.title}</h2>
            <p>{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="landing-footer">
        <p>A project by <a href="https://bennuttall.com/">Ben Nuttall</a>.</p>
      </footer>
    </div>
  );
}
