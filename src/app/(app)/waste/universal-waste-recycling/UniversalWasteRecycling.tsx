"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createDetermination, createUniversalWasteItem, createNonhazRecyclingRecord,
  createRecyclingCertificate, markLoadRejected, resolveRejectedLoad,
} from "@/lib/actions/universal-waste-recycling-tracking";
import {
  getVendorStatusBadge, computeDiversionRate, diversionSubtitle,
  stoplightForDeadline, countdownLabel, exceedsQuantityLimit,
  type Stoplight, type VendorBadge,
} from "@/lib/waste/uw-helpers";
import type {
  Determination, UwItem, NonhazRecord, VendorLite, Certificate, RejectedLoad, UwCategory,
} from "./types";
import { ComboBox } from "@/components/ui/ComboBox";
import { COMMON_WASTE_MATERIALS, COMMON_RECYCLABLE_MATERIALS, COMMON_REJECT_REASONS, US_STATES } from "@/lib/waste/options";

type TabKey = "universal_waste" | "nonhaz_recycling";

const UW_CATEGORIES: { value: UwCategory; label: string }[] = [
  { value: "batteries", label: "Batteries" },
  { value: "lamps", label: "Lamps / bulbs" },
  { value: "mercury_equipment", label: "Mercury equipment" },
  { value: "aerosol_cans", label: "Aerosol cans" },
  { value: "pesticides", label: "Pesticides" },
  { value: "e_waste", label: "E-waste" },
  { value: "used_oil", label: "Used oil" },
  { value: "solvents", label: "Solvents" },
];
const CATEGORY_LABEL = Object.fromEntries(UW_CATEGORIES.map((c) => [c.value, c.label])) as Record<UwCategory, string>;

const STOPLIGHT_STYLE: Record<Stoplight, string> = {
  green: "bg-green-100 text-green-800 border-green-300",
  yellow: "bg-amber-100 text-amber-800 border-amber-300",
  red: "bg-red-100 text-red-800 border-red-300",
};
const VENDOR_STYLE: Record<VendorBadge, string> = {
  valid: "bg-green-100 text-green-800 border-green-300",
  expiring: "bg-amber-100 text-amber-800 border-amber-300",
  expired: "bg-red-100 text-red-800 border-red-300",
};
const VENDOR_LABEL: Record<VendorBadge, string> = {
  valid: "Valid",
  expiring: "Expiring soon",
  expired: "Expired",
};

interface Props {
  determinations: Determination[];
  uwItems: UwItem[];
  nonhazRecords: NonhazRecord[];
  vendors: VendorLite[];
  certificates: Certificate[];
  rejectedLoads: RejectedLoad[];
}

export function UniversalWasteRecycling({ initialTab = "universal_waste", ...props }: Props & { initialTab?: TabKey }) {
  // Which section to show is driven by the top Waste-module tab bar (?tab=…), so
  // there's no inner tab switcher here — that would duplicate the module tabs.
  const tab = initialTab;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Runs a server action, surfaces plain-English errors, refreshes on success.
  function run(action: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Something went wrong. Please try again.");
        return;
      }
      onOk?.();
      router.refresh();
    });
  }

  const approvedDeterminations = props.determinations.filter((d) => d.status === "approved");
  const hasDetermination = approvedDeterminations.length > 0;

  return (
    <div className="p-6 space-y-6">
      {error && (
        <div className="rounded-md border border-red-400 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      <DeterminationSection
        hasDetermination={hasDetermination}
        pending={pending}
        onCreate={(input, done) => run(() => createDetermination(input), done)}
      />

      {tab === "universal_waste" ? (
        <UniversalWasteTab {...props} approvedDeterminations={approvedDeterminations} pending={pending} run={run} />
      ) : (
        <NonhazRecyclingTab {...props} approvedDeterminations={approvedDeterminations} pending={pending} run={run} />
      )}
    </div>
  );
}

// ── Determination gate + create ─────────────────────────────────────────────────

function DeterminationSection({
  hasDetermination, pending, onCreate,
}: {
  hasDetermination: boolean;
  pending: boolean;
  onCreate: (
    input: { materialDescription: string; determinationResult: "hazardous" | "universal_waste" | "nonhazardous" | "excluded"; jurisdictionState: string; documentUrl?: string },
    done: () => void,
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [result, setResult] = useState<"hazardous" | "universal_waste" | "nonhazardous" | "excluded">("universal_waste");
  const [state, setState] = useState("WI");
  const [url, setUrl] = useState("");

  return (
    <div id="new-determination" className={`rounded-md border p-4 text-sm ${hasDetermination ? "border-slate-200 bg-slate-50" : "border-amber-400 bg-amber-50"}`}>
      {!hasDetermination ? (
        <p className="mb-2">
          <strong>You can&apos;t add anything to a recycling stream yet.</strong> A documented
          hazardous-waste determination must be on file first — this protects your organization from EPA violations.
        </p>
      ) : (
        <p className="mb-2 text-slate-600">
          A hazardous-waste determination is on file, so you can add tracked items and recycling records below.
          Add another determination any time a new material appears.
        </p>
      )}

      {!open ? (
        <button onClick={() => setOpen(true)} className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white">
          Start a determination
        </button>
      ) : (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="col-span-full text-xs font-medium text-slate-600">
            What material is this? <span className="font-normal text-slate-400">▾ pick or type</span>
            <ComboBox value={desc} onValueChange={setDesc} options={COMMON_WASTE_MATERIALS}
              placeholder="e.g. Spent AA batteries from packaging line" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Determination result
            <select value={result} onChange={(e) => setResult(e.target.value as typeof result)} className="mt-1 w-full rounded border px-2 py-1.5 text-sm">
              <option value="hazardous">Hazardous</option>
              <option value="universal_waste">Universal waste</option>
              <option value="nonhazardous">Nonhazardous</option>
              <option value="excluded">Excluded</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            State ▾
            <ComboBox value={state} onValueChange={(v) => setState(v.toUpperCase().slice(0, 2))}
              options={US_STATES} maxLength={2} placeholder="e.g. WI" />
          </label>
          <label className="col-span-full text-xs font-medium text-slate-600">
            Supporting document URL (optional)
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…"
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
          </label>
          <div className="col-span-full flex gap-2">
            <button
              disabled={pending || !desc.trim()}
              onClick={() =>
                onCreate(
                  { materialDescription: desc.trim(), determinationResult: result, jurisdictionState: state, documentUrl: url.trim() || undefined },
                  () => { setOpen(false); setDesc(""); setUrl(""); },
                )
              }
              className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save determination"}
            </button>
            <button onClick={() => setOpen(false)} className="rounded border px-3 py-1.5 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

type RunFn = (action: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) => void;

// ── Universal Waste tab ─────────────────────────────────────────────────────────

function UniversalWasteTab({
  uwItems, certificates, rejectedLoads, vendors, approvedDeterminations, pending, run,
}: Props & { approvedDeterminations: Determination[]; pending: boolean; run: RunFn }) {
  const certsByItem = useMemo(() => {
    const m = new Map<string, number>();
    certificates.forEach((c) => { if (c.universal_waste_item_id) m.set(c.universal_waste_item_id, (m.get(c.universal_waste_item_id) ?? 0) + 1); });
    return m;
  }, [certificates]);

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Universal Waste — batteries, lamps, mercury devices, aerosol cans, pesticides, e-waste, used oil, solvents.
        Each item starts a 1-year clock the day it begins accumulating.
      </p>

      <AddUwItemForm determinations={approvedDeterminations} pending={pending} run={run} />

      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h2 className="font-medium">Universal Waste Items</h2>
        </div>
        {uwItems.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            Nothing tracked yet — add your first Universal Waste Item above to start the clock.
          </p>
        ) : (
          <ul className="divide-y">
            {uwItems.map((item) => {
              const light = stoplightForDeadline(item.accumulation_deadline);
              const rejected = item.status === "rejected";
              const overLimit = exceedsQuantityLimit(item.quantity, item.quantity_limit);
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="font-medium">{CATEGORY_LABEL[item.category]}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">{item.jurisdiction_state}</span>
                  {item.quantity != null && (
                    <span className={`text-slate-500 ${overLimit ? "text-red-600 font-medium" : ""}`}>
                      {item.quantity} {item.quantity_uom ?? ""}{overLimit ? " ⚠ over limit" : ""}
                    </span>
                  )}
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STOPLIGHT_STYLE[light]}`}>
                    {rejected ? "Rejected" : countdownLabel(item.accumulation_deadline)}
                  </span>
                  {certsByItem.get(item.id) ? (
                    <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                      Certificate on file · retention {item.retention_period_years ?? 3} yr
                    </span>
                  ) : null}
                  <div className="ml-auto flex gap-2">
                    {!rejected && (
                      <>
                        <CertificateButton kind="uw" targetId={item.id} vendors={vendors} pending={pending} run={run} />
                        <RejectButton kind="uw" targetId={item.id} pending={pending} run={run} />
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <RejectedLoadsPanel rejectedLoads={rejectedLoads} scope="uw" pending={pending} run={run} />
      <VendorBadges vendors={vendors} />
    </div>
  );
}

function AddUwItemForm({ determinations, pending, run }: { determinations: Determination[]; pending: boolean; run: RunFn }) {
  const [open, setOpen] = useState(false);
  const [determinationId, setDeterminationId] = useState("");
  const [category, setCategory] = useState<UwCategory>("batteries");
  const [state, setState] = useState("WI");
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState("");
  const [quantityLimit, setQuantityLimit] = useState("");

  const disabled = determinations.length === 0;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? "Add an approved determination first" : undefined}
        className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        Add Universal Waste Item
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50/40 p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="col-span-full text-xs font-medium text-slate-600">
          Linked determination (required)
          <select value={determinationId} onChange={(e) => setDeterminationId(e.target.value)} className="mt-1 w-full rounded border px-2 py-1.5 text-sm">
            <option value="">Select a determination…</option>
            {determinations.map((d) => (
              <option key={d.id} value={d.id}>{d.material_description}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value as UwCategory)} className="mt-1 w-full rounded border px-2 py-1.5 text-sm">
            {UW_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          State ▾
          <ComboBox value={state} onValueChange={(v) => setState(v.toUpperCase().slice(0, 2))}
            options={US_STATES} maxLength={2} placeholder="e.g. WI" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Clock starts (accumulation start date)
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Quantity (optional)
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Quantity limit (optional — warns if exceeded)
          <input value={quantityLimit} onChange={(e) => setQuantityLimit(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          disabled={pending || !determinationId}
          onClick={() =>
            run(
              () => createUniversalWasteItem({
                determinationId,
                category,
                jurisdictionState: state,
                accumulationStartDate: start,
                quantity: quantity ? Number(quantity) : undefined,
                quantityLimit: quantityLimit ? Number(quantityLimit) : undefined,
              }),
              () => { setOpen(false); setQuantity(""); setQuantityLimit(""); },
            )
          }
          className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save item"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded border px-3 py-1.5 text-sm">Cancel</button>
      </div>
    </div>
  );
}

// ── Nonhazardous Recycling tab ──────────────────────────────────────────────────

function NonhazRecyclingTab({
  nonhazRecords, rejectedLoads, vendors, certificates, approvedDeterminations, pending, run,
}: Props & { approvedDeterminations: Determination[]; pending: boolean; run: RunFn }) {
  const totals = useMemo(() => {
    let recycled = 0, landfill = 0, costAvoided = 0, revenue = 0;
    nonhazRecords.forEach((r) => {
      recycled += r.weight_recycled ?? 0;
      landfill += r.weight_landfill ?? 0;
      costAvoided += r.cost_avoided ?? 0;
      revenue += r.revenue ?? 0;
    });
    return { rate: computeDiversionRate(recycled, landfill), costAvoided, revenue };
  }, [nonhazRecords]);

  const certsByRecord = useMemo(() => {
    const m = new Map<string, number>();
    certificates.forEach((c) => { if (c.nonhaz_recycling_record_id) m.set(c.nonhaz_recycling_record_id, (m.get(c.nonhaz_recycling_record_id) ?? 0) + 1); });
    return m;
  }, [certificates]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-green-200 bg-green-50/40 p-4">
          <h2 className="text-sm font-medium text-slate-600">Diversion Rate</h2>
          <p className="mt-1 text-3xl font-semibold text-green-700">{totals.rate == null ? "—" : `${totals.rate}%`}</p>
          <p className="mt-1 text-xs text-slate-500">{diversionSubtitle(totals.rate)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-medium text-slate-600">Cost avoided</h2>
          <p className="mt-1 text-2xl font-semibold">${totals.costAvoided.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-500">Landfill fees you didn&apos;t pay.</p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-medium text-slate-600">Recycling revenue</h2>
          <p className="mt-1 text-2xl font-semibold">${totals.revenue.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-500">Paid back for recycled material.</p>
        </div>
      </div>

      <AddNonhazForm determinations={approvedDeterminations} vendors={vendors} pending={pending} run={run} />

      <div className="rounded-lg border">
        <div className="border-b px-4 py-3"><h2 className="font-medium">Recycling Records</h2></div>
        {nonhazRecords.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            Nothing here yet — log your first weight ticket above to start tracking diversion.
          </p>
        ) : (
          <ul className="divide-y">
            {nonhazRecords.map((r) => {
              const rejected = r.status === "rejected";
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="font-medium">{r.material_category}</span>
                  <span className="text-slate-500">
                    {(r.weight_recycled ?? 0)} recycled / {(r.weight_landfill ?? 0)} landfill {r.weight_uom ?? "lbs"}
                  </span>
                  <span className="rounded-full border border-green-300 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                    {r.diversion_rate == null ? "—" : `${r.diversion_rate}% diverted`}
                  </span>
                  {rejected && <span className="rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Rejected</span>}
                  {certsByRecord.get(r.id) ? <span className="text-xs text-slate-500">Certificate on file</span> : null}
                  <div className="ml-auto flex gap-2">
                    {!rejected && (
                      <>
                        <CertificateButton kind="nonhaz" targetId={r.id} vendors={vendors} pending={pending} run={run} />
                        <RejectButton kind="nonhaz" targetId={r.id} pending={pending} run={run} />
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <RejectedLoadsPanel rejectedLoads={rejectedLoads} scope="nonhaz" pending={pending} run={run} />
    </div>
  );
}

function AddNonhazForm({ determinations, vendors, pending, run }: { determinations: Determination[]; vendors: VendorLite[]; pending: boolean; run: RunFn }) {
  const [open, setOpen] = useState(false);
  const [determinationId, setDeterminationId] = useState("");
  const [material, setMaterial] = useState("");
  const [recycled, setRecycled] = useState("");
  const [landfill, setLandfill] = useState("");
  const [costAvoided, setCostAvoided] = useState("");
  const [revenue, setRevenue] = useState("");
  const [vendorId, setVendorId] = useState("");

  const disabled = determinations.length === 0;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} disabled={disabled}
        title={disabled ? "Add an approved determination first" : undefined}
        className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
        Add Recycling Record
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50/40 p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="col-span-full text-xs font-medium text-slate-600">
          Linked determination (required)
          <select value={determinationId} onChange={(e) => setDeterminationId(e.target.value)} className="mt-1 w-full rounded border px-2 py-1.5 text-sm">
            <option value="">Select a determination…</option>
            {determinations.map((d) => <option key={d.id} value={d.id}>{d.material_description}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Material ▾ (e.g. cardboard, scrap metal)
          <ComboBox value={material} onValueChange={setMaterial} options={COMMON_RECYCLABLE_MATERIALS}
            placeholder="e.g. Cardboard / OCC" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Vendor (optional)
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="mt-1 w-full rounded border px-2 py-1.5 text-sm">
            <option value="">—</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Weight recycled (lbs)
          <input value={recycled} onChange={(e) => setRecycled(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Weight landfilled (lbs)
          <input value={landfill} onChange={(e) => setLandfill(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Cost avoided ($, optional)
          <input value={costAvoided} onChange={(e) => setCostAvoided(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Revenue ($, optional)
          <input value={revenue} onChange={(e) => setRevenue(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          disabled={pending || !determinationId || !material.trim()}
          onClick={() =>
            run(
              () => createNonhazRecyclingRecord({
                determinationId,
                materialCategory: material.trim(),
                weightRecycled: recycled ? Number(recycled) : undefined,
                weightLandfill: landfill ? Number(landfill) : undefined,
                costAvoided: costAvoided ? Number(costAvoided) : undefined,
                revenue: revenue ? Number(revenue) : undefined,
                vendorId: vendorId || undefined,
              }),
              () => { setOpen(false); setMaterial(""); setRecycled(""); setLandfill(""); setCostAvoided(""); setRevenue(""); },
            )
          }
          className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save record"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded border px-3 py-1.5 text-sm">Cancel</button>
      </div>
    </div>
  );
}

// ── Shared action buttons ───────────────────────────────────────────────────────

function CertificateButton({ kind, targetId, vendors, pending, run }: { kind: "uw" | "nonhaz"; targetId: string; vendors: VendorLite[]; pending: boolean; run: RunFn }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"recycling" | "reclamation" | "destruction">("recycling");
  const [issued, setIssued] = useState(() => new Date().toISOString().slice(0, 10));
  const [url, setUrl] = useState("");
  const [vendorId, setVendorId] = useState("");

  if (!open) return <button onClick={() => setOpen(true)} className="rounded border px-2 py-1 text-xs">Add certificate</button>;

  return (
    <div className="w-full rounded border bg-white p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-600">
          Type
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="mt-1 w-full rounded border px-2 py-1 text-sm">
            <option value="recycling">Recycling</option>
            <option value="reclamation">Reclamation</option>
            <option value="destruction">Destruction</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Vendor
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="mt-1 w-full rounded border px-2 py-1 text-sm">
            <option value="">—</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Issued date
          <input type="date" value={issued} onChange={(e) => setIssued(e.target.value)} className="mt-1 w-full rounded border px-2 py-1 text-sm" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Certificate document URL
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="mt-1 w-full rounded border px-2 py-1 text-sm" />
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-500">Chain-of-custody and retention period fill in automatically from this certificate.</p>
      <div className="mt-2 flex gap-2">
        <button
          disabled={pending || !url.trim()}
          onClick={() =>
            run(
              () => createRecyclingCertificate({
                universalWasteItemId: kind === "uw" ? targetId : undefined,
                nonhazRecyclingRecordId: kind === "nonhaz" ? targetId : undefined,
                certificateType: type,
                vendorId: vendorId || undefined,
                issuedDate: issued,
                documentUrl: url.trim(),
              }),
              () => setOpen(false),
            )
          }
          className="rounded bg-slate-800 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save certificate"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded border px-3 py-1 text-xs">Cancel</button>
      </div>
    </div>
  );
}

function RejectButton({ kind, targetId, pending, run }: { kind: "uw" | "nonhaz"; targetId: string; pending: boolean; run: RunFn }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <button onClick={() => setOpen(true)} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700">Mark rejected</button>;
  return (
    <div className="w-full rounded border border-red-300 bg-red-50 p-3">
      <label className="text-xs font-medium text-slate-600">
        Why was this load rejected? ▾
        <ComboBox value={reason} onValueChange={setReason} options={COMMON_REJECT_REASONS}
          className="mt-1 w-full rounded border px-2 py-1 text-sm" placeholder="Pick a reason or type your own…" />
      </label>
      <div className="mt-2 flex gap-2">
        <button
          disabled={pending || !reason.trim()}
          onClick={() =>
            run(
              () => markLoadRejected({
                universalWasteItemId: kind === "uw" ? targetId : undefined,
                nonhazRecyclingRecordId: kind === "nonhaz" ? targetId : undefined,
                reason: reason.trim(),
              }),
              () => setOpen(false),
            )
          }
          className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {pending ? "Flagging…" : "Confirm rejection"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded border px-3 py-1 text-xs">Cancel</button>
      </div>
    </div>
  );
}

function RejectedLoadsPanel({ rejectedLoads, scope, pending, run }: { rejectedLoads: RejectedLoad[]; scope: "uw" | "nonhaz"; pending: boolean; run: RunFn }) {
  const relevant = rejectedLoads.filter((r) => (scope === "uw" ? r.universal_waste_item_id : r.nonhaz_recycling_record_id));
  if (relevant.length === 0) return null;
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-4">
      <h2 className="flex items-center gap-2 font-medium text-red-800">
        <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{relevant.length}</span>
        Rejected loads — waste coordinator action needed
      </h2>
      <p className="mt-1 text-xs text-red-700">These are blocked from further processing until you record what happened next.</p>
      <ul className="mt-3 space-y-2">
        {relevant.map((r) => (
          <li key={r.id} className="rounded border border-red-200 bg-white p-3 text-sm">
            <p className="text-slate-700">{r.rejected_reason}</p>
            <div className="mt-2 flex gap-2">
              {(["recertified", "disposed", "rerouted"] as const).map((action) => (
                <button
                  key={action}
                  disabled={pending}
                  onClick={() => run(() => resolveRejectedLoad({ rejectedLoadId: r.id, resolutionAction: action }))}
                  className="rounded border px-2 py-1 text-xs capitalize disabled:opacity-50"
                >
                  {action}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VendorBadges({ vendors }: { vendors: VendorLite[] }) {
  if (vendors.length === 0) return null;
  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-3"><h2 className="font-medium">Vendor status</h2></div>
      <ul className="divide-y">
        {vendors.map((v) => {
          const badge = getVendorStatusBadge(v.permit_expiry, v.insurance_expiry, v.recycler_authorization_expiry);
          return (
            <li key={v.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="font-medium">{v.name}</span>
              <span className={`ml-auto rounded-full border px-2 py-0.5 text-xs font-medium ${VENDOR_STYLE[badge]}`}>
                {VENDOR_LABEL[badge]}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
