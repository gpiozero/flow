import './landing.css';
import './live.css';

const FETCH_ON_PI = `curl -LO https://flow.bennuttall.com/gpiozero-flow.zip
unzip gpiozero-flow.zip && cd gpiozero-flow`;

const INSTALL_WEBSOCKETS = `sudo apt install -y python3-websockets`;

const START_APP = `python3 -m http.server 8000`;

const START_AGENT = `cd gpiozero-flow
python3 agent/gpio_agent.py`;

const SERVE_APP = `unzip gpiozero-flow.zip
cd gpiozero-flow
python3 -m http.server 8000`;

const AGENT_INSTALL = `ssh pi 'sudo apt install python3-websockets && mkdir -p ~/gpio-agent'
scp agent/gpio_agent.py pi:gpio-agent/
ssh pi 'nohup python3 ~/gpio-agent/gpio_agent.py \\
        > ~/gpio-agent/agent.log 2>&1 < /dev/null &'`;

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
          Live mode drives a real Pi's GPIO pins from the canvas, over a websocket to{' '}
          <code>agent/gpio_agent.py</code> running on the Pi. Browsers block that websocket from a
          page served over HTTPS — this hosted site is, so Live mode needs to run another way.
          There are two ways to do that: serve everything from the Pi itself, or keep the app on
          your own computer and just run the agent on the Pi.
        </p>

        <div className="live-step">
          <h2>Download the app + agent</h2>
          <p>
            A zip of the built app plus <code>gpio_agent.py</code>, rebuilt on every deploy — no
            source code, no npm install needed.
          </p>
          <a className="landing-cta landing-cta-download" href="/gpiozero-flow.zip">
            Download gpiozero-flow.zip ↓
          </a>
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
              <h3>Fetch the zip and unzip it</h3>
              <pre className="config-code">
                <code>{FETCH_ON_PI}</code>
              </pre>
            </li>

            <li>
              <h3>Install the agent's dependency</h3>
              <pre className="config-code">
                <code>{INSTALL_WEBSOCKETS}</code>
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
            Keeps the Pi running just the agent — nothing else to install there beyond{' '}
            <code>websockets</code>.
          </p>

          <ol className="live-steps">
            <li>
              <h3>Serve the app on your computer</h3>
              <p>
                Unzip it and serve the folder with any static file server — Python's is already
                there on most machines:
              </p>
              <pre className="config-code">
                <code>{SERVE_APP}</code>
              </pre>
              <p>
                Then open <code>http://localhost:8000/app/</code> — <code>localhost</code> is
                exempt from the browsers' HTTPS restriction, even over plain HTTP.
              </p>
            </li>

            <li>
              <h3>Run the agent on the Pi</h3>
              <p>
                Needs gpiozero and Python 3.11+, both stock on Raspberry Pi OS, plus the{' '}
                <code>websockets</code> package:
              </p>
              <pre className="config-code">
                <code>{AGENT_INSTALL}</code>
              </pre>
              <p>
                See <code>agent/README.md</code> in the download for a venv-based alternative and
                more detail.
              </p>
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
      </main>

      <footer className="landing-footer">
        <p>
          A project by <a href="https://bennuttall.com/">Ben Nuttall</a>.
        </p>
      </footer>
    </div>
  );
}
