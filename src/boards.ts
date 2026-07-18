import type { NodeKind, ParamValue } from './types';

/**
 * Add-on boards as expansion recipes: dropping a board creates its
 * constituent catalog devices on the correct (fixed) pins, rather than
 * a single composite node — TrafficHat becomes a TrafficLights, a
 * Button and a Buzzer, each wirable with plain source/values semantics.
 *
 * Pins are BCM numbers, converted from the BOARDn spellings in
 * gpiozero's boards.py. Component names follow the board's attribute
 * names (traffic_hat.lights -> "lights") where it has them.
 *
 * Not included: PiStop (needs a location argument choosing its pins),
 * and the boards with more LEDs than the LEDBoard node supports
 * (PiHutXmasTree: 25, PumpkinPi: 12).
 */

export interface BoardComponent {
  kind: NodeKind;
  /** preferred device name; deduped against the canvas on drop */
  name: string;
  /** param overrides: fixed pins, pull_up, led counts, ... */
  params: Record<string, ParamValue>;
  /** canvas position relative to the drop point */
  offset: { x: number; y: number };
}

export interface BoardSpec {
  id: string;
  label: string;
  description: string;
  components: BoardComponent[];
}

const COL = 250;

export const BOARDS: Record<string, BoardSpec> = {
  traffichat: {
    id: 'traffichat',
    label: 'Traffic HAT',
    description: 'Ryanteck: traffic lights, button and buzzer',
    components: [
      { kind: 'trafficlights', name: 'lights', params: { red: 24, amber: 23, green: 22 }, offset: { x: 0, y: 0 } },
      { kind: 'button', name: 'button', params: { pin: 25 }, offset: { x: COL, y: 0 } },
      { kind: 'buzzer', name: 'buzzer', params: { pin: 5 }, offset: { x: COL, y: 150 } },
    ],
  },
  trafficphat: {
    id: 'trafficphat',
    label: 'Traffic pHAT',
    description: 'Ryanteck: traffic lights on a pHAT',
    components: [
      { kind: 'trafficlights', name: 'lights', params: { red: 25, amber: 24, green: 23 }, offset: { x: 0, y: 0 } },
    ],
  },
  pitraffic: {
    id: 'pitraffic',
    label: 'Pi-Traffic',
    description: 'Low Voltage Labs: traffic lights',
    components: [
      { kind: 'trafficlights', name: 'lights', params: { red: 9, amber: 10, green: 11 }, offset: { x: 0, y: 0 } },
    ],
  },
  fishdish: {
    id: 'fishdish',
    label: 'Fish Dish',
    description: 'Pi Supply: traffic lights, button and buzzer',
    components: [
      { kind: 'trafficlights', name: 'lights', params: { red: 9, amber: 22, green: 4 }, offset: { x: 0, y: 0 } },
      { kind: 'button', name: 'button', params: { pin: 7, pull_up: false }, offset: { x: COL, y: 0 } },
      { kind: 'buzzer', name: 'buzzer', params: { pin: 8 }, offset: { x: COL, y: 150 } },
    ],
  },
  jamhat: {
    id: 'jamhat',
    label: 'JAM HAT',
    description: 'ModMyPi: two rows of red/yellow/green LEDs, two buttons and a buzzer',
    components: [
      { kind: 'trafficlights', name: 'lights_1', params: { red: 5, amber: 12, green: 16 }, offset: { x: 0, y: 0 } },
      { kind: 'trafficlights', name: 'lights_2', params: { red: 6, amber: 13, green: 17 }, offset: { x: 0, y: 200 } },
      { kind: 'button', name: 'button_1', params: { pin: 19, pull_up: false }, offset: { x: COL, y: 0 } },
      { kind: 'button', name: 'button_2', params: { pin: 18, pull_up: false }, offset: { x: COL, y: 130 } },
      { kind: 'tonalbuzzer', name: 'buzzer', params: { pin: 20 }, offset: { x: COL, y: 260 } },
    ],
  },
  pibrella: {
    id: 'pibrella',
    label: 'Pibrella',
    description: 'Cyntech/Pimoroni: lights, button and buzzer (IO ports not included)',
    components: [
      { kind: 'trafficlights', name: 'lights', params: { red: 27, amber: 17, green: 4 }, offset: { x: 0, y: 0 } },
      { kind: 'button', name: 'button', params: { pin: 11, pull_up: false }, offset: { x: COL, y: 0 } },
      { kind: 'tonalbuzzer', name: 'buzzer', params: { pin: 18 }, offset: { x: COL, y: 150 } },
    ],
  },
  ledborg: {
    id: 'ledborg',
    label: 'LedBorg',
    description: 'PiBorg: a single RGB LED',
    components: [
      { kind: 'rgbled', name: 'ledborg', params: { red: 17, green: 27, blue: 22 }, offset: { x: 0, y: 0 } },
    ],
  },
  piliter: {
    id: 'piliter',
    label: 'Pi-LITEr',
    description: 'Ciseco: strip of 8 LEDs',
    components: [
      {
        kind: 'ledboard',
        name: 'piliter',
        params: { leds: 8, pin1: 4, pin2: 17, pin3: 27, pin4: 18, pin5: 22, pin6: 23, pin7: 24, pin8: 25 },
        offset: { x: 0, y: 0 },
      },
    ],
  },
  piliterbargraph: {
    id: 'piliterbargraph',
    label: 'Pi-LITEr (bar graph)',
    description: 'Ciseco Pi-LITEr as an 8-LED bar graph',
    components: [
      {
        kind: 'ledbargraph',
        name: 'piliter',
        params: { leds: 8, pin1: 4, pin2: 17, pin3: 27, pin4: 18, pin5: 22, pin6: 23, pin7: 24, pin8: 25 },
        offset: { x: 0, y: 0 },
      },
    ],
  },
  snowpi: {
    id: 'snowpi',
    label: 'SnowPi',
    description: 'Ryanteck: snowman with 9 LEDs (eyes, nose, arms)',
    components: [
      {
        // in gpiozero's order: eyes (left, right), nose, arms (left
        // top/middle/bottom, right top/middle/bottom)
        kind: 'ledboard',
        name: 'snowpi',
        params: { leds: 9, pin1: 23, pin2: 24, pin3: 25, pin4: 17, pin5: 18, pin6: 22, pin7: 7, pin8: 8, pin9: 9 },
        offset: { x: 0, y: 0 },
      },
    ],
  },
  statuszero: {
    id: 'statuszero',
    label: 'STATUS Zero',
    description: 'The Pi Hut: three red/green LED pairs',
    components: [
      { kind: 'ledboard', name: 'status1', params: { leds: 2, pin1: 4, pin2: 17 }, offset: { x: 0, y: 0 } },
      { kind: 'ledboard', name: 'status2', params: { leds: 2, pin1: 27, pin2: 22 }, offset: { x: 0, y: 170 } },
      { kind: 'ledboard', name: 'status3', params: { leds: 2, pin1: 10, pin2: 9 }, offset: { x: 0, y: 340 } },
    ],
  },
  ryanteckrobot: {
    id: 'ryanteckrobot',
    label: 'Ryanteck MCB Robot',
    description: 'Ryanteck motor controller board as a Robot',
    components: [
      {
        kind: 'robot',
        name: 'robot',
        params: { left_forward: 17, left_backward: 18, right_forward: 22, right_backward: 23 },
        offset: { x: 0, y: 0 },
      },
    ],
  },
  camjamkitrobot: {
    id: 'camjamkitrobot',
    label: 'CamJam #3 Robot',
    description: 'CamJam EduKit 3 motor controller as a Robot',
    components: [
      {
        kind: 'robot',
        name: 'robot',
        params: { left_forward: 9, left_backward: 10, right_forward: 7, right_backward: 8 },
        offset: { x: 0, y: 0 },
      },
    ],
  },
  pololudrv8835: {
    id: 'pololudrv8835',
    label: 'Pololu DRV8835',
    description: 'Pololu DRV8835 kit: two phase/enable motors',
    components: [
      { kind: 'phaseenablemotor', name: 'motor_left', params: { phase: 5, enable: 12 }, offset: { x: 0, y: 0 } },
      { kind: 'phaseenablemotor', name: 'motor_right', params: { phase: 6, enable: 13 }, offset: { x: 0, y: 160 } },
    ],
  },
};

export const BOARD_LIST: BoardSpec[] = Object.values(BOARDS);
