# gpiozero flow (name TBC)

A node-based drag & drop web interface for [gpiozero](https://gpiozero.readthedocs.io/), built
around the [source/values](https://gpiozero.readthedocs.io/en/stable/source_values.html) paradigm.

Drag components from the sidebar onto the canvas, configure their init params in the right-hand
panel, and wire them together. Values propagate live through the wires in the browser: press a
Button and connected LEDs light up; drag a potentiometer and a PWMLED's brightness follows.
Clicking a Button latches it on until the next click; press and hold for a momentary press.

This is an MVP/proof of concept — nothing here touches real GPIO pins or talks to Python.

## Development

```sh
npm install
npm run dev
```

Built with Vite, React, TypeScript, and [React Flow](https://reactflow.dev/).

## Components

- **Inputs**: Button, MCP3008 (potentiometer)
- **Outputs**: LED, PWMLED
- **Tools**: `negated`, `inverted`, `all_values`, `any_values`, `summed`, `scaled`, `smoothed`
- **Artificial sources**: `alternating_values`, `random_values`, `sin_values`, `cos_values`,
  `ramping_values`

While any time-based node (an artificial source, or `smoothed`) is on the canvas, a simulation
clock ticks at 10 steps per second — the equivalent of `source_delay=0.1`. The wave sources
default to `period=36` so one cycle takes ~3.6 s, matching gpiozero's defaults (`period=360` at
`source_delay=0.01`).

New GPIO devices are assigned the next free pin automatically (4-27 first, then 0-3 as a last
resort), and the pin dropdown disables pins already in use, so two devices can never share a pin.

Connection semantics mirror gpiozero: an output device's `source` accepts a single wire
(reconnecting replaces it), combining tools like `all_values` accept many, output devices also
expose their values so they can chain (LED → LED), and cycles are rejected.
