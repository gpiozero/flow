"""gpiozero-flow: the node-based gpiozero web app and its GPIO agent, bundled
for `pip install` onto a Raspberry Pi. See gpiozero_flow/README.md.

The `webapp/` directory isn't present in the source tree — it's assembled
into the wheel at build time (see pyproject.toml's force-include) from the
Vite build output (dist/), so it only exists once this package has
actually been built (`npm run build` first).
"""

__version__ = '0.1.0'
