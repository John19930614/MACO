// Pure H-statement → NfpaRating deriver for a single container (chemical).
//
// SafetyIQ's chemical_inventory carries no professionally-assigned NFPA columns,
// so — consistent with the existing GHS-derived diamond in @/lib/lab-risk —
// we approximate the 0-4 ratings from the GHS H-statements the app already
// stores. This module is intentionally SELF-CONTAINED (its own H-code tables, no
// import from the lab-risk deriver) so the nfpa704 feature can be committed and
// shipped independently.
//
// CRITICAL SAFETY RULE: a chemical with NO hazard data at all yields nulls
// ("Rating not yet entered"), NEVER 0. A 0 tells an emergency responder
// "no hazard"; a missing rating means "unknown" — the two must never collapse.
// When a chemical DOES carry H-statements but none map to a given category, that
// category is a legitimate 0 (a real "no hazard in this category" reading).

import type { NfpaRating, NfpaSpecialHazard } from './types';

const norm = (raw: string) =>
  raw.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase();

// Health (blue) — acute + chronic toxicity, corrosivity.
const HEALTH: Record<number, string[]> = {
  4: ['H300', 'H310', 'H330', 'H370'],
  3: ['H301', 'H311', 'H331', 'H314', 'H318', 'H340', 'H350', 'H360', 'H371'],
  2: ['H302', 'H312', 'H332', 'H315', 'H319', 'H335', 'H351', 'H361', 'H373', 'H304', 'H334', 'H317', 'H341', 'H372'],
  1: ['H303', 'H313', 'H333', 'H316', 'H320', 'H336'],
};

// Flammability (red).
const FLAMMABILITY: Record<number, string[]> = {
  4: ['H220', 'H222', 'H224', 'H250'],
  3: ['H221', 'H223', 'H225', 'H228', 'H241', 'H251', 'H252', 'H260', 'H261'],
  2: ['H226', 'H242'],
  1: ['H227', 'H229'],
};

// Instability / reactivity (yellow).
const INSTABILITY: Record<number, string[]> = {
  4: ['H200', 'H201', 'H240', 'H271'],
  3: ['H202', 'H203', 'H241'],
  2: ['H204', 'H205', 'H270', 'H272', 'H290'],
  1: ['H280', 'H281'],
};

// Special hazards (white). Only OX / W are reliably derivable from GHS H-codes
// today; COR is inferred from the skin-corrosion / serious-eye-damage codes.
// SA / BIO / ACID / ALK / RAD have no H-code source yet — they remain available
// in the type for manual/future entry, and the roll-up unions them correctly.
const OXIDIZER = new Set(['H270', 'H271', 'H272']);
const WATER_REACTIVE = new Set(['H260', 'H261']);
const CORROSIVE = new Set(['H314', 'H318']);

function ratingFor(codes: Set<string>, table: Record<number, string[]>): number {
  for (const level of [4, 3, 2, 1]) {
    if (table[level].some((c) => codes.has(c))) return level;
  }
  return 0;
}

/**
 * Derive an NfpaRating for one container from its GHS H-statement codes.
 * Returns an all-null ("not yet entered") rating when there is no hazard data.
 */
export function deriveRatingFromHCodes(hCodes: string[]): NfpaRating {
  const codes = new Set(hCodes.map(norm).filter(Boolean));

  // No hazard data at all → explicitly "not entered", never 0/no-hazard.
  if (codes.size === 0) {
    return {
      health: null,
      flammability: null,
      instability: null,
      specialHazards: [],
      isComplete: false,
    };
  }

  const specialHazards: NfpaSpecialHazard[] = [];
  if ([...codes].some((c) => OXIDIZER.has(c))) specialHazards.push('OX');
  if ([...codes].some((c) => WATER_REACTIVE.has(c))) specialHazards.push('W');
  if ([...codes].some((c) => CORROSIVE.has(c))) specialHazards.push('COR');

  return {
    health: ratingFor(codes, HEALTH),
    flammability: ratingFor(codes, FLAMMABILITY),
    instability: ratingFor(codes, INSTABILITY),
    specialHazards,
    isComplete: true,
  };
}
