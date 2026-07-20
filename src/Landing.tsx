import { useState } from 'react';
import './landing.css';

/** Button --wire--> LED, same relationship the app itself simulates. Click it. */
function DemoCircuit() {
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      className={`landing-demo${on ? ' is-on' : ''}`}
      onClick={() => setOn((v) => !v)}
      aria-pressed={on}
      aria-label="Demo: click the button to light the LED"
      title="Click me"
    >
      <span className="landing-demo-button">
        <span className="landing-demo-button-cap" />
      </span>
      <span className="landing-demo-wire" />
      <span className="landing-demo-led" />
    </button>
  );
}

const FEATURES: {
  color: string;
  title: string;
  body: string;
  link?: { href: string; label: string };
}[] = [
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
    body: "Switch to Live and point the app at a Pi's address — the same wiring now drives real GPIO hardware remotely. Browsers block that connection from a hosted site, so this needs a local copy of the app plus the agent running on the Pi.",
    link: { href: '/live/', label: 'How to run it locally →' },
  },
];

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-header">
        <a className="landing-brand" href="/">
          <span className="brand-led" aria-hidden="true" />
          gpiozero flow
        </a>
        <a className="landing-nav-link" href="/app/">
          Open the app
        </a>
      </header>

      <main className="landing-hero">
        <DemoCircuit />
        <h1>Connect GPIO devices with drag &amp; drop</h1>
        <p className="landing-subtitle">
          Flow is a visual, node-based interface for <a href="https://gpiozero.readthedocs.io/">gpiozero</a> devices.
        </p>
        <p className="landing-subtitle">
          Drag components onto a canvas and connect them up with no code. Flow runs in the browser, and can connect to a Raspberry Pi to control real GPIO devices remotely.
        </p>
        <a className="landing-cta" href="/app/">
          Start building →
        </a>
      </main>

      <section className="landing-features">
        {FEATURES.map((f) => (
          <div className="landing-feature" key={f.title}>
            <span className="landing-feature-dot" style={{ background: f.color }} />
            <h2>{f.title}</h2>
            <p>{f.body}</p>
            {f.link && (
              <a className="landing-feature-link" href={f.link.href}>
                {f.link.label}
              </a>
            )}
          </div>
        ))}
      </section>

      <footer className="landing-footer">
        <p>A project by <a href="https://bennuttall.com/">Ben Nuttall</a>.</p>
      </footer>
    </div>
  );
}
