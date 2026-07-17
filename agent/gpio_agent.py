#!/usr/bin/env python3
"""WebSocket agent that mirrors a gpio-webapp canvas onto real GPIO devices.

The browser sends the serialized node graph on every canvas change; the
agent reconciles it into live gpiozero devices — constructing new
devices, closing removed ones and reassigning ``.source`` chains — so
edits land in the running session without a restart. Device values are
streamed back at 10Hz so the canvas can display real hardware state.

Wire protocol (JSON messages):

  browser -> agent:
    {"type": "graph", "nodes": [...], "edges": [{"source", "target"}]}
      device node: {"id", "device": true, "cls": "LED", "name",
                    "args": [...], "kwargs": {...}, "attrs": {...}}
      tool node:   {"id", "device": false, "fn": "negated", "kwargs": {...}}
      Tagged values: {"__type__": "time", "value": [h, m]} -> datetime.time,
                     {"__type__": "motor", "pins": [f, b]} -> Motor (Robot).

  agent -> browser:
    {"type": "applied", "errors": [{"nodeId", "message"}, ...]}
    {"type": "values", "values": {node id: value, ...}}  (changed only)

Run on the Pi:  gpio_agent.py [--host 0.0.0.0] [--port 8765]
"""

import argparse
import asyncio
import datetime
import inspect
import json
import logging

import gpiozero
import gpiozero.tools
from gpiozero.mixins import SourceMixin, ValuesMixin
from websockets.asyncio.server import serve

log = logging.getLogger('gpio-agent')

TICK_SECONDS = 0.1

# Tools are looked up by name in gpiozero.tools; devices may be any
# Device subclass exported by gpiozero. Anything else is rejected.
TOOLS = {
    name: fn
    for name, fn in vars(gpiozero.tools).items()
    if not name.startswith('_') and inspect.isfunction(fn)
}


def device_class(name):
    cls = getattr(gpiozero, name, None)
    if inspect.isclass(cls) and issubclass(cls, gpiozero.Device):
        return cls
    raise ValueError(f'unknown device class {name!r}')


def decode(value, created):
    """A wire value as a Python value; sub-devices built for tagged
    values (Robot's motors) are appended to `created` so a failed
    constructor can release their pins."""
    if isinstance(value, dict):
        tag = value.get('__type__')
        if tag == 'time':
            hour, minute = value['value']
            return datetime.time(hour, minute)
        if tag == 'motor':
            motor = gpiozero.Motor(*value['pins'])
            created.append(motor)
            return motor
        raise ValueError(f'unknown tagged value {tag!r}')
    return value


def jsonable(value):
    """A device value as JSON: namedtuples become lists, floats are
    rounded so the changed-value stream isn't churned by noise."""
    if isinstance(value, tuple):
        return [jsonable(v) for v in value]
    if isinstance(value, float):
        return round(value, 3)
    return value


def constructor_sig(node):
    """Signature of a device node's constructor inputs; a change means
    the device must be rebuilt (attrs are settable live, so excluded)."""
    return json.dumps(
        [node.get('cls'), node.get('args'), node.get('kwargs')], sort_keys=True
    )


class Session:
    """The live gpiozero devices mirroring the last applied graph."""

    def __init__(self):
        self.devices = {}     # node id -> device object
        self.dev_sigs = {}    # node id -> constructor signature
        self.gen = {}         # node id -> creation counter (bumped on rebuild)
        self.wiring = {}      # node id -> signature of the chain feeding it
        self.chain_deps = {}  # node id -> device node ids its chain reads

    def apply(self, nodes, edges):
        """Reconcile the live devices to the graph; returns node errors."""
        errors = []
        by_id = {n['id']: n for n in nodes}
        incoming = {}
        for e in edges:
            if e['source'] in by_id and e['target'] in by_id:
                incoming.setdefault(e['target'], []).append(e['source'])

        # Close devices that are gone or whose constructor changed;
        # consumers reading a doomed device are unwired first so their
        # copy threads don't crash on a closed source.
        doomed = [
            node_id
            for node_id in self.devices
            if self.dev_sigs[node_id]
            != (
                constructor_sig(by_id[node_id])
                if node_id in by_id and by_id[node_id].get('device')
                else None
            )
        ]
        for node_id in doomed:
            for consumer, deps in list(self.chain_deps.items()):
                if node_id in deps:
                    self._unwire(consumer)
            self._close(node_id)

        # Construct new devices
        for node in nodes:
            if not node.get('device') or node['id'] in self.devices:
                continue
            created = []
            try:
                cls = device_class(node['cls'])
                args = [decode(v, created) for v in node.get('args', [])]
                kwargs = {
                    k: decode(v, created) for k, v in node.get('kwargs', {}).items()
                }
                self.devices[node['id']] = cls(*args, **kwargs)
            except Exception as exc:
                for dev in created:
                    dev.close()
                errors.append(
                    {'nodeId': node['id'], 'message': f"{node['cls']}: {exc}"}
                )
                continue
            self.dev_sigs[node['id']] = constructor_sig(node)
            self.gen[node['id']] = self.gen.get(node['id'], 0) + 1
            log.info('created %s (%s)', node.get('name') or node['id'], node['cls'])

        # Live-settable attribute params (e.g. source_delay)
        for node in nodes:
            dev = self.devices.get(node['id'])
            if dev is None:
                continue
            for name, value in (node.get('attrs') or {}).items():
                try:
                    setattr(dev, name, value)
                except Exception as exc:
                    errors.append(
                        {'nodeId': node['id'], 'message': f'{name}: {exc}'}
                    )

        # (Re)assign source chains where the feeding subgraph changed
        for node in nodes:
            if not node.get('device'):
                continue
            dev = self.devices.get(node['id'])
            if dev is None:
                continue
            preds = incoming.get(node['id'], [])
            if not preds:
                if node['id'] in self.wiring:
                    self._unwire(node['id'])
                continue
            sig = json.dumps(self._chain_sig(preds[0], by_id, incoming))
            if self.wiring.get(node['id']) == sig:
                continue
            if not isinstance(dev, SourceMixin):
                errors.append(
                    {
                        'nodeId': node['id'],
                        'message': f"{node['cls']} cannot take a source",
                    }
                )
                continue
            try:
                deps = set()
                dev.source = self._build_chain(preds[0], by_id, incoming, deps)
            except Exception as exc:
                errors.append({'nodeId': node['id'], 'message': str(exc)})
                continue
            self.wiring[node['id']] = sig
            self.chain_deps[node['id']] = deps
            log.info('wired %s', node.get('name') or node['id'])

        return errors

    def _chain_sig(self, node_id, by_id, incoming):
        """Structural signature of the source subgraph rooted at a node.
        Devices contribute their creation counter, so a rebuilt device
        forces its consumers' chains to be rebuilt around the new object."""
        node = by_id[node_id]
        if node.get('device'):
            return [node_id, self.gen.get(node_id)]
        return [
            node.get('fn'),
            node.get('kwargs'),
            [self._chain_sig(p, by_id, incoming) for p in incoming.get(node_id, [])],
        ]

    def _build_chain(self, node_id, by_id, incoming, deps):
        """The value for a `.source` assignment: the device itself, or
        the tool subgraph called as nested gpiozero.tools generators."""
        node = by_id[node_id]
        if node.get('device'):
            dev = self.devices.get(node_id)
            if dev is None:
                raise ValueError(
                    f"source device {node.get('name') or node_id} was not created"
                )
            deps.add(node_id)
            return dev
        inputs = [
            self._build_chain(p, by_id, incoming, deps)
            for p in incoming.get(node_id, [])
        ]
        kwargs = node.get('kwargs') or {}
        if node['fn'] == 'zip_values':
            # gpiozero's zip_values takes devices only; builtin zip
            # handles device values and generator chains alike
            return zip(
                *(i.values if isinstance(i, ValuesMixin) else i for i in inputs)
            )
        fn = TOOLS.get(node['fn'])
        if fn is None:
            raise ValueError(f"unknown tool {node['fn']!r}")
        return fn(*inputs, **kwargs)

    def _unwire(self, node_id):
        self.wiring.pop(node_id, None)
        self.chain_deps.pop(node_id, None)
        dev = self.devices.get(node_id)
        if isinstance(dev, SourceMixin):
            try:
                dev.source = None
            except Exception:
                log.exception('unwiring %s', node_id)

    def _close(self, node_id):
        self._unwire(node_id)
        dev = self.devices.pop(node_id, None)
        self.dev_sigs.pop(node_id, None)
        if dev is not None:
            try:
                dev.close()
            except Exception:
                log.exception('closing %s', node_id)
            log.info('closed %s', node_id)


class Agent:
    def __init__(self):
        self.session = Session()
        self.clients = set()
        self.last_values = {}

    async def handler(self, ws):
        log.info('client connected: %s', ws.remote_address)
        self.clients.add(ws)
        try:
            # paint current hardware state immediately
            if self.last_values:
                await ws.send(
                    json.dumps({'type': 'values', 'values': self.last_values})
                )
            async for message in ws:
                try:
                    msg = json.loads(message)
                except ValueError:
                    continue
                if msg.get('type') == 'graph':
                    try:
                        errors = self.session.apply(
                            msg.get('nodes', []), msg.get('edges', [])
                        )
                    except Exception as exc:
                        log.exception('applying graph')
                        errors = [{'nodeId': None, 'message': str(exc)}]
                    try:
                        await ws.send(json.dumps({'type': 'applied', 'errors': errors}))
                    except Exception:
                        break  # client went away mid-reply; the graph still applied
        finally:
            self.clients.discard(ws)
            log.info('client disconnected')

    async def stream_values(self):
        """Broadcast changed device values to all clients at 10Hz."""
        while True:
            changed = {}
            for node_id, dev in list(self.session.devices.items()):
                try:
                    value = jsonable(dev.value)
                except Exception:
                    continue
                if self.last_values.get(node_id) != value:
                    self.last_values[node_id] = value
                    changed[node_id] = value
            for node_id in list(self.last_values):
                if node_id not in self.session.devices:
                    del self.last_values[node_id]
            if changed and self.clients:
                payload = json.dumps({'type': 'values', 'values': changed})
                for ws in list(self.clients):
                    try:
                        await ws.send(payload)
                    except Exception:
                        pass
            await asyncio.sleep(TICK_SECONDS)


async def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--host', default='0.0.0.0')
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s'
    )
    gpiozero.Device.ensure_pin_factory()
    agent = Agent()
    asyncio.create_task(agent.stream_values())
    async with serve(agent.handler, args.host, args.port):
        log.info(
            'gpio-agent listening on ws://%s:%d (pin factory: %s)',
            args.host,
            args.port,
            type(gpiozero.Device.pin_factory).__name__,
        )
        await asyncio.Future()


if __name__ == '__main__':
    asyncio.run(main())
