# Considerations for future work

Ideas that came up during development, deliberately not (or no longer)
implemented in the webapp, and why.

## A fan-out / splitter source tool (`broadcast`)

**Need**: there is no way to drive a tuple-input device from a single
scalar source — e.g. one Button lighting all three lamps of a
TrafficLights. gpiozero's closest answer is
`lights.source = zip(button.values, button.values, button.values)`,
which the canvas can't express (the same source can't be wired into
`zip_values` three times), and `gpiozero.tools` has no fan-out
function.

**What was tried** (built 2026-07-18, fully working, then reverted): a
webapp-only `broadcast` tool — scalar in, n-channel tuple out
(n = 2..10). Three integration points, kept here for reference:

- *Simulation*: repeat the scalar across n channels
  (`Array(n).fill(input)`).
- *Codegen*: no gpiozero import exists, so the script emitted a local
  helper and spelt out `.values` for device sources
  (`lights.source = broadcast(button.values, n=3)`):

  ```python
  def broadcast(values, n=3):
      for v in values:
          yield (v,) * n
  ```

- *Agent*: the same generator registered in its `TOOLS` table, with a
  `ValuesMixin` check to accept device sources.

**Why reverted**: the webapp aims to mirror gpiozero's source/values
vocabulary, and a tool with no gpiozero equivalent breaks the "what
you wire is what gpiozero runs" property — the generated script needs
a bespoke helper, and the agent needs out-of-band tool definitions.
The better path is to add the missing tools to gpiozero itself
(gpiozero.tools), then adopt them here like any other tool.

**Upstream candidates** (for a gpiozero PR):

- `broadcast(values, n)` — one source repeated as n-tuples, as above.
  Complements `zip_values`, which combines n sources into tuples.
- Possibly a general `tee`-style splitter if generator sharing across
  multiple sinks ever becomes a first-class need.

Once such tools exist upstream, the webapp integration is mechanical:
catalog spec + one simulation case; codegen and the agent already
handle any `gpiozero.tools` function generically.
