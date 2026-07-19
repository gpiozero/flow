# Gating a TonalBuzzer with a button

Findings on how "button plays a chosen tone" could work, written
2026-07-19. Nothing here is implemented; this is groundwork for a
future decision (and probably a gpiozero proposal).

## The problem

Button → Buzzer is a natural wiring: the buzzer's value is boolean, so
the button's 0/1 maps straight onto off/on. Button → TonalBuzzer is
not: TonalBuzzer's value is a *pitch* in -1..1 (0 = mid_tone, ±1 = an
octave either side), so a button just alternates between two tones —
released plays the mid tone rather than going quiet.

What the user often wants instead is a gate: pressed = play a chosen
tone, released = silent.

## What gpiozero provides today

- `TonalBuzzer.value` accepts the special value `None`, meaning
  silent (`output_devices.py`, value setter: `None` clears the PWM
  frequency; -1..1 sets a pitch). `initial_value=None` is the default,
  and `stop()` is just `self.value = None`.
- `SourceMixin` copies source values with a plain `self.value = v`
  loop, so a generator yielding `None`s and pitches works right now:

  ```python
  tb.source = (0 if v else None for v in button.values)
  ```

  With 0 as the "on" pitch, the *tone played* is chosen by the
  existing `mid_tone` init param — no extra tone parameter needed.
- `Servo` has the same convention: `value = None` means
  un-controlled (no pulses), via `detach()`. So a boolean→value/None
  gate is useful beyond buzzers (press to hold a servo position,
  release to let it float).
- `None` is *not* universally safe: `PWMLED`/`LED` and friends
  reject or misinterpret it, so a gate emitting `None` only suits the
  devices that define it (TonalBuzzer, Servo/AngularServo).

## Can existing tools express it?

No. Every function in `gpiozero.tools` maps numbers to numbers:

- `scaled`/`booleanized`/`inverted` can reshape the range but can't
  produce silence — their "off" is still a number, and for
  TonalBuzzer every number in -1..1 is an audible tone.
- `multiplied` with a button gives 0 when released — the mid tone,
  not silence.
- Nothing yields `None`; the generator expression above is the only
  way, and the canvas can't express arbitrary generator expressions.

## Options

### 1. A new gpiozero.tools function (recommended)

A conditional/gate tool, e.g.:

```python
def cond(values, on_value=1, off_value=0):
    """Yield on_value for each truthy value, off_value otherwise."""
    for v in values:
        yield on_value if v else off_value
```

Usage: `tb.source = cond(button.values, 0, None)` — button pressed
plays `mid_tone`, released is silent. `on_value` can be any pitch in
-1..1 to choose a tone within the range instead.

This is the most general fix: it also covers button → preset servo
position, button → preset brightness, sensor → one of two values,
and (with `off_value=None`) the detach semantics on Servo. It follows
the [broadcast precedent](considerations.md): a missing source tool
goes upstream to gpiozero first, then the webapp adopts it like any
other tool — catalog spec plus one simulation case; codegen and the
agent already handle `gpiozero.tools` functions generically.

Naming needs thought for a PR: gpiozero transforms are past
participles (`negated`, `scaled`, `queued`), so perhaps `switched` or
`gated`; `cond` reads well but breaks the convention.

### 2. A gpiozero TonalBuzzer API change

Alternatives on the device itself:

- an init param that reinterprets source values as on/off (e.g.
  `TonalBuzzer(pin, gate=True)` treating truthy as "play mid_tone").
  Rejected in this analysis: it overloads one device's value
  vocabulary (0 would mean *silent* on one buzzer and *mid tone* on
  another), breaks value round-tripping, and doesn't help Servo.
- a new wrapper class (a "ToneAlarm"-style bool-valued device).
  Heavier than a tool, and every None-accepting device would need its
  own wrapper.

Both are worse than option 1: the transformation belongs between the
devices, which is exactly what tools are for.

### 3. A webapp-only tool

Ruled out on principle — see the reverted `broadcast` experiment in
[considerations.md](considerations.md): webapp-only tools break the
"what you wire is what gpiozero runs" property.

## Webapp implications (whichever option lands)

`None` on a wire is new for the canvas either way:

- `SimValue` is `number | number[]` (src/types.ts:76). The
  simulation already renders an *unwired* TonalBuzzer's silence as
  `NaN` (src/simulation.ts:189-192), so `NaN` is the natural in-sim
  stand-in for `None` flowing along a wire; alternatively extend
  `SimValue` with `null`.
- Downstream nodes need a defined reaction to the silent value
  (TonalBuzzer/Servo: go silent/detach; other devices: probably
  refuse the wire or treat as 0, mirroring gpiozero's behaviour).
- The tool's params would be `on_value`/`off_value` floats where
  "none" must be a choosable option — a small param-editor addition
  (a "silent/none" checkbox alongside the number field).

## Recommendation

Propose a `cond`-style gate tool for `gpiozero.tools` (option 1).
Once merged, webapp integration is mechanical. Meanwhile, no interim
webapp-only tool.
