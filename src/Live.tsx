import './landing.css';
import './live.css';

const VENV_SETUP = `python3 -m venv --system-site-packages ~/.virtualenvs/gpiozero-flow
~/.virtualenvs/gpiozero-flow/bin/pip install gpiozero-flow`;

const START_APP = `~/.virtualenvs/gpiozero-flow/bin/gpiozero-flow`;

const START_AGENT = `~/.virtualenvs/gpiozero-flow/bin/gpiozero-agent`;

export default function Live() {
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

      <main className="live-content">
        <h1>Run Flow locally</h1>
        <p className="landing-subtitle">
          Live mode drives a real Pi's GPIO pins from the canvas, over a websocket to the{' '}
          <code>gpiozero-agent</code> command running on the Pi. Browsers block that websocket
          from a page served over HTTPS — this hosted site is, so Live mode needs to run another
          way. There are two ways to do that: serve everything from the Pi itself, or keep the app
          on your own computer and just run the agent on the Pi.
        </p>

        <div className="live-step">
          <h2>Install gpiozero-flow</h2>
          <p>
            Ships as a pip package — the web app comes pre-built, so no Node/npm needed. Raspberry
            Pi OS (like most current Linux) refuses a bare <code>pip install</code>, so create a
            virtualenv first; <code>--system-site-packages</code> picks up the apt-installed
            gpiozero and its pin factory (lgpio), so real GPIO access works right away:
          </p>
          <pre className="config-code">
            <code>{VENV_SETUP}</code>
          </pre>
          <p>
            This installs two commands: <code>gpiozero-flow</code> (serves the web app) and{' '}
            <code>gpiozero-agent</code> (the GPIO agent). Run it wherever you need either one —
            once on the Pi covers both setups below.
          </p>
        </div>

        <details className="live-option">
          <summary className="live-option-summary">
            <h2 className="live-option-title">Serve it from the Pi</h2>
          </summary>
          <p className="live-option-intro">
            One device to set up, and any browser on your network can drive it — your phone,
            laptop, anything. Since the page itself isn't served over HTTPS, the mixed-content
            restriction never applies. Run these directly on the Pi — open a terminal there,
            locally or over SSH.
          </p>

          <ol className="live-steps">
            <li>
              <h3>Install gpiozero-flow</h3>
              <pre className="config-code">
                <code>{VENV_SETUP}</code>
              </pre>
            </li>

            <li>
              <h3>Start the app</h3>
              <pre className="config-code">
                <code>{START_APP}</code>
              </pre>
              <p>Leave this running — it's what serves the app to your network.</p>
            </li>

            <li>
              <h3>Start the agent</h3>
              <p>In a second terminal on the Pi (another SSH session, or a new tab):</p>
              <pre className="config-code">
                <code>{START_AGENT}</code>
              </pre>
            </li>

            <li>
              <h3>Open it from any device on your network</h3>
              <p>
                Visit <code>http://raspberrypi.local:8000/app/</code>, switch to{' '}
                <strong>Live</strong>, enter <code>raspberrypi.local:8765</code>, and click{' '}
                <strong>Connect to Pi</strong>.
              </p>
            </li>
          </ol>
        </details>

        <details className="live-option">
          <summary className="live-option-summary">
            <h2 className="live-option-title">Run it on your computer, connect to the Pi remotely</h2>
          </summary>
          <p className="live-option-intro">
            Keeps the Pi running just the agent — nothing else to install there beyond
            gpiozero-flow itself.
          </p>

          <ol className="live-steps">
            <li>
              <h3>Install and start the app on your computer</h3>
              <pre className="config-code">
                <code>{VENV_SETUP}</code>
              </pre>
              <pre className="config-code">
                <code>{START_APP}</code>
              </pre>
              <p>
                Then open <code>http://localhost:8000/app/</code> — <code>localhost</code> is
                exempt from the browsers' HTTPS restriction, even over plain HTTP.
              </p>
            </li>

            <li>
              <h3>Install and start the agent on the Pi</h3>
              <p>Same install, run on the Pi instead — over SSH, or a terminal there:</p>
              <pre className="config-code">
                <code>{VENV_SETUP}</code>
              </pre>
              <pre className="config-code">
                <code>{START_AGENT}</code>
              </pre>
            </li>

            <li>
              <h3>Connect</h3>
              <p>
                In the local app, switch to <strong>Live</strong>, enter{' '}
                <code>&lt;pi-address&gt;:8765</code>, and click <strong>Connect to Pi</strong>.
              </p>
            </li>
          </ol>
        </details>

        <div className="live-step">
          <h2>Prefer not to use pip?</h2>
          <p>
            A zip of the built app plus the agent script, rebuilt on every deploy — no Python
            packaging involved, just <code>python3 -m http.server</code> and the agent script
            directly.
          </p>
          <a className="landing-cta landing-cta-download" href="/gpiozero-flow.zip">
            Download gpiozero-flow.zip ↓
          </a>
        </div>
      </main>

      <footer className="landing-footer">
        <p>
          A project by <a href="https://bennuttall.com/">Ben Nuttall</a>.
        </p>
      </footer>
    </div>
  );
}
