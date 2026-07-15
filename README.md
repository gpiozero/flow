# gpiozero flow

A node-based drag & drop web interface for [gpiozero](https://gpiozero.readthedocs.io/), built
around the [source/values](https://gpiozero.readthedocs.io/en/stable/source_values.html) paradigm.

Drag components from the sidebar onto the canvas, configure their init params in the right-hand
panel, and wire them together. Values propagate live through the wires in the browser: press a
Button and connected LEDs light up; drag a potentiometer and a PWMLED's brightness follows; feed
`sin_values` into a Servo and watch the needle sweep. Clicking a Button latches it on until the
next click; press and hold for a momentary press.

This is an MVP/proof of concept — nothing here touches real GPIO pins or talks to Python.

## Development

```sh
npm install
npm run dev
```

Built with Vite, React, TypeScript, and [React Flow](https://reactflow.dev/).

## Components

- **Inputs**: Button, MCP3008 (potentiometer), LightSensor, MotionSensor
- **Outputs**: LED, PWMLED, Buzzer, Servo, Motor, LEDBarGraph
- **Tools**: `negated`, `inverted`, `all_values`, `any_values`, `summed`, `scaled`, `smoothed`
- **Artificial sources**: `alternating_values`, `random_values`, `sin_values`, `cos_values`,
  `ramping_values`

## Devices

Each device gets a unique name (`led`, `led2`, …) which can be edited in the config panel —
lowercase letters, digits and underscores only, since it doubles as the variable name in the
gpiozero code preview shown beneath the params. Tools and artificial sources stay anonymous,
as in gpiozero they're generator expressions rather than devices.

Output devices have a `source_delay` (default 0.01 s, as in gpiozero), set as an attribute in
the code preview. Delays longer than one simulation tick make the device hold its last value
and re-read its source only when the delay elapses.

Most devices' values range 0..1; Servo, Motor and LEDBarGraph range -1..1, which pairs
naturally with `sin_values` and `cos_values`. Boolean devices follow Python truthiness: any
nonzero source value counts as on.

Remove a node with the × in its corner (shown on hover/select), the **Delete node** button in
the config panel, or Delete/Backspace; wires go with it. Wires can be removed with their own ×
or a double-click.

## Pins and channels

New GPIO devices are assigned the next free pin automatically (4-27 first, then 0-3 as a last
resort), and pin dropdowns disable pins already in use, so two devices can never share a pin.
This covers multi-pin devices too: a Motor takes two distinct pins (`forward`/`backward`), and
an LEDBarGraph holds one pin per LED — change its led count (1-10) and pins are assigned or
released to match. MCP3008 pots work the same way with ADC channels, taking the lowest free
channel from 0-7.

## Simulation clock

While any time-based node (an artificial source, or `smoothed`) is on the canvas — or any
device has a `source_delay` longer than one tick — a simulation clock ticks at 10 steps per
second, the equivalent of `source_delay=0.1`. The wave sources default to `period=36` so one
cycle takes ~3.6 s, matching gpiozero's defaults (`period=360` at `source_delay=0.01`).

## Connection semantics

Connection semantics mirror gpiozero: an output device's `source` accepts a single wire
(reconnecting replaces it), combining tools like `all_values` accept many, output devices also
expose their values so they can chain (LED → LED), and cycles are rejected.
