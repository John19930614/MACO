// Waste-hierarchy roll-up. Rows in waste_hierarchy_record split waste across the
// full hierarchy (eliminate / substitute / reduce / reuse / recycle / treat /
// dispose). For reporting we group into three views that are ALWAYS shown
// separately so progress on true source reduction is never masked by recycling.

export interface HierarchyRow {
  eliminated_kg: number;
  substituted_kg: number;
  reduced_kg: number;
  reused_kg: number;
  recycled_kg: number;
  treated_kg: number;
  landfilled_kg: number;
}

export interface HierarchySplit {
  prevented: number; // eliminate + substitute + reduce (source reduction)
  recycled: number; // reuse + recycle + treat (diverted, but not prevented)
  landfilled: number; // dispose
  total: number;
}

const n = (v: number | null | undefined) => (typeof v === "number" && isFinite(v) ? v : 0);

export function summarizeHierarchy(rows: HierarchyRow[]): HierarchySplit {
  const split = rows.reduce<HierarchySplit>(
    (acc, r) => {
      acc.prevented += n(r.eliminated_kg) + n(r.substituted_kg) + n(r.reduced_kg);
      acc.recycled += n(r.reused_kg) + n(r.recycled_kg) + n(r.treated_kg);
      acc.landfilled += n(r.landfilled_kg);
      return acc;
    },
    { prevented: 0, recycled: 0, landfilled: 0, total: 0 },
  );
  split.total = split.prevented + split.recycled + split.landfilled;
  return split;
}
