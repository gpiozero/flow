# Could a hosted version of the app talk to a Pi on the user's LAN?

> **Status (now that the app is actually deployed):** the mixed-content block
> described below is real, not hypothetical. `src/pi.ts` exports
> `liveModeSupported()`, and `App.tsx` uses it to swap the Live-mode connect UI
> for a short explainer when it returns false — see option 2 below. It checks
> `location.protocol !== 'https:'` rather than the hostname: mixed content only
> fires when the *page* is https, so an insecure page talking to
> `raspberrypi.local` (option 1) is just as unrestricted as one on `localhost`
> (option 2) — hostname-only used to wrongly gate the Pi-hosted case. The
> distribution question is resolved: source stays private, but the build is
> public. `.github/workflows/deploy.yml` zips the built `dist/` together with
> `agent/gpio_agent.py` and its README into `dist/gpiozero-flow.zip` on every
> deploy, so it rides along with the site (`/gpiozero-flow.zip`) with no
> separate hosting or release process. `vite.config.ts` builds the app as its
> own HTML entry (`app/index.html`, not client-side routing) specifically so
> the unzipped copy works from a plain static server — `python3 -m http.server`
> is enough, no Node/npm needed on the user's machine, whether that server runs
> on the user's computer (option 2) or on the Pi itself (option 1). A third
> entry, `live/index.html`, is a dedicated page at `/live` with step-by-step
> setup instructions for both options, plus the zip link; the landing page and
> the Live-mode modal both link to `/live` rather than straight to the zip.

Short answer: **not as it stands, if the app were served over HTTPS — and any real
deployment would be HTTPS.** The blocker is browser mixed-content policy, not networking.

## What would happen

The connection is made from the browser (`src/pi.ts`), which builds `ws://<address>` and
calls `new WebSocket(url)`. That part is actually favourable for the LAN case: the
WebSocket originates from the user's machine, so a hosted page can reach `192.168.x.x` or
`raspberrypi.local` — the hosting server never needs to see the Pi.

But every major browser blocks insecure `ws://` connections from a page loaded over
`https://` (mixed content). Chrome and Firefox throw a `SecurityError` at construction, so
users would just get the "Invalid Pi address" / "Could not connect" toast. Switching to
`wss://` doesn't fix it either, because the Pi would need a TLS certificate the browser
trusts, and you can't get a publicly-valid cert for a private IP or `.local` name.

There's a second squeeze coming: Chrome's Local Network Access rollout (replacing Private
Network Access) puts public-website→LAN requests behind a permission prompt. That's
actually a possible long-term way *out* — the proposal includes relaxing mixed-content
rules for local devices once the user grants permission — but it isn't something to rely
on today.

## Ways it *can* work

1. **Serve the app from the Pi itself** (the Node-RED model). Shipped as the
   `gpiozero-flow` PyPI package (`pyproject.toml`, root of this repo): `gpiozero-flow`
   serves the built `dist/` over plain HTTP on the LAN, `gpiozero-agent` runs the
   websocket agent, both on the same origin — see `gpiozero_flow/README.md`. An
   `http://raspberrypi.local` page may open `ws://` freely. This is the most natural fit
   given the agent already exists, and is also what the "Switch to Pi" link in the
   Live-mode modal (`src/components/LiveModeModal.tsx`) targets.
2. **Run the app locally** — `localhost` is a secure context even over plain HTTP, and
   pages on it aren't subject to mixed-content blocking, so the current dev-server
   workflow already works and a downloadable/Electron/PWA-ish distribution would too.
3. **Host it over plain HTTP** — works, but browsers flag "Not secure" and it's a
   non-starter for a public site.
4. **Real certs on the Pi** — the Plex/Home Assistant-style trick (public DNS name
   resolving to the LAN IP + DNS-01 Let's Encrypt cert, then `wss://`). Works but is
   significant infrastructure for users to set up.

## Security note

The agent (`gpiozero_flow/gpio_agent.py`) accepts any connection without checking the `Origin`
header or any token. WebSockets aren't protected by CORS, so once mixed content isn't in
the way (e.g. the app served from the Pi over HTTP), *any* website the user visits could
connect to the agent and drive GPIO. Worth adding an origin check or pairing token before
this goes beyond the LAN-toy stage.

**Not yet implemented — planned design (2026-07-23):** `gpiozero_flow/gpio_agent.py:342` calls
`serve(agent.handler, args.host, args.port)` with no `origins=`. That parameter (checked
in `websockets` 16.1.1 — supports a list of exact strings or `re.Pattern`) turns out not
to be enough on its own: it's a static list, but the two legitimate setups need a
per-connection comparison against *that request's own* `Host` header, which only the
`process_request` hook sees. So the plan is a custom check there rather than the built-in
`origins=` list:

- **Allow** if there's no `Origin` header at all — non-browser clients (the README
  documents the wire protocol for hand-rolled scripts) have no Origin to check, and a
  script on the LAN is already a different threat model than a browser tab.
- **Allow** if `Origin` hostname is `localhost` / `127.0.0.1` / `::1`, any port — running
  the web app on a laptop to drive a remote Pi's GPIO over the network. Safe because a
  real remote page can't spoof its own Origin to say `localhost`.
- **Allow** if `Origin` hostname matches the hostname in the request's own `Host` header,
  any port — the app and agent bundled on the same Pi (`http://raspberrypi.local:8000`
  talking to `raspberrypi.local:8765`). Also unspoofable: an attacker's page only gets the
  browser to dial whatever hostname *it* used to reach the agent, which has to equal the
  agent's own hostname for this to pass.
- **Reject** everything else — some other domain that's neither localhost nor the agent's
  own hostname.

This closes the "a malicious webpage open in another tab silently drives your GPIO"
vector with no configuration for either legitimate setup. It still doesn't stop a direct
attacker already on the LAN sending raw WebSocket frames with a forged `Host`/`Origin`
pair — no browser involved, so nothing here constrains them. That's the same pre-existing
gap, just narrower: a pairing token would be needed to close it fully, and is worth
revisiting once this ships as an installable package (`gpiozero-agent` / `gpiozero-flow`
CLI scripts) rather than something run by hand.
