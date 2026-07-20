# gpiozero flow

A node-based drag & drop web interface for [gpiozero](https://gpiozero.readthedocs.io/), built
around the [source/values](https://gpiozero.readthedocs.io/en/stable/source_values.html) paradigm.

Drag components from the sidebar onto the canvas, configure their init params in the right-hand
panel, and wire them together. Values propagate live through the wires in the browser: press a
Button and connected LEDs light up; drag a potentiometer and a PWMLED's brightness follows; feed
`sin_values` into a Servo and watch the needle sweep. Clicking a Button latches it on until the
next click; press and hold for a momentary press.

Switch to Live mode to drive a real Pi instead of the simulation — run
[`agent/gpio_agent.py`](agent/README.md) on the Pi and the same canvas controls its GPIO pins over
a websocket. Live mode needs the app itself running on `localhost` too, since browsers block an
insecure `ws://` connection from a page served over HTTPS — the hosted site links to a downloadable
build for exactly that.

## Development

```sh
npm install
npm run dev
```

Visit `/app` for the canvas — the root path serves the marketing landing page. Built with Vite,
React, TypeScript, and [React Flow](https://reactflow.dev/).

## Devices and source tools

Every gpiozero device with a scalar or tuple `value` is supported — inputs, outputs, boards, ADCs
and internal devices all have a node, grouped into sidebar drawers, alongside the full
`gpiozero.tools` set (sources, processors and combiners). Wires carry either a single number or a
multi-channel tuple: anything with a scalar `value` (0..1 or -1..1) fits the model as-is, and
composite devices like RGBLED take tuples built with `zip_values`. Connections are shape-checked —
a tuple wire can't feed a scalar input or vice versa, mirroring what would fail in Python.

Composite HATs (TrafficHat, FishDish, JamHat, Pibrella, …) are deliberately not included: they're
just fixed arrangements of the base components above, and their nested values sit awkwardly on
flat wires — one wire would have to drive lights, buzzer and ignore the onboard button at once.
Building the same thing from parts (say a TrafficLights, a Buzzer and a Button, wired however you
like) fits the node model better and isn't tied to the boards' fixed pins.

## Device behaviour

Each device gets a unique name (`led`, `led_2`, …) which can be edited in the config panel —
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
released to match. ADCs work the same way with channels, taking the lowest free channel on
their chip; each ADC kind models one physical chip, so channel pools are per kind (two
MCP3002s share channels 0-1, while an MCP3008 alongside them has its own 0-7).

**Known issue:** the MCP3xxx ADCs talk over the SPI bus, so constructing one in gpiozero reserves
GPIO 8-11 (CE0/MISO/MOSI/SCLK; a second chip on CE1 would also take GPIO 7). Relatedly, a canvas
mixing different ADC chips generates constructors that all sit on CE0 — fine in simulation, but
real chips would each need their own select pin. Energenie is similar: all sockets share one radio
transmitter that silently reserves GPIO 17, 22, 23, 27 (data), 24 (mode) and 25 (enable). Neither
the app nor the agent models this — an MCP3008 or an Energenie occupies no GPIO pins here, and the
auto-assigner will happily give those pins to other devices. A canvas mixing one of these with
enough pinned devices therefore generates a script that raises `GPIOPinInUse` on a real Pi, even
though the simulation is fine. Fix: treat GPIO 8-11 as taken while any MCP3xxx is on the canvas,
disable them in pin dropdowns with an "SPI" note, and decide what happens when one is dropped after
8-11 are already assigned (block with a warning, or reassign the clashing devices).

## Simulation clock

While any time-based node (an artificial source, or a stateful tool like `smoothed`,
`queued` or the delays/filters) is on the canvas — or any
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
