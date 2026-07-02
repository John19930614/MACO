import type { ReactNode } from "react";

/**
 * A single navigation entry.
 *
 * This is the generic, framework-free shape used by {@link getActiveKey}. It is
 * intentionally decoupled from the richer internal nav-item shape used inside
 * `LeftNav` (which carries description/badge/emoji fields) so the matching logic
 * can be unit-tested in a plain Node environment with no React or Next.js
 * runtime. `LeftNav` maps its own items onto this shape (using `href` as the
 * key) and re-exports both symbols so callers may import from either module.
 */
export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon?: ReactNode;
  children?: NavItem[];
}

/**
 * Pure helper — no React/Next.js dependency, so it can be unit-tested in Node.
 *
 * Returns the `key` of the nav item whose href best matches `pathname`.
 * Rules:
 *  1. Exact match wins.
 *  2. Otherwise, the item whose href is the longest prefix of pathname wins.
 *  3. Root '/' is only matched when pathname === '/' (avoids matching everything).
 *  4. Returns null when no item matches.
 */
export function getActiveKey(
  pathname: string,
  items: NavItem[]
): string | null {
  // Flatten nested items into a single list for matching.
  const flat: NavItem[] = [];
  const collect = (list: NavItem[]) => {
    for (const item of list) {
      flat.push(item);
      if (item.children) collect(item.children);
    }
  };
  collect(items);

  // Exact match first.
  const exact = flat.find((item) => item.href === pathname);
  if (exact) return exact.key;

  // Longest-prefix match (exclude root '/' from prefix matching).
  let best: NavItem | null = null;
  let bestLen = 0;
  for (const item of flat) {
    if (item.href === "/") continue; // root only matches exactly
    if (pathname.startsWith(item.href) && item.href.length > bestLen) {
      best = item;
      bestLen = item.href.length;
    }
  }
  return best ? best.key : null;
}
