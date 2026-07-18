# gpio-webapp (name TBC)

A web app project providing a node-based drag & drop interface for gpiozero.

## Running & verifying

`npm run dev` serves on http://localhost:5173/ with hot reload. To drive the app in a
browser (drop nodes, wire them, screenshot), follow `.claude/skills/run-app/SKILL.md` —
it has working Playwright helpers; don't rediscover the drag & drop mechanics. Use the
system Chrome (`channel: 'chrome'`), never `npx playwright install`.

## Background

### gpiozero

gpiozero is a Python library providing a simple straightforward interface to GPIO devices such as
LEDs, buttons, various sensors, and add-on boards comprising multiple such components.

In this project we will use a source/values approach to connecting devices - see source_values.rst

### NODE-RED

Node-RED is a flow-based programming tool for wiring together hardware devices, APIs, and online
services. It's built on Node.js and gives you a browser-based editor where you build applications by
dragging "nodes" onto a canvas and connecting them with wires, rather than writing code line by
line.

## MVP

For the MVP we will develop a webapp allowing the user to drag basic components (e.g. LEDs and
buttons) from a sidebar into a main canvas, configure them (set the init params) and connect
components together by drawing lines between them.

We will provide drawers of available components in sections (inputs and outputs).

The MVP will be a proof-of-concept which will not need to control GPIO pins or communicate with any
Python processes.

## Decisions (2026-07-13)

- **Stack**: React + React Flow, TypeScript, Vite
- **Node types**: devices plus a few representative source tools (e.g. `negated`, `all_values`) in
  a third drawer section
- **MVP devices**: LED, PWMLED, Button, plus an analog input (MCP3008/potentiometer) so float
  sources are representable
- **Simulation**: live value simulation in the browser — interacting with an input node (e.g.
  pressing a Button) propagates values through wires to tools and output nodes, mirroring
  source/values semantics in JS
- **Persistence**: canvas state (nodes + wires) is saved to localStorage on change and restored on
  load (src/persist.ts); the graph model stays a serializable structure so a future Python backend
  is easy to add