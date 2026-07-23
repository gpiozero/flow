# Agent/webapp version compatibility

Design note written 2026-07-19, not yet implemented. Once the webapp
is released, new source tools and devices added to the catalog will
outrun the gpiozero (and agent) installed on users' Pis. This page
records how the ws protocol should handle that and how the user
finds out.

## Where new-feature support actually lives

The agent (`gpiozero_flow/gpio_agent.py`) resolves tools and devices
dynamically — `TOOLS` is built from `vars(gpiozero.tools)` and device
classes come from `getattr(gpiozero, name)` — so support for a new
tool or device is almost always a property of the **gpiozero version
on the Pi**, not of the agent script. The agent script itself only
matters when the wire format changes (e.g. a new tagged value
alongside `__type__: "motor"`).

Today an old gpiozero fails late and cryptically: the graph applies,
`_build_chain` raises `unknown tool 'cond'` (attributed to the
consuming device node) or `device_class` raises `unknown device
class`, and the user sees a raw per-node error toast that never says
"upgrade gpiozero".

## Who checks: the webapp, not the Pi

Putting a version *requirement* in the browser→agent payload and
having the Pi enforce it has a bootstrapping problem: the agents that
most need catching are the old ones, and an old agent silently
ignores message keys it doesn't know (`msg.get('type') == 'graph'`;
everything else is dropped). Pi-side enforcement only starts working
one agent generation after it ships — and the Pi is exactly the side
that lags.

So invert it: **the agent reports facts; the webapp — always
current — does the comparing.** One agent update bootstraps this
forever, and the absence of the report cleanly identifies every
pre-versioning agent.

## Protocol addition: a `hello` message

Sent by the agent immediately on connection, before the first
`values` frame:

```json
{"type": "hello", "protocol": 1, "agent": "0.3",
 "gpiozero": "2.0.1", "pin_factory": "LGPIOFactory",
 "tools": ["negated", "scaled", "..."],
 "devices": ["LED", "Button", "..."]}
```

Two separate things are versioned:

- **`protocol`** (int, may be echoed webapp→agent in the graph
  message): covers wire-format changes only — new tagged values, new
  message types the agent must understand. Bumped rarely; on
  mismatch the webapp refuses to connect or warns.
- **Feature support** is reported as the agent's actual `tools` and
  `devices` lists, which it already computes at startup. Capability
  reporting beats comparing version strings: distro-patched
  gpiozero, dev installs and backports all report truthfully, and
  there is no version parsing to get wrong. `gpiozero.__version__`
  rides along anyway — not for the check, but to phrase the error.

Webapp side: catalog `NodeSpec`s that postdate the initial release
gain optional metadata, e.g. `requires: { gpiozero: '2.1' }`. It is
used only to word the remedy ("needs gpiozero ≥ 2.1"); the actual
check is "is `cond` in the hello's `tools`".

## How the user learns their setup is incompatible

Layered, friendliest first:

1. **At connect time** — `usePiLink` (src/pi.ts) compares the hello
   against the nodes on the canvas (or the whole catalog). On a gap,
   the status indicator shows a warning state and a toast names both
   problem and fix: *"Connected: gpiozero 2.0.1 on
   raspberrypi.local. This canvas uses `cond` (needs gpiozero ≥
   2.1) — run `sudo pip install --upgrade gpiozero` on the Pi."*
   No hello at all ⇒ oldest baseline; message: "agent predates
   version reporting — download the current gpio_agent.py".
2. **At drag time, while connected** — unsupported drawer entries
   are dimmed/badged with a tooltip ("needs gpiozero ≥ 2.1;
   connected Pi has 2.0.1"), so the user never wires something that
   cannot run. Unconnected (simulation-only) use is never gated —
   the browser simulates everything.
3. **Backstop** — the per-node `applied` errors remain; with hello
   data in hand the webapp rewrites "unknown tool/class" errors into
   the upgrade message instead of showing the raw exception.

## The reverse direction

Old webapp against a newer agent mostly just works: the agent's
tool/device lists are a superset, and unknown keys in `hello` are
ignored. Only a wire-format change breaks it, which is what the
`protocol` int catches.

## Implementation touchpoints (when picked up)

- `gpiozero_flow/gpio_agent.py`: send `hello` in `handler()` before the
  initial values frame; add an `AGENT_VERSION` and `PROTOCOL`
  constant; lists come from the existing `TOOLS` dict and a sweep of
  `gpiozero` Device subclasses.
- `src/pi.ts`: extend `AgentMessage`, store the hello in link state,
  expose it from `usePiLink`.
- `src/catalog.ts`: optional `requires` metadata on `NodeSpec`.
- Drawer + status UI: dim/badge unsupported entries; warning state
  on the connection indicator.
