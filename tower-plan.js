/* ==========================================================================
   MHMRWS — Tower & flat plan
   ==========================================================================
   The real layout of Max Heights Majestic.

   Flat numbers are the floor number followed by a two-digit flat number,
   counting the ground floor as zero — so the ground floor is 001..006, the
   first floor 101..106, and the top floor of a G+13 tower is 1301..1306.

   `floors` is the number of floors ABOVE ground, so 13 means levels 0
   through 13 inclusive (14 levels), matching the project's "G+13".

   THIS FILE DELIBERATELY IMPORTS NOTHING. The registration form reads its
   tower and flat dropdowns from here, so those always render correctly even
   if the Firebase SDK or a CDN fails to load. If a tower is ever added or
   re-numbered, change it HERE only — the resident form, the admin panel and
   the validators all read from this one place.
   ========================================================================== */

export const TOWER_PLAN = {
  A: { flatsPerFloor: 6, floors: 13 },
  B: { flatsPerFloor: 6, floors: 13 },
  C: { flatsPerFloor: 4, floors: 13 },
  D: { flatsPerFloor: 4, floors: 13 },
  E: { flatsPerFloor: 5, floors: 13 },
  F: { flatsPerFloor: 4, floors: 13 },
  G: { flatsPerFloor: 4, floors: 11 }
};

export const TOWER_IDS = Object.keys(TOWER_PLAN);

/** Human label for a floor index: 0 -> "Ground Floor", 1 -> "1st Floor". */
export function floorLabel(n) {
  if (n === 0) return 'Ground Floor';
  const suffix = (n % 10 === 1 && n !== 11) ? 'st'
               : (n % 10 === 2 && n !== 12) ? 'nd'
               : (n % 10 === 3 && n !== 13) ? 'rd' : 'th';
  return `${n}${suffix} Floor`;
}

/**
 * Every flat in a tower, grouped by floor.
 * @returns {{floor:number,label:string,flats:string[]}[]}
 */
export function flatsForTower(tower) {
  const plan = TOWER_PLAN[tower];
  if (!plan) return [];
  const out = [];
  for (let floor = 0; floor <= plan.floors; floor++) {
    const flats = [];
    for (let i = 1; i <= plan.flatsPerFloor; i++) {
      flats.push(`${floor}${String(i).padStart(2, '0')}`);
    }
    out.push({ floor, label: floorLabel(floor), flats });
  }
  return out;
}

/** True only if flatNumber is a real flat in that tower. */
export function isValidFlat(tower, flatNumber) {
  return flatsForTower(tower).some(g => g.flats.includes(String(flatNumber)));
}

/** Total number of flats in the society (currently 454). */
export function totalFlats() {
  return TOWER_IDS.reduce((sum, t) => {
    const p = TOWER_PLAN[t];
    return sum + p.flatsPerFloor * (p.floors + 1);
  }, 0);
}
