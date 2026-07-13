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
- **Tools**: `negated`, `all_values`, `scaled`

Connection semantics mirror gpiozero: an output device's `source` accepts a single wire
(reconnecting replaces it), combining tools like `all_values` accept many, output devices also
expose their values so they can chain (LED → LED), and cycles are rejected.
