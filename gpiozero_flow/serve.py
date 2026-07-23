"""Serve the built gpiozero-flow web app over plain HTTP.

The app is built as separate HTML entries rather than client-side routing
(see vite.config.ts) — `/`, `/app/` and `/live/` are each a real static
page sharing `/assets/` — so a plain static file server rooted at the
build output is enough; no Node/npm needed to *run* it, only to build it
(the `webapp/` directory bundled alongside this module).

Serving over plain HTTP (rather than the hosted https:// site) matters
for Live mode: browsers block ws:// as mixed content from an https: page,
but not from here, whatever host this is reached by — see
docs/hosted-deployment.md.
"""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

WEBAPP_DIR = Path(__file__).parent / 'webapp'


def main():
    """Entry point for the `gpiozero-flow` console script."""
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--host', default='0.0.0.0')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()

    handler = partial(SimpleHTTPRequestHandler, directory=str(WEBAPP_DIR))
    with ThreadingHTTPServer((args.host, args.port), handler) as httpd:
        print(f'Serving gpiozero-flow on http://{args.host}:{args.port}/ (Ctrl+C to stop)')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
