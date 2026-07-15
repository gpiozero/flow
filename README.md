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

## Devices supported

Wires carry a single number, so anything with a scalar `value` (0..1 or -1..1) fits the model
as-is. The main blocker for the rest is composite devices whose `value` is a tuple — those need
a multi-channel wire design first.

| Device | Type | Supported | Notes |
| --- | --- | --- | --- |
| Button | Input | ✅ | click latches, hold is momentary |
| MCP3008 | Input (ADC) | ✅ | modelled as a potentiometer; channels auto-assigned 0-7 |
| LightSensor | Input | ✅ | simulated with a slider |
| MotionSensor | Input | ✅ | simulated with a toggle |
| LineSensor | Input | ✅ | boolean toggle, same shape as MotionSensor |
| DistanceSensor | Input | ✅ | slider; two pins (`echo`, `trigger`) like Motor |
| RotaryEncoder | Input | ✅ | -1..1 slider; a proper knob widget would be a nice follow-up |
| Other MCP3xxx ADCs | Input (ADC) | ❌ | trivial variants of MCP3008 (channels/resolution) |
| LED | Output | ✅ | |
| PWMLED | Output | ✅ | |
| Buzzer | Output | ✅ | visual only; WebAudio beep would be a fun follow-up |
| Servo | Output | ✅ | needle sweeps -90° to +90° |
| AngularServo | Output | ✅ | needle visual is a generic ±90°, not scaled to custom `min_angle`/`max_angle` |
| Motor | Output | ✅ | two pins, bidirectional bar |
| RGBLED | Output | ❌ | value is an (r, g, b) tuple — blocked on multi-channel wires |
| TonalBuzzer | Output | ❌ | easy now -1..1 values exist; pairs with WebAudio |
| PhaseEnableMotor | Output | ❌ | trivial — Motor with a different pin layout |
| LEDBarGraph | Board | ✅ | scalar value despite being multi-LED; one pin per LED |
| LEDBoard | Board | ❌ | tuple value — blocked on multi-channel wires |
| ButtonBoard | Board | ❌ | tuple value — blocked on multi-channel wires |
| TrafficLights | Board | ❌ | tuple value, though the visual would be lovely |
| Robot | Board | ❌ | tuple of motor values plus board-level methods |
| Other boards (FishDish, JamHat, …) | Board | ❌ | mostly tuple values; case-by-case after multi-channel wires |
| Energenie | Other | ❌ | easy — boolean like LED, socket number instead of pin |
| CPUTemperature, LoadAverage, DiskUsage | Internal | ❌ | easy — simulated slider inputs |
| TimeOfDay | Internal | ❌ | easy — boolean derived from a clock |
| PingServer | Internal | ❌ | easy — a toggle standing in for reachability |

## Source tools supported

| Tool | Kind | Supported | Notes |
| --- | --- | --- | --- |
| `alternating_values` | Source | ✅ | |
| `random_values` | Source | ✅ | |
| `sin_values` | Source | ✅ | |
| `cos_values` | Source | ✅ | |
| `ramping_values` | Source | ✅ | |
| `negated` | Processor | ✅ | |
| `inverted` | Processor | ✅ | |
| `scaled` | Processor | ✅ | |
| `scaled_full`, `scaled_half` | Processor | ✅ | shorthands for `scaled` |
| `clamped` | Processor | ✅ | |
| `absoluted` | Processor | ✅ | |
| `quantized` | Processor | ✅ | |
| `booleanized` | Processor | ✅ | hysteresis latches on the sim's per-node state, same as `smoothed` |
| `smoothed` | Processor | ✅ | |
| `queued` | Processor | ❌ | easy — stateful window like `smoothed` |
| `pre_delayed`, `post_delayed` | Processor | ❌ | moderate — per-node time state on the sim clock |
| `pre_periodic_filtered`, `post_periodic_filtered` | Processor | ❌ | moderate — as above |
| `all_values` | Combiner | ✅ | |
| `any_values` | Combiner | ✅ | |
| `summed` | Combiner | ✅ | |
| `averaged` | Combiner | ✅ | |
| `multiplied` | Combiner | ✅ | |
| `zip_values` | Combiner | ❌ | tuple output — blocked on multi-channel wires |

## Device behaviour

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
