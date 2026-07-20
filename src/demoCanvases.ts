import type { SavedCanvas } from './persist';

/**
 * Built-in starter canvases, seeded once into every user's own canvas
 * store on first load (see readStore in persist.ts) — after that
 * they're indistinguishable from a canvas the user made themselves:
 * editable, renameable, deletable, and never re-added once seeded.
 */
export const DEMO_CANVASES: Record<string, SavedCanvas> = {
  led_button: {
    nodes: [
      {
        id: 'led-1',
        position: { x: 632, y: 208 },
        data: {
          kind: 'led',
          name: 'led',
          params: { pin: 4, active_high: true, initial_value: false, source_delay: 0.01 },
          state: {},
        },
      },
      {
        id: 'button-2',
        position: { x: 279, y: 204 },
        data: {
          kind: 'button',
          name: 'button',
          params: { pin: 5, pull_up: true },
          state: { pressed: false },
        },
      },
    ],
    edges: [{ id: 'xy-edge__button-2out-led-1in', source: 'button-2', target: 'led-1' }],
  },

  pot_led: {
    nodes: [
      {
        id: 'mcp3008-1',
        position: { x: 235, y: 321 },
        data: {
          kind: 'mcp3008',
          name: 'pot',
          params: { channel: 0, differential: false },
          state: { level: 0.76 },
        },
      },
      {
        id: 'pwmled-2',
        position: { x: 615, y: 330 },
        data: {
          kind: 'pwmled',
          name: 'pwmled',
          params: {
            pin: 4,
            active_high: true,
            initial_value: 0,
            frequency: 100,
            source_delay: 0.01,
          },
          state: {},
        },
      },
    ],
    edges: [{ id: 'xy-edge__mcp3008-1out-pwmled-2in', source: 'mcp3008-1', target: 'pwmled-2' }],
  },

  garden_light: {
    nodes: [
      {
        id: 'lightsensor-1',
        position: { x: 233, y: 239 },
        data: { kind: 'lightsensor', name: 'light_sensor', params: { pin: 4 }, state: { level: 0.5 } },
      },
      {
        id: 'motionsensor-2',
        position: { x: 237, y: 398 },
        data: {
          kind: 'motionsensor',
          name: 'motion_sensor',
          params: { pin: 5 },
          state: { motion: false },
        },
      },
      {
        id: 'led-3',
        position: { x: 740, y: 287 },
        data: {
          kind: 'led',
          name: 'garden_light',
          params: { pin: 6, active_high: true, initial_value: false, source_delay: 0.01 },
          state: {},
        },
      },
      {
        id: 'all_values-4',
        position: { x: 504, y: 291 },
        data: { kind: 'all_values', params: {}, state: {} },
      },
    ],
    edges: [
      { id: 'xy-edge__lightsensor-1out-all_values-4in', source: 'lightsensor-1', target: 'all_values-4' },
      { id: 'xy-edge__motionsensor-2out-all_values-4in', source: 'motionsensor-2', target: 'all_values-4' },
      { id: 'xy-edge__all_values-4out-led-3in', source: 'all_values-4', target: 'led-3' },
    ],
  },

  rgb_led: {
    nodes: [
      {
        id: 'rgbled-8',
        position: { x: 735, y: 425 },
        data: {
          kind: 'rgbled',
          name: 'rgbled',
          params: { red: 4, green: 5, blue: 6, active_high: true, pwm: true, source_delay: 0.01 },
          state: {},
        },
      },
      {
        id: 'mcp3008-9',
        position: { x: 107, y: 282 },
        data: {
          kind: 'mcp3008',
          name: 'mcp3008_0',
          params: { channel: 0, differential: false },
          state: { level: 1 },
        },
      },
      {
        id: 'mcp3008-10',
        position: { x: 109, y: 415 },
        data: {
          kind: 'mcp3008',
          name: 'mcp3008_1',
          params: { channel: 1, differential: false },
          state: { level: 0 },
        },
      },
      {
        id: 'mcp3008-11',
        position: { x: 110, y: 551 },
        data: {
          kind: 'mcp3008',
          name: 'mcp3008_2',
          params: { channel: 2, differential: false },
          state: { level: 1 },
        },
      },
      {
        id: 'zip_values-12',
        position: { x: 413, y: 435 },
        data: { kind: 'zip_values', params: {}, state: {} },
      },
    ],
    edges: [
      { id: 'xy-edge__mcp3008-9out-zip_values-12in', source: 'mcp3008-9', target: 'zip_values-12' },
      { id: 'xy-edge__mcp3008-10out-zip_values-12in', source: 'mcp3008-10', target: 'zip_values-12' },
      { id: 'xy-edge__mcp3008-11out-zip_values-12in', source: 'mcp3008-11', target: 'zip_values-12' },
      { id: 'xy-edge__zip_values-12out-rgbled-8in', source: 'zip_values-12', target: 'rgbled-8' },
    ],
  },

  rotary_robot: {
    nodes: [
      {
        id: 'robot-1',
        position: { x: 784, y: 357 },
        data: {
          kind: 'robot',
          name: 'robot',
          params: {
            left_forward: 4,
            left_backward: 5,
            right_forward: 6,
            right_backward: 7,
            source_delay: 0.01,
          },
          state: {},
        },
      },
      {
        id: 'rotaryencoder-2',
        position: { x: 160, y: 286 },
        data: {
          kind: 'rotaryencoder',
          name: 'rotaryencoder_left',
          params: { a: 8, b: 9, max_steps: 16, wrap: false },
          state: { steps: -4 },
        },
      },
      {
        id: 'rotaryencoder-4',
        position: { x: 155, y: 432 },
        data: {
          kind: 'rotaryencoder',
          name: 'rotaryencoder_right',
          params: { a: 10, b: 11, max_steps: 16, wrap: false },
          state: { steps: 16 },
        },
      },
      {
        id: 'zip_values-5',
        position: { x: 461, y: 364 },
        data: { kind: 'zip_values', params: {}, state: {} },
      },
    ],
    edges: [
      { id: 'xy-edge__rotaryencoder-2out-zip_values-5in', source: 'rotaryencoder-2', target: 'zip_values-5' },
      { id: 'xy-edge__rotaryencoder-4out-zip_values-5in', source: 'rotaryencoder-4', target: 'zip_values-5' },
      { id: 'xy-edge__zip_values-5out-robot-1in', source: 'zip_values-5', target: 'robot-1' },
    ],
  },

  internal_devices: {
    nodes: [
      {
        id: 'energenie-1',
        position: { x: 784, y: 199.125 },
        data: {
          kind: 'energenie',
          name: 'lamp',
          params: { socket: 1, initial_value: false, source_delay: 0.01 },
          state: {},
        },
      },
      {
        id: 'timeofday-2',
        position: { x: 288, y: 157.125 },
        data: {
          kind: 'timeofday',
          name: 'daytime',
          params: { start_time: '09:00', end_time: '17:00', utc: false },
          state: {},
        },
      },
      {
        id: 'cputemperature-3',
        position: { x: 283, y: 411.125 },
        data: {
          kind: 'cputemperature',
          name: 'cputemperature',
          params: { min_temp: 50, max_temp: 90 },
          state: { level: 71 },
        },
      },
      {
        id: 'all_values-4',
        position: { x: 554, y: 205.125 },
        data: { kind: 'all_values', params: {}, state: {} },
      },
      {
        id: 'ledbargraph-5',
        position: { x: 788, y: 428.125 },
        data: {
          kind: 'ledbargraph',
          name: 'ledbargraph',
          params: {
            leds: 10,
            pwm: true,
            initial_value: 0,
            source_delay: 0.01,
            pin1: 4,
            pin2: 5,
            pin3: 6,
            pin4: 7,
            pin5: 8,
            pin6: 9,
            pin7: 10,
            pin8: 11,
            pin9: 12,
            pin10: 13,
          },
          state: {},
        },
      },
      {
        id: 'clamped-6',
        position: { x: 552, y: 429.125 },
        data: { kind: 'clamped', params: { output_min: 0, output_max: 1 }, state: {} },
      },
    ],
    edges: [
      { id: 'xy-edge__all_values-4out-energenie-1in', source: 'all_values-4', target: 'energenie-1' },
      { id: 'xy-edge__timeofday-2out-all_values-4in', source: 'timeofday-2', target: 'all_values-4' },
      { id: 'xy-edge__cputemperature-3out-clamped-6in', source: 'cputemperature-3', target: 'clamped-6' },
      { id: 'xy-edge__clamped-6out-ledbargraph-5in', source: 'clamped-6', target: 'ledbargraph-5' },
    ],
  },

  buttonboard_ledboard: {
    nodes: [
      {
        id: 'buttonboard-1',
        position: { x: 183, y: 346 },
        data: {
          kind: 'buttonboard',
          name: 'buttonboard',
          params: { buttons: 5, pull_up: true, pin1: 4, pin2: 5, pin3: 6, pin4: 7, pin5: 13 },
          state: { pressed3: false, pressed2: true, pressed4: true },
        },
      },
      {
        id: 'ledboard-2',
        position: { x: 723, y: 331 },
        data: {
          kind: 'ledboard',
          name: 'ledboard',
          params: {
            leds: 5,
            pwm: false,
            active_high: true,
            initial_value: false,
            source_delay: 0.01,
            pin1: 8,
            pin2: 9,
            pin3: 10,
            pin4: 11,
            pin5: 12,
          },
          state: {},
        },
      },
      {
        id: 'ledbargraph-4',
        position: { x: 747, y: 779 },
        data: {
          kind: 'ledbargraph',
          name: 'ledbargraph',
          params: {
            leds: 5,
            pwm: false,
            initial_value: 0,
            source_delay: 0.01,
            pin1: 19,
            pin2: 20,
            pin3: 21,
            pin4: 22,
            pin5: 23,
          },
          state: {},
        },
      },
      {
        id: 'averaged-10',
        position: { x: 442, y: 798 },
        data: { kind: 'averaged', params: {}, state: {} },
      },
      {
        id: 'button-11',
        position: { x: 130, y: 552 },
        data: {
          kind: 'button',
          name: 'button',
          params: { pin: 14, pull_up: true },
          state: { pressed: true },
        },
      },
      {
        id: 'button-12',
        position: { x: 129, y: 676 },
        data: {
          kind: 'button',
          name: 'button_2',
          params: { pin: 15, pull_up: true },
          state: { pressed: false },
        },
      },
      {
        id: 'button-13',
        position: { x: 127, y: 799 },
        data: {
          kind: 'button',
          name: 'button_3',
          params: { pin: 16, pull_up: true },
          state: { pressed: true },
        },
      },
      {
        id: 'button-14',
        position: { x: 130, y: 918 },
        data: {
          kind: 'button',
          name: 'button_4',
          params: { pin: 17, pull_up: true },
          state: { pressed: false },
        },
      },
      {
        id: 'button-15',
        position: { x: 128, y: 1040 },
        data: {
          kind: 'button',
          name: 'button_5',
          params: { pin: 18, pull_up: true },
          state: { pressed: true },
        },
      },
    ],
    edges: [
      { id: 'xy-edge__buttonboard-1out-ledboard-2in', source: 'buttonboard-1', target: 'ledboard-2' },
      { id: 'xy-edge__averaged-10out-ledbargraph-4in', source: 'averaged-10', target: 'ledbargraph-4' },
      { id: 'xy-edge__button-11out-averaged-10in', source: 'button-11', target: 'averaged-10' },
      { id: 'xy-edge__button-12out-averaged-10in', source: 'button-12', target: 'averaged-10' },
      { id: 'xy-edge__button-13out-averaged-10in', source: 'button-13', target: 'averaged-10' },
      { id: 'xy-edge__button-14out-averaged-10in', source: 'button-14', target: 'averaged-10' },
      { id: 'xy-edge__button-15out-averaged-10in', source: 'button-15', target: 'averaged-10' },
    ],
  },

  artificial_sources: {
    nodes: [
      {
        id: 'sin_values-1',
        position: { x: 178, y: 414 },
        data: { kind: 'sin_values', params: { period: 36 }, state: {} },
      },
      {
        id: 'cos_values-2',
        position: { x: 185, y: 559 },
        data: { kind: 'cos_values', params: { period: 36 }, state: {} },
      },
      {
        id: 'ramping_values-4',
        position: { x: 183, y: 829 },
        data: { kind: 'ramping_values', params: { period: 36 }, state: {} },
      },
      {
        id: 'alternating_values-5',
        position: { x: 171, y: 298.125 },
        data: { kind: 'alternating_values', params: { initial_value: false }, state: {} },
      },
      {
        id: 'ledbargraph-6',
        position: { x: 658, y: 816.125 },
        data: {
          kind: 'ledbargraph',
          name: 'ledbargraph',
          params: {
            leds: 5,
            pwm: true,
            initial_value: 0,
            source_delay: 0.01,
            pin1: 4,
            pin2: 5,
            pin3: 6,
            pin4: 7,
            pin5: 8,
          },
          state: {},
        },
      },
      {
        id: 'servo-7',
        position: { x: 616, y: 405.125 },
        data: {
          kind: 'servo',
          name: 'servo',
          params: { pin: 9, initial_value: 0, source_delay: 0.01 },
          state: {},
        },
      },
      {
        id: 'motor-8',
        position: { x: 610, y: 536.125 },
        data: {
          kind: 'motor',
          name: 'motor',
          params: { forward: 10, backward: 11, source_delay: 0.01 },
          state: {},
        },
      },
      {
        id: 'tonalbuzzer-9',
        position: { x: 662, y: 947.125 },
        data: {
          kind: 'tonalbuzzer',
          name: 'tonalbuzzer',
          params: { pin: 12, octaves: 1, source_delay: 0.01 },
          state: {},
        },
      },
      {
        id: 'sin_values-10',
        position: { x: 195, y: 956 },
        data: { kind: 'sin_values', params: { period: 36 }, state: {} },
      },
      {
        id: 'random_values-15',
        position: { x: 177, y: 698.125 },
        data: { kind: 'random_values', params: {}, state: {} },
      },
      {
        id: 'led-16',
        position: { x: 614, y: 276.125 },
        data: {
          kind: 'led',
          name: 'led',
          params: { pin: 13, active_high: true, initial_value: false, source_delay: 0.5 },
          state: {},
        },
      },
      {
        id: 'pwmled-17',
        position: { x: 624, y: 678.125 },
        data: {
          kind: 'pwmled',
          name: 'pwmled',
          params: {
            pin: 14,
            active_high: true,
            initial_value: 0,
            frequency: 100,
            source_delay: 0.01,
          },
          state: {},
        },
      },
    ],
    edges: [
      { id: 'xy-edge__ramping_values-4out-ledbargraph-6in', source: 'ramping_values-4', target: 'ledbargraph-6' },
      { id: 'xy-edge__sin_values-1out-servo-7in', source: 'sin_values-1', target: 'servo-7' },
      { id: 'xy-edge__cos_values-2out-motor-8in', source: 'cos_values-2', target: 'motor-8' },
      { id: 'xy-edge__sin_values-10out-tonalbuzzer-9in', source: 'sin_values-10', target: 'tonalbuzzer-9' },
      { id: 'xy-edge__alternating_values-5out-led-16in', source: 'alternating_values-5', target: 'led-16' },
      { id: 'xy-edge__random_values-15out-pwmled-17in', source: 'random_values-15', target: 'pwmled-17' },
    ],
  },
};
