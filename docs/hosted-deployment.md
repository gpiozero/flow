# Could a hosted version of the app talk to a Pi on the user's LAN?

> **Status (now that the app is actually deployed):** the mixed-content block
> described below is real, not hypothetical. `src/pi.ts` exports `isLocalhost()`,
> and `App.tsx` uses it to swap the Live-mode connect UI for a short explainer
> when the page isn't on `localhost`/`127.0.0.1`/`[::1]` — see option 2 below. The
> explainer's "how to run it locally" instructions are a placeholder for now
> (marked with a `TODO` in `App.tsx`) pending a decision on how the app is
> actually distributed for local use (git clone? a packaged download? something
> else?).

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

1. **Serve the app from the Pi itself** (the Node-RED model). A `pip install`/apt package
   that serves the built `dist/` over plain HTTP on the LAN plus the agent websocket on
   the same origin. An `http://raspberrypi.local` page may open `ws://` freely. This is
   the most natural fit given the agent already exists.
2. **Run the app locally** — `localhost` is a secure context even over plain HTTP, and
   pages on it aren't subject to mixed-content blocking, so the current dev-server
   workflow already works and a downloadable/Electron/PWA-ish distribution would too.
3. **Host it over plain HTTP** — works, but browsers flag "Not secure" and it's a
   non-starter for a public site.
4. **Real certs on the Pi** — the Plex/Home Assistant-style trick (public DNS name
   resolving to the LAN IP + DNS-01 Let's Encrypt cert, then `wss://`). Works but is
   significant infrastructure for users to set up.

## Security note

The agent (`agent/gpio_agent.py`) accepts any connection without checking the `Origin`
header or any token. WebSockets aren't protected by CORS, so once mixed content isn't in
the way (e.g. the app served from the Pi over HTTP), *any* website the user visits could
connect to the agent and drive GPIO. Worth adding an origin check or pairing token before
this goes beyond the LAN-toy stage.
