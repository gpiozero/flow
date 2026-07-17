// Playwright primitives for driving the gpio-webapp canvas.
// See SKILL.md for why each works the way it does.
import { chromium } from 'playwright';

const URL = process.env.APP_URL ?? 'http://localhost:5173/';

export async function launch() {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(URL);
  await page.waitForSelector('.canvas');
  return { browser, page };
}

// Place a device on the canvas at canvas-relative (x, y).
// kind is a NodeKind key from src/catalog.ts, e.g. 'led', 'lightsensor'.
export async function dropNode(page, kind, x, y) {
  await page.evaluate(
    ({ kind, x, y }) => {
      const canvas = document.querySelector('.canvas');
      const dt = new DataTransfer();
      dt.setData('application/gpiozero-node', kind);
      const rect = canvas.getBoundingClientRect();
      const opts = {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
        clientX: rect.left + x,
        clientY: rect.top + y,
      };
      canvas.dispatchEvent(new DragEvent('dragover', opts));
      canvas.dispatchEvent(new DragEvent('drop', opts));
    },
    { kind, x, y }
  );
}

// Set a node's range slider through React's native value setter.
export async function setSlider(page, nodeLocator, value) {
  const input = nodeLocator.locator('input[type=range]');
  await input.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

// Wire fromNode's output handle to toNode's input handle.
export async function connect(page, fromNode, toNode) {
  const a = await fromNode.locator('.react-flow__handle-right').boundingBox();
  const b = await toNode.locator('.react-flow__handle-left').boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
}
