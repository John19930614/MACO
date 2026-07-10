import Link from "next/link";

// One in-module tab bar shared by every Waste Management page. Each page passes
// its own `active` key (no client hooks needed), and the strip links out to the
// existing routes — nothing about those pages or their data flow changes. This
// is what makes the four waste areas read as a single module.
export type WasteTabKey = "streams" | "universal_waste" | "nonhaz_recycling" | "compliance";

const TABS: { key: WasteTabKey; label: string; href: string }[] = [
  { key: "streams", label: "Waste Streams", href: "/waste" },
  { key: "universal_waste", label: "Universal Waste", href: "/waste/universal-waste-recycling?tab=universal_waste" },
  { key: "nonhaz_recycling", label: "Recycling", href: "/waste/universal-waste-recycling?tab=nonhaz_recycling" },
  { key: "compliance", label: "Compliance", href: "/waste/compliance" },
];

export function WasteModuleTabs({ active }: { active: WasteTabKey }) {
  return (
    <div className="border-b border-slate-200 px-6 dark:border-slate-700">
      <nav aria-label="Waste Management sections">
        <ul className="flex flex-wrap gap-1">
          {TABS.map((t) => {
            const isActive = t.key === active;
            return (
              <li key={t.key}>
                <Link
                  href={t.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`-mb-px inline-block border-b-2 px-3 py-2 text-sm font-medium ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
