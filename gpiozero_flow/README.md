# gpiozero-flow

The [gpiozero flow](https://github.com/gpiozero/flow) web app — a node-based drag & drop
interface for [gpiozero](https://gpiozero.readthedocs.io/) — and the WebSocket agent that
mirrors its canvas onto real GPIO devices, bundled for `pip install` onto a Raspberry Pi.
No Node/npm required; the web app ships pre-built.

The browser sends the serialized graph on every canvas change; the agent reconciles it
into live gpiozero devices — constructing new devices, closing removed ones and
reassigning `.source` chains — so edits land in the running session in tens of
milliseconds, with no restart. Device values are streamed back at 10Hz, so the canvas
shows real hardware state (press a physical button and its node — and anything wired to
it — updates live). The wire protocol is documented in `gpio_agent.py`'s docstring; the
browser-side serializer is `src/wire.ts` and the connection hook is `src/pi.ts` (both in
the main repo).

## Requirements

- gpiozero 2.x and a working pin factory (both stock on Raspberry Pi OS)
- Python 3.11+
- `websockets` — any version >= 10.1 (the agent falls back to the legacy API on < 13, so
  Debian Bookworm's apt package works)

## Install (recommended)

```sh
pip install gpiozero-flow
```

This installs two commands:

- **`gpiozero-flow`** — serves the web app over plain HTTP (default port 8000).
- **`gpiozero-agent`** — the GPIO agent (default port 8765).

Run both on the Pi, then visit `http://<pi-address>:8000/app/`, switch to **Live**,
enter `<pi-address>:8765` and click **Connect to Pi**.

Serving the app itself over plain HTTP — rather than using the hosted `https://` site —
is what makes Live mode work at all here: browsers block an insecure `ws://` connection
from a page loaded over HTTPS (see `docs/hosted-deployment.md` in the main repo). Running
the web app on your own laptop instead works the same way: point `gpiozero-agent --host
0.0.0.0` at the Pi, then connect to it from the laptop's own copy of the app running on
`localhost`.

Both commands run in the foreground; background them yourself (`nohup … &`, a systemd
unit, etc.) for a persistent setup.

## Install (apt only, no pip)

`gpio_agent.py` (alongside this README) has no dependencies beyond gpiozero and
`websockets`, both available via apt, so it can be copied and run directly without
installing this package:

```sh
ssh pi 'sudo apt install python3-websockets && mkdir -p ~/gpio-agent'
scp gpio_agent.py pi:gpio-agent/
ssh pi 'nohup python3 ~/gpio-agent/gpio_agent.py \
        > ~/gpio-agent/agent.log 2>&1 < /dev/null &'
```

This only runs the agent — for the web app too, either `pip install` above or use the
downloadable build linked from the hosted site's `/live` page.

## Install (venv, newer websockets)

```sh
ssh pi 'python3 -m venv --system-site-packages ~/.virtualenvs/gpio-agent &&
        ~/.virtualenvs/gpio-agent/bin/pip install websockets &&
        mkdir -p ~/gpio-agent'
scp gpio_agent.py pi:gpio-agent/
ssh pi 'nohup ~/.virtualenvs/gpio-agent/bin/python ~/gpio-agent/gpio_agent.py \
        > ~/gpio-agent/agent.log 2>&1 < /dev/null &'
```

(`--system-site-packages` picks up the apt-installed gpiozero and lgpio.)

The agent keeps the last applied graph running after the browser disconnects —
disconnecting leaves the hardware doing whatever the canvas last described. Send an
empty graph (or restart the agent) to release all pins.

**Security note:** the agent doesn't yet check the WebSocket handshake's `Origin`, so
treat it as LAN-only for now — see `docs/hosted-deployment.md`'s security note in the
main repo for the planned fix.
