# gpio-agent

A WebSocket agent that runs on a Raspberry Pi and mirrors the gpio-webapp canvas
onto real GPIO devices. The browser sends the serialized graph on every canvas
change; the agent reconciles it into live gpiozero devices — constructing new
devices, closing removed ones and reassigning `.source` chains — so edits land
in the running session in tens of milliseconds, with no restart. Device values
are streamed back at 10Hz, so the canvas shows real hardware state (press a
physical button and its node — and anything wired to it — updates live).

The wire protocol is documented in the `gpio_agent.py` docstring; the
browser-side serializer is `src/wire.ts` and the connection hook is `src/pi.ts`.

## Requirements

- gpiozero 2.x and a working pin factory (both stock on Raspberry Pi OS)
- Python 3.11+
- `websockets` >= 14

## Deploy

```sh
ssh pi 'python3 -m venv --system-site-packages ~/.virtualenvs/gpio-agent &&
        ~/.virtualenvs/gpio-agent/bin/pip install websockets &&
        mkdir -p ~/gpio-agent'
scp agent/gpio_agent.py pi:gpio-agent/
ssh pi 'nohup ~/.virtualenvs/gpio-agent/bin/python ~/gpio-agent/gpio_agent.py \
        > ~/gpio-agent/agent.log 2>&1 < /dev/null &'
```

(`--system-site-packages` picks up the apt-installed gpiozero and lgpio.)

Then in the webapp topbar, enter `<pi-address>:8765` and click **Connect to Pi**.

The agent keeps the last applied graph running after the browser disconnects —
disconnecting leaves the hardware doing whatever the canvas last described.
Send an empty graph (or restart the agent) to release all pins.
