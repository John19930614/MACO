// Standard atomic weights (IUPAC, g/mol) for the common elements found in lab
// chemical inventories. Used to compute molecular weight from a formula string
// when it isn't stored on the record. Returns null if the formula can't be
// parsed (unknown element, nested groups, etc.) so the label shows "—".

const ATOMIC: Record<string, number> = {
  H: 1.008, He: 4.0026, Li: 6.94, Be: 9.0122, B: 10.81, C: 12.011, N: 14.007, O: 15.999,
  F: 18.998, Ne: 20.18, Na: 22.99, Mg: 24.305, Al: 26.982, Si: 28.085, P: 30.974, S: 32.06,
  Cl: 35.45, Ar: 39.948, K: 39.098, Ca: 40.078, Sc: 44.956, Ti: 47.867, V: 50.942, Cr: 51.996,
  Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38, Ga: 69.723, Ge: 72.63,
  As: 74.922, Se: 78.971, Br: 79.904, Kr: 83.798, Rb: 85.468, Sr: 87.62, Y: 88.906, Zr: 91.224,
  Nb: 92.906, Mo: 95.95, Ag: 107.868, Cd: 112.414, In: 114.818, Sn: 118.71, Sb: 121.76,
  Te: 127.6, I: 126.904, Xe: 131.293, Cs: 132.905, Ba: 137.327, Pt: 195.084, Au: 196.967,
  Hg: 200.592, Tl: 204.38, Pb: 207.2, Bi: 208.98, W: 183.84, Pd: 106.42, Li7: 7,
};

// Unicode subscript digits (₀–₉) → ASCII, so formulas like "CH₂O" parse.
const SUBS: Record<string, string> = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9" };

export function computeMolecularWeight(formula: string | null | undefined): number | null {
  if (!formula) return null;
  let f = formula.replace(/[₀-₉]/g, (d) => SUBS[d] ?? d).replace(/\s/g, "");
  if (!f || /[^A-Za-z0-9().·]/.test(f)) {
    // strip hydrate dots / mid-dots but reject anything else unusual
    f = f.replace(/[·]/g, "");
    if (/[^A-Za-z0-9()]/.test(f)) return null;
  }

  // Expand one level of parentheses, e.g. Ca(OH)2 → CaO2H2
  f = f.replace(/\(([^()]*)\)(\d*)/g, (_m, grp: string, n: string) => {
    const mult = n ? parseInt(n, 10) : 1;
    return grp.replace(/([A-Z][a-z]?)(\d*)/g, (_x, el: string, c: string) => el + String((c ? parseInt(c, 10) : 1) * mult));
  });
  if (/[()]/.test(f)) return null; // nested groups unsupported → fall back to "—"

  let total = 0;
  let matched = false;
  const re = /([A-Z][a-z]?)(\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(f)) !== null) {
    if (!m[0]) break;
    const w = ATOMIC[m[1]];
    if (w == null) return null;
    total += w * (m[2] ? parseInt(m[2], 10) : 1);
    matched = true;
  }
  if (!matched || total <= 0) return null;
  return Math.round(total * 100) / 100;
}
