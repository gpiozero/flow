---
name: run-app
description: Launch the gpio-webapp dev server and drive it in a browser (drop nodes, work sliders, wire connections, screenshot) with Playwright
---

# Running and driving gpio-webapp

## Launch

```bash
npm run dev   # background; Vite prints the URL, normally http://localhost:5173/
```

Confirm it's up with `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/` → 200.
Hot reload means code edits appear live — no restart needed.

## Drive it with Playwright

Playwright is a devDependency. **Always launch with `channel: 'chrome'`** — it uses the
system Google Chrome; never download browsers into `~/.cache/ms-playwright`
(no `npx playwright install`).

`helpers.mjs` (next to this file) has the non-obvious primitives that took real
work to discover — import it rather than rediscovering them:

- `launch()` → `{ browser, page }` on the dev server with `.canvas` ready.
- `dropNode(page, kind, x, y)` — places a device on the canvas. React Flow's
  drag & drop can't be done with mouse moves alone; it needs a synthetic
  DragEvent whose DataTransfer carries the `application/gpiozero-node` MIME
  type set to a `NodeKind` key from `src/catalog.ts` (e.g. `'led'`,
  `'lightsensor'`, `'sin_values'`).
- `setSlider(page, nodeLocator, value)` — range inputs must be set through the
  native value setter and then dispatch an `input` event, or React ignores it.
- `connect(page, fromNode, toNode)` — drags from a node's right handle to
  another's left handle with `page.mouse` moves (this one *is* real mouse work).

Example session:

```js
import { launch, dropNode, setSlider, connect } from './helpers.mjs';

const { browser, page } = await launch();
await dropNode(page, 'lightsensor', 300, 200);
await dropNode(page, 'pwmled', 600, 200);
await connect(page, page.locator('.device-node').first(), page.locator('.device-node').nth(1));
await setSlider(page, page.locator('.device-node').first(), 0.8);
await page.locator('.device-node').nth(1).screenshot({ path: 'led.png' });
await browser.close();
```

**Look at the screenshots you take** — a blank frame means the app didn't render.

## Other interactions

- Button node: `page.click('.tactile-button')` (quick tap latches, hold is momentary).
- Node config: click a node, edit fields in the right-hand panel.
- Generated code: the "View Python script" button in the header.
