import { GPIO_PINS } from './catalog';
import type { ParamValue } from './types';

/**
 * BCM vs BOARD pin numbering. Pins are stored as BCM ints everywhere
 * (params, wire format, pin assignment); BOARD is purely how they're
 * shown and how generated code spells them — gpiozero accepts physical
 * header numbers as 'BOARDn' strings, e.g. LED('BOARD11') for GPIO17.
 */
export type PinNumbering = 'bcm' | 'board';

/** physical pin -> BCM for the 40-pin J8 header (matches gpiozero's pin spec) */
const BOARD_TO_BCM: Record<number, number> = {
  3: 2, 5: 3, 7: 4, 8: 14, 10: 15, 11: 17, 12: 18, 13: 27, 15: 22,
  16: 23, 18: 24, 19: 10, 21: 9, 22: 25, 23: 11, 24: 8, 26: 7, 27: 0,
  28: 1, 29: 5, 31: 6, 32: 12, 33: 13, 35: 19, 36: 16, 37: 26, 38: 20,
  40: 21,
};

const BCM_TO_BOARD: Record<number, number> = Object.fromEntries(
  Object.entries(BOARD_TO_BCM).map(([board, bcm]) => [bcm, Number(board)]),
);

/** A BCM pin as shown in the UI: '17' or 'BOARD11' */
export function pinDisplay(bcm: ParamValue, numbering: PinNumbering): string {
  return numbering === 'board' ? `BOARD${BCM_TO_BOARD[Number(bcm)]}` : String(bcm);
}

/** A BCM pin as a Python literal: 17 or 'BOARD11' */
export function pyPin(bcm: ParamValue, numbering: PinNumbering): string {
  return numbering === 'board' ? `'BOARD${BCM_TO_BOARD[Number(bcm)]}'` : String(bcm);
}

/** Dropdown order (as BCM values): BCM ascending, or by header position */
export function pinOptions(numbering: PinNumbering): number[] {
  if (numbering === 'bcm') return GPIO_PINS;
  return [...GPIO_PINS].sort((a, b) => BCM_TO_BOARD[a] - BCM_TO_BOARD[b]);
}
