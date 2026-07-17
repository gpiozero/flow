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

Wires carry either a single number or a multi-channel tuple. Anything with a scalar `value`
(0..1 or -1..1) fits the model as-is; composite devices like RGBLED take tuples, built with
`zip_values`. Connections are shape-checked — a tuple wire can't feed a scalar input or vice
versa, mirroring what would fail in Python. Remaining ❌ devices are unblocked in principle and
just need their node designs (per-channel pins, visuals).

| Device | Type | Supported | Notes |
| --- | --- | --- | --- |
| Button | Input | ✅ | click latches, hold is momentary |
| MCP3008 | Input (ADC) | ✅ | modelled as a potentiometer; channels auto-assigned 0-7 |
| LightSensor | Input | ✅ | slider; sun icon brightens with the level |
| MotionSensor | Input | ✅ | simulated with a toggle |
| LineSensor | Input | ✅ | boolean toggle, same shape as MotionSensor |
| DistanceSensor | Input | ✅ | slider; two pins (`echo`, `trigger`) like Motor |
| RotaryEncoder | Input | ✅ | -1..1; drag the knob round, or scroll to step |
| Other MCP3xxx ADCs | Input (ADC) | ❌ | trivial variants of MCP3008 (channels/resolution) |
| LED | Output | ✅ | |
| PWMLED | Output | ✅ | |
| Buzzer | Output | ✅ | visual only; WebAudio beep would be a fun follow-up |
| Servo | Output | ✅ | horn sweeps -90° to +90° |
| AngularServo | Output | ✅ | horn follows the configured `min_angle`/`max_angle` range |
| Motor | Output | ✅ | two pins; wheel spins with speed and direction |
| RGBLED | Output | ✅ | colour swatch; source must yield (r, g, b) tuples, e.g. from `zip_values`; `pwm=False` snaps to the 8 primary/secondary colours |
| TonalBuzzer | Output | ✅ | shows the note being played; actual WebAudio sound would be a fun follow-up |
| PhaseEnableMotor | Output | ✅ | Motor's spinning wheel with `phase`/`enable` pins |
| LEDBarGraph | Board | ✅ | scalar value despite being multi-LED; one pin per LED; `pwm=True` dims the partially-covered LED, without it the value reads back quantized to lit/total |
| LEDBoard | Board | ✅ | bank of 1-10 LEDs, one tuple channel each; `pwm=True` dims fractionally |
| ButtonBoard | Board | ✅ | bank of 1-10 buttons emitting a boolean tuple; wires straight into LEDBoard |
| TrafficLights | Board | ✅ | red/amber/green lamps; boolean channels in that order, or fractional dimming with `pwm=True` |
| Robot | Board | ✅ | (left, right) speed tuples; wheels spin independently; board-level methods (forward, left, …) don't exist here — steer via the source |
| Energenie | Other | ✅ | sockets 1-4; a British plug face whose pins glow while energised |
| CPUTemperature, LoadAverage, DiskUsage | Internal | ✅ | simulated with sliders; subtitles show the reading in real units (°C, load, % full) |
| TimeOfDay | Internal | ✅ | reads the actual wall clock (UTC or local); live clock face, glows inside the window; ranges may cross midnight |
| PingServer | Internal | ✅ | toggle stands in for reachability |

Composite HATs (TrafficHat, FishDish, JamHat, Pibrella, …) are deliberately not included:
they're just fixed arrangements of the base components above, and their nested values sit
awkwardly on flat wires — one wire would have to drive lights, buzzer and ignore the onboard
button at once. Building the same thing from parts (say a TrafficLights, a Buzzer and a
Button, wired however you like) fits the node model better and isn't tied to the boards'
fixed pins. If real-hardware support arrives, revisit — on a physical HAT the composite
class is what you'd actually construct.

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
| `zip_values` | Combiner | ✅ | tuple output; channel order follows wiring order |

## Device behaviour

Each device gets a unique name (`led`, `led2`, …) which can be edited in the config panel —
lowercase letters, digits and underscores only, since it doubles as the variable name in the
gpiozero code preview shown beneath the params. Tools and artificial sources stay anonymous,
as in gpiozero they're generator expressions rather than devices.

Output devices have a `source_delay` (default 0.01 s, as in gpiozero), set as an attribute in
the code preview. Delays longer than one simulation tick make the device hold its last value
and re-read its source only when the delay elapses.

Most devices' values range 0..1; Servo, Motor, PhaseEnableMotor and LEDBarGraph range -1..1,
which pairs naturally with `sin_values` and `cos_values`. Boolean devices follow Python
truthiness: any nonzero source value counts as on.

Internal devices live in their own drawer: the three system gauges are sliders whose subtitles
read in real units, TimeOfDay follows the actual wall clock (so its value only flips when the
real time crosses the window), and none of them occupy GPIO pins. Their extra param types —
strings (PingServer's `host`, DiskUsage's `filesystem`) and times (TimeOfDay's window, emitted
as `datetime.time(...)` with the import added) — flow through to the generated script.

Remove a node with the × in its corner (shown on hover/select), the **Delete node** button in
the config panel, or Delete/Backspace; wires go with it. Wires can be removed with their own ×
or a double-click.

Copy the selected node with Ctrl/Cmd+C and paste copies with Ctrl/Cmd+V (or use the
**Duplicate node** button in the config panel). Copies keep the original's params and
interactive state but get fresh pins/channels and a fresh name, since those must be unique;
wires are not copied.

## Pins and channels

New GPIO devices are assigned the next free pin automatically (4-27 first, then 0-3 as a last
resort), and pin dropdowns disable pins already in use, so two devices can never share a pin.
This covers multi-pin devices too: a Motor takes two distinct pins (`forward`/`backward`), and
an LEDBarGraph holds one pin per LED — change its led count (1-10) and pins are assigned or
released to match. MCP3008 pots work the same way with ADC channels, taking the lowest free
channel from 0-7.

**Known issue (matters once we target real hardware):** the MCP3008 talks over the SPI bus,
so constructing one in gpiozero reserves GPIO 8-11 (CE0/MISO/MOSI/SCLK; a second chip on CE1
would also take GPIO 7). Energenie is similar: all sockets share one radio transmitter that
silently reserves GPIO 17, 22, 23, 27 (data), 24 (mode) and 25 (enable). The app doesn't
model either — a pot or an Energenie occupies no GPIO pins here, and the auto-assigner will
happily give those pins to other devices. A canvas mixing a pot with enough
pinned devices therefore generates a script that raises `GPIOPinInUse` on a real Pi (verified
against gpiozero 2.0.1's mock pin factory), even though the simulation is fine. Fix when we
wire up real GPIO: treat GPIO 8-11 as taken while any MCP3008 is on the canvas, disable them
in pin dropdowns with an "SPI" note, and decide what happens when a pot is dropped after
8-11 are already assigned (block with a warning, or reassign the clashing devices).

## Simulation clock

While any time-based node (an artificial source, or `smoothed`) is on the canvas — or any
device has a `source_delay` longer than one tick — a simulation clock ticks at 10 steps per
second, the equivalent of `source_delay=0.1`. The wave sources default to `period=36` so one
cycle takes ~3.6 s, matching gpiozero's defaults (`period=360` at `source_delay=0.01`).

## Connection semantics

Connection semantics mirror gpiozero: an output device's `source` accepts a single wire
(reconnecting replaces it), combining tools like `all_values` accept many, output devices also
expose their values so they can chain (LED → LED), and cycles are rejected.

## Multi-channel wires

Wires are shaped: most carry scalars, but `zip_values` and ButtonBoard emit one channel per
source/button, RGBLED and TrafficLights consume and re-emit 3-tuples, and LEDBoard consumes
and re-emits one channel per LED.
Connecting a tuple wire to a scalar input, or a scalar wire to a tuple consumer, is
rejected at draw time — in gpiozero the equivalent would raise at run time. Tuples longer than
a consumer needs are truncated; shorter ones are padded with 0.

In the generated script a `zip_values` node fed only by devices becomes gpiozero's
`zip_values(dev1, dev2, …)` (which reads their `values` itself); if any input is an anonymous
tool expression it falls back to the equivalent builtin `zip(...)` over the value iterators.
